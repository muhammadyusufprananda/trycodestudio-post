const { app, BrowserWindow, net, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const appOrigin = 'trycode://postmaker';
const appPage = appOrigin + '/index.html';
const appAssets = new Set(['index.html', 'app.js', 'style.css']);

protocol.registerSchemesAsPrivileged([{
  scheme: 'trycode',
  privileges: { standard: true, secure: true, supportFetchAPI: true }
}]);

function openStudioSite(url) {
  try {
    const target = new URL(url);
    if (target.protocol === 'https:' && target.hostname === 'trycodestudio.github.io') shell.openExternal(target.href);
  } catch {
    // Ignore invalid or unexpected navigation targets.
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 760,
    minHeight: 650,
    backgroundColor: '#f5f3ed',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });

  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    openStudioSite(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(appOrigin + '/')) return;
    event.preventDefault();
    openStudioSite(url);
  });
  window.loadURL(appPage);
}

app.whenReady().then(() => {
  protocol.handle('trycode', (request) => {
    const asset = new URL(request.url).pathname.replace(/^\/+/, '');
    if (!appAssets.has(asset)) return new Response('Not found', { status: 404 });
    const filePath = path.join(app.getAppPath(), asset);
    return net.fetch(pathToFileURL(filePath).href);
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
