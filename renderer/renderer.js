let prompts = {};
let hasSavedKey = false;

window.addEventListener('DOMContentLoaded', async () => {
  prompts = await window.api.getPrompts();

  // Check for saved key
  const keyState = await window.api.loadKey();
  updateKeyUI(keyState);

  // Populate language dropdowns
  const languages = prompts.languages || [];
  ['sourceLang', 'targetLang'].forEach((id) => {
    const select = document.getElementById(id);
    languages.forEach((lang) => {
      const option = document.createElement('option');
      option.value = lang;
      option.textContent = lang;
      select.appendChild(option);
    });
  });

  // Default target lang to second option if available
  const targetSelect = document.getElementById('targetLang');
  if (targetSelect.options.length > 1) targetSelect.selectedIndex = 1;

  updateModeBadge();

  // Language change → update mode badge
  document.getElementById('sourceLang').addEventListener('change', updateModeBadge);
  document.getElementById('targetLang').addEventListener('change', updateModeBadge);

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${target}`).classList.add('active');
    });
  });

  // Close button
  document.getElementById('closeBtn').addEventListener('click', () => {
    showConfirmModal(() => window.api.closeWindow());
  });

  // File load button (settings tab)
  document.getElementById('loadFileBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });

  document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      document.getElementById('keyTextarea').value = ev.target.result;
      document.getElementById('fileStatus').textContent = file.name;
      validateKey(ev.target.result);
    };
    reader.readAsText(file);
  });

  // Key textarea blur → validate
  document.getElementById('keyTextarea').addEventListener('blur', (e) => {
    validateKey(e.target.value.trim());
  });

  // Save key button
  document.getElementById('saveKeyBtn').addEventListener('click', async () => {
    const keyJson = document.getElementById('keyTextarea').value.trim();
    if (!keyJson) return;
    const result = await window.api.saveKey(keyJson);
    if (result.success) {
      updateKeyUI({ exists: true, projectId: result.projectId });
    } else {
      const feedback = document.getElementById('keyFeedback');
      feedback.textContent = `✗ 저장 실패: ${result.error}`;
      feedback.className = 'key-feedback error';
      feedback.style.display = '';
    }
  });

  // Delete key button
  document.getElementById('deleteKeyBtn').addEventListener('click', async () => {
    await window.api.deleteKey();
    updateKeyUI({ exists: false });
  });

  // Submit
  document.getElementById('submitBtn').addEventListener('click', handleSubmit);

  // Clear input button
  document.getElementById('clearInputBtn').addEventListener('click', () => {
    document.getElementById('inputText').value = '';
  });

  // Copy button
  document.getElementById('copyBtn').addEventListener('click', () => {
    const text = document.getElementById('resultText').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copyBtn');
      btn.textContent = '복사됨';
      setTimeout(() => { btn.textContent = '복사'; }, 1500);
    });
  });
});

function updateModeBadge() {
  const src = document.getElementById('sourceLang').value;
  const tgt = document.getElementById('targetLang').value;
  const badge = document.getElementById('modeBadge');
  if (src === tgt) {
    badge.textContent = '교정';
    badge.classList.add('grammar');
  } else {
    badge.textContent = '번역';
    badge.classList.remove('grammar');
  }
}

function validateKey(raw) {
  const feedback = document.getElementById('keyFeedback');
  const saveBtn = document.getElementById('saveKeyBtn');
  if (!raw) {
    feedback.style.display = 'none';
    saveBtn.style.display = 'none';
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.project_id || !parsed.client_email) {
      throw new Error('필수 필드 누락 (project_id, client_email)');
    }
    feedback.textContent = '✓ JSON 키가 유효합니다.';
    feedback.className = 'key-feedback ok';
    feedback.style.display = '';
    saveBtn.style.display = '';
  } catch (err) {
    feedback.textContent = `✗ 유효하지 않은 JSON: ${err.message}`;
    feedback.className = 'key-feedback error';
    feedback.style.display = '';
    saveBtn.style.display = 'none';
  }
}

function updateKeyUI(state) {
  hasSavedKey = state.exists;
  const savedDisplay = document.getElementById('savedKeyDisplay');
  const inputArea = document.getElementById('keyInputArea');

  if (state.exists) {
    document.getElementById('savedProjectId').textContent = state.projectId;
    savedDisplay.style.display = '';
    inputArea.style.display = 'none';
  } else {
    savedDisplay.style.display = 'none';
    inputArea.style.display = '';
    // Reset input area
    document.getElementById('keyTextarea').value = '';
    document.getElementById('fileStatus').textContent = '선택된 파일 없음';
    document.getElementById('keyFeedback').style.display = 'none';
    document.getElementById('saveKeyBtn').style.display = 'none';
  }
}

async function handleSubmit() {
  const keyJson = hasSavedKey ? '' : document.getElementById('keyTextarea').value.trim();
  if (!hasSavedKey && !keyJson) return showError('설정 탭에서 Vertex AI JSON 키를 먼저 입력해주세요.');

  const sourceLang = document.getElementById('sourceLang').value;
  const targetLang = document.getElementById('targetLang').value;
  const inputText = document.getElementById('inputText').value.trim();

  if (!inputText) return showError('텍스트를 입력해주세요.');

  const task = sourceLang === targetLang ? 'grammar' : 'translation';
  const systemPrompt = prompts[task] || '';
  const langInfo = task === 'translation'
    ? `Source language: ${sourceLang}\nTarget language: ${targetLang}`
    : `Language: ${sourceLang}`;
  const userMessage = `${langInfo}\n\nText:\n${inputText}`;

  showError('');
  clearResult();
  setLoading(true);

  const response = await window.api.sendToVertex({ keyJson, systemPrompt, userMessage });

  setLoading(false);

  if (response.success) {
    showResult(response.result);
  } else {
    showError(`오류: ${response.error}`);
  }
}

function setLoading(on) {
  const btn = document.getElementById('submitBtn');
  btn.disabled = on;
  btn.textContent = on ? '처리 중...' : '전송';
}

function showResult(text) {
  const el = document.getElementById('resultText');
  el.textContent = text;
  el.scrollTop = 0;
  document.getElementById('copyBtn').style.display = '';
}

function clearResult() {
  document.getElementById('resultText').textContent = '';
  document.getElementById('copyBtn').style.display = 'none';
}

function showConfirmModal(onConfirm) {
  const modal = document.getElementById('confirmModal');
  modal.style.display = 'flex';
  const confirmBtn = document.getElementById('modalConfirm');
  const cancelBtn = document.getElementById('modalCancel');

  function cleanup() {
    modal.style.display = 'none';
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  }

  document.getElementById('modalConfirm').addEventListener('click', () => {
    cleanup();
    onConfirm();
  }, { once: true });

  document.getElementById('modalCancel').addEventListener('click', () => {
    cleanup();
  }, { once: true });
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  if (msg) {
    el.textContent = msg;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}
