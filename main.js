const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;

function setupAutoUpdater() {
  // Auto-update is only available for packaged builds (not `npm start`).
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`[Updater] Update available: ${info.version}`);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] App is up to date.');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[Updater] Download ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Gestion Hamza - Mise à jour disponible',
      message: `La version ${info.version} est prête à être installée.`,
      detail: 'L’application va redémarrer pour terminer la mise à jour.',
      buttons: ['Installer maintenant', 'Plus tard'],
      defaultId: 0,
      cancelId: 1
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  autoUpdater.on('error', (error) => {
    console.error('[Updater] Error:', error);
  });

  // Give the app a moment to finish loading before checking GitHub Releases.
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      console.error('[Updater] Check failed:', error);
    });
  }, 5000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    show: false,
    icon: path.join(__dirname, 'icon.ico'),
    backgroundColor: '#FAF6EF',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    dialog.showErrorBox(
      'Gestion Hamza - Erreur',
      `Impossible de charger l'application.\n\nCode: ${errorCode}\n${errorDescription}`
    );
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    dialog.showErrorBox(
      'Gestion Hamza - Erreur',
      `Le moteur de l'application s'est arrêté.\n\nRaison: ${details.reason || 'inconnue'}`
    );
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
