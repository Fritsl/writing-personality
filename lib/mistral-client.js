const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

class MistralClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async chat(messages, { temperature = 0, model = 'mistral-large-latest' } = {}) {
    const res = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Mistral API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }

  async detectLanguage(text) {
    const raw = await this.chat([
      {
        role: 'system',
        content: `Detect the language of the text below. Reply with ONLY a JSON object: {"language":"<English name>","code":"<ISO 639-1>"}. No commentary.`
      },
      { role: 'user', content: text }
    ], { temperature: 0 });

    try {
      return JSON.parse(raw);
    } catch {
      return { language: 'English', code: 'en' };
    }
  }

  async normalize(text, language) {
    return this.chat([
      {
        role: 'system',
        content: `You are a copy editor working in ${language}. Your task:
1. Rewrite the text below in standard ${language}.
2. Correct spelling, grammar, and punctuation according to ${language} norms.
3. Remove profanity and replace with clean alternatives in ${language}.
4. Use proper capitalization and complete sentences.
5. Do NOT translate to any other language. Output MUST be in ${language}.
6. Do not change the meaning or add new information.
7. Do not add commentary.
Output ONLY the corrected text.`
      },
      { role: 'user', content: text }
    ], { temperature: 0 });
  }

  async analyzeStyle(text, language) {
    return this.chat([
      {
        role: 'system',
        content: `You are a writing style analyst. The text below is in ${language}. Analyze the writing style within the context of ${language} norms. Do NOT describe the content or topics. Focus ONLY on:
- How does this person use punctuation? (commas, dashes, ellipses, exclamation marks, periods)
- What is their relationship with ${language} grammar rules?
- How do they express emphasis or emotion?
- What patterns appear in their sentence construction?
- What makes their writing voice distinctive?
- Do they use slang, abbreviations, or unconventional spelling (relative to ${language})?

Be specific and give concrete examples from the text. Output a concise bullet-point analysis.`
      },
      { role: 'user', content: text }
    ], { temperature: 0 });
  }

  async generateStyled(userMessage, styleProfile, conversationHistory = []) {
    const messages = [
      { role: 'system', content: styleProfile.systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];
    return this.chat(messages, { temperature: 0.7 });
  }

  async generateClean(userMessage, conversationHistory = []) {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant. Respond naturally and helpfully.' },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];
    return this.chat(messages, { temperature: 0.7 });
  }
}

module.exports = MistralClient;
