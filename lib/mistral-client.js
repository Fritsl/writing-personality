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

  async normalize(text) {
    return this.chat([
      {
        role: 'system',
        content: `You are a copy editor. First, identify the language of the text below. Then rewrite it using the standard, correct form of THAT SAME LANGUAGE. Do NOT translate to English or any other language. Fix spelling, grammar, and punctuation within the original language. Remove profanity and replace with clean alternatives. Use proper capitalization and complete sentences. Do not change the meaning or add new information. Do not add commentary. Output ONLY the rewritten text.`
      },
      { role: 'user', content: text }
    ], { temperature: 0 });
  }

  async analyzeStyle(text) {
    return this.chat([
      {
        role: 'system',
        content: `You are a writing style analyst. First, identify the language of the text below. Analyze the writing style within the context of THAT language — do not compare against English norms if the text is not in English. Do NOT describe the content or topics. Focus ONLY on:
- How does this person use punctuation? (commas, dashes, ellipses, exclamation marks, periods)
- What is their relationship with grammar rules of their language?
- How do they express emphasis or emotion?
- What patterns appear in their sentence construction?
- What makes their writing voice distinctive?
- Do they use slang, abbreviations, or unconventional spelling (relative to their language)?

Be specific and give concrete examples from the text. Output a concise bullet-point analysis. Start your analysis by noting the detected language.`
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
