import { app, BrowserWindow, dialog, nativeTheme, screen } from 'electron';
import { fileURLToPath } from 'node:url';
import { startLocalServer } from '../lib/local-server.mjs';
import { isZoomKey } from '../lib/ui-scale.mjs';

let localServer;
let mainWindow;
let quitting = false;

async function showWindow() {
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const window = new BrowserWindow({
    title: 'FMV',
    icon: fileURLToPath(new URL('../out/fmv-icon.png', import.meta.url)),
    width: Math.min(workArea.width, Math.max(1280, Math.round(workArea.width * 0.9))),
    height: Math.min(workArea.height, Math.max(850, Math.round(workArea.height * 0.88))),
    minWidth: 395,
    minHeight: 530,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#101714' : '#f5f5f0',
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
      additionalArguments: [`--fmv-system-language=${app.getPreferredSystemLanguages()[0] || app.getSystemLocale()}`],
    },
  });
  mainWindow = window;
  window.removeMenu();
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { mainWindow = undefined; });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && (input.control || input.meta) && !input.alt && isZoomKey(input.key, input.code)) {
      event.preventDefault();
    }
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== localServer.origin) event.preventDefault();
  });
  await window.loadURL(localServer.url);
  window.webContents.setZoomFactor(1);
}

function startupError(error) {
  const language = app.getPreferredSystemLanguages()[0];
  dialog.showErrorBox(/^tr(?:[-_]|$)/i.test(language ?? '') ? 'FMV açılamadı' : 'Could not open FMV', error.message);
  app.quit();
}

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'system';
  const webRoot = fileURLToPath(new URL('../out/', import.meta.url));
  localServer = await startLocalServer({ webRoot });
  await showWindow();
  app.on('activate', () => showWindow().catch(startupError));
}).catch(startupError);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', (event) => {
  if (!localServer || quitting) return;
  event.preventDefault();
  quitting = true;
  localServer.close().finally(() => app.quit());
});
