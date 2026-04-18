let prompts = {};
let hasSavedKey = false;
let currentMode = 'translation';
const history = [];
let lastDeleted = null;

const LOCKED_LANGS = ['Korean', 'English'];

window.addEventListener('DOMContentLoaded', async () => {
  prompts = await window.api.getPrompts();

  // Check for saved key
  const keyState = await window.api.loadKey();
  updateKeyUI(keyState);

  // Populate target language dropdown
  const languages = prompts.languages || [];
  const targetSelect = document.getElementById('targetLang');
  languages.forEach((lang) => {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = lang;
    targetSelect.appendChild(option);
  });
  if (targetSelect.options.length > 1) targetSelect.selectedIndex = 1;

  // Mode toggle button
  document.getElementById('modeToggleBtn').addEventListener('click', () => {
    currentMode = currentMode === 'translation' ? 'grammar' : 'translation';
    updateModeToggle();
  });

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

  // Pin (always on top)
  let isAlwaysOnTop = false;
  const pinBtn = document.getElementById('pinBtn');
  pinBtn.addEventListener('click', () => {
    isAlwaysOnTop = !isAlwaysOnTop;
    window.api.setAlwaysOnTop(isAlwaysOnTop);
    pinBtn.classList.toggle('active', isAlwaysOnTop);
  });

  // Opacity
  const savedOpacity = await window.api.getOpacity();
  applyOpacity(savedOpacity);

  const opacityBtn = document.getElementById('opacityBtn');
  const opacityPopover = document.getElementById('opacityPopover');
  const opacitySlider = document.getElementById('opacitySlider');
  const opacityValueLabel = document.getElementById('opacityValue');

  opacityBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (opacityPopover.style.display === 'none') {
      opacityPopover.style.display = 'flex';
      requestAnimationFrame(() => {
        const btnRect = opacityBtn.getBoundingClientRect();
        const popRect = opacityPopover.getBoundingClientRect();
        opacityPopover.style.top = `${btnRect.top + btnRect.height / 2 - popRect.height / 2}px`;
      });
    } else {
      opacityPopover.style.display = 'none';
    }
  });

  let opacitySaveTimer;
  opacitySlider.addEventListener('input', () => {
    const val = parseInt(opacitySlider.value, 10);
    opacityValueLabel.textContent = `${val}%`;
    document.documentElement.style.setProperty('--bg-alpha', val / 100);
    clearTimeout(opacitySaveTimer);
    opacitySaveTimer = setTimeout(() => window.api.saveOpacity(val / 100), 500);
  });

  document.addEventListener('click', (e) => {
    if (!opacityPopover.contains(e.target) && e.target !== opacityBtn) {
      opacityPopover.style.display = 'none';
    }
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

  // Ctrl+Enter shortcut
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      const translateTab = document.getElementById('tab-translate');
      if (translateTab.classList.contains('active')) showSubmitConfirmModal();
    }
  });

  // Clear input button
  document.getElementById('clearInputBtn').addEventListener('click', () => {
    document.getElementById('inputText').value = '';
  });

  // History clear button
  document.getElementById('historyClearBtn').addEventListener('click', () => {
    if (history.length === 0) {
      showHistoryFeedback('삭제할 이력이 없습니다.');
      return;
    }
    showConfirmModal('이력을 모두 삭제하시겠습니까?', () => {
      history.length = 0;
      clearUndo();
      renderHistory(null);
    }, '삭제');
  });

  // History copy button
  document.getElementById('historyCopyBtn').addEventListener('click', () => {
    const text = document.getElementById('historyResultPane').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('historyCopyBtn');
      btn.textContent = '복사됨';
      setTimeout(() => { btn.textContent = '복사'; }, 1500);
    });
  });

  // Undo button
  document.getElementById('historyUndoBtn').addEventListener('click', () => {
    if (!lastDeleted) return;
    const { idx, item } = lastDeleted;
    history.splice(idx, 0, item);
    clearUndo();
    renderHistory(item.id);
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

function applyOpacity(value) {
  document.documentElement.style.setProperty('--bg-alpha', value);
  const pct = Math.round(value * 100);
  document.getElementById('opacitySlider').value = pct;
  document.getElementById('opacityValue').textContent = `${pct}%`;
}


function updateModeToggle() {
  document.querySelectorAll('.mode-switch-label').forEach((label) => {
    label.classList.toggle('active', label.dataset.mode === currentMode);
  });
  const wrap = document.getElementById('targetLangWrap');
  wrap.style.visibility = currentMode === 'translation' ? '' : 'hidden';
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
  const indicator = document.getElementById('keyIndicator');
  const homeIndicator = document.getElementById('homeKeyIndicator');
  const homeKeyHint = document.getElementById('homeKeyHint');

  if (state.exists) {
    document.getElementById('savedProjectId').textContent = state.projectId;
    savedDisplay.style.display = '';
    inputArea.style.display = 'none';
    indicator.textContent = '● 키 설정됨';
    indicator.className = 'key-indicator ok';
    homeIndicator.textContent = '● 키 설정됨';
    homeIndicator.className = 'key-indicator ok';
    homeKeyHint.style.display = 'none';
  } else {
    savedDisplay.style.display = 'none';
    inputArea.style.display = '';
    // Reset input area
    document.getElementById('keyTextarea').value = '';
    document.getElementById('fileStatus').textContent = '선택된 파일 없음';
    document.getElementById('keyFeedback').style.display = 'none';
    document.getElementById('saveKeyBtn').style.display = 'none';
    indicator.textContent = '⚠ 키 미설정';
    indicator.className = 'key-indicator missing';
    homeIndicator.textContent = '⚠ 키 미설정';
    homeIndicator.className = 'key-indicator missing';
    homeKeyHint.style.display = '';
  }
}

async function handleSubmit() {
  const keyJson = hasSavedKey ? '' : document.getElementById('keyTextarea').value.trim();
  if (!hasSavedKey && !keyJson) return showError('설정 탭에서 Vertex AI JSON 키를 먼저 입력해주세요.');

  const targetLang = document.getElementById('targetLang').value;
  const inputText = document.getElementById('inputText').value.trim();

  if (!inputText) return showError('텍스트를 입력해주세요.');

  const systemPrompt = prompts[currentMode] || '';
  const userMessage = currentMode === 'translation'
    ? `Target language: ${targetLang}\n\nText:\n${inputText}`
    : `Text:\n${inputText}`;

  showError('');
  clearResult();
  setLoading(true);

  const response = await window.api.sendToVertex({ keyJson, systemPrompt, userMessage });

  setLoading(false);

  if (response.success) {
    showError('');
    showResult(response.result);
    addHistory({
      targetLang,
      mode: currentMode,
      input: inputText,
      result: response.result
    });
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

function showSubmitConfirmModal() {
  const modal = document.getElementById('submitConfirmModal');
  const confirmBtn = document.getElementById('submitModalConfirm');
  const cancelBtn = document.getElementById('submitModalCancel');

  modal.style.display = 'flex';
  confirmBtn.focus();

  function cleanup() {
    modal.style.display = 'none';
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  }

  document.getElementById('submitModalConfirm').addEventListener('click', () => {
    cleanup();
    handleSubmit();
  }, { once: true });

  document.getElementById('submitModalCancel').addEventListener('click', () => {
    cleanup();
  }, { once: true });
}

function showConfirmModal(messageOrCallback, onConfirm, confirmLabel = '종료') {
  const modal = document.getElementById('confirmModal');
  const msgEl = modal.querySelector('.modal-message');
  const defaultMsg = '종료하시겠습니까?';
  if (typeof messageOrCallback === 'function') {
    onConfirm = messageOrCallback;
  } else {
    msgEl.textContent = messageOrCallback;
  }
  modal.style.display = 'flex';
  const confirmBtn = document.getElementById('modalConfirm');
  const cancelBtn = document.getElementById('modalCancel');
  confirmBtn.textContent = confirmLabel;

  function cleanup() {
    modal.style.display = 'none';
    msgEl.textContent = defaultMsg;
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

function addHistory(entry) {
  const now = new Date();
  const timestamp = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  history.unshift({ id: Date.now(), timestamp, ...entry });
  if (history.length > 10) history.pop();
  renderHistory();
}

function renderHistory(selectedId) {
  const list = document.getElementById('historyList');
  const empty = document.getElementById('historyEmpty');

  list.querySelectorAll('.history-card').forEach(el => el.remove());

  if (history.length === 0) {
    empty.style.display = '';
    setHistoryPanes(null);
    return;
  }
  empty.style.display = 'none';

  const activeId = selectedId ?? history[0].id;

  history.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'history-card' + (item.id === activeId ? ' selected' : '');

    const langText = item.mode === 'translation'
      ? `→ ${item.targetLang}`
      : '';

    card.innerHTML = `
      <div class="history-card-header">
        <div class="history-card-meta">
          <span class="history-time">${item.timestamp}</span>
          <span class="mode-badge${item.mode === 'grammar' ? ' grammar' : ''}">${item.mode === 'translation' ? '번역' : '교정'}</span>
          <span class="history-langs">${langText}</span>
        </div>
        <span class="history-preview">${item.input.replace(/\n/g, ' ')}</span>
        <button class="history-delete-btn">삭제</button>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('history-delete-btn')) return;
      renderHistory(item.id);
    });

    card.querySelector('.history-delete-btn').addEventListener('click', () => {
      const idx = history.findIndex(h => h.id === item.id);
      if (idx === -1) return;
      lastDeleted = { idx, item: history[idx] };
      history.splice(idx, 1);
      const nextId = history.length > 0 ? history[Math.min(idx, history.length - 1)].id : null;
      renderHistory(nextId);
      showUndoToast();
    });

    list.appendChild(card);
  });

  const activeItem = history.find(h => h.id === activeId);
  setHistoryPanes(activeItem);
}

function showHistoryFeedback(msg) {
  const el = document.getElementById('historyFeedback');
  el.textContent = msg;
  el.style.display = '';
  setTimeout(() => { el.style.display = 'none'; }, 2000);
}

function showUndoToast() {
  document.getElementById('historyUndoBar').style.display = 'flex';
}

function clearUndo() {
  lastDeleted = null;
  document.getElementById('historyUndoBar').style.display = 'none';
}

function setHistoryPanes(item) {
  document.getElementById('historyInputPane').textContent = item ? item.input : '';
  document.getElementById('historyResultPane').textContent = item ? item.result : '';
  document.getElementById('historyCopyBtn').style.display = item ? '' : 'none';
}

function syncLangDropdowns() {
  const prevTgt = document.getElementById('targetLang').value;
  const languages = prompts.languages || [];

  const tgtEl = document.getElementById('targetLang');
  tgtEl.innerHTML = '';
  languages.forEach((lang) => {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = lang;
    tgtEl.appendChild(option);
  });

  if (languages.includes(prevTgt)) tgtEl.value = prevTgt;
  else if (tgtEl.options.length > 1) tgtEl.selectedIndex = 1;
}
