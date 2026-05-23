const { app, BrowserWindow } = require('electron');
const path = require('path');

// Store data in the OS user-data folder so it survives app updates
// and is writable outside the read-only asar archive.
process.env.GAMESCAPE_DATA = path.join(app.getPath('userData'), 'data');

const { server, PORT } = require('./server');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0d0d0d',
    title: 'Gamescape',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.removeMenu();
  win.loadURL(`http://localhost:${PORT}`);
}

app.whenReady().then(() => {
  if (server.listening) {
    createWindow();
  } else {
    server.once('listening', createWindow);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
