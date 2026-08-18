const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let updateWindow = null;
let updateDialogOpen = false;
let updateDownloading = false;
let availableUpdateVersion = null;

function showError(message, detail) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  dialog.showMessageBox(mainWindow, {
    type: 'error', title: 'Gestion Hamza — تحديث', message, detail, buttons: ['حسناً']
  }).catch(() => {});
}

function createUpdateWindow(version) {
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.focus();
    return;
  }

  updateWindow = new BrowserWindow({
    parent: mainWindow,
    modal: true,
    width: 520,
    height: 300,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Gestion Hamza — تحديث',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });

  const html = `<!doctype html><html lang="ar"><head><meta charset="UTF-8"><style>
  body{font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#faf6ef;margin:0;padding:28px;color:#2f2a25;text-align:center}
  h2{margin:0 0 10px;font-size:23px}.sub{margin:0 0 22px;color:#6d665f;font-size:15px}
  button{border:0;border-radius:10px;padding:11px 22px;font-size:15px;cursor:pointer;margin:5px}
  #download{background:#8b5e34;color:white}#later{background:#e7ded2;color:#4b4239}
  #status{margin-top:18px;font-size:14px;color:#6d665f;min-height:22px}
  .bar{height:12px;background:#e4ddd5;border-radius:20px;overflow:hidden;margin:12px 0 20px}.fill{height:100%;width:0;background:#8b5e34;transition:width .2s}
  #install{display:none;background:#2e7d32;color:#fff}.hidden{display:none!important}
</style></head><body>
  <h2>🆕 تحديث جديد متوفر</h2>
  <p class="sub">النسخة الجديدة <b>${version}</b> متوفرة لـ Gestion Hamza.</p>
  <div id="choice"><button id="download">⬇️ تحميل التحديث</button><button id="later">لاحقاً</button></div>
  <div id="progress" class="hidden"><div class="bar"><div class="fill" id="fill"></div></div><div id="status">جاري التحميل… 0%</div></div>
  <button id="install">✅ تثبيت الآن وإعادة التشغيل</button>
<script>
const { ipcRenderer } = require('electron');
</script></body></html>`;

  // Buttons are handled by executeJavaScript from the main process to keep nodeIntegration disabled.
  updateWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  updateWindow.webContents.once('did-finish-load', () => {
    updateWindow.webContents.executeJavaScript(`
      document.getElementById('download').onclick=()=>document.body.dataset.action='download';
      document.getElementById('later').onclick=()=>document.body.dataset.action='later';
      document.getElementById('install').onclick=()=>document.body.dataset.action='install';
    `).catch(() => {});
  });

  const poll = setInterval(async () => {
    if (!updateWindow || updateWindow.isDestroyed()) { clearInterval(poll); return; }
    try {
      const action = await updateWindow.webContents.executeJavaScript('document.body.dataset.action || ""');
      if (action === 'download') {
        await updateWindow.webContents.executeJavaScript(`
          document.getElementById('choice').classList.add('hidden');
          document.getElementById('progress').classList.remove('hidden');
          document.getElementById('status').textContent='جاري تحميل التحديث… 0%';
        `);
        clearInterval(poll);
        updateDownloading = true;
        try {
          await autoUpdater.downloadUpdate();
        } catch (error) {
          updateDownloading = false;
          if (updateWindow && !updateWindow.isDestroyed()) {
            updateWindow.webContents.executeJavaScript(`document.getElementById('status').textContent=${JSON.stringify('وقع مشكل أثناء التحميل: ' + (error?.message || error))}`).catch(() => {});
          }
        }
      } else if (action === 'later') {
        clearInterval(poll);
        updateWindow.close();
      } else if (action === 'install') {
        clearInterval(poll);
        installDownloadedUpdate(version);
      }
    } catch (_) {}
  }, 250);

  updateWindow.on('closed', () => {
    clearInterval(poll);
    updateWindow = null;
    updateDialogOpen = false;
  });
}

function installDownloadedUpdate(version) {
  updateDownloading = false;
  console.log('[Updater] installing downloaded update:', version);
  if (updateWindow && !updateWindow.isDestroyed()) updateWindow.close();
  setTimeout(() => {
    try { autoUpdater.quitAndInstall(false, true); }
    catch (error) { console.error('[Updater install]', error); try { app.quit(); } catch (_) {} }
  }, 500);
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => console.log('[Updater] checking for update'));

  autoUpdater.on('update-available', info => {
    console.log('[Updater] update available:', info.version);
    if (updateDialogOpen || updateDownloading) return;
    updateDialogOpen = true;
    availableUpdateVersion = info.version;
    createUpdateWindow(info.version);
  });

  autoUpdater.on('download-progress', progress => {
    console.log(`[Updater] downloading ${progress.percent.toFixed(1)}%`);
    if (updateWindow && !updateWindow.isDestroyed()) {
      const percent = Math.max(0, Math.min(100, progress.percent));
      updateWindow.webContents.executeJavaScript(`
        document.getElementById('fill').style.width='${percent.toFixed(1)}%';
        document.getElementById('status').textContent='جاري تحميل التحديث… ${percent.toFixed(1)}%';
      `).catch(() => {});
    }
  });

  autoUpdater.on('update-downloaded', info => {
    updateDownloading = false;
    availableUpdateVersion = info.version;
    console.log('[Updater] update downloaded:', info.version);

    if (!updateWindow || updateWindow.isDestroyed()) {
      createUpdateWindow(info.version);
      setTimeout(() => {
        if (updateWindow && !updateWindow.isDestroyed()) {
          updateWindow.webContents.executeJavaScript(`
            document.getElementById('choice').classList.add('hidden');
            document.getElementById('progress').classList.remove('hidden');
            document.getElementById('fill').style.width='100%';
            document.getElementById('status').textContent='✅ التحديث جاهز للتثبيت';
            document.getElementById('install').style.display='inline-block';
          `).catch(() => {});
        }
      }, 300);
      return;
    }

    updateWindow.webContents.executeJavaScript(`
      document.getElementById('progress').classList.remove('hidden');
      document.getElementById('fill').style.width='100%';
      document.getElementById('status').textContent='✅ التحديث جاهز للتثبيت';
      document.getElementById('install').style.display='inline-block';
    `).catch(() => {});
  });

  autoUpdater.on('error', error => {
    updateDownloading = false;
    console.error('[Updater error]', error);
    showError('وقع مشكل فالتحديث', error?.message || String(error));
  });

  setTimeout(() => autoUpdater.checkForUpdates().catch(error => console.error('[Updater check]', error)), 5000);
}

// v1.0.7: تحسين البيع بلا كود بار — تسجيل المدفوع والباقي/الصرف والربح.
function injectV107Features() {
  const code = String.raw`
(() => {
  if (window.__v107Installed) return;
  window.__v107Installed = true;

  const oldRenderSaleRow = window.renderSaleRow;

  window.checkout = async function () {
    if (!state.cart || state.cart.length === 0) return;
    const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);

    const rawPaid = await showPromptModal('💵 شحال خلص الزبون؟\\nالمجموع: ' + fmt(total) + ' د.م', { isText: true });
    if (rawPaid === null) return;

    const paid = parseFloat(String(rawPaid).replace(',', '.'));
    if (isNaN(paid) || paid < 0) {
      playBeep('error');
      state.notice = { type: 'error', text: 'دخل مبلغ صحيح ديال شحال خلص الزبون.' };
      render();
      return;
    }

    const remaining = Math.max(0, total - paid);
    const change = Math.max(0, paid - total);

    state.cart.forEach(item => {
      if (state.products[item.barcode]) state.products[item.barcode].qty = Math.max(0, state.products[item.barcode].qty - item.qty);
    });

    const sale = { id: Date.now(), date: nowLabel(), items: state.cart.map(item => ({ ...item })), total, paid, remaining, change, paymentStatus: remaining > 0 ? 'partial' : 'paid' };
    state.sales.unshift(sale);
    state.cart = [];
    state.lastReceiptSaleId = sale.id;
    state.notice = { type: remaining > 0 ? 'warn' : 'ok', text: remaining > 0 ? 'تم البيع — خلص: ' + fmt(paid) + ' د.م — باقي: ' + fmt(remaining) + ' د.م' : change > 0 ? 'تم البيع — خلص: ' + fmt(paid) + ' د.م — الصرف: ' + fmt(change) + ' د.م' : 'تم البيع — خلص الزبون ' + fmt(paid) + ' د.م كاملة' };
    playBeep('ok');
    save();
    render();
  };

  window.renderSaleRow = function (s) {
    const html = oldRenderSaleRow(s);
    if (s.paid == null) return html;
    return html + '<div style="padding:8px 12px 12px;border-top:1px solid var(--border);font-size:12px;color:var(--muted);">💵 خلص: <b style="color:var(--success);">' + fmt(s.paid) + ' د.م</b>' + (s.remaining > 0 ? ' — باقي: <b style="color:var(--danger);">' + fmt(s.remaining) + ' د.م</b>' : '') + (s.change > 0 ? ' — الصرف: <b style="color:var(--accent);">' + fmt(s.change) + ' د.م</b>' : '') + '</div>';
  };

  if (typeof render === 'function') render();
})();
`;
  mainWindow.webContents.executeJavaScript(code, true).catch(error => console.error('[v1.0.7 injection]', error));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 900, minHeight: 650,
    show: false, icon: path.join(__dirname, 'icon.ico'), backgroundColor: '#FAF6EF', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.once('did-finish-load', () => injectV107Features());
  mainWindow.once('ready-to-show', () => { mainWindow.maximize(); mainWindow.show(); });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
