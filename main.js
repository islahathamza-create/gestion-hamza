const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let updateDialogOpen = false;
let updateDownloading = false;

function showInfo(title, message, detail, buttons = ['حسناً']) {
  if (!mainWindow || mainWindow.isDestroyed()) return Promise.resolve({ response: 0 });
  return dialog.showMessageBox(mainWindow, {
    type: 'info',
    title,
    message,
    detail,
    buttons,
    defaultId: 0,
    cancelId: buttons.length > 1 ? 1 : 0
  });
}

function showError(message, detail) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  dialog.showMessageBox(mainWindow, {
    type: 'error',
    title: 'Gestion Hamza — تحديث',
    message,
    detail,
    buttons: ['حسناً']
  }).catch(() => {});
}

async function startUpdateDownload(version) {
  if (updateDownloading) return;
  updateDownloading = true;

  try {
    await showInfo(
      'Gestion Hamza — تحديث جديد',
      `كاينة نسخة جديدة من Gestion Hamza: ${version}`,
      'غادي نبدأ دابا تحميل التحديث. خليه مفتوح حتى يكمل التحميل.'
    );

    await autoUpdater.downloadUpdate();
  } catch (error) {
    updateDownloading = false;
    console.error('[Updater download]', error);
    showError(
      'ما قدرناش نحملو التحديث',
      `وقع مشكل أثناء تحميل النسخة ${version}.\n\n${error?.message || error}`
    );
  }
}

function installDownloadedUpdate(version) {
  if (updateDownloading) updateDownloading = false;
  console.log('[Updater] installing downloaded update:', version);

  // Give electron-updater a moment to finish writing the downloaded installer.
  // Then quit the current process and let NSIS replace the installed files.
  setTimeout(() => {
    try {
      autoUpdater.quitAndInstall(false, true);
    } catch (error) {
      console.error('[Updater install]', error);
      try {
        app.quit();
      } catch (_) {}
    }
  }, 500);
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] checking for update');
  });

  autoUpdater.on('update-available', info => {
    console.log('[Updater] update available:', info.version);
    if (updateDialogOpen || updateDownloading) return;
    updateDialogOpen = true;
    startUpdateDownload(info.version).finally(() => {
      updateDialogOpen = false;
    });
  });

  autoUpdater.on('download-progress', progress => {
    console.log(`[Updater] downloading ${progress.percent.toFixed(1)}%`);
  });

  autoUpdater.on('update-downloaded', info => {
    updateDownloading = false;
    console.log('[Updater] update downloaded:', info.version);

    if (!mainWindow || mainWindow.isDestroyed()) {
      installDownloadedUpdate(info.version);
      return;
    }

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Gestion Hamza — التحديث جاهز',
      message: `النسخة ${info.version} تحمّلات بنجاح.`,
      detail: 'ضغط على «تثبيت الآن» باش يسد البرنامج ويثبت النسخة الجديدة تلقائياً.',
      buttons: ['تثبيت الآن', 'لاحقاً'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    }).then(({ response }) => {
      if (response === 0) {
        installDownloadedUpdate(info.version);
      }
    }).catch(error => {
      console.error('[Updater install dialog]', error);
    });
  });

  autoUpdater.on('error', error => {
    updateDownloading = false;
    console.error('[Updater error]', error);
    showError(
      'وقع مشكل فالتحديث',
      error?.message || String(error)
    );
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(error => {
      console.error('[Updater check]', error);
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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
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
