const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  sendToVertex: (payload) => ipcRenderer.invoke('send-to-vertex', payload),
  getPrompts: () => ipcRenderer.invoke('get-prompts'),
  closeWindow: () => ipcRenderer.send('close-window'),
  saveKey: (keyJson) => ipcRenderer.invoke('save-key', keyJson),
  loadKey: () => ipcRenderer.invoke('load-key'),
  deleteKey: () => ipcRenderer.invoke('delete-key'),
  savePrompts: (data) => ipcRenderer.invoke('save-prompts', data),
  setAlwaysOnTop: (flag) => ipcRenderer.send('set-always-on-top', flag),
  getOpacity: () => ipcRenderer.invoke('get-opacity'),
  saveOpacity: (val) => ipcRenderer.invoke('save-opacity', val),
});
