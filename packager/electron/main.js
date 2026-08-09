// Peergos desktop window for the Linux flatpak.
//
// An Electron window onto the local Peergos server, plus a tray icon showing the
// global sync status. This replaces the GTK4/WebKitGTK host: WebKitGTK cannot
// render WebGL from a worker without deadlocking the whole web process, which
// hangs vlc.js and weboffice. See electron.md.
//
// The engine is bundled rather than taken from the runtime, so it is patched by
// a Peergos release rather than by a flatpak update. That is the deal we took to
// get an engine the apps can run on.
//
// Closing the window hides it to the tray, leaving the server running and
// syncing; "Close Peergos" in the tray menu quits, exiting 0 so the Java server
// shuts down. If nothing on the bus is hosting tray icons (stock GNOME without
// the AppIndicator extension) there is nowhere to hide, so closing quits
// instead - otherwise the user is left with an invisible server they can't get
// back to. The same rule applies to starting minimised.
//
// Only one copy of the window runs: launching Peergos while it is already up
// presents the window that is there rather than opening a second one.
//
// Deliberately dependency free: the only thing here that is not Electron or the
// node standard library is the icons, which are files. That is what lets the
// flatpak build stay offline without vendoring an npm tree.

const {app, BrowserWindow, Menu, Tray, dialog, nativeImage, session, shell} = require('electron');
const {execFile} = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const APP_ID = 'org.peergos.Peergos';
const POLL_SECONDS = 10;
const STATUS_TIMEOUT_MS = 5000;
// How long a minimised start waits for a tray to take it before giving up and
// showing the window. At login we may well be up before the shell extension
// that hosts us is.
const TRAY_WAIT_MS = 10000;

const WATCHER_NAME = 'org.kde.StatusNotifierWatcher';

// set by the server when it was itself started with -minimised true, which is
// what the login item we write in ~/.config/autostart does
const MINIMISED = !!process.env.PEERGOS_MINIMISED;
const PORT = process.argv[2] || process.env.PEERGOS_PORT || '7777';

const AUTOSTART_ENTRY = `[Desktop Entry]
Type=Application
Name=Peergos
Comment=Private, secure peer-to-peer storage
Exec=flatpak run org.peergos.Peergos -minimised true
Icon=org.peergos.Peergos
Terminal=false
X-Flatpak=org.peergos.Peergos
`;

let win = null;
let tray = null;
let trayAvailable = false;
let status = {state: 'NONE', message: 'Peergos'};

// ---------------------------------------------------------------- autostart

// Where the session manager looks for login items. Deliberately not
// app.getPath('userData') or Electron's setLoginItemSettings: inside the
// flatpak both write the app's private config, which nothing outside the
// sandbox ever reads. The real ~/.config is reachable only because the manifest
// grants --filesystem=home. The entry launches `flatpak run` on the host, not
// our own command: the file is read by the host's session manager, which knows
// nothing of us.
function autostartPath() {
    return path.join(os.homedir(), '.config', 'autostart', APP_ID + '.desktop');
}

// Read from disk each time it is asked. The user can remove the entry behind our
// back - GNOME's Background Apps list has a switch for exactly that - and the
// menu has to show that as off.
function autostartEnabled() {
    try {
        return fs.statSync(autostartPath()).isFile();
    } catch (e) {
        return false;
    }
}

// Reports nothing back on purpose: the caller re-reads the state from disk
// rather than trusting this, so a write that failed leaves the check where it
// was instead of claiming a state we did not reach.
function setAutostart(enabled) {
    const file = autostartPath();
    try {
        if (enabled) {
            fs.mkdirSync(path.dirname(file), {recursive: true});
            fs.writeFileSync(file, AUTOSTART_ENTRY);
        } else {
            fs.rmSync(file, {force: true});
        }
    } catch (e) {
        console.error('Peergos: could not update ' + file + ': ' + e.message);
    }
}

// --------------------------------------------------------------------- tray

// Whether anything on the bus is hosting tray icons. Electron's Tray says
// nothing about this - it succeeds either way - but two decisions depend on the
// answer: whether closing the window hides or quits, and whether a minimised
// start ever shows the window. Ask the bus directly, the way the GTK host did by
// watching the name. gdbus comes from glib in the runtime, so this needs no
// dependency; if it is somehow missing we report no tray, which is the safe way
// to be wrong - a visible window beats an unreachable one.
function refreshTrayAvailable() {
    return new Promise(resolve => {
        execFile('gdbus', ['call', '--session', '--dest', 'org.freedesktop.DBus',
                           '--object-path', '/org/freedesktop/DBus',
                           '--method', 'org.freedesktop.DBus.NameHasOwner', WATCHER_NAME],
                 {timeout: 5000}, (err, stdout) => {
            trayAvailable = !err && /true/.test(stdout);
            resolve(trayAvailable);
        });
    });
}

function iconFor(state) {
    const name = {SYNCED: 'synced', SYNCING: 'syncing', ERROR: 'error'}[state] || 'idle';
    return nativeImage.createFromPath(path.join(__dirname, 'icons', 'tray-' + name + '.png'));
}

function buildMenu() {
    return Menu.buildFromTemplate([
        // informational only, so it is shown disabled
        {label: status.message, enabled: false},
        {type: 'separator'},
        {
            label: 'Start on boot',
            type: 'checkbox',
            // taken from the file on disk rather than from what we last did to it
            checked: autostartEnabled(),
            click: item => {
                setAutostart(!autostartEnabled());
                item.checked = autostartEnabled();
                tray.setContextMenu(buildMenu());
            }
        },
        {label: 'Close Peergos', click: () => app.quit()}
    ]);
}

function createTray() {
    tray = new Tray(iconFor(status.state));
    tray.setToolTip('Peergos');
    tray.setContextMenu(buildMenu());
    tray.on('click', showWindow);
}

function applyStatus(next) {
    const changed = next.state !== status.state;
    const said = next.message !== status.message;
    status = next;
    if (!tray)
        return;
    if (changed)
        tray.setImage(iconFor(status.state));
    if (said) {
        tray.setToolTip(status.message);
        tray.setContextMenu(buildMenu());
    }
}

// The sync loop only runs every 30s, so a ~10s poll is plenty. An unreachable
// server is red: it should be there and isn't.
function pollStatus() {
    // the localhost API only answers POST - a GET is a 405
    const request = http.request(
        {host: 'localhost', port: PORT, path: '/peergos/v0/sync/status', method: 'POST',
         timeout: STATUS_TIMEOUT_MS},
        response => {
            let body = '';
            response.on('data', chunk => body += chunk);
            response.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    applyStatus({state: parsed.state || 'NONE',
                                 message: parsed.error || parsed.msg || 'Peergos'});
                } catch (e) {
                    applyStatus({state: 'ERROR', message: 'Cannot reach Peergos'});
                }
            });
        });
    request.on('timeout', () => request.destroy());
    request.on('error', () => applyStatus({state: 'ERROR', message: 'Cannot reach Peergos'}));
    request.end();
}

// ------------------------------------------------------------------ downloads

// Where downloads go. Not app.getPath('downloads') alone: that reads
// ~/.config/user-dirs.dirs, which a sandbox can't always see, and falling back
// to $HOME would drop files in the top of the user's home.
function downloadDir() {
    const home = os.homedir();
    const candidates = [process.env.XDG_DOWNLOAD_DIR];
    try {
        candidates.push(app.getPath('downloads'));
    } catch (e) { /* unset in this environment */ }
    candidates.push(path.join(home, 'Downloads'));
    for (const candidate of candidates) {
        try {
            if (candidate && fs.statSync(candidate).isDirectory())
                return candidate;
        } catch (e) { /* not there, try the next */ }
    }
    return home;
}

// A path under directory that no file has yet, as name, name-1, name-2...
function unusedPath(directory, name) {
    const extension = path.extname(name);
    const stem = path.basename(name, extension);
    let candidate = path.join(directory, name);
    let attempt = 0;
    while (fs.existsSync(candidate)) {
        attempt++;
        candidate = path.join(directory, stem + '-' + attempt + extension);
    }
    return candidate;
}

// -------------------------------------------------------------------- window

function showWindow() {
    if (win === null)
        return;
    win.show();
    win.focus();
}

function openInspector() {
    if (win === null)
        return;
    showWindow();
    if (!win.webContents.isDevToolsOpened())
        win.webContents.openDevTools({mode: 'detach'});
}

function createWindow() {
    win = new BrowserWindow({
        width: 1280,
        height: 900,
        title: 'Peergos',
        show: false,          // presented below, or not at all when minimised
        icon: path.join(__dirname, 'icons', 'peergos.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    win.setMenuBarVisibility(false);

    // Without a tray there is no way back to a hidden window, so let it quit.
    win.on('close', event => {
        if (!trayAvailable || app.quitting)
            return;
        event.preventDefault();
        win.hide();
    });

    // A link that wants a new window - anything target=_blank. We don't want a
    // second window, so hand the address to the user's browser.
    win.webContents.setWindowOpenHandler(({url}) => {
        shell.openExternal(url);
        return {action: 'deny'};
    });

    // The web inspector. Electron has no default context menu and no built-in
    // shortcut for it, so both ways in are ours to provide: the keys the GTK
    // host had, and right click > Inspect element as it also had. It cannot dock
    // usefully into a window that is nothing but the page, so give it its own.
    win.webContents.on('before-input-event', (event, input) => {
        const key = (input.key || '').toLowerCase();
        if (input.type === 'keyDown' && (key === 'f12' || (input.control && input.shift && key === 'i'))) {
            openInspector();
            event.preventDefault();
        }
    });

    // params are in the coordinates of the top level page, and inspectElement
    // resolves them into whichever frame is actually under the pointer - so
    // this reaches into a sandboxed app frame as well as the Peergos UI.
    win.webContents.on('context-menu', (event, params) => {
        Menu.buildFromTemplate([
            {label: 'Inspect element', click: () => {
                openInspector();
                win.webContents.inspectElement(params.x, params.y);
            }}
        ]).popup({window: win});
    });

    // Renderer console straight to our stdout, for when the window is in a state
    // where opening the inspector is not practical. Off unless asked for, since
    // the page is chatty.
    if (process.env.PEERGOS_DEBUG) {
        win.webContents.on('console-message', event => {
            console.log('[page] ' + event.message
                        + ' (' + event.sourceId + ':' + event.lineNumber + ')');
        });
    }

    win.loadURL('http://localhost:' + PORT);
}

function wireSession() {
    const peergos = session.defaultSession;

    // The camera is the one permission the UI needs, for scanning QR codes, and
    // it is worth asking about. Everything else is refused.
    peergos.setPermissionRequestHandler((contents, permission, callback, details) => {
        const wantsCamera = permission === 'media'
            && (details.mediaTypes || []).includes('video');
        if (!wantsCamera) {
            callback(false);
            return;
        }
        dialog.showMessageBox(win, {
            message: 'Allow Peergos to use the camera?',
            detail: 'Peergos uses the camera to scan QR codes.',
            buttons: ['Deny', 'Allow'],
            cancelId: 0,
            defaultId: 1
        }).then(answer => callback(answer.response === 1));
    });

    // Downloads save straight to the XDG download directory rather than
    // prompting, as chromium --app and the GTK host both did here.
    peergos.on('will-download', (event, item) => {
        item.setSavePath(unusedPath(downloadDir(), item.getFilename() || 'download'));
    });

}

// The window's preload covers the top frame, and only the top frame needs it:
// __peergosDesktop is read by assets/js/webauthn.js, which index.html loads and
// the sandboxed app pages do not. The GTK host injected it into ALL_FRAMES, but
// nothing in an app frame ever looked at it. Worth knowing if that changes -
// session.registerPreloadScript({type: 'frame'}) registers without complaint
// but does not reach a cross-origin app frame, so it would not be the answer.

// ---------------------------------------------------------------------- boot

// Chromium derives WM_CLASS from the process name, and desktops match that
// against org.peergos.Peergos.desktop to find our icon and name.
app.setName('Peergos');
app.commandLine.appendSwitch('class', APP_ID);

app.on('before-quit', () => { app.quitting = true; });

// Quitting has to exit 0: the Java server watches this process and shuts itself
// down when it ends. Hiding the window must never reach here.
app.on('window-all-closed', () => app.quit());

async function start() {
    wireSession();
    // The window is built either way: it keeps the app alive whether or not it
    // is ever shown, and leaves the page warm for the first click.
    createWindow();
    await refreshTrayAvailable();
    createTray();
    pollStatus();
    setInterval(() => {
        pollStatus();
        // picks up a shell restart, or an AppIndicator extension being enabled
        refreshTrayAvailable();
    }, POLL_SECONDS * 1000);

    if (!MINIMISED) {
        showWindow();
        return;
    }
    // Registering is a bus round trip, so a minimised start cannot know yet
    // whether it has anywhere to hide. Once it is clear that nothing took the
    // icon, show the window: there would otherwise be no way to reach or quit
    // the server at all.
    setTimeout(async () => {
        if (!await refreshTrayAvailable()) {
            console.error('Peergos: no tray to start minimised into, showing the window');
            showWindow();
        }
    }, TRAY_WAIT_MS);
}

// One window per user, not one per launch. Launching Peergos again - from the
// icon, or a second `flatpak run` - brings the window we already have to the
// front instead of opening another onto the same server.
//
// The lock is a socket in the app's config directory, which every flatpak
// instance of the app shares, so it holds across sandboxes: each instance has
// its own pid namespace, and both processes think they are pid 2, but the
// newcomer still finds the socket and is answered over it.
//
// Whoever is already running wins, rather than the newcomer taking over: the
// running window is the one whose Java parent owns the server, and a window that
// outlived its server would have nothing to show. The newcomer's own Java parent
// watches it and exits when it does, so losing the race leaves nothing behind.
// It had not started a second server: the server reuses one already listening.
//
// A minimised start is a launch that wants no window - the login item runs us
// that way - so it says so, and the running instance stays as it is. It still
// has to take the lock or give it up like any other launch, or two invisible
// copies could sit in the tray.
if (!app.requestSingleInstanceLock({show: !MINIMISED})) {
    console.log('Peergos: already running, showing that window instead');
    app.quit();
} else {
    // argv and the working directory are the newcomer's, and we want neither:
    // the port it was given is its Java parent's business, and we are already
    // pointed at the server. Only the intent matters. An older host with no
    // additionalData to send means an ordinary launch, so show.
    app.on('second-instance', (event, argv, workingDirectory, data) => {
        if (!data || data.show !== false)
            showWindow();
    });

    app.whenReady().then(start);
}
