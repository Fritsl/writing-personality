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
    let result = await this.chat([
      {
        role: 'system',
        content: `You are a helpful AI chatbot. Re-express the content below in your own natural voice, in ${language}.
- Convey the same information and meaning
- Use your natural tone, phrasing, and sentence structure
- Do NOT preserve the original author's style, quirks, or voice
- Do NOT add new information or commentary
- Output ONLY the re-expressed text`
      },
      { role: 'user', content: text }
    ], { temperature: 0 });

    // Strip LLM preamble if present (e.g. "Here's the rewritten text:\n---")
    result = result.replace(/^.*?(?:here'?s|below is).*?[:]\s*/i, '');
    result = result.replace(/^---\s*/gm, '').trim();
    return result;
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
