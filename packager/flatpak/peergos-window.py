#!/usr/bin/env python3
"""Peergos desktop window for the Linux flatpak.

A GTK4 window holding a WebKitGTK view of the local Peergos server, plus a tray
icon showing the global sync status. Both the browser engine and the GTK/Python
bindings come from org.gnome.Platform, so the engine is patched by flatpak
update rather than by us shipping a new build.

The tray speaks the StatusNotifierItem D-Bus protocol directly instead of using
libayatana-appindicator: that library is GTK3 only, and GTK3 and GTK4 cannot be
loaded into one process. Talking to the bus needs nothing beyond GLib.

Closing the window hides it to the tray, leaving the server running and syncing;
"Close Peergos" in the tray menu quits, exiting 0 so the Java server shuts down.
If no StatusNotifierWatcher is on the bus (stock GNOME without the AppIndicator
extension) there is no tray to reopen from, so closing the window quits as it
did before - otherwise the user is left with an invisible server they can't get
back to.

Downloads save straight to the XDG download directory rather than prompting, as
chromium --app did here before. GTK4's file dialogs are async only, and
WebKitDownload needs its destination synchronously.
"""

import base64
import json
import math
import os
import sys
import threading
import time
import urllib.request
import zlib
from pathlib import Path

import gi

gi.require_version("Gdk", "4.0")
gi.require_version("Gtk", "4.0")
gi.require_version("Soup", "3.0")
gi.require_version("WebKit", "6.0")

from gi.repository import Gdk, Gio, GLib, Gtk, Soup, WebKit

APP_ID = "org.peergos.Peergos"
POLL_SECONDS = 10
STATUS_TIMEOUT_S = 5

ICON_SIZE = 44
DOT_RADIUS = 10.0
# The dot is a badge on the constant Peergos icon: with no sync pairs there is
# no dot, but the icon itself must stay, since it is the only way back into a
# hidden window and the only way to quit.
DOT_COLOURS = {
    "SYNCED": (0x2E, 0xA0, 0x43),
    "SYNCING": (0xDB, 0x8A, 0x0F),
    "ERROR": (0xDA, 0x36, 0x33),
}

# peergos.svg, rendered to 44x44 RGBA, deflated. Kept inline rather than loaded
# from the installed icon because GdkPixbuf in this runtime hands decoding to
# glycin, which spawns a sandboxed loader over D-Bus - a lot of moving parts
# between us and an icon that must never fail to appear. Regenerate with
# `./peergos-window.py --render-icon` after changing peergos.svg.
LOGO = (
    "eNrtmM9v0zAUxwfih8QPCXEDAYuTNNU0iQvSuCJxh78AbggOXDjANUiUbmOpGC1tZ6c0rHSjHdAOytoksFVCCC5c4Qr/ALtO"
    "4lBjO0q2TCDSbKuH5Cc91c+xo0+/eX52MjQkTJgwYdtsur53dGHhwIWuvo/FGO+h8bkvcL8/hLZpH71GYzqWxWTuoHETLryu"
    "OQhrjtkZ7eaPaHZpzIvRKo1ZH2mzPnLNi80Ojelcfrz9u+D9t8mtxxeVmvFeqRvLfTmZQ+fyWHLAundNKqd6xHFE74Fy6ibP"
    "MiFXxm+B6uSHKE7H8i5rmm1ejZy7NrrCmzfpwjuR15lj3uavL8pE1tc1De76OuZcdH1Rlbu+DloJMb3JY6WewXLdwGorv5l5"
    "eRfwfvN5VMpaM8i6gszl51NhZhd93QW8qz4P42tk2S9rv5r2+Nf1/cmTVW1nDxKGns8DZtOY1FmsLuaYg2cTGDxNb+Tt0Tm8"
    "eEeWSsNB3rYKWCK8LBd8vvYMlqz7OPG2EPTJ7+AZXrwJB54PcrcxjeX5Ka/dzGKlmfM0r06Q+NGGPaM0xq2W2eblgJc8f2l2"
    "nO5hTM/EUhFrHcjyQX2dC3iTLrrETV8b3Qh0I2w0H8D8A5IbeVYrwNwkBhXvP/A8S67XBng3VHuJpvT5++cxuvaYzqEabOrc"
    "9HVR8Y/7WLtIfOZvZ4gCx9rbjPF+0eDI+7lfXnLe+MSN10U/Yuj7naO+azF41wbNeaqkHx+2Ui+Blf4Vx+lceo9BsEpd65jy"
    "4uGiUsusbMnJPZIfnxzdaV7FKZ+O+91hs4/Y8ITgDdtZp3KY7qnb4Sdb8JD4cCpMmDBh/4f9BlC43ow="
)

# Nothing on a WebKitFileChooserRequest says whether the page wants a directory,
# so note which kind of input was clicked and ask the page when the request comes.
FILE_INPUT_KIND = """
(function () {
  document.addEventListener('click', event => {
    const target = event.target;
    if (target && target.tagName === 'INPUT' && target.type === 'file')
      window.__peergosDirectoryUpload = target.hasAttribute('webkitdirectory')
          || target.hasAttribute('directory') || !!target.webkitdirectory;
  }, true);
})();
"""

# WebKitGTK stopped handing dropped files to web content in 2.50.3, as the fix for
# CVE-2025-13947: a page now gets the file names but never the contents. So the host
# takes the drop itself and hands the page file shaped objects that read through us.
# They are lazy - each slice is fetched when read - so dropping a huge file is fine.
DROP_SHIM = """
window.__peergosDrop = (function () {
  function read(id, from, to) {
    // an in process scheme served by the host: a script message reply cannot
    // carry an ArrayBuffer into the page, and this needs no copying
    return fetch('peergos-drop:/' + id + '/' + from + '-' + to)
        .then(function (response) { return response.arrayBuffer(); });
  }

  // a Blob shaped view of part of a file, which is all the uploader needs
  function part(spec, from, to) {
    var length = to - from;
    return {
      size: length,
      type: spec.type,
      slice: function (start, end) {
        start = start === undefined ? 0 : (start < 0 ? Math.max(0, length + start) : Math.min(start, length));
        end = end === undefined ? length : (end < 0 ? Math.max(0, length + end) : Math.min(end, length));
        return part(spec, from + start, from + Math.max(start, end));
      },
      arrayBuffer: function () { return read(spec.id, from, to); },
      text: function () {
        return this.arrayBuffer().then(function (b) { return new TextDecoder().decode(b); });
      }
    };
  }

  function fileFor(spec) {
    var file = part(spec, 0, spec.size);
    file.name = spec.name;
    file.lastModified = spec.lastModified || Date.now();
    file.webkitRelativePath = '';
    return file;
  }

  // the entries api, which is what the drive's drop handler walks
  function entryFor(spec) {
    if (spec.kind === 'file') {
      var file = fileFor(spec);
      return {isFile: true, isDirectory: false, name: spec.name, fullPath: spec.fullPath,
              file: function (callback) { callback(file); }, _file: file};
    }
    var children = spec.children.map(entryFor);
    return {isFile: false, isDirectory: true, name: spec.name, fullPath: spec.fullPath,
            _children: children,
            createReader: function () {
              var served = false;
              return {readEntries: function (callback) {
                var batch = served ? [] : children;   // an empty batch ends the walk
                served = true;
                callback(batch);
              }};
            }};
  }

  function filesIn(entries, found) {
    entries.forEach(function (entry) {
      if (entry.isFile) found.push(entry._file);
      else filesIn(entry._children, found);
    });
    return found;
  }

  function transferFor(entries) {
    return {
      types: ['Files'],
      files: filesIn(entries, []),
      items: entries.map(function (entry) {
        return {kind: 'file', type: entry._file ? entry._file.type : '',
                getAsFile: function () { return entry._file || null; },
                webkitGetAsEntry: function () { return entry; }};
      }),
      dropEffect: 'copy',
      effectAllowed: 'all',
      getData: function () { return ''; }
    };
  }

  // A real DragEvent only accepts a real DataTransfer, which cannot hold our lazy
  // files, so carry ours on a plain event instead. Handlers read it just the same.
  function dispatch(type, x, y, transfer) {
    var target = document.elementFromPoint(x, y) || document.body;
    var event = new Event(type, {bubbles: true, cancelable: true});
    Object.defineProperty(event, 'dataTransfer', {value: transfer});
    Object.defineProperty(event, 'clientX', {value: x});
    Object.defineProperty(event, 'clientY', {value: y});
    target.dispatchEvent(event);
    return target;
  }

  var empty = {types: ['Files'], files: [], items: [], dropEffect: 'copy',
               effectAllowed: 'all', getData: function () { return ''; }};
  var over = null;

  return {
    // the page sees no real drag, so keep its highlighting alive by hand
    hover: function (x, y) {
      var target = dispatch('dragover', x, y, empty);
      if (over && over !== target)
        dispatch('dragleave', x, y, empty);
      over = target;
    },
    leave: function (x, y) {
      dispatch('dragleave', x, y, empty);
      over = null;
    },
    deliver: function (payload) {
      var entries = payload.entries.map(entryFor);
      var transfer = transferFor(entries);
      dispatch('dragover', payload.x, payload.y, transfer);
      dispatch('drop', payload.x, payload.y, transfer);
      over = null;
    }
  };
})();
"""

DROP_SCHEME = "peergos-drop"

WATCHER_NAME = "org.kde.StatusNotifierWatcher"
WATCHER_PATH = "/StatusNotifierWatcher"
SNI_IFACE = "org.kde.StatusNotifierItem"
SNI_PATH = "/StatusNotifierItem"
MENU_IFACE = "com.canonical.dbusmenu"
MENU_PATH = "/MenuBar"

# Menu item ids. 0 is the root the layout hangs off.
ITEM_STATUS = 1
ITEM_SEPARATOR = 2
ITEM_QUIT = 3

SNI_XML = """
<node>
  <interface name='org.kde.StatusNotifierItem'>
    <property name='Category' type='s' access='read'/>
    <property name='Id' type='s' access='read'/>
    <property name='Title' type='s' access='read'/>
    <property name='Status' type='s' access='read'/>
    <property name='IconName' type='s' access='read'/>
    <property name='IconPixmap' type='a(iiay)' access='read'/>
    <property name='ItemIsMenu' type='b' access='read'/>
    <property name='Menu' type='o' access='read'/>
    <property name='ToolTip' type='(sa(iiay)ss)' access='read'/>
    <method name='Activate'>
      <arg name='x' type='i' direction='in'/>
      <arg name='y' type='i' direction='in'/>
    </method>
    <method name='SecondaryActivate'>
      <arg name='x' type='i' direction='in'/>
      <arg name='y' type='i' direction='in'/>
    </method>
    <method name='ContextMenu'>
      <arg name='x' type='i' direction='in'/>
      <arg name='y' type='i' direction='in'/>
    </method>
    <method name='Scroll'>
      <arg name='delta' type='i' direction='in'/>
      <arg name='orientation' type='s' direction='in'/>
    </method>
    <signal name='NewIcon'/>
    <signal name='NewToolTip'/>
    <signal name='NewStatus'>
      <arg name='status' type='s'/>
    </signal>
  </interface>
</node>
"""

MENU_XML = """
<node>
  <interface name='com.canonical.dbusmenu'>
    <property name='Version' type='u' access='read'/>
    <property name='Status' type='s' access='read'/>
    <property name='TextDirection' type='s' access='read'/>
    <property name='IconThemePath' type='as' access='read'/>
    <method name='GetLayout'>
      <arg name='parentId' type='i' direction='in'/>
      <arg name='recursionDepth' type='i' direction='in'/>
      <arg name='propertyNames' type='as' direction='in'/>
      <arg name='revision' type='u' direction='out'/>
      <arg name='layout' type='(ia{sv}av)' direction='out'/>
    </method>
    <method name='GetGroupProperties'>
      <arg name='ids' type='ai' direction='in'/>
      <arg name='propertyNames' type='as' direction='in'/>
      <arg name='properties' type='a(ia{sv})' direction='out'/>
    </method>
    <method name='GetProperty'>
      <arg name='id' type='i' direction='in'/>
      <arg name='name' type='s' direction='in'/>
      <arg name='value' type='v' direction='out'/>
    </method>
    <method name='Event'>
      <arg name='id' type='i' direction='in'/>
      <arg name='eventId' type='s' direction='in'/>
      <arg name='data' type='v' direction='in'/>
      <arg name='timestamp' type='u' direction='in'/>
    </method>
    <method name='EventGroup'>
      <arg name='events' type='a(isvu)' direction='in'/>
      <arg name='idErrors' type='ai' direction='out'/>
    </method>
    <method name='AboutToShow'>
      <arg name='id' type='i' direction='in'/>
      <arg name='needUpdate' type='b' direction='out'/>
    </method>
    <signal name='ItemsPropertiesUpdated'>
      <arg name='updatedProps' type='a(ia{sv})'/>
      <arg name='removedProps' type='a(ias)'/>
    </signal>
    <signal name='LayoutUpdated'>
      <arg name='revision' type='u'/>
      <arg name='parent' type='i'/>
    </signal>
  </interface>
</node>
"""


def render_icon(state):
    """The tray icon for a sync state, as (width, height, ARGB32 bytes)."""
    pixels = _base_pixels()
    colour = DOT_COLOURS.get(state)
    if colour is not None:
        _draw_dot(pixels, colour)
    argb = bytearray(len(pixels))
    argb[0::4] = pixels[3::4]
    argb[1::4] = pixels[0::4]
    argb[2::4] = pixels[1::4]
    argb[3::4] = pixels[2::4]
    return ICON_SIZE, ICON_SIZE, bytes(argb)


def _base_pixels():
    """The Peergos logo as a flat RGBA buffer."""
    return bytearray(zlib.decompress(base64.b64decode(LOGO)))


def _draw_dot(pixels, colour):
    """Blend an antialiased dot, ringed in white for contrast, into the corner."""
    centre = ICON_SIZE - DOT_RADIUS - 1
    lo = max(0, int(centre - DOT_RADIUS - 1))
    hi = min(ICON_SIZE, int(centre + DOT_RADIUS + 2))
    for y in range(lo, hi):
        for x in range(lo, hi):
            distance = math.hypot(x - centre, y - centre)
            outer = min(1.0, max(0.0, DOT_RADIUS - distance + 0.5))
            if outer <= 0.0:
                continue
            inner = min(1.0, max(0.0, DOT_RADIUS * 0.72 - distance + 0.5))
            i = (y * ICON_SIZE + x) * 4
            for channel in range(3):
                ring = 0xFF * (1.0 - inner) + colour[channel] * inner
                pixels[i + channel] = int(pixels[i + channel] * (1.0 - outer) + ring * outer)
            pixels[i + 3] = int(pixels[i + 3] * (1.0 - outer) + 0xFF * outer)


class Tray:
    """A StatusNotifierItem showing the global sync state, with a menu of the
    status line and Close Peergos. `available` is false until a watcher has
    accepted our registration - the window uses it to decide whether hiding on
    close is safe."""

    def __init__(self, connection, on_activate, on_quit):
        self.connection = connection
        self.on_activate = on_activate
        self.on_quit = on_quit
        self.available = False
        self.state = "NONE"
        self.message = "Peergos"
        self.revision = 1
        self._icon = render_icon(self.state)

        # register_object is deprecated in the runtime's pygobject but is all
        # older ones have, and this file is handy to run outside the flatpak.
        register = getattr(connection, "register_object_with_closures2", connection.register_object)
        register(SNI_PATH, _iface(SNI_XML), self._on_sni_call, self._on_sni_get, None)
        register(MENU_PATH, _iface(MENU_XML), self._on_menu_call, self._on_menu_get, None)
        # Watching rather than calling once picks up a shell restart, and tells
        # us there is no tray at all on a desktop without one.
        Gio.bus_watch_name_on_connection(connection, WATCHER_NAME, Gio.BusNameWatcherFlags.NONE,
                                         self._on_watcher_appeared, self._on_watcher_vanished)

    def set_status(self, state, message):
        if message and message != self.message:
            self.message = message
            self._emit(SNI_IFACE, "NewToolTip", None)
            self._emit(MENU_IFACE, "ItemsPropertiesUpdated",
                       GLib.Variant("(a(ia{sv})a(ias))", ([(ITEM_STATUS, self._status_props())], [])))
        if state != self.state:
            self.state = state
            self._icon = render_icon(state)
            self._emit(SNI_IFACE, "NewIcon", None)

    def _on_watcher_appeared(self, connection, name, owner):
        connection.call(owner, WATCHER_PATH, WATCHER_NAME, "RegisterStatusNotifierItem",
                        GLib.Variant("(s)", (connection.get_unique_name(),)), None,
                        Gio.DBusCallFlags.NONE, 5000, None, self._on_registered)

    def _on_registered(self, connection, result, *user_data):
        try:
            connection.call_finish(result)
            self.available = True
        except GLib.Error as e:
            print("Peergos: could not register tray icon: " + e.message, file=sys.stderr)

    def _on_watcher_vanished(self, connection, name):
        self.available = False

    def _emit(self, interface, signal, args):
        path = SNI_PATH if interface == SNI_IFACE else MENU_PATH
        self.connection.emit_signal(None, path, interface, signal, args)

    def _on_sni_call(self, connection, sender, path, interface, method, params, invocation):
        if method in ("Activate", "SecondaryActivate"):
            self.on_activate()
        invocation.return_value(None)

    def _on_sni_get(self, connection, sender, path, interface, name):
        if name == "Category":
            return GLib.Variant("s", "ApplicationStatus")
        if name == "Id":
            return GLib.Variant("s", "peergos")
        if name == "Title":
            return GLib.Variant("s", "Peergos")
        if name == "Status":
            return GLib.Variant("s", "Active")
        if name == "IconName":
            return GLib.Variant("s", "")
        if name == "IconPixmap":
            return GLib.Variant("a(iiay)", [self._icon])
        if name == "ItemIsMenu":
            return GLib.Variant("b", False)
        if name == "Menu":
            return GLib.Variant("o", MENU_PATH)
        if name == "ToolTip":
            return GLib.Variant("(sa(iiay)ss)", ("", [self._icon], "Peergos", self.message))
        return None

    def _status_props(self):
        # Informational only, so it is shown disabled.
        return {"label": GLib.Variant("s", self.message.replace("_", "__")),
                "enabled": GLib.Variant("b", False)}

    def _props(self, item_id):
        if item_id == ITEM_STATUS:
            return self._status_props()
        if item_id == ITEM_SEPARATOR:
            return {"type": GLib.Variant("s", "separator")}
        if item_id == ITEM_QUIT:
            return {"label": GLib.Variant("s", "Close Peergos")}
        return {}

    def _layout(self, item_id, depth):
        children = []
        if item_id == 0 and depth != 0:
            children = [self._layout(child, 0) for child in (ITEM_STATUS, ITEM_SEPARATOR, ITEM_QUIT)]
        return GLib.Variant("(ia{sv}av)", (item_id, self._props(item_id), children))

    def _on_menu_call(self, connection, sender, path, interface, method, params, invocation):
        if method == "GetLayout":
            parent, depth = params[0], params[1]
            invocation.return_value(GLib.Variant.new_tuple(GLib.Variant("u", self.revision),
                                                           self._layout(parent, depth)))
        elif method == "GetGroupProperties":
            ids = params[0] or [ITEM_STATUS, ITEM_SEPARATOR, ITEM_QUIT]
            invocation.return_value(GLib.Variant("(a(ia{sv}))", ([(i, self._props(i)) for i in ids],)))
        elif method == "GetProperty":
            value = self._props(params[0]).get(params[1], GLib.Variant("s", ""))
            invocation.return_value(GLib.Variant.new_tuple(GLib.Variant("v", value)))
        elif method == "Event":
            if params[0] == ITEM_QUIT and params[1] == "clicked":
                self.on_quit()
            invocation.return_value(None)
        elif method == "EventGroup":
            for item_id, event, _data, _time in params[0]:
                if item_id == ITEM_QUIT and event == "clicked":
                    self.on_quit()
            invocation.return_value(GLib.Variant("(ai)", ([],)))
        elif method == "AboutToShow":
            invocation.return_value(GLib.Variant("(b)", (False,)))
        else:
            invocation.return_value(None)

    def _on_menu_get(self, connection, sender, path, interface, name):
        if name == "Version":
            return GLib.Variant("u", 3)
        if name == "Status":
            return GLib.Variant("s", "normal")
        if name == "TextDirection":
            return GLib.Variant("s", "ltr")
        if name == "IconThemePath":
            return GLib.Variant("as", [])
        return None


def _iface(xml):
    return Gio.DBusNodeInfo.new_for_xml(xml).interfaces[0]


class PeergosWindow(Gtk.ApplicationWindow):

    def __init__(self, app, port):
        super().__init__(application=app, title="Peergos", default_width=1280, default_height=900)
        # names the icon the taskbar and window list show, looked up in the icon
        # theme - /app/share/icons/.../org.peergos.Peergos.svg, which the flatpak
        # installs and puts on XDG_DATA_DIRS.
        self.set_icon_name(APP_ID)
        self.dropped = {}          # id -> path, for the files of the current drop
        self.last_hover = 0.0

        content = WebKit.UserContentManager()
        content.add_script(WebKit.UserScript.new(FILE_INPUT_KIND,
                                                 WebKit.UserContentInjectedFrames.ALL_FRAMES,
                                                 WebKit.UserScriptInjectionTime.START, None, None))
        content.add_script(WebKit.UserScript.new(DROP_SHIM,
                                                 WebKit.UserContentInjectedFrames.TOP_FRAME,
                                                 WebKit.UserScriptInjectionTime.START, None, None))
        context = WebKit.WebContext.get_default()
        context.register_uri_scheme(DROP_SCHEME, self._serve_drop_range)
        context.get_security_manager().register_uri_scheme_as_cors_enabled(DROP_SCHEME)
        self.webview = WebKit.WebView(user_content_manager=content)
        self._take_over_drops()
        # the web inspector: right click > Inspect Element, or Ctrl+Shift+I.
        # chromium --app had one, and it is off by default here.
        self.webview.get_settings().set_enable_developer_extras(True)
        # It cannot dock into this window - the webview is the whole of it - and
        # webkit docks it regardless, leaving a blank window. Give it its own.
        inspector = self.webview.get_inspector()
        inspector.connect("attach", self._show_inspector)
        inspector.connect("open-window", self._show_inspector)
        self.set_child(self.webview)
        self.webview.connect("decide-policy", self._on_decide_policy)
        self.webview.connect("create", self._on_create)
        self.webview.connect("permission-request", self._on_permission)
        self.webview.connect("run-file-chooser", self._on_file_chooser)
        self.webview.get_network_session().connect("download-started", self._on_download_started)
        self.webview.load_uri("http://localhost:" + port)

    def _on_decide_policy(self, webview, decision, decision_type):
        if decision_type == WebKit.PolicyDecisionType.RESPONSE and not decision.is_mime_type_supported():
            decision.download()
            return True
        return False

    def _take_over_drops(self):
        # Ours only claims a list of files, so gtk hands it the drops from the
        # desktop and leaves everything else - notably dragging within the page -
        # to webkit's own target, which stays where it is.
        drops = Gtk.DropTarget.new(Gdk.FileList, Gdk.DragAction.COPY)
        drops.connect("motion", self._on_drop_motion)
        drops.connect("leave", self._on_drop_leave)
        drops.connect("drop", self._on_drop)
        self.webview.add_controller(drops)

    def _on_drop_motion(self, target, x, y):
        now = time.monotonic()
        if now - self.last_hover > 0.1:   # the page only needs enough to highlight
            self.last_hover = now
            self._run_js("window.__peergosDrop.hover(%d, %d)" % (x, y))
        return Gdk.DragAction.COPY

    def _on_drop_leave(self, target):
        self._run_js("window.__peergosDrop.leave(0, 0)")

    def _on_drop(self, target, files, x, y):
        self.dropped = {}
        try:
            entries = [self._describe(Path(f.get_path()), "")
                       for f in files.get_files() if f.get_path() is not None]
        except OSError as e:
            print("Peergos: could not read the dropped files: " + str(e), file=sys.stderr)
            return False
        self._run_js("window.__peergosDrop.deliver(%s)"
                     % json.dumps({"x": x, "y": y, "entries": entries}))
        return True

    def _describe(self, path, parent):
        """What the page needs to build a file, or a directory of them."""
        full = parent + "/" + path.name
        if path.is_dir():
            children = []
            for child in sorted(path.iterdir(), key=lambda p: p.name):
                try:
                    children.append(self._describe(child, full))
                except OSError:
                    pass  # unreadable child, skip it rather than lose the drop
            return {"kind": "directory", "name": path.name, "fullPath": full, "children": children}
        identifier = str(len(self.dropped))
        self.dropped[identifier] = str(path)
        info = path.stat()
        return {"kind": "file", "id": identifier, "name": path.name, "fullPath": full,
                "size": info.st_size, "type": Gio.content_type_guess(str(path), None)[0],
                "lastModified": int(info.st_mtime * 1000)}

    def _serve_drop_range(self, request):
        """One slice of a dropped file. Nothing else can ask: the ids only exist
        for the current drop, and the scheme is only served inside this window."""
        try:
            path, span = request.get_uri().split(":", 1)[1].lstrip("/").split("/", 1)
            start, end = (int(value) for value in span.split("-"))
            with open(self.dropped[path], "rb") as source:
                source.seek(start)
                data = source.read(max(0, end - start))
            response = WebKit.URISchemeResponse.new(
                Gio.MemoryInputStream.new_from_bytes(GLib.Bytes.new(data)), len(data))
            response.set_content_type("application/octet-stream")
            # the page is http://localhost, so this is cross origin and needs saying so
            headers = Soup.MessageHeaders.new(Soup.MessageHeadersType.RESPONSE)
            headers.append("Access-Control-Allow-Origin", "*")
            # the page sets Cross-Origin-Embedder-Policy: require-corp, so every
            # cross origin resource it loads has to opt in explicitly
            headers.append("Cross-Origin-Resource-Policy", "cross-origin")
            response.set_http_headers(headers)
            request.finish_with_response(response)
        except Exception as e:
            request.finish_error(GLib.Error(str(e)))

    def _run_js(self, script):
        self.webview.evaluate_javascript(script, -1, None, None, None, None, None)

    def _show_inspector(self, inspector):
        view = inspector.get_web_view()
        if view.get_parent() is None:
            window = Gtk.Window(title="Web Inspector", default_width=1100, default_height=750)
            window.set_child(view)
            window.present()
        return True

    def _on_create(self, webview, navigation_action):
        # A link that wants a new window - anything target=_blank. There is no
        # default for this, so without it such links silently do nothing. We don't
        # want a second webview, so hand the address to the user's browser.
        uri = navigation_action.get_request().get_uri()
        Gtk.UriLauncher(uri=uri).launch(self, None, None, None)
        return None

    def _on_permission(self, webview, request):
        # WebKit refuses every permission unless we answer. The camera is the one
        # the UI needs, for scanning QR codes, and it is worth asking about.
        if not isinstance(request, WebKit.UserMediaPermissionRequest) \
                or not request.get_property("is-for-video-device"):
            request.deny()
            return True
        dialog = Gtk.AlertDialog(message="Allow Peergos to use the camera?",
                                 detail="Peergos uses the camera to scan QR codes.",
                                 buttons=["Deny", "Allow"],
                                 cancel_button=0,
                                 default_button=1)
        dialog.choose(self, None, self._on_camera_answer, request)
        return True

    def _on_camera_answer(self, dialog, result, request):
        allowed = False
        try:
            allowed = dialog.choose_finish(result) == 1
        except GLib.Error:
            pass  # dismissed
        if allowed:
            request.allow()
        else:
            request.deny()

    def _on_file_chooser(self, webview, request):
        webview.evaluate_javascript("!!window.__peergosDirectoryUpload", -1, None, None, None,
                                    self._on_upload_kind, request)
        return True

    def _on_upload_kind(self, webview, result, request):
        directory = False
        try:
            directory = webview.evaluate_javascript_finish(result).to_boolean()
        except GLib.Error:
            pass
        dialog = Gtk.FileDialog()
        if directory:
            dialog.select_folder(self, None, self._on_folder_chosen, request)
        elif request.get_select_multiple():
            dialog.open_multiple(self, None, self._on_files_chosen, request)
        else:
            dialog.open(self, None, self._on_file_chosen, request)

    def _on_folder_chosen(self, dialog, result, request):
        try:
            # webkit expands the directory itself, filling in webkitRelativePath
            request.select_files([dialog.select_folder_finish(result).get_path()])
        except GLib.Error:
            request.cancel()

    def _on_file_chosen(self, dialog, result, request):
        try:
            request.select_files([dialog.open_finish(result).get_path()])
        except GLib.Error:
            request.cancel()

    def _on_files_chosen(self, dialog, result, request):
        try:
            files = dialog.open_multiple_finish(result)
            request.select_files([files.get_item(i).get_path() for i in range(files.get_n_items())])
        except GLib.Error:
            request.cancel()

    def _on_download_started(self, session, download):
        download.connect("decide-destination", self._on_decide_destination)

    def _on_decide_destination(self, download, suggested_name):
        download.set_destination(_unused_path(_download_dir(), suggested_name or "download"))
        return True


def _download_dir():
    """Where downloads go. GLib's special dirs come from ~/.config/user-dirs.dirs,
    which a sandbox can't always read - falling back to $HOME would drop files in
    the top of the user's home, so try the conventional path first."""
    home = GLib.get_home_dir()
    for candidate in (os.environ.get("XDG_DOWNLOAD_DIR"),
                      GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOWNLOAD),
                      os.path.join(home, "Downloads")):
        if candidate and os.path.isdir(candidate):
            return candidate
    return home


def _unused_path(directory, name):
    """A path under directory that no file has yet, as name, name-1, name-2..."""
    stem, extension = os.path.splitext(name)
    candidate = os.path.join(directory, name)
    attempt = 0
    while os.path.exists(candidate):
        attempt += 1
        candidate = os.path.join(directory, stem + "-" + str(attempt) + extension)
    return candidate


class StatusPoller:
    """Polls the server's sync status onto the tray. The sync loop only runs
    every 30s, so a ~10s poll is plenty."""

    def __init__(self, port, tray):
        self.url = "http://localhost:" + port + "/peergos/v0/sync/status"
        self.tray = tray

    def start(self):
        GLib.timeout_add_seconds(POLL_SECONDS, self._tick)
        self._tick()

    def _tick(self):
        threading.Thread(target=self._fetch, daemon=True).start()
        return GLib.SOURCE_CONTINUE

    def _fetch(self):
        # An unreachable server is red: it should be there and isn't.
        state, message = "ERROR", "Cannot reach Peergos"
        try:
            # the localhost API only answers POST - a GET is a 405
            request = urllib.request.Request(self.url, method="POST")
            with urllib.request.urlopen(request, timeout=STATUS_TIMEOUT_S) as response:
                status = json.loads(response.read().decode("utf-8"))
            state = status.get("state") or "NONE"
            message = status.get("error") or status.get("msg") or "Peergos"
        except Exception:
            pass
        GLib.idle_add(self.tray.set_status, state, message)


class PeergosApp(Gtk.Application):

    def __init__(self, port):
        super().__init__(application_id=APP_ID, flags=Gio.ApplicationFlags.NON_UNIQUE)
        self.port = port
        self.tray = None
        self.window = None

    def do_activate(self):
        if self.window is not None:
            self._present()
            return
        self.window = PeergosWindow(self, self.port)
        self.window.connect("close-request", self._on_close_request)
        try:
            self.tray = Tray(Gio.bus_get_sync(Gio.BusType.SESSION, None), self._present, self.quit)
            StatusPoller(self.port, self.tray).start()
        except GLib.Error as e:
            print("Peergos: no tray icon: " + e.message, file=sys.stderr)
        self.window.present()

    def _present(self):
        self.window.set_visible(True)
        self.window.present()

    def _on_close_request(self, window):
        # Without a tray there is no way back to a hidden window, so let it quit.
        if self.tray is None or not self.tray.available:
            return False
        window.set_visible(False)
        return True


def render_logo():
    """Re-encode peergos.svg into the LOGO constant above. Development only: it
    needs a working GdkPixbuf image loader, which is the thing LOGO avoids."""
    gi.require_version("GdkPixbuf", "2.0")
    from gi.repository import GdkPixbuf

    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "peergos.svg")
    pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(path, ICON_SIZE, ICON_SIZE)
    if not pixbuf.get_has_alpha():
        pixbuf = pixbuf.add_alpha(False, 0, 0, 0)
    source = pixbuf.get_pixels()
    stride = pixbuf.get_rowstride()
    width, height = pixbuf.get_width(), pixbuf.get_height()
    pixels = bytearray(ICON_SIZE * ICON_SIZE * 4)
    left, top = (ICON_SIZE - width) // 2, (ICON_SIZE - height) // 2
    for y in range(height):
        start = y * stride
        dest = ((y + top) * ICON_SIZE + left) * 4
        pixels[dest:dest + width * 4] = source[start:start + width * 4]
    blob = base64.b64encode(zlib.compress(bytes(pixels), 9)).decode()
    print("LOGO = (")
    for i in range(0, len(blob), 96):
        print('    "' + blob[i:i + 96] + '"')
    print(")")
    return 0


def main():
    if "--render-icon" in sys.argv:
        return render_logo()
    # WM_CLASS/app_id defaults to the binary name, which desktops then fail to
    # match against org.peergos.Peergos.desktop, losing the icon and the name.
    GLib.set_prgname(APP_ID)
    GLib.set_application_name("Peergos")
    port = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("PEERGOS_PORT", "7777")
    return PeergosApp(port).run([])


if __name__ == "__main__":
    sys.exit(main())
