const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
let mainWindow = null;
let updateDialogOpen = false;
function showUpdateDialog(version, downloaded = false) {
  if (!mainWindow || mainWindow.isDestroyed() || updateDialogOpen) return;
  updateDialogOpen = true;
  const downloadedMsg = downloaded;
  dialog.showMessageBox(mainWindow, {
    type:'info',
    title: downloadedMsg ? 'Gestion Hamza — التحديث جاهز' : 'Gestion Hamza — تحديث جديد',
    message: downloadedMsg ? `النسخة ${version} جاهزة للتثبيت.` : `كاينة نسخة جديدة من Gestion Hamza: ${version}`,
    detail: downloadedMsg ? 'التحديث تحمّل. اضغط «تثبيت الآن» لإعادة تشغيل التطبيق بالنسخة الجديدة.' : 'غادي يبدأ تحميل التحديث تلقائياً.',
    buttons: downloadedMsg ? ['تثبيت الآن','لاحقاً'] : ['حسناً'],
    defaultId:0, cancelId: downloadedMsg ? 1 : 0
  }).then(({response}) => { updateDialogOpen=false; if(downloadedMsg && response===0) autoUpdater.quitAndInstall(false,true); }).catch(()=>{updateDialogOpen=false;});
}
function setupAutoUpdater(){
  if(!app.isPackaged) return;
  autoUpdater.autoDownload=true;
  autoUpdater.autoInstallOnAppQuit=false;
  autoUpdater.allowPrerelease=false;
  autoUpdater.on('update-available', info=>showUpdateDialog(info.version,false));
  autoUpdater.on('update-downloaded', info=>showUpdateDialog(info.version,true));
  autoUpdater.on('error', err=>console.error('[Updater]',err));
  setTimeout(()=>autoUpdater.checkForUpdates().catch(err=>console.error('[Updater]',err)),5000);
}
function createWindow(){
  mainWindow=new BrowserWindow({width:1200,height:800,minWidth:900,minHeight:650,show:false,icon:path.join(__dirname,'icon.ico'),backgroundColor:'#FAF6EF',autoHideMenuBar:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname,'index.html'));
  mainWindow.once('ready-to-show',()=>{mainWindow.maximize();mainWindow.show();});
  mainWindow.webContents.setWindowOpenHandler(({url})=>{if(/^https?:\/\//i.test(url)) shell.openExternal(url); return {action:'deny'};});
  mainWindow.on('closed',()=>{mainWindow=null;});
}
app.whenReady().then(()=>{createWindow();setupAutoUpdater();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
