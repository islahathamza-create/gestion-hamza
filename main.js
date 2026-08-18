const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let updateDialogOpen = false;
let updateDownloading = false;

function showInfo(title, message, detail, buttons = ['حسناً']) {
  if (!mainWindow || mainWindow.isDestroyed()) return Promise.resolve({ response: 0 });
  return dialog.showMessageBox(mainWindow, {
    type: 'info', title, message, detail, buttons,
    defaultId: 0, cancelId: buttons.length > 1 ? 1 : 0
  });
}

function showError(message, detail) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  dialog.showMessageBox(mainWindow, {
    type: 'error', title: 'Gestion Hamza — تحديث', message, detail, buttons: ['حسناً']
  }).catch(() => {});
}

async function startUpdateDownload(version) {
  if (updateDownloading) return;
  updateDownloading = true;
  try {
    await showInfo('Gestion Hamza — تحديث جديد', `كاينة نسخة جديدة من Gestion Hamza: ${version}`, 'غادي نبدأ دابا تحميل التحديث. خليه مفتوح حتى يكمل التحميل.');
    await autoUpdater.downloadUpdate();
  } catch (error) {
    updateDownloading = false;
    console.error('[Updater download]', error);
    showError('ما قدرناش نحملو التحديث', `وقع مشكل أثناء تحميل النسخة ${version}.\n\n${error?.message || error}`);
  }
}

function installDownloadedUpdate(version) {
  if (updateDownloading) updateDownloading = false;
  console.log('[Updater] installing downloaded update:', version);
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
    startUpdateDownload(info.version).finally(() => { updateDialogOpen = false; });
  });
  autoUpdater.on('download-progress', progress => console.log(`[Updater] downloading ${progress.percent.toFixed(1)}%`));
  autoUpdater.on('update-downloaded', info => {
    updateDownloading = false;
    console.log('[Updater] update downloaded:', info.version);
    if (!mainWindow || mainWindow.isDestroyed()) { installDownloadedUpdate(info.version); return; }
    dialog.showMessageBox(mainWindow, {
      type: 'info', title: 'Gestion Hamza — التحديث جاهز',
      message: `النسخة ${info.version} تحمّلات بنجاح.`,
      detail: 'ضغط على «تثبيت الآن» باش يسد البرنامج ويثبت النسخة الجديدة تلقائياً.',
      buttons: ['تثبيت الآن', 'لاحقاً'], defaultId: 0, cancelId: 1, noLink: true
    }).then(({ response }) => { if (response === 0) installDownloadedUpdate(info.version); }).catch(error => console.error('[Updater install dialog]', error));
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

  const oldCheckout = window.checkout;
  const oldPrintSaleReceipt = window.printSaleReceipt;
  const oldRenderSaleRow = window.renderSaleRow;

  window.checkout = async function () {
    if (!state.cart || state.cart.length === 0) return;
    const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);

    const rawPaid = await showPromptModal(
      '💵 شحال خلص الزبون؟\\nالمجموع: ' + fmt(total) + ' د.م',
      { isText: true }
    );
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
      if (state.products[item.barcode]) {
        state.products[item.barcode].qty = Math.max(0, state.products[item.barcode].qty - item.qty);
      }
    });

    const sale = {
      id: Date.now(),
      date: nowLabel(),
      items: state.cart.map(item => ({ ...item })),
      total,
      paid,
      remaining,
      change,
      paymentStatus: remaining > 0 ? 'partial' : 'paid'
    };

    state.sales.unshift(sale);
    state.cart = [];
    state.lastReceiptSaleId = sale.id;
    state.notice = {
      type: remaining > 0 ? 'warn' : 'ok',
      text: remaining > 0
        ? `تم البيع — خلص: ${fmt(paid)} د.م — باقي: ${fmt(remaining)} د.م`
        : change > 0
          ? `تم البيع — خلص: ${fmt(paid)} د.م — الصرف: ${fmt(change)} د.م`
          : `تم البيع — خلص الزبون ${fmt(paid)} د.م كاملة`
    };
    playBeep('ok');
    save();
    render();
  };

  window.printSaleReceipt = function (saleId) {
    const sale = state.sales.find(s => s.id === saleId);
    if (!sale) return;
    const rows = sale.items.map(it => `<tr><td>${esc(it.name)} × ${it.qty}</td><td style="text-align:left;">${fmt(it.price * it.qty)}</td></tr>`).join('');
    const paymentRows = sale.paid != null ? `
      <div class="line"></div>
      <table>
        <tr><td>خلص الزبون</td><td style="text-align:left;">${fmt(sale.paid)} د.م</td></tr>
        ${sale.remaining > 0 ? `<tr><td>الباقي</td><td style="text-align:left;">${fmt(sale.remaining)} د.م</td></tr>` : ''}
        ${sale.change > 0 ? `<tr><td>الصرف</td><td style="text-align:left;">${fmt(sale.change)} د.م</td></tr>` : ''}
      </table>` : '';
    const body = `
      <h2>إصلاحات حمزة</h2>
      <p class="sub">${sale.date}${sale.returned ? ' — تم الإرجاع' : ''}</p>
      <div class="line"></div>
      <table>${rows}</table>
      <div class="line"></div>
      <div class="total"><span>المجموع</span><span>${fmt(sale.total)} د.م</span></div>
      ${paymentRows}
      <p class="foot">شكرا على تعاملكم معانا 🙏</p>`;
    openPrintWindow(body, 'تيكيت البيع');
  };

  window.renderSaleRow = function (s) {
    const html = oldRenderSaleRow(s);
    if (s.paid == null) return html;
    const payment = `<div style="padding:8px 12px 12px; border-top:1px solid var(--border); font-size:12px; color:var(--muted);">
      💵 خلص: <b style="color:var(--success);">${fmt(s.paid)} د.م</b>
      ${s.remaining > 0 ? ` — باقي: <b style="color:var(--danger);">${fmt(s.remaining)} د.م</b>` : ''}
      ${s.change > 0 ? ` — الصرف: <b style="color:var(--accent);">${fmt(s.change)} د.م</b>` : ''}
    </div>`;
    return html + payment;
  };

  // إعادة الرسم حتى تتعرف الواجهة على الوظائف الجديدة.
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
