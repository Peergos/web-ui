const { app, BrowserWindow } = require('electron');

const port = process.argv[2];

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    
    win.loadURL('http://localhost:' + port);
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    app.quit();
});
