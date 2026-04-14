const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { GoogleAuth } = require('google-auth-library');

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

// Vertex AI request handler
ipcMain.handle('send-to-vertex', async (event, { keyJson, prompt }) => {
  try {
    const credentials = typeof keyJson === 'string' ? JSON.parse(keyJson) : keyJson;

    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    const projectId = credentials.project_id;
    const promptsPath = path.join(__dirname, 'prompts.json');
    const promptsData = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));
    const model = promptsData.model || 'gemini-1.5-flash';
    const location = 'us-central1';

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Vertex AI request failed');
    }

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
