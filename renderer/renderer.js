let prompts = {};
let savedKeyJson = '';

window.addEventListener('DOMContentLoaded', async () => {
  prompts = await window.api.getPrompts();

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
    window.api.closeWindow();
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

  // Submit
  document.getElementById('submitBtn').addEventListener('click', handleSubmit);

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
  if (!raw) {
    feedback.style.display = 'none';
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.project_id || !parsed.client_email) {
      throw new Error('필수 필드 누락 (project_id, client_email)');
    }
    savedKeyJson = raw;
    feedback.textContent = '✓ JSON 키가 유효합니다.';
    feedback.className = 'key-feedback ok';
    feedback.style.display = '';
  } catch (err) {
    savedKeyJson = '';
    feedback.textContent = `✗ 유효하지 않은 JSON: ${err.message}`;
    feedback.className = 'key-feedback error';
    feedback.style.display = '';
  }
}

async function handleSubmit() {
  // Get key from settings tab
  const keyJson = document.getElementById('keyTextarea').value.trim();
  if (!keyJson) return showError('설정 탭에서 Vertex AI JSON 키를 먼저 입력해주세요.');

  const sourceLang = document.getElementById('sourceLang').value;
  const targetLang = document.getElementById('targetLang').value;
  const inputText = document.getElementById('inputText').value.trim();

  if (!inputText) return showError('텍스트를 입력해주세요.');

  const task = sourceLang === targetLang ? 'grammar' : 'translation';
  const basePrompt = prompts[task] || '';
  const langInfo = task === 'translation'
    ? `Source language: ${sourceLang}\nTarget language: ${targetLang}`
    : `Language: ${sourceLang}`;
  const fullPrompt = `${basePrompt}\n\n${langInfo}\n\nText:\n${inputText}`;

  showError('');
  clearResult();
  setLoading(true);

  const response = await window.api.sendToVertex({ keyJson, prompt: fullPrompt });

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

function showError(msg) {
  const el = document.getElementById('errorMsg');
  if (msg) {
    el.textContent = msg;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}
