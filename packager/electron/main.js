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
// The tray itself is not ours: tray.py draws it, for the reasons set out at the
// top of that file, and this process tells it what to show and hears back what
// the user clicked.
//
// Deliberately dependency free: nothing here is outside Electron and the node
// standard library, and tray.py needs only python and the vendored jeepney,
// which is pure python. That is what lets the flatpak build stay offline without
// vendoring an npm tree or compiling anything.

const {app, BrowserWindow, Menu, dialog, session, shell} = require('electron');
const {spawn} = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const APP_ID = 'org.peergos.Peergos';
const POLL_SECONDS = 10;
const STATUS_TIMEOUT_MS = 5000;
// Oftener than the status poll: a launch that replaces the server is right behind
// the one that stopped it, and until we have noticed we hold both the profile and
// the single instance lock against it.
const SERVER_GONE_MS = 500;
// How long a minimised start waits for a tray to take it before giving up and
// showing the window. At login we may well be up before the shell extension
// that hosts us is.
const TRAY_WAIT_MS = 10000;

// Menu item ids, shared with tray.py: it draws the menu we send and tells us
// which id the user picked.
const MENU_STATUS = 1;
const MENU_SEPARATOR = 2;
const MENU_AUTOSTART = 3;
const MENU_QUIT = 4;

// set by the server when it was itself started with -minimised true, which is
// what the login item we write in ~/.config/autostart does
const MINIMISED = !!process.env.PEERGOS_MINIMISED;
const PORT = process.argv[2] || process.env.PEERGOS_PORT || '7777';

// The server that spawned us. It exits when we do, and nothing carried the
// reverse: a server stopped from under us - by the launch that replaces it, or by
// a crash - left this window up on nothing, holding the lock against every launch
// after it, so the app could not be started again at all.
const SERVER_PID = process.ppid;

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

// The tray is a process of its own - see tray.py for why Electron's own Tray
// cannot be used on this Chromium. It draws what we send it and reports what the
// user did; every decision stays here.
function sendTray(command) {
    if (tray === null)
        return;
    tray.stdin.write(JSON.stringify(command) + '\n');
}

function menuItems() {
    return [
        // informational only, so it is shown disabled
        {id: MENU_STATUS, label: status.message, enabled: false},
        {id: MENU_SEPARATOR, type: 'separator'},
        // taken from the file on disk rather than from what we last did to it
        {id: MENU_AUTOSTART, label: 'Start on boot', checked: autostartEnabled()},
        {id: MENU_QUIT, label: 'Close Peergos'}
    ];
}

function createTray() {
    // Not through zypak: that is chromium's sandbox launcher, and its LD_PRELOAD
    // has no business in a python process we start ourselves.
    const environment = Object.assign({}, process.env, {PYTHONPATH: __dirname});
    delete environment.LD_PRELOAD;
    tray = spawn('python3', [path.join(__dirname, 'tray.py')],
                 {env: environment, stdio: ['pipe', 'pipe', 'inherit']});

    // No tray process is no tray: closing the window must quit rather than hide
    // it somewhere the user cannot reach.
    tray.on('error', error => {
        console.error('Peergos: could not start the tray: ' + error.message);
        tray = null;
        trayAvailable = false;
    });
    tray.on('exit', code => {
        if (!app.quitting)
            console.error('Peergos: the tray exited (' + code + ')');
        tray = null;
        trayAvailable = false;
    });

    let pending = '';
    tray.stdout.on('data', chunk => {
        pending += chunk;
        const lines = pending.split('\n');
        pending = lines.pop();
        for (const line of lines) {
            if (line.trim() === '')
                continue;
            try {
                onTrayEvent(JSON.parse(line));
            } catch (e) {
                console.error('Peergos: unreadable tray event: ' + line);
            }
        }
    });

    sendTray({cmd: 'icon', state: status.state});
    sendTray({cmd: 'tooltip', text: status.message});
    sendTray({cmd: 'menu', items: menuItems()});
}

function onTrayEvent(event) {
    if (event.event === 'registered') {
        // A truthful answer to a question Electron's Tray could not answer at
        // all: not whether a host exists, but whether one took our icon. Closing
        // the window hides it only when it did.
        trayAvailable = event.ok;
    } else if (event.event === 'activate') {
        showWindow();
    } else if (event.event === 'clicked') {
        if (event.id === MENU_AUTOSTART) {
            setAutostart(!autostartEnabled());
            sendTray({cmd: 'menu', items: menuItems()});
        } else if (event.id === MENU_QUIT) {
            app.quit();
        }
    }
}

function applyStatus(next) {
    const changed = next.state !== status.state;
    const said = next.message !== status.message;
    status = next;
    if (changed)
        sendTray({cmd: 'icon', state: status.state});
    if (said) {
        sendTray({cmd: 'tooltip', text: status.message});
        // the status line is the first item, so the menu goes with it
        sendTray({cmd: 'menu', items: menuItems()});
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

// A child outliving its parent is reparented, so a ppid that has moved means the
// server is gone. Not the status poll for this: an unreachable server is drawn red
// because it may yet answer, and closing the window over a stall would be worse
// than showing one.
function quitIfServerGone() {
    if (process.ppid === SERVER_PID)
        return;
    console.error('Peergos: server exited, closing the window');
    app.quit();
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

// Destroyed as well as null: a launch can reach us over the lock while we are
// already on our way out, and presenting a torn down window throws.
function showWindow() {
    if (win === null || win.isDestroyed())
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

    // The camera is the one permission worth asking about, for scanning QR
    // codes. Everything else is refused, bar the clipboard write behind every
    // Copy button.
    peergos.setPermissionRequestHandler((contents, permission, callback, details) => {
        // Chromium only asks for the sanitized write off a real user
        // activation - without one it asks for clipboard-read, the read-write
        // permission, which stays refused. So granting this cannot become a way
        // for a page to read the clipboard or to overwrite it unprompted.
        if (permission === 'clipboard-sanitized-write') {
            callback(true);
            return;
        }
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

app.on('before-quit', () => {
    app.quitting = true;
    // Asked to go rather than killed: it closes its bus connection on the way
    // out, which is what takes the icon off the panel. Handed no removal, a
    // panel can keep the dead icon and start us again when it is clicked.
    sendTray({cmd: 'quit'});
});

// Quitting has to exit 0: the Java server watches this process and shuts itself
// down when it ends. Hiding the window must never reach here.
app.on('window-all-closed', () => app.quit());

async function start() {
    wireSession();
    // The window is built either way: it keeps the app alive whether or not it
    // is ever shown, and leaves the page warm for the first click.
    createWindow();
    createTray();
    pollStatus();
    setInterval(quitIfServerGone, SERVER_GONE_MS);
    setInterval(pollStatus, POLL_SECONDS * 1000);

    if (!MINIMISED) {
        showWindow();
        return;
    }
    // Registering is a bus round trip, so a minimised start cannot know yet
    // whether it has anywhere to hide. Once it is clear that nothing took the
    // icon, show the window: there would otherwise be no way to reach or quit
    // the server at all. The tray keeps watching the name after that, so a shell
    // restart or an AppIndicator extension being switched on still reaches us.
    setTimeout(() => {
        if (!trayAvailable) {
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
