const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { GoogleAuth } = require('google-auth-library');

const keyFilePath        = () => path.join(app.getPath('userData'), 'saved-key.bin');
const profileKeyFilePath = (id) => path.join(app.getPath('userData'), `custom-key-${id}.bin`);
const appConfigFilePath  = () => path.join(app.getPath('userData'), 'app-config.json');
const promptsFilePath    = () => app.isPackaged
  ? path.join(process.resourcesPath, 'prompts.json')
  : path.join(__dirname, 'prompts.json');
const windowStatePath    = () => path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    const p = windowStatePath();
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {}
  return { width: 900, height: 640 };
}

function saveWindowState(win) {
  try {
    if (win.isMaximized() || win.isMinimized()) return;
    const bounds = win.getBounds();
    fs.writeFileSync(windowStatePath(), JSON.stringify(bounds), 'utf-8');
  } catch {}
}

function createWindow() {
  const state = loadWindowState();
  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    ...(state.x !== undefined && { x: state.x }),
    ...(state.y !== undefined && { y: state.y }),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  let saveTimer;
  const debouncedSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveWindowState(win), 500);
  };
  win.on('resize', debouncedSave);
  win.on('move', debouncedSave);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Save key
ipcMain.handle('save-key', async (event, keyJson) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('암호화를 사용할 수 없는 환경입니다.');
    }
    const encrypted = safeStorage.encryptString(keyJson);
    fs.writeFileSync(keyFilePath(), encrypted);
    const parsed = JSON.parse(keyJson);
    return { success: true, projectId: parsed.project_id };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Load key — returns project_id only, never the raw key
ipcMain.handle('load-key', async () => {
  try {
    const p = keyFilePath();
    if (!fs.existsSync(p)) return { exists: false };
    const encrypted = fs.readFileSync(p);
    const keyJson = safeStorage.decryptString(encrypted);
    const parsed = JSON.parse(keyJson);
    return { exists: true, projectId: parsed.project_id };
  } catch {
    return { exists: false };
  }
});

// Delete key
ipcMain.handle('delete-key', async () => {
  try {
    const p = keyFilePath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── App Config (provider 선택 등 비민감 설정) ────────────────────────────────
ipcMain.handle('load-app-config', async () => {
  try {
    const p = appConfigFilePath();
    if (!fs.existsSync(p)) return { provider: 'vertex' };
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return { provider: 'vertex' };
  }
});

ipcMain.handle('save-app-config', async (event, config) => {
  try {
    fs.writeFileSync(appConfigFilePath(), JSON.stringify(config, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── OpenAI Compatible 프로필 관리 ────────────────────────────────────────────
// 프로필 저장 (비민감: app-config.json / 민감: custom-key-{id}.bin)
ipcMain.handle('save-profile', async (event, { profile, apiKey }) => {
  try {
    const p = appConfigFilePath();
    const config = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : { provider: 'vertex', profiles: [] };
    if (!config.profiles) config.profiles = [];

    const existingIdx = config.profiles.findIndex(pr => pr.id === profile.id);
    if (existingIdx >= 0) {
      config.profiles[existingIdx] = { ...config.profiles[existingIdx], ...profile };
    } else {
      config.profiles.push(profile);
    }

    if (apiKey) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('암호화를 사용할 수 없는 환경입니다.');
      const encrypted = safeStorage.encryptString(apiKey);
      fs.writeFileSync(profileKeyFilePath(profile.id), encrypted);
      const saved = config.profiles.find(pr => pr.id === profile.id);
      if (saved) saved.hasKey = true;
    }

    fs.writeFileSync(p, JSON.stringify(config, null, 2), 'utf-8');
    return { success: true, config };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 프로필 삭제 (app-config.json에서 제거 + 키 파일 삭제)
ipcMain.handle('delete-profile', async (event, id) => {
  try {
    const p = appConfigFilePath();
    const config = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : { profiles: [] };
    config.profiles = (config.profiles || []).filter(pr => pr.id !== id);
    if (config.activeProfileId === id) config.activeProfileId = null;
    fs.writeFileSync(p, JSON.stringify(config, null, 2), 'utf-8');
    const kp = profileKeyFilePath(id);
    if (fs.existsSync(kp)) fs.unlinkSync(kp);
    return { success: true, config };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 활성 프로필 설정
ipcMain.handle('set-active-profile', async (event, id) => {
  try {
    const p = appConfigFilePath();
    const config = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : { profiles: [] };
    config.activeProfileId = id;
    fs.writeFileSync(p, JSON.stringify(config, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── 통합 LLM 요청 핸들러 ────────────────────────────────────────────────────
ipcMain.handle('send-to-llm', async (event, { systemPrompt, userMessage }) => {
  try {
    // provider 판단
    const configPath = appConfigFilePath();
    const appConfig = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      : { provider: 'vertex' };
    const provider = appConfig.provider || 'vertex';

    const promptsData = JSON.parse(fs.readFileSync(promptsFilePath(), 'utf-8'));

    // ── Vertex AI ──────────────────────────────────────────────────────────────
    if (provider === 'vertex') {
      const p = keyFilePath();
      if (!fs.existsSync(p)) throw new Error('저장된 키가 없습니다. 설정 탭에서 키를 입력해주세요.');
      const encrypted = fs.readFileSync(p);
      const resolvedKeyJson = safeStorage.decryptString(encrypted);
      const credentials = JSON.parse(resolvedKeyJson);

      const auth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });
      const client = await auth.getClient();
      const { token } = await client.getAccessToken();

      const projectId = credentials.project_id;
      const model = promptsData.model || 'gemini-3-flash-preview';
      const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${model}:generateContent`;

      const body = {
        ...(systemPrompt && { system_instruction: { parts: [{ text: systemPrompt }] } }),
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generation_config: {
          max_output_tokens: promptsData.max_output_tokens ?? 2048,
          ...(promptsData.temperature != null && { temperature: promptsData.temperature }),
          ...(promptsData.thinking_level && {
            thinking_config: { thinking_level: promptsData.thinking_level }
          })
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) { const t = await response.text(); throw new Error(`[${response.status}] ${t}`); }
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('No response from model');
      return { success: true, result: text };
    }

    // ── OpenAI Compatible (프로필 기반) ──────────────────────────────────────
    if (provider === 'openai') {
      const activeId = appConfig.activeProfileId;
      const profile  = (appConfig.profiles || []).find(pr => pr.id === activeId);
      if (!profile) throw new Error('활성 프로필이 없습니다. 설정 탭에서 프로필을 선택해주세요.');

      const kp = profileKeyFilePath(activeId);
      if (!fs.existsSync(kp)) throw new Error(`"${profile.name}" 프로필의 API 키가 없습니다.`);
      const encrypted = fs.readFileSync(kp);
      const apiKey = safeStorage.decryptString(encrypted);

      if (!profile.endpoint) throw new Error('엔드포인트 URL이 없는 프로필입니다.');
      if (!profile.model)    throw new Error('모델명이 없는 프로필입니다.');

      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: userMessage });

      const body = {
        model: profile.model,
        messages,
        ...(promptsData.temperature != null && { temperature: promptsData.temperature })
      };

      const response = await fetch(profile.endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) { const t = await response.text(); throw new Error(`[${response.status}] ${t}`); }
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('No response from model');
      return { success: true, result: text };
    }

    throw new Error(`알 수 없는 provider: ${provider}`);

  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    const message = isTimeout
      ? '요청 시간이 초과됐습니다 (30초). 네트워크 상태를 확인하고 다시 시도해주세요.'
      : err.message;
    return { success: false, error: message, isTimeout };
  }
});

// (send-to-vertex 채널 제거됨 — renderer.js에서 send-to-llm 단일 채널 사용)

// Always on top
ipcMain.on('set-always-on-top', (event, flag) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setAlwaysOnTop(flag);
});

// Opacity
ipcMain.handle('get-opacity', async () => {
  const state = loadWindowState();
  return state.opacity ?? 1.0;
});

ipcMain.handle('save-opacity', async (event, opacity) => {
  try {
    const state = loadWindowState();
    state.opacity = opacity;
    fs.writeFileSync(windowStatePath(), JSON.stringify(state), 'utf-8');
    return { success: true };
  } catch {
    return { success: false };
  }
});

// Close window
ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

// Load prompts
ipcMain.handle('get-prompts', async () => {
  const promptsPath = promptsFilePath();
  const raw = fs.readFileSync(promptsPath, 'utf-8');
  return JSON.parse(raw);
});

// Save prompts
ipcMain.handle('save-prompts', async (event, data) => {
  try {
    const promptsPath = promptsFilePath();
    fs.writeFileSync(promptsPath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
