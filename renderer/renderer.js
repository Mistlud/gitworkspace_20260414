let prompts = {};
let hasSavedKey = false;  // Vertex AI
let appConfig = { provider: 'vertex', profiles: [], activeProfileId: null };
let currentMode = 'translation';
const history = [];
let lastDeleted = null;

const LOCKED_LANGS = ['Korean', 'English'];
const DEFAULT_VERTEX_MODELS = ['gemini-3-flash-preview', 'gemini-3.1-pro-preview'];

window.addEventListener('DOMContentLoaded', async () => {
  prompts = await window.api.getPrompts();
  if (ensureVertexModels()) await window.api.savePrompts(prompts);

  // ── App config + 프로파일 로드
  appConfig = await window.api.loadAppConfig();
  applyProvider(appConfig.provider || 'vertex');
  renderProfiles();

  // ── Vertex AI 키 상태
  const keyState = await window.api.loadKey();
  hasSavedKey = keyState.exists;
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

  setupComparisonTab();

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
    hasSavedKey = false;
    updateKeyUI({ exists: false });
  });

  // ── Provider 토글
  document.querySelectorAll('.provider-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const p = btn.dataset.provider;
      appConfig.provider = p;
      await window.api.saveAppConfig(appConfig);
      applyProvider(p);
      updateIndicator();
    });
  });

  // ── 프로파일 추가 버튼
  document.getElementById('addProfileBtn').addEventListener('click', () => openProfileForm());

  // ── 프로파일 폼 저장
  document.getElementById('profileSaveBtn').addEventListener('click', saveProfile);

  // ── 프로파일 폼 취소
  document.getElementById('profileCancelBtn').addEventListener('click', closeProfileForm);

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

  // Vertex model selection and registry
  const modelSelect = document.getElementById('modelSelect');
  renderVertexModelList();
  syncVertexModelSelect();
  modelSelect.addEventListener('change', async () => {
    prompts.model = modelSelect.value;
    await window.api.savePrompts(prompts);
  });

  document.getElementById('vertexModelAddBtn').addEventListener('click', () => {
    const input = document.getElementById('vertexModelInput');
    addVertexModel(input.value);
    input.value = '';
  });
  document.getElementById('vertexModelInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const input = document.getElementById('vertexModelInput');
      addVertexModel(input.value);
      input.value = '';
    }
  });

  // Thinking Level (Vertex AI only)
  const thinkingLevelSelect = document.getElementById('thinkingLevelSelect');
  thinkingLevelSelect.value = prompts.thinking_level || '';
  thinkingLevelSelect.addEventListener('change', async () => {
    const level = thinkingLevelSelect.value;
    if (level) prompts.thinking_level = level;
    else delete prompts.thinking_level;
    await window.api.savePrompts(prompts);
  });

  // Temperature
  const temperatureInput = document.getElementById('temperatureInput');
  temperatureInput.value = prompts.temperature != null ? prompts.temperature : '';

  document.getElementById('temperatureSaveBtn').addEventListener('click', async () => {
    const raw = temperatureInput.value.trim();
    const feedback = document.getElementById('temperatureFeedback');

    if (raw === '') {
      // 비워두면 파라미터 제거
      delete prompts.temperature;
      await window.api.savePrompts(prompts);
      feedback.textContent = '✓ 온도 파라미터를 전송하지 않도록 설정됨';
      feedback.className = 'key-feedback ok';
      feedback.style.display = '';
      setTimeout(() => { feedback.style.display = 'none'; }, 2500);
      return;
    }

    const val = parseFloat(raw);
    if (isNaN(val) || val < 0 || val > 2) {
      feedback.textContent = '✗ 0.0 ~ 2.0 사이의 값을 입력해주세요.';
      feedback.className = 'key-feedback error';
      feedback.style.display = '';
      return;
    }
    prompts.temperature = val;
    await window.api.savePrompts(prompts);
    feedback.textContent = `✓ 온도 ${val} 저장됨`;
    feedback.className = 'key-feedback ok';
    feedback.style.display = '';
    setTimeout(() => { feedback.style.display = 'none'; }, 2500);
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
      const comparisonTab = document.getElementById('tab-tab4');
      if (comparisonTab.classList.contains('active') &&
          (e.target.id === 'compareLeftInput' || e.target.id === 'compareRightInput')) {
        e.preventDefault();
        runComparison();
      }
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

  // Flip button
  document.getElementById('flipBtn').addEventListener('click', () => {
    const result = document.getElementById('resultText').textContent;
    if (!result) return;
    document.getElementById('inputText').value = result;
    clearResult();
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

// ─── 텍스트 비교 탭 ─────────────────────────────────────────────────────────
const COMPARE_MAX_CHARS = 20000;
let comparisonDiffs = [];
let comparisonPosition = -1;

function setupComparisonTab() {
  const leftInput = document.getElementById('compareLeftInput');
  const rightInput = document.getElementById('compareRightInput');

  [leftInput, rightInput].forEach((input) => {
    input.addEventListener('input', updateComparisonMetrics);
  });

  document.getElementById('compareRunBtn').addEventListener('click', runComparison);
  document.getElementById('compareResetBtn').addEventListener('click', resetComparison);
  document.getElementById('compareSwapBtn').addEventListener('click', () => {
    const previousLeft = leftInput.value;
    leftInput.value = rightInput.value;
    rightInput.value = previousLeft;
    updateComparisonMetrics();
    runComparison();
  });
  document.getElementById('compareLeftCopyBtn').addEventListener('click', () => copyComparisonSource(leftInput, 'compareLeftCopyBtn'));
  document.getElementById('compareRightCopyBtn').addEventListener('click', () => copyComparisonSource(rightInput, 'compareRightCopyBtn'));
  document.getElementById('comparePrevBtn').addEventListener('click', () => moveComparisonDifference(-1));
  document.getElementById('compareNextBtn').addEventListener('click', () => moveComparisonDifference(1));
  document.querySelectorAll('.compare-options input').forEach((option) => option.addEventListener('change', () => {
    if (leftInput.value && rightInput.value) runComparison();
  }));
  updateComparisonMetrics();
}

function updateComparisonMetrics() {
  const left = document.getElementById('compareLeftInput').value;
  const right = document.getElementById('compareRightInput').value;
  document.getElementById('compareLeftMetrics').textContent = formatComparisonMetrics(left);
  document.getElementById('compareRightMetrics').textContent = formatComparisonMetrics(right);
}

function formatComparisonMetrics(text) {
  return `${text.length.toLocaleString('ko-KR')}자 · 예상 ${estimateTokens(text).toLocaleString('ko-KR')}토큰`;
}

function estimateTokens(text) {
  let cjk = 0;
  let latinOrNumber = 0;
  let whitespace = 0;
  let symbols = 0;
  for (const char of text) {
    if (/\p{Script=Hangul}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Han}/u.test(char)) cjk++;
    else if (/[A-Za-z0-9]/.test(char)) latinOrNumber++;
    else if (/\s/u.test(char)) whitespace++;
    else symbols++;
  }
  return Math.ceil((cjk * 1.3) + (latinOrNumber / 4) + (whitespace * 0.1) + symbols);
}

function getComparisonOptions() {
  return {
    ignoreWhitespace: document.getElementById('compareIgnoreWhitespace').checked,
    ignoreCase: document.getElementById('compareIgnoreCase').checked,
    ignoreNewlines: document.getElementById('compareIgnoreNewlines').checked,
  };
}

function comparisonTokenize(text) {
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('ko', { granularity: 'word' });
    return Array.from(segmenter.segment(text), ({ segment }) => segment);
  }
  return Array.from(text);
}

function comparisonKey(token, options) {
  if (options.ignoreNewlines && /^(\r\n|\r|\n)$/.test(token)) return '__IGNORED_NEWLINE__';
  if (options.ignoreWhitespace && /^\s+$/.test(token)) return '__IGNORED_WHITESPACE__';
  return options.ignoreCase ? token.toLocaleLowerCase() : token;
}

function runComparison() {
  const left = document.getElementById('compareLeftInput').value;
  const right = document.getElementById('compareRightInput').value;
  const status = document.getElementById('compareStatus');

  if (!left || !right) {
    clearComparisonResults('양쪽에 텍스트를 모두 입력해주세요.');
    return;
  }
  if (left.length > COMPARE_MAX_CHARS || right.length > COMPARE_MAX_CHARS) {
    clearComparisonResults(`각 텍스트는 ${COMPARE_MAX_CHARS.toLocaleString('ko-KR')}자 이하로 입력해주세요.`);
    return;
  }

  const options = getComparisonOptions();
  const leftTokens = comparisonTokenize(left);
  const rightTokens = comparisonTokenize(right);
  const changes = myersDiff(leftTokens, rightTokens, (a, b) => comparisonKey(a, options) === comparisonKey(b, options));
  renderComparisonResults(changes);

  const differenceCount = comparisonDiffs.length;
  const optionNames = [];
  if (options.ignoreWhitespace) optionNames.push('공백 무시');
  if (options.ignoreCase) optionNames.push('대소문자 무시');
  if (options.ignoreNewlines) optionNames.push('줄바꿈 무시');
  const optionNote = optionNames.length ? ` · ${optionNames.join(', ')}` : '';
  const delta = left.length - right.length;
  const tokenDelta = estimateTokens(left) - estimateTokens(right);
  const deltaNote = `글자 수 차이 ${formatSignedNumber(delta)}자 · 예상 토큰 차이 ${formatSignedNumber(tokenDelta)}토큰`;
  status.textContent = differenceCount === 0
    ? `두 텍스트가 동일합니다. · ${deltaNote}${optionNote}`
    : `차이 ${differenceCount}곳 · ${deltaNote}${optionNote}`;
  setComparisonPosition(differenceCount ? 0 : -1);
}

function myersDiff(left, right, equals) {
  const leftLength = left.length;
  const rightLength = right.length;
  const max = leftLength + rightLength;
  const trace = [];
  let frontier = new Map([[1, 0]]);

  for (let distance = 0; distance <= max; distance++) {
    trace.push(new Map(frontier));
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const goDown = diagonal === -distance || (diagonal !== distance && (frontier.get(diagonal - 1) ?? -1) < (frontier.get(diagonal + 1) ?? -1));
      let x = goDown ? (frontier.get(diagonal + 1) ?? 0) : (frontier.get(diagonal - 1) ?? 0) + 1;
      let y = x - diagonal;
      while (x < leftLength && y < rightLength && equals(left[x], right[y])) {
        x++;
        y++;
      }
      frontier.set(diagonal, x);
      if (x >= leftLength && y >= rightLength) return buildMyersChanges(trace, left, right);
    }
  }
  return [];
}

function buildMyersChanges(trace, left, right) {
  let x = left.length;
  let y = right.length;
  const changes = [];
  for (let distance = trace.length - 1; distance >= 0; distance--) {
    const frontier = trace[distance];
    const diagonal = x - y;
    const goDown = diagonal === -distance || (diagonal !== distance && (frontier.get(diagonal - 1) ?? -1) < (frontier.get(diagonal + 1) ?? -1));
    const previousDiagonal = goDown ? diagonal + 1 : diagonal - 1;
    const previousX = frontier.get(previousDiagonal) ?? 0;
    const previousY = previousX - previousDiagonal;
    while (x > previousX && y > previousY) {
      changes.push({ type: 'equal', left: left[x - 1], right: right[y - 1] });
      x--; y--;
    }
    if (distance === 0) break;
    if (x === previousX) {
      changes.push({ type: 'added', value: right[y - 1] });
      y--;
    } else {
      changes.push({ type: 'removed', value: left[x - 1] });
      x--;
    }
  }
  return changes.reverse();
}

function renderComparisonResults(changes) {
  const leftResult = document.getElementById('compareLeftResult');
  const rightResult = document.getElementById('compareRightResult');
  leftResult.replaceChildren();
  rightResult.replaceChildren();
  comparisonDiffs = [];
  comparisonPosition = -1;

  let index = 0;
  while (index < changes.length) {
    const change = changes[index];
    if (change.type === 'equal') {
      appendComparisonText(leftResult, change.left);
      appendComparisonText(rightResult, change.right);
      index++;
      continue;
    }

    const group = [];
    while (index < changes.length && changes[index].type !== 'equal') group.push(changes[index++]);
    const diffIndex = comparisonDiffs.length;
    const leftMark = createComparisonMark('compare-diff-left', diffIndex);
    const rightMark = createComparisonMark('compare-diff-right', diffIndex);
    group.filter((item) => item.type === 'removed').forEach((item) => appendComparisonText(leftMark, item.value));
    group.filter((item) => item.type === 'added').forEach((item) => appendComparisonText(rightMark, item.value));
    if (!leftMark.textContent) leftMark.classList.add('compare-diff-anchor');
    if (!rightMark.textContent) rightMark.classList.add('compare-diff-anchor');
    leftResult.appendChild(leftMark);
    rightResult.appendChild(rightMark);
    comparisonDiffs.push({ leftMark, rightMark });
  }
}

function createComparisonMark(className, index) {
  const mark = document.createElement('mark');
  mark.className = className;
  mark.dataset.diffIndex = index;
  return mark;
}

function appendComparisonText(parent, text) {
  parent.appendChild(document.createTextNode(text));
}

function setComparisonPosition(position) {
  comparisonPosition = position;
  const total = comparisonDiffs.length;
  document.getElementById('comparePosition').textContent = total ? `${position + 1} / ${total}` : '0 / 0';
  document.getElementById('comparePrevBtn').disabled = total === 0;
  document.getElementById('compareNextBtn').disabled = total === 0;
  comparisonDiffs.forEach((diff, index) => {
    diff.leftMark.classList.toggle('active', index === position);
    diff.rightMark.classList.toggle('active', index === position);
  });
  if (position >= 0) {
    const selected = comparisonDiffs[position];
    selected.leftMark.scrollIntoView({ block: 'center' });
    selected.rightMark.scrollIntoView({ block: 'center' });
  }
}

function moveComparisonDifference(direction) {
  if (!comparisonDiffs.length) return;
  setComparisonPosition((comparisonPosition + direction + comparisonDiffs.length) % comparisonDiffs.length);
}

function clearComparisonResults(message) {
  comparisonDiffs = [];
  comparisonPosition = -1;
  document.getElementById('compareLeftResult').textContent = '비교 결과가 여기에 표시됩니다.';
  document.getElementById('compareRightResult').textContent = '비교 결과가 여기에 표시됩니다.';
  document.getElementById('compareStatus').textContent = message;
  setComparisonPosition(-1);
}

function resetComparison() {
  document.getElementById('compareLeftInput').value = '';
  document.getElementById('compareRightInput').value = '';
  document.querySelectorAll('.compare-options input').forEach((option) => { option.checked = false; });
  updateComparisonMetrics();
  clearComparisonResults('양쪽에 텍스트를 입력한 뒤 비교하세요.');
}

async function copyComparisonSource(input, buttonId) {
  const button = document.getElementById(buttonId);
  if (!input.value) return;
  try {
    await navigator.clipboard.writeText(input.value);
    button.textContent = '복사됨';
  } catch {
    button.textContent = '복사 실패';
  }
  setTimeout(() => { button.textContent = '원문 복사'; }, 1500);
}

function formatSignedNumber(value) {
  return `${value > 0 ? '+' : ''}${value.toLocaleString('ko-KR')}`;
}


function applyProvider(provider) {
  document.getElementById('vertexSection').style.display  = provider === 'vertex' ? '' : 'none';
  document.getElementById('openaiSection').style.display  = provider === 'openai' ? '' : 'none';
  document.querySelectorAll('.provider-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.provider === provider);
  });
  updateIndicator();
}

// provider + key/profile 상태에 따른 인디케이터 업데이트
function updateIndicator() {
  const provider = appConfig.provider || 'vertex';
  const indicator = document.getElementById('keyIndicator');
  const homeIndicator = document.getElementById('homeKeyIndicator');
  const homeKeyHint   = document.getElementById('homeKeyHint');

  let text, cls, showHint, hintHtml = '';

  if (provider === 'vertex') {
    if (hasSavedKey) {
      text = '● Vertex AI';
      cls  = 'key-indicator ok';
      showHint = false;
    } else {
      text = '⚠ Vertex AI 키 미설정';
      cls  = 'key-indicator missing';
      showHint = true;
      hintHtml = '설정(⚙) 탭에서 Vertex AI 서비스 계정 JSON 키를 등록해주세요.<br>키가 없으면 번역·교정 기능을 사용할 수 없습니다.';
    }
  } else {
    const activeId  = appConfig.activeProfileId;
    const profile   = (appConfig.profiles || []).find(p => p.id === activeId);
    if (profile && profile.hasKey) {
      text = `● ${profile.name} — ${profile.model}`;
      cls  = 'key-indicator ok';
      showHint = false;
    } else if (profile) {
      text = `⚠ ${profile.name} (키 없음)`;
      cls  = 'key-indicator missing';
      showHint = true;
      hintHtml = '설정(⚙) 탭에서 활성 OpenAI Compatible 프로필에 API Key를 등록해주세요.<br>키가 없으면 번역·교정 기능을 사용할 수 없습니다.';
    } else {
      text = '⚠ 프로파일 미선택';
      cls  = 'key-indicator missing';
      showHint = true;
      hintHtml = '설정(⚙) 탭에서 OpenAI Compatible 프로필을 추가하고 활성화해주세요.<br>프로필이 없으면 번역·교정 기능을 사용할 수 없습니다.';
    }
  }

  indicator.textContent = text;
  indicator.className   = cls;
  homeIndicator.textContent = text;
  homeIndicator.className   = cls;
  homeKeyHint.innerHTML = hintHtml;
  homeKeyHint.style.display = showHint ? '' : 'none';
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
  const inputArea    = document.getElementById('keyInputArea');

  if (state.exists) {
    document.getElementById('savedProjectId').textContent = state.projectId;
    savedDisplay.style.display = '';
    inputArea.style.display    = 'none';
  } else {
    savedDisplay.style.display = 'none';
    inputArea.style.display    = '';
    document.getElementById('keyTextarea').value = '';
    document.getElementById('fileStatus').textContent = '선택된 파일 없음';
    document.getElementById('keyFeedback').style.display = 'none';
    document.getElementById('saveKeyBtn').style.display  = 'none';
  }
  updateIndicator();
}

async function handleSubmit() {
  const provider = appConfig.provider || 'vertex';

  if (provider === 'vertex' && !hasSavedKey) {
    return showError('설정 탭에서 Vertex AI JSON 키를 먼저 등록해주세요.');
  }
  if (provider === 'openai') {
    const activeId = appConfig.activeProfileId;
    const profile  = (appConfig.profiles || []).find(p => p.id === activeId);
    if (!profile)          return showError('설정 탭에서 활성 프로파일을 선택해주세요.');
    if (!profile.hasKey)   return showError(`"${profile.name}" 프로파일의 API 키가 없습니다. 프로파일을 수정해 키를 등록해주세요.`);
  }

  const targetLang = document.getElementById('targetLang').value;
  const inputText  = document.getElementById('inputText').value.trim();
  if (!inputText) return showError('텍스트를 입력해주세요.');

  const systemPrompt = prompts[currentMode] || '';
  const userMessage  = currentMode === 'translation'
    ? `Target language: ${targetLang}\n\nText:\n${inputText}`
    : `Text:\n${inputText}`;

  showError('');
  clearResult();
  setLoading(true);

  const response = await window.api.sendToLlm({ systemPrompt, userMessage });

  setLoading(false);

  if (response.success) {
    showError('');
    showResult(response.result);
    addHistory({ targetLang, mode: currentMode, input: inputText, result: response.result });
  } else {
    showError(`오류: ${response.error}`, true);
  }
}

// ─── 프로필 관리 ────────────────────────────────────────────────────────────
function renderProfiles() {
  const list    = document.getElementById('profileList');
  const empty   = document.getElementById('profileEmpty');
  const profiles = appConfig.profiles || [];
  const activeId = appConfig.activeProfileId;

  // 카드만 제거 (empty 메시지는 유지)
  list.querySelectorAll('.profile-card').forEach(el => el.remove());

  if (profiles.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  profiles.forEach((profile) => {
    const isActive = profile.id === activeId;
    const card = document.createElement('div');
    card.className = 'profile-card' + (isActive ? ' active' : '');
    card.dataset.id = profile.id;

    const endpointShort = (profile.endpoint || '').replace(/^https?:\/\//, '').slice(0, 40);

    card.innerHTML = `
      <span class="profile-radio">${isActive ? '●' : '○'}</span>
      <div class="profile-info">
        <div class="profile-name">${profile.name}</div>
        <div class="profile-sub">${profile.model} · ${endpointShort}</div>
      </div>
      <span class="profile-key-badge ${profile.hasKey ? 'has-key' : 'no-key'}">${profile.hasKey ? '키 있음' : '키 없음'}</span>
      <div class="profile-actions">
        <button class="profile-edit-btn">수정</button>
        <button class="profile-delete-btn">삭제</button>
      </div>
    `;

    // 카드 클릭 → 활성 프로필 선택
    card.addEventListener('click', async (e) => {
      if (e.target.closest('.profile-actions')) return;
      appConfig.activeProfileId = profile.id;
      await window.api.setActiveProfile(profile.id);
      renderProfiles();
      updateIndicator();
    });

    card.querySelector('.profile-edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openProfileForm(profile);
    });

    card.querySelector('.profile-delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const res = await window.api.deleteProfile(profile.id);
      if (res.success) {
        appConfig = res.config;
        renderProfiles();
        updateIndicator();
      }
    });

    list.appendChild(card);
  });
}

function openProfileForm(profile = null) {
  const formSection = document.getElementById('profileFormSection');
  const title       = document.getElementById('profileFormTitle');
  formSection.style.display = '';
  document.getElementById('profileFormFeedback').style.display = 'none';

  if (profile) {
    title.textContent = '프로필 수정';
    document.getElementById('profileEditId').value          = profile.id;
    document.getElementById('profileNameInput').value       = profile.name;
    document.getElementById('profileEndpointInput').value   = profile.endpoint;
    document.getElementById('profileModelInput').value      = profile.model;
    document.getElementById('profileKeyInput').value        = '';
  } else {
    title.textContent = '프로필 추가';
    document.getElementById('profileEditId').value          = '';
    document.getElementById('profileNameInput').value       = '';
    document.getElementById('profileEndpointInput').value   = '';
    document.getElementById('profileModelInput').value      = '';
    document.getElementById('profileKeyInput').value        = '';
  }
}

function closeProfileForm() {
  document.getElementById('profileFormSection').style.display = 'none';
}

async function saveProfile() {
  const editId   = document.getElementById('profileEditId').value.trim();
  const name     = document.getElementById('profileNameInput').value.trim();
  const endpoint = document.getElementById('profileEndpointInput').value.trim();
  const model    = document.getElementById('profileModelInput').value.trim();
  const apiKey   = document.getElementById('profileKeyInput').value.trim();
  const feedback = document.getElementById('profileFormFeedback');

  if (!name || !endpoint || !model) {
    feedback.textContent = '✗ 이름, Endpoint, Model은 필수입니다.';
    feedback.className = 'key-feedback error';
    feedback.style.display = '';
    return;
  }

  // 새 프로필이면 ID 생성
  const id = editId || `p-${Date.now()}`;
  const profile = { id, name, endpoint, model };

  const res = await window.api.saveProfile({ profile, apiKey: apiKey || null });
  if (!res.success) {
    feedback.textContent = `✗ 저장 실패: ${res.error}`;
    feedback.className = 'key-feedback error';
    feedback.style.display = '';
    return;
  }

  appConfig = res.config;
  // 첫 프로필이거나 현재 활성이 없으면 자동 활성화
  if (!appConfig.activeProfileId) {
    appConfig.activeProfileId = id;
    await window.api.setActiveProfile(id);
  }

  closeProfileForm();
  renderProfiles();
  updateIndicator();
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

function ensureVertexModels() {
  const hasStoredModelList = Array.isArray(prompts.vertexModels);
  const existingModels = hasStoredModelList ? prompts.vertexModels : [];
  const currentModel = typeof prompts.model === 'string' && prompts.model.trim()
    ? prompts.model.trim()
    : DEFAULT_VERTEX_MODELS[0];
  const modelCandidates = hasStoredModelList && existingModels.length
    ? [...existingModels, currentModel]
    : [...DEFAULT_VERTEX_MODELS, currentModel];
  const normalizedModels = modelCandidates
    .map((model) => typeof model === 'string' ? model.trim() : '')
    .filter(Boolean)
    .filter((model, index, models) => models.indexOf(model) === index);
  const changed = prompts.model !== currentModel
    || JSON.stringify(existingModels) !== JSON.stringify(normalizedModels);

  prompts.model = currentModel;
  prompts.vertexModels = normalizedModels.length ? normalizedModels : [...DEFAULT_VERTEX_MODELS];
  return changed;
}

function renderVertexModelList() {
  const list = document.getElementById('vertexModelList');
  list.innerHTML = '';

  prompts.vertexModels.forEach((model) => {
    const item = document.createElement('div');
    item.className = 'model-list-item';

    const name = document.createElement('span');
    name.className = 'model-list-item-name';
    name.textContent = model;

    const del = document.createElement('button');
    del.className = 'model-delete-btn';
    if (prompts.vertexModels.length === 1) {
      del.textContent = '필수';
      del.disabled = true;
      del.classList.add('locked');
    } else {
      del.textContent = '삭제';
      del.addEventListener('click', () => deleteVertexModel(model));
    }

    item.appendChild(name);
    item.appendChild(del);
    list.appendChild(item);
  });
}

function syncVertexModelSelect() {
  const select = document.getElementById('modelSelect');
  const models = prompts.vertexModels || [];
  select.innerHTML = '';
  models.forEach((model) => {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    select.appendChild(option);
  });

  if (!models.includes(prompts.model)) prompts.model = models[0];
  select.value = prompts.model;
}

function showVertexModelFeedback(message, type) {
  const el = document.getElementById('vertexModelFeedback');
  el.textContent = message;
  el.className = `key-feedback ${type}`;
  el.style.display = '';
  setTimeout(() => { el.style.display = 'none'; }, 2500);
}

async function addVertexModel(rawName) {
  const model = rawName.trim();
  if (!model) return;
  if (prompts.vertexModels.includes(model)) {
    return showVertexModelFeedback(`✗ "${model}"은(는) 이미 목록에 있습니다.`, 'error');
  }
  prompts.vertexModels.push(model);
  await saveAndSyncVertexModels();
  showVertexModelFeedback(`✓ "${model}" 추가됨`, 'ok');
}

async function deleteVertexModel(model) {
  if (prompts.vertexModels.length <= 1) {
    return showVertexModelFeedback('✗ 모델 목록에는 하나 이상의 모델이 필요합니다.', 'error');
  }
  prompts.vertexModels = prompts.vertexModels.filter((item) => item !== model);
  if (prompts.model === model) prompts.model = prompts.vertexModels[0];
  await saveAndSyncVertexModels();
}

async function saveAndSyncVertexModels() {
  await window.api.savePrompts(prompts);
  renderVertexModelList();
  syncVertexModelSelect();
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
