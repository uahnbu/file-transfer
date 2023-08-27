const { app, BrowserWindow } = require('electron');

if (process.env.NODE_ENV === 'development') try {
  require('electron-reloader')(module);
} catch {}

const createWindow = async () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
  });
  const server = await require('./src/server');
  win.loadURL(server.address);
  win.removeMenu();
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    !BrowserWindow.getAllWindows().length && createWindow();
  });
});

app.on('window-all-closed', () => {
  process.platform !== 'darwin' && app.quit()
});

module.exports = {
  downloadPath: app.getPath('downloads')
};