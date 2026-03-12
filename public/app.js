let chatHistory = [];
let styleEnabled = true;

async function analyze() {
  const text = document.getElementById('input-text').value.trim();
  if (!text || text.length < 20) {
    showStatus('Please paste at least a few sentences of writing.', true);
    return;
  }

  const btn = document.getElementById('analyze-btn');
  btn.disabled = true;
  btn.textContent = 'Analyzing...';
  showStatus('Sending to Mistral for normalization and style analysis...', false);

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Analysis failed');
    }

    const data = await res.json();
    showResults(data);
    showStatus('Analysis complete!', false);
  } catch (err) {
    showStatus(`Error: ${err.message}`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Analyze Writing Style';
  }
}

function showResults(data) {
  // Show comparison panel
  document.getElementById('original-text').textContent = data.originalText;
  document.getElementById('cleaned-text').textContent = data.cleanedText;
  document.getElementById('detected-language').textContent = data.language ? `(${data.language})` : '';
  document.getElementById('comparison-panel').classList.remove('hidden');

  // Show profile panel
  const featureList = document.getElementById('feature-list');
  featureList.innerHTML = '';
  if (data.featureSummary.length === 0) {
    featureList.innerHTML = '<li>No strong style deviations detected — try more expressive text</li>';
  } else {
    data.featureSummary.forEach(line => {
      const li = document.createElement('li');
      li.textContent = line;
      featureList.appendChild(li);
    });
  }

  document.getElementById('qualitative-analysis').textContent = data.qualitativeAnalysis;

  const repSentences = document.getElementById('representative-sentences');
  repSentences.innerHTML = '';
  if (data.representativeSentences && data.representativeSentences.length > 0) {
    data.representativeSentences.forEach(s => {
      const div = document.createElement('div');
      div.className = 'rep-sentence';
      div.textContent = s;
      repSentences.appendChild(div);
    });
  } else {
    repSentences.textContent = 'No strongly stylistic sentences found.';
  }

  document.getElementById('profile-panel').classList.remove('hidden');

  // Show chat panel
  document.getElementById('chat-panel').classList.remove('hidden');
  chatHistory = [];
  document.getElementById('chat-messages').innerHTML = '';
  addBotMessage("Style profile loaded! Try chatting with me — I'll write in the captured style. Toggle the switch to compare with/without style.");

  // Scroll to comparison
  document.getElementById('comparison-panel').scrollIntoView({ behavior: 'smooth' });
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  addUserMessage(message);

  // Show loading
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-msg bot';
  loadingDiv.innerHTML = '<div class="label">bot</div><div class="bubble loading">Thinking</div>';
  const chatMessages = document.getElementById('chat-messages');
  chatMessages.appendChild(loadingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: chatHistory.slice(-10), // Last 10 messages for context
        styled: styleEnabled,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Chat failed');
    }

    const data = await res.json();
    loadingDiv.remove();
    addBotMessage(data.response);

    // Add to history
    chatHistory.push({ role: 'user', content: message });
    chatHistory.push({ role: 'assistant', content: data.response });
  } catch (err) {
    loadingDiv.remove();
    addBotMessage(`Error: ${err.message}`);
  }
}

function addUserMessage(text) {
  const chatMessages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg user';
  div.innerHTML = `<div class="label">you</div><div class="bubble">${escapeHtml(text)}</div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addBotMessage(text) {
  const chatMessages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg bot';
  const label = styleEnabled ? 'bot (styled)' : 'bot (clean)';
  div.innerHTML = `<div class="label">${label}</div><div class="bubble">${escapeHtml(text)}</div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function toggleStyle() {
  const toggle = document.getElementById('style-toggle');
  const status = document.getElementById('style-status');
  styleEnabled = toggle.checked;

  if (styleEnabled) {
    status.textContent = 'Writing in captured style';
    status.className = 'style-on';
  } else {
    status.textContent = 'Writing in clean AI style (no personality)';
    status.className = 'style-off';
  }
}

function showStatus(msg, isError) {
  const el = document.getElementById('analyze-status');
  el.textContent = msg;
  el.className = isError ? 'status error' : 'status';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function exportPersona() {
  const name = document.getElementById('persona-name').value.trim() || 'Extracted Persona';
  const url = `/api/export-persona?name=${encodeURIComponent(name)}`;
  window.location.href = url;
}

async function copyForGdprChat() {
  const btn = document.getElementById('copy-gdprchat-btn');
  try {
    const res = await fetch('/api/export-style-fragment');
    if (!res.ok) throw new Error('No profile loaded');
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy for GDPR Chat'; }, 2000);
  } catch (err) {
    btn.textContent = 'Error — analyze first';
    setTimeout(() => { btn.textContent = 'Copy for GDPR Chat'; }, 2000);
  }
}
