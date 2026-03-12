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
        content: `Detect the language of the text below. Reply with ONLY a JSON object: {"language":"<English name>","code":"<ISO 639-1>"}. No markdown, no code fences, no commentary.`
      },
      { role: 'user', content: text }
    ], { temperature: 0 });

    console.log('[DETECT_LANG] Raw response:', raw);

    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      console.warn('[DETECT_LANG] Failed to parse, falling back to English. Raw:', raw);
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
        content: `You are a writing style coach. The text below is in ${language}. Write behavioral instructions that tell an AI how to replicate this person's writing style in ${language}. Use imperative verbs (Write, Use, Avoid, Match, Keep). Cover:
- Punctuation habits (commas, dashes, ellipses, exclamation marks, periods)
- Grammar patterns (formal vs informal, passive vs active voice, contractions)
- How they express emphasis or emotion
- Sentence construction patterns (length, complexity, rhythm)
- What makes their voice distinctive
- Slang, abbreviations, or unconventional spelling

Be specific — include brief examples from the text. Output as a short paragraph of direct instructions, NOT bullet points or analysis. Max 150 words.`
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
