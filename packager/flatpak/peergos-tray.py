#!/usr/bin/env python3
"""The tray icon, as its own process.

Electron's Tray cannot be used here. Chromium 150 puts every status icon in a
process behind one multiplexer that exports a single /StatusNotifierItem path
and routes each call by matching the *destination* against the well-known names
it owns (crbug 543471702). Hosts built on GDBus - Cinnamon's xapp-sn-watcher,
XFCE, the GNOME AppIndicator extension - resolve the name owner and then address
the unique connection name, which matches nothing in that map, so every property
read fails. The host gets no icon, no tooltip and no menu path, and draws a blank
placeholder that does nothing when clicked. Fixed upstream on 2026-08-13; until
that reaches an Electron release, nothing inside Electron can work around it,
because nothing in its API sets a bus name.

So the tray speaks StatusNotifierItem itself, from a process that has no such
problem: objects here are dispatched by path, so a call addressed to our unique
name is answered like any other. We register under the unique name and own no
well-known name at all, which is what the GTK host did before the Electron port.

Deliberately pure Python: jeepney is vendored beside this file and has no
dependencies and nothing compiled, so the flatpak build stays offline and the
runtime needs no native module. The window host owns all the policy - what the
menu says, what a click does, when to quit - and this process only draws what it
is told and reports back what the user did.

Protocol, one JSON object per line, in on stdin and out on stdout:

    in   {"cmd": "icon", "state": "SYNCED"}
         {"cmd": "tooltip", "text": "All synced"}
         {"cmd": "menu", "items": [{"id": 1, "label": "...", "enabled": false},
                                   {"id": 2, "type": "separator"},
                                   {"id": 3, "label": "...", "checked": true}]}
         {"cmd": "quit"}
    out  {"event": "registered", "ok": true}   a host took the icon (or dropped it)
         {"event": "activate"}                 left click
         {"event": "clicked", "id": 3}         menu item chosen
"""
import json
import os
import select
import sys
import zlib

from jeepney import DBusAddress, HeaderFields, MessageFlag, MessageType, new_error, \
    new_method_call, new_method_return, new_signal
from jeepney.io.blocking import open_dbus_connection

BUS = DBusAddress('/org/freedesktop/DBus', bus_name='org.freedesktop.DBus',
                  interface='org.freedesktop.DBus')
WATCHER_NAME = 'org.kde.StatusNotifierWatcher'

SNI_IFACE = 'org.kde.StatusNotifierItem'
SNI_PATH = '/StatusNotifierItem'
MENU_IFACE = 'com.canonical.dbusmenu'
MENU_PATH = '/MenuBar'
PROPERTIES_IFACE = 'org.freedesktop.DBus.Properties'

# installed beside this file; set explicitly when running from a source checkout,
# where the icons live with the Electron host rather than with the packaging
ICON_DIR = os.environ.get('PEERGOS_TRAY_ICONS',
                          os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icons'))
ICON_STATES = {'SYNCED': 'synced', 'SYNCING': 'syncing', 'ERROR': 'error'}


# ---------------------------------------------------------------------- icons

def load_icon(path):
    """An 8 bit RGBA PNG as (width, height, ARGB32 bytes), which is what the
    StatusNotifierItem spec asks for and what a host draws without ever reading a
    file - the icons live inside the sandbox, where no panel can reach them.

    Only the one PNG shape render-icons.py writes is handled, and anything else
    raises rather than being drawn wrong."""
    data = open(path, 'rb').read()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError(path + ' is not a PNG')

    pos, width, height, compressed = 8, 0, 0, b''
    while pos + 8 <= len(data):
        length = int.from_bytes(data[pos:pos + 4], 'big')
        kind = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        pos += 12 + length          # 4 length, 4 kind, the data, 4 crc
        if kind == b'IHDR':
            width = int.from_bytes(chunk[0:4], 'big')
            height = int.from_bytes(chunk[4:8], 'big')
            depth, colour, _, _, interlace = chunk[8:13]
            if (depth, colour, interlace) != (8, 6, 0):
                raise ValueError(path + ' is not 8 bit RGBA, non-interlaced')
        elif kind == b'IDAT':
            compressed += chunk
        elif kind == b'IEND':
            break

    stride = width * 4
    raw = zlib.decompress(compressed)
    pixels = bytearray(stride * height)
    for y in range(height):
        # each scanline is prefixed with the filter its bytes were encoded with,
        # and is undone against the reconstructed line above it
        filter_type = raw[y * (stride + 1)]
        line = raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)]
        out = y * stride
        for x in range(stride):
            left = pixels[out + x - 4] if x >= 4 else 0
            up = pixels[out - stride + x] if y > 0 else 0
            up_left = pixels[out - stride + x - 4] if y > 0 and x >= 4 else 0
            if filter_type == 0:
                value = line[x]
            elif filter_type == 1:
                value = line[x] + left
            elif filter_type == 2:
                value = line[x] + up
            elif filter_type == 3:
                value = line[x] + (left + up) // 2
            elif filter_type == 4:
                value = line[x] + paeth(left, up, up_left)
            else:
                raise ValueError(path + ' uses unknown PNG filter ' + str(filter_type))
            pixels[out + x] = value & 0xFF

    argb = bytearray(len(pixels))
    argb[0::4] = pixels[3::4]
    argb[1::4] = pixels[0::4]
    argb[2::4] = pixels[1::4]
    argb[3::4] = pixels[2::4]
    return width, height, bytes(argb)


def paeth(left, up, up_left):
    estimate = left + up - up_left
    by_left = abs(estimate - left)
    by_up = abs(estimate - up)
    by_up_left = abs(estimate - up_left)
    if by_left <= by_up and by_left <= by_up_left:
        return left
    return up if by_up <= by_up_left else up_left


def load_icons():
    """Every state up front: an icon that fails to load once the user is looking
    at it would leave them with no way back into a hidden window."""
    icons = {}
    for state, name in list(ICON_STATES.items()) + [('NONE', 'idle')]:
        icons[state] = load_icon(os.path.join(ICON_DIR, 'tray-' + name + '.png'))
    return icons


# ----------------------------------------------------------------------- tray

class Tray:
    """A StatusNotifierItem and the dbusmenu behind it."""

    def __init__(self, connection, icons, on_event):
        self.connection = connection
        self.icons = icons
        self.on_event = on_event
        self.state = 'NONE'
        self.tooltip = 'Peergos'
        self.items = []
        self.revision = 1
        self.registered = False
        self.pending_registration = None

    # ------------------------------------------------------------ properties

    def icon(self):
        return self.icons.get(self.state, self.icons['NONE'])

    def sni_properties(self):
        return {
            'Category': ('s', 'ApplicationStatus'),
            'Id': ('s', 'peergos'),
            'Title': ('s', 'Peergos'),
            'Status': ('s', 'Active'),
            # empty rather than absent: a host that reads a name first and only
            # falls back to pixmaps must see there is no name to use
            'IconName': ('s', ''),
            'IconPixmap': ('a(iiay)', [self.icon()]),
            'ItemIsMenu': ('b', False),
            'Menu': ('o', MENU_PATH),
            'ToolTip': ('(sa(iiay)ss)', ('', [self.icon()], 'Peergos', self.tooltip)),
        }

    def menu_properties(self):
        return {'Version': ('u', 3), 'Status': ('s', 'normal'), 'TextDirection': ('s', 'ltr'),
                'IconThemePath': ('as', [])}

    def item_properties(self, item):
        if item.get('type') == 'separator':
            return {'type': ('s', 'separator')}
        properties = {'label': ('s', item.get('label', '')),
                      'enabled': ('b', item.get('enabled', True)),
                      'visible': ('b', True)}
        if 'checked' in item:
            properties['toggle-type'] = ('s', 'checkmark')
            properties['toggle-state'] = ('i', 1 if item['checked'] else 0)
        return properties

    def layout(self):
        children = [('(ia{sv}av)', (item['id'], self.item_properties(item), []))
                    for item in self.items]
        return (self.revision, (0, {'children-display': ('s', 'submenu')}, children))

    # -------------------------------------------------------------- updating

    def set_icon(self, state):
        if state == self.state:
            return
        self.state = state
        self.emit(SNI_PATH, SNI_IFACE, 'NewIcon')

    def set_tooltip(self, text):
        if text == self.tooltip:
            return
        self.tooltip = text
        self.emit(SNI_PATH, SNI_IFACE, 'NewToolTip')

    def set_menu(self, items):
        """A whole new menu each time, rather than diffing it: the menu is four
        items long and only changes when the status line or the checkbox does, so
        a layout bump costs a round trip nobody notices."""
        self.items = items
        self.revision += 1
        self.emit(MENU_PATH, MENU_IFACE, 'LayoutUpdated', 'ui', (self.revision, 0))

    def emit(self, path, interface, member, signature=None, body=()):
        self.connection.send(new_signal(DBusAddress(path, interface=interface),
                                        member, signature, body))

    # ---------------------------------------------------------- registration

    def register(self):
        """Hand ourselves to whatever is hosting tray icons, by unique name. The
        spec allows either a bus name or an object path here, and hosts use the
        sender either way, so owning a well-known name buys nothing - and it is
        exactly the well-known name that Chromium's multiplexer needs and we do
        not."""
        message = new_method_call(
            DBusAddress('/StatusNotifierWatcher', bus_name=WATCHER_NAME,
                        interface=WATCHER_NAME),
            'RegisterStatusNotifierItem', 's', (self.connection.unique_name,))
        self.pending_registration = next(self.connection.outgoing_serial)
        self.connection.send(message, serial=self.pending_registration)

    def on_registration_reply(self, message):
        self.pending_registration = None
        self.registered = message.header.message_type is MessageType.method_return
        if not self.registered:
            print('Peergos: no tray host took the icon: '
                  + str(message.header.fields.get(HeaderFields.error_name)), file=sys.stderr)
        self.on_event({'event': 'registered', 'ok': self.registered})

    def on_watcher_gone(self):
        # Reported, not hidden: with no tray there is nowhere for the window to
        # hide, and the host has to know that before it hides it.
        if self.registered:
            self.registered = False
            self.on_event({'event': 'registered', 'ok': False})

    # ------------------------------------------------------------ dispatch

    def handle(self, message):
        """Answer a method call addressed to one of our objects. Anything we do
        not implement gets an error rather than silence, so a host waiting on a
        reply is never left hanging."""
        fields = message.header.fields
        path = fields.get(HeaderFields.path)
        interface = fields.get(HeaderFields.interface)
        member = fields.get(HeaderFields.member)
        body = message.body

        if interface == PROPERTIES_IFACE:
            properties = self.sni_properties() if path == SNI_PATH else self.menu_properties()
            if member == 'GetAll':
                return new_method_return(message, 'a{sv}', (properties,))
            if member == 'Get':
                if body[1] not in properties:
                    return new_error(message, 'org.freedesktop.DBus.Error.UnknownProperty',
                                     's', ('No such property ' + str(body[1]),))
                return new_method_return(message, 'v', (properties[body[1]],))

        elif interface == SNI_IFACE:
            if member in ('Activate', 'SecondaryActivate'):
                self.on_event({'event': 'activate'})
                return new_method_return(message)
            if member in ('ContextMenu', 'Scroll'):
                # the menu is the host's to pop up from the dbusmenu below, and
                # scrolling the icon means nothing to us
                return new_method_return(message)

        elif interface == MENU_IFACE:
            if member == 'GetLayout':
                # two out arguments, the revision and the tree - not one struct
                return new_method_return(message, 'u(ia{sv}av)', self.layout())
            if member == 'GetGroupProperties':
                wanted = body[0]
                return new_method_return(message, 'a(ia{sv})', ([
                    (item['id'], self.item_properties(item)) for item in self.items
                    if not wanted or item['id'] in wanted],))
            if member == 'GetProperty':
                for item in self.items:
                    if item['id'] == body[0]:
                        return new_method_return(message, 'v',
                                                 (self.item_properties(item)[body[1]],))
            if member == 'AboutToShow':
                # nothing to build on demand - the window host pushes the menu
                # whenever it changes, so what we have is current
                return new_method_return(message, 'b', (False,))
            if member in ('Event', 'EventGroup'):
                events = [body] if member == 'Event' else body[0]
                for event in events:
                    if event[1] == 'clicked':
                        self.on_event({'event': 'clicked', 'id': event[0]})
                return new_method_return(message)

        elif interface == 'org.freedesktop.DBus.Introspectable' and member == 'Introspect':
            return new_method_return(message, 's', (introspection(path),))

        elif interface == 'org.freedesktop.DBus.Peer' and member == 'Ping':
            return new_method_return(message)

        return new_error(message, 'org.freedesktop.DBus.Error.UnknownMethod', 's',
                         ('No method ' + str(interface) + '.' + str(member),))


def introspection(path):
    """Enough for busctl and d-feet to show what is here. Hosts do not need it -
    GDBus proxies are built from their own copy of the interface - but a tray
    that cannot be inspected is a tray nobody can debug."""
    if path == MENU_PATH:
        return ("<node><interface name='com.canonical.dbusmenu'>"
                "<method name='GetLayout'/><method name='GetGroupProperties'/>"
                "<method name='GetProperty'/><method name='Event'/>"
                "<method name='AboutToShow'/></interface></node>")
    return ("<node><interface name='org.kde.StatusNotifierItem'>"
            "<method name='Activate'/><method name='SecondaryActivate'/>"
            "<method name='ContextMenu'/><method name='Scroll'/></interface></node>")


# ----------------------------------------------------------------- the loop

def emit_event(event):
    """Straight out and flushed: a click has to reach the window host now, not
    whenever the next thing happens to arrive on the bus."""
    sys.stdout.write(json.dumps(event) + '\n')
    sys.stdout.flush()


def main():
    connection = open_dbus_connection(bus='SESSION')
    tray = Tray(connection, load_icons(), emit_event)

    # A watcher that starts after us - a shell restart, or an extension being
    # switched on - has to find us, so we watch the name rather than asking once.
    connection.send(new_method_call(BUS, 'AddMatch', 's', (
        "type='signal',sender='org.freedesktop.DBus',path='/org/freedesktop/DBus',"
        "interface='org.freedesktop.DBus',member='NameOwnerChanged',arg0='"
        + WATCHER_NAME + "'",)))
    tray.register()

    stdin_buffer = b''
    running = True
    while running:
        # the parser can be holding messages that the socket will not announce
        # again, so it is drained before anything is allowed to block
        while True:
            try:
                message = connection.receive(timeout=0)
            except TimeoutError:
                break
            handle_bus_message(connection, tray, message)

        readable, _, _ = select.select([connection.sock, sys.stdin.fileno()], [], [])
        if connection.sock in readable:
            handle_bus_message(connection, tray, connection.receive())
        if sys.stdin.fileno() in readable:
            data = os.read(sys.stdin.fileno(), 4096)
            if not data:
                break                       # the window host is gone, and so are we
            stdin_buffer += data
            while b'\n' in stdin_buffer:
                line, stdin_buffer = stdin_buffer.split(b'\n', 1)
                running = handle_command(tray, line)
                if not running:
                    break

    connection.close()


def handle_bus_message(connection, tray, message):
    kind = message.header.message_type
    if kind is MessageType.method_call:
        reply = tray.handle(message)
        if not (message.header.flags & MessageFlag.no_reply_expected):
            connection.send(reply)
    elif kind in (MessageType.method_return, MessageType.error):
        if message.header.fields.get(HeaderFields.reply_serial) == tray.pending_registration:
            tray.on_registration_reply(message)
    elif kind is MessageType.signal:
        if message.header.fields.get(HeaderFields.member) == 'NameOwnerChanged':
            _, old_owner, new_owner = message.body
            if new_owner:
                tray.register()
            elif old_owner:
                tray.on_watcher_gone()


def handle_command(tray, line):
    """Apply one command from the window host. Returns whether to keep running."""
    try:
        command = json.loads(line)
    except ValueError:
        print('Peergos: tray ignoring unreadable command: ' + repr(line), file=sys.stderr)
        return True
    name = command.get('cmd')
    if name == 'icon':
        tray.set_icon(command.get('state', 'NONE'))
    elif name == 'tooltip':
        tray.set_tooltip(command.get('text', 'Peergos'))
    elif name == 'menu':
        tray.set_menu(command.get('items', []))
    elif name == 'quit':
        return False
    return True


if __name__ == '__main__':
    main()
