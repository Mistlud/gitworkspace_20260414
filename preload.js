const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // LLM 요청 (통합 — provider/프로필은 main.js가 app-config.json에서 판단)
  sendToLlm: (payload) => ipcRenderer.invoke('send-to-llm', payload),

  // App config (provider 선택 등 비민감 설정)
  loadAppConfig: ()       => ipcRenderer.invoke('load-app-config'),
  saveAppConfig: (config) => ipcRenderer.invoke('save-app-config', config),

  // Vertex AI JSON 키 (암호화 저장)
  saveKey:   (keyJson) => ipcRenderer.invoke('save-key', keyJson),
  loadKey:   ()        => ipcRenderer.invoke('load-key'),
  deleteKey: ()        => ipcRenderer.invoke('delete-key'),

  // OpenAI Compatible 프로필 관리
  saveProfile:      ({ profile, apiKey }) => ipcRenderer.invoke('save-profile', { profile, apiKey }),
  deleteProfile:    (id)                  => ipcRenderer.invoke('delete-profile', id),
  setActiveProfile: (id)                  => ipcRenderer.invoke('set-active-profile', id),

  // Prompts
  getPrompts:  ()     => ipcRenderer.invoke('get-prompts'),
  savePrompts: (data) => ipcRenderer.invoke('save-prompts', data),

  // Window
  closeWindow:    ()     => ipcRenderer.send('close-window'),
  setAlwaysOnTop: (flag) => ipcRenderer.send('set-always-on-top', flag),
  getOpacity:     ()     => ipcRenderer.invoke('get-opacity'),
  saveOpacity:    (val)  => ipcRenderer.invoke('save-opacity', val),
});
