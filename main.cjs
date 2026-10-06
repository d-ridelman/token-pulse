const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, clipboard, ipcMain } = require('electron');
const { TokenMonitor } = require('./monitor.cjs');
const { formatShare } = require('./share.cjs');

const monitor = new TokenMonitor(undefined, process.env.TOKEN_PULSE_PROJECT_DIR || null);
let window;

function createWindow() {
  window = new BrowserWindow({
    width: 1000,
    height: 790,
    minWidth: 680,
    minHeight: 600,
    backgroundColor: '#0f172a',
    title: 'Token Pulse',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const language = process.env.TOKEN_PULSE_LANG;
  window.loadFile(path.join(__dirname, 'index.html'),
    ['ru', 'en'].includes(language) ? { query: { lang: language } } : undefined);
  if (monitor.projectDir) {
    window.webContents.once('did-finish-load', () =>
      window.setTitle(`Token Pulse — ${path.basename(monitor.projectDir)}`));
  }
}

app.whenReady().then(() => {
  monitor.scan();
  ipcMain.handle('pulse:snapshot', () => monitor.snapshot());
  ipcMain.handle('pulse:share', async (_event, id, language) => {
    const session = monitor.snapshot().sessions.find(item => item.id === id);
    const result = formatShare(session, language, app.getVersion());
    if (!result) return false;
    await clipboard.writeText(result);
    return true;
  });
  createWindow();
  const emit = () => {
    if (window && !window.isDestroyed()) window.webContents.send('pulse:update', monitor.snapshot());
  };
  setInterval(() => { if (monitor.pollHot()) emit(); }, 100);
  setInterval(() => { if (monitor.scan()) emit(); }, 2000);
  setInterval(emit, 1000);
  try {
    let scheduled = false;
    const watcher = fs.watch(monitor.root, { recursive: true }, () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        if (monitor.scan()) emit();
      }, 50);
    });
    app.on('before-quit', () => watcher.close());
  } catch { /* polling remains available */ }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => app.quit());
