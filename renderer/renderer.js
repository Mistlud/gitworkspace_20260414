let prompts = {};

window.addEventListener('DOMContentLoaded', async () => {
  prompts = await window.api.getPrompts();

  // File load button
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
    };
    reader.readAsText(file);
  });

  // Task type toggle — show/hide target language
  document.querySelectorAll('input[name="task"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const isTranslation = radio.value === 'translation';
      document.getElementById('targetLangField').style.display = isTranslation ? '' : 'none';
    });
  });

  // Submit
  document.getElementById('submitBtn').addEventListener('click', handleSubmit);
});

async function handleSubmit() {
  const keyJson = document.getElementById('keyTextarea').value.trim();
  const task = document.querySelector('input[name="task"]:checked').value;
  const sourceLang = document.getElementById('sourceLang').value.trim();
  const targetLang = document.getElementById('targetLang').value.trim();
  const inputText = document.getElementById('inputText').value.trim();

  // Validation
  if (!keyJson) return showError('Vertex AI JSON 키를 입력해주세요.');
  if (!sourceLang) return showError('출발 언어를 입력해주세요.');
  if (task === 'translation' && !targetLang) return showError('도착 언어를 입력해주세요.');
  if (!inputText) return showError('입력 내용을 작성해주세요.');

  // Build prompt
  const basePrompt = prompts[task] || '';
  const langInfo = task === 'translation'
    ? `Source language: ${sourceLang}\nTarget language: ${targetLang}`
    : `Language: ${sourceLang}`;
  const fullPrompt = `${basePrompt}\n\n${langInfo}\n\nText:\n${inputText}`;

  // UI state
  showError('');
  hideResult();
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
  document.getElementById('resultText').textContent = text;
  document.getElementById('resultCard').style.display = '';
}

function hideResult() {
  document.getElementById('resultCard').style.display = 'none';
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
