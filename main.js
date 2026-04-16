const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { GoogleAuth } = require('google-auth-library');

const keyFilePath = () => path.join(app.getPath('userData'), 'saved-key.bin');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 640,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
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

// Vertex AI request handler
ipcMain.handle('send-to-vertex', async (event, { keyJson, systemPrompt, userMessage }) => {
  try {
    let resolvedKeyJson = keyJson;
    if (!resolvedKeyJson) {
      const p = keyFilePath();
      if (!fs.existsSync(p)) throw new Error('저장된 키가 없습니다. 설정 탭에서 키를 입력해주세요.');
      const encrypted = fs.readFileSync(p);
      resolvedKeyJson = safeStorage.decryptString(encrypted);
    }
    const credentials = typeof resolvedKeyJson === 'string' ? JSON.parse(resolvedKeyJson) : resolvedKeyJson;

    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    const projectId = credentials.project_id;
    const promptsPath = path.join(__dirname, 'prompts.json');
    const promptsData = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));
    const model = promptsData.model || 'gemini-3-flash-preview';

    const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${model}:generateContent`;

    const body = {
      ...(systemPrompt && {
        system_instruction: { parts: [{ text: systemPrompt }] }
      }),
      contents: [
        { role: 'user', parts: [{ text: userMessage }] }
      ],
      generation_config: {
        temperature: promptsData.temperature ?? 0.1,
        max_output_tokens: 2048,
        ...(promptsData.thinking_level && {
          thinking_config: { thinking_level: promptsData.thinking_level }
        })
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`[${response.status}] ${errText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('No response from model');

    return { success: true, result: text };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Close window
ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

// Load prompts
ipcMain.handle('get-prompts', async () => {
  const promptsPath = path.join(__dirname, 'prompts.json');
  const raw = fs.readFileSync(promptsPath, 'utf-8');
  return JSON.parse(raw);
});
