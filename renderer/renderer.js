let prompts = {};
let hasSavedKey = false;

const LOCKED_LANGS = ['Korean', 'English'];

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

  // Prompt editors
  document.getElementById('translationPrompt').value = prompts.translation || '';
  document.getElementById('grammarPrompt').value = prompts.grammar || '';

  document.getElementById('saveTranslationBtn').addEventListener('click', async () => {
    prompts.translation = document.getElementById('translationPrompt').value;
    await window.api.savePrompts(prompts);
    showPromptFeedback('translationFeedback');
  });

  document.getElementById('saveGrammarBtn').addEventListener('click', async () => {
    prompts.grammar = document.getElementById('grammarPrompt').value;
    await window.api.savePrompts(prompts);
    showPromptFeedback('grammarFeedback');
  });

  // Max output tokens
  const maxTokensInput = document.getElementById('maxTokensInput');
  maxTokensInput.value = prompts.max_output_tokens ?? 2048;

  document.getElementById('maxTokensSaveBtn').addEventListener('click', async () => {
    const val = parseInt(maxTokensInput.value, 10);
    const feedback = document.getElementById('tokensFeedback');
    if (isNaN(val) || val < 256 || val > 8192) {
      feedback.textContent = '✗ 256 ~ 8192 사이의 값을 입력해주세요.';
      feedback.className = 'key-feedback error';
      feedback.style.display = '';
      return;
    }
    prompts.max_output_tokens = val;
    await window.api.savePrompts(prompts);
    feedback.textContent = `✓ ${val} 토큰으로 저장됨`;
    feedback.className = 'key-feedback ok';
    feedback.style.display = '';
    setTimeout(() => { feedback.style.display = 'none'; }, 2500);
  });

  // Model selection
  const modelSelect = document.getElementById('modelSelect');
  modelSelect.value = prompts.model || 'gemini-3-flash-preview';
  modelSelect.addEventListener('change', async () => {
    const selected = modelSelect.value;
    prompts.model = selected;
    if (selected === 'gemini-3-flash-preview') {
      prompts.thinking_level = 'MINIMAL';
    } else {
      delete prompts.thinking_level;
    }
    await window.api.savePrompts(prompts);
  });

  // Language management
  renderLangList();

  document.getElementById('langAddBtn').addEventListener('click', () => {
    const input = document.getElementById('langInput');
    addLanguage(input.value.trim());
    input.value = '';
  });

  document.getElementById('langInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const input = document.getElementById('langInput');
      addLanguage(input.value.trim());
      input.value = '';
    }
  });

  // Submit
  document.getElementById('submitBtn').addEventListener('click', handleSubmit);
  document.getElementById('retryBtn').addEventListener('click', handleSubmit);

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
    showError('');
    showResult(response.result);
  } else {
    showError(`오류: ${response.error}`, true);
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

function showError(msg, showRetry = false) {
  const bar = document.getElementById('errorBar');
  const el = document.getElementById('errorMsg');
  const retryBtn = document.getElementById('retryBtn');
  if (msg) {
    el.textContent = msg;
    retryBtn.style.display = showRetry ? '' : 'none';
    bar.style.display = '';
  } else {
    bar.style.display = 'none';
    retryBtn.style.display = 'none';
  }
}

function showPromptFeedback(id) {
  const el = document.getElementById(id);
  el.textContent = '✓ 저장됨';
  el.className = 'key-feedback ok';
  el.style.display = '';
  setTimeout(() => { el.style.display = 'none'; }, 2500);
}

function renderLangList() {
  const list = document.getElementById('langList');
  list.innerHTML = '';
  (prompts.languages || []).forEach((lang) => {
    const item = document.createElement('div');
    item.className = 'lang-item';

    const name = document.createElement('span');
    name.className = 'lang-item-name';
    name.textContent = lang;

    const del = document.createElement('button');
    del.className = 'lang-delete-btn';

    if (LOCKED_LANGS.includes(lang)) {
      del.textContent = '고정';
      del.disabled = true;
      del.classList.add('locked');
    } else {
      del.textContent = '삭제';
      del.addEventListener('click', () => deleteLanguage(lang));
    }

    item.appendChild(name);
    item.appendChild(del);
    list.appendChild(item);
  });
}

function showLangFeedback(msg, type) {
  const el = document.getElementById('langFeedback');
  el.textContent = msg;
  el.className = `key-feedback ${type}`;
  el.style.display = '';
  setTimeout(() => { el.style.display = 'none'; }, 2500);
}

async function addLanguage(name) {
  if (!name) return;
  if (prompts.languages.includes(name)) {
    return showLangFeedback(`✗ "${name}"은(는) 이미 목록에 있습니다.`, 'error');
  }
  prompts.languages.push(name);
  await saveAndSyncLanguages();
  showLangFeedback(`✓ "${name}" 추가됨`, 'ok');
}

async function deleteLanguage(name) {
  prompts.languages = prompts.languages.filter((l) => l !== name);
  await saveAndSyncLanguages();
}

async function saveAndSyncLanguages() {
  await window.api.savePrompts(prompts);
  renderLangList();
  syncLangDropdowns();
}

function syncLangDropdowns() {
  const prevSrc = document.getElementById('sourceLang').value;
  const prevTgt = document.getElementById('targetLang').value;
  const languages = prompts.languages || [];

  ['sourceLang', 'targetLang'].forEach((id) => {
    const select = document.getElementById(id);
    select.innerHTML = '';
    languages.forEach((lang) => {
      const option = document.createElement('option');
      option.value = lang;
      option.textContent = lang;
      select.appendChild(option);
    });
  });

  // 기존 선택값이 목록에 남아있으면 유지, 없으면 첫 번째로 초기화
  const srcEl = document.getElementById('sourceLang');
  const tgtEl = document.getElementById('targetLang');
  if (languages.includes(prevSrc)) srcEl.value = prevSrc;
  if (languages.includes(prevTgt)) tgtEl.value = prevTgt;
  else if (tgtEl.options.length > 1) tgtEl.selectedIndex = 1;

  updateModeBadge();
}
