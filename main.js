// ============================================================
// main.js —— Electron 主进程
// 职责：创建无边框透明置顶浮窗；窗口控制；
//       本机 data.json 读写、备份导出与导入恢复。
// ============================================================
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const StoreCore = require('./src/store-core.js');
const Defaults = require('./src/defaults.js');

let mainWindow = null;

// ---------------- 本机数据文件 ----------------
function dataFilePath() {
  return path.join(app.getPath('userData'), 'data.json');
}

function readDataFile() {
  const file = dataFilePath();
  if (!fs.existsSync(file)) {
    const def = Defaults.createDefaultData();
    fs.writeFileSync(file, JSON.stringify(def, null, 2), 'utf8');
    return def;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const { ok } = StoreCore.validateData(parsed);
    return ok ? StoreCore.normalizeData(parsed) : Defaults.createDefaultData();
  } catch {
    // 文件损坏：回退默认数据，不覆盖磁盘上的原文件
    return Defaults.createDefaultData();
  }
}

function writeDataFile(data) {
  fs.writeFileSync(dataFilePath(), JSON.stringify(data, null, 2), 'utf8');
}

// ---------------- 窗口 ----------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 680,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setAlwaysOnTop(true);
  mainWindow.loadFile('index.html');

  // 验收辅助：加载完成后回读关键卡片渲染情况，输出到主进程控制台
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`JSON.stringify({
      clock: document.getElementById('clock').textContent,
      status: document.getElementById('statusLabel').textContent,
      next: document.getElementById('nextDetail').textContent,
      checkins: document.querySelectorAll('#checkinList .checkin-item').length,
      lessons: document.querySelectorAll('#todayList .lesson-item').length,
      weekCells: document.querySelectorAll('#weekGrid .week-cell').length,
      dots: document.querySelectorAll('#themeDots .theme-dot').length
    })`).then((result) => console.log('[render-check]', result));
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------- 窗口控制 IPC ----------------
ipcMain.on('window:toggle-pin', (event) => {
  if (!mainWindow) return;
  const next = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(next);
  event.reply('window:pinned-changed', next);
});

ipcMain.on('window:quit', () => {
  app.quit();
});

// 渲染层错误上报到主进程控制台，便于验收时排查
ipcMain.on('renderer:error', (_event, msg) => {
  console.error('[renderer]', msg);
});

// ---------------- 数据 IPC ----------------
ipcMain.handle('data:load', () => readDataFile());

ipcMain.handle('data:save', (_event, data) => {
  const { ok, errors } = StoreCore.validateData(data);
  if (!ok) return { ok: false, errors };
  const normalized = StoreCore.normalizeData(data);
  writeDataFile(normalized);
  return { ok: true, data: normalized };
});

ipcMain.handle('data:export', async () => {
  const current = readDataFile();
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'teacher-app-backup.json',
    filters: [{ name: 'JSON 备份', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  fs.writeFileSync(filePath, JSON.stringify(current, null, 2), 'utf8');
  return { ok: true, filePath };
});

ipcMain.handle('data:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'JSON 备份', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths || filePaths.length === 0) return { ok: false, canceled: true };

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
  } catch {
    return { ok: false, errors: ['备份文件不是合法 JSON'] };
  }

  const { ok, errors } = StoreCore.validateData(parsed);
  if (!ok) return { ok: false, errors }; // 校验失败：不覆盖现有数据

  const normalized = StoreCore.normalizeData(parsed);
  writeDataFile(normalized);
  return { ok: true, data: normalized };
});

// ---------------- 生命周期 ----------------
app.whenReady().then(() => {
  readDataFile(); // 首启即确保本机数据文件存在（示例占位数据）
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
