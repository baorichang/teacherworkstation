// ============================================================
// preload.js —— 预加载脚本
// 通过 contextBridge 向页面暴露白名单接口，页面不直接接触 Node。
// ============================================================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appAPI', {
  // 窗口控制
  togglePin: () => ipcRenderer.send('window:toggle-pin'),
  onPinnedChanged: (callback) =>
    ipcRenderer.on('window:pinned-changed', (_event, value) => callback(value)),
  quit: () => ipcRenderer.send('window:quit'),
  reportError: (message) => ipcRenderer.send('renderer:error', message),

  // 数据读写与备份
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  exportBackup: () => ipcRenderer.invoke('data:export'),
  importBackup: () => ipcRenderer.invoke('data:import')
});
