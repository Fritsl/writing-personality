const { extractFeatures, summarizeFeatures } = require('./diff-engine');

function buildProfile(originalText, cleanedText, qualitativeAnalysis, language = 'English') {
  const features = extractFeatures(originalText, cleanedText);
  const featureSummary = summarizeFeatures(features);
  const promptFragment = buildPromptFragment(features, featureSummary, qualitativeAnalysis, language);

  return {
    features,
    featureSummary,
    qualitativeAnalysis,
    language,
    originalText,
    cleanedText,
    promptFragment,
    systemPrompt: buildSystemPrompt(promptFragment, language),
  };
}

/**
 * Canonical prompt fragment — the single source of truth for writing style injection.
 * Designed to be pasted into any system prompt (GDPRChat, livingbios, etc.).
 */
function buildPromptFragment(features, featureSummary, qualitativeAnalysis, language = 'English') {
  const rules = featureSummary.map(line => `- ${line}`).join('\n');

  const examples = features.representativeSentences.length > 0
    ? features.representativeSentences.map(s => `> ${s}`).join('\n')
    : '';

  return `## WRITING STYLE (match this person's natural voice)

QUANTITATIVE PATTERNS:
${rules}

QUALITATIVE STYLE:
${qualitativeAnalysis}

REFERENCE SENTENCES (capture the feel, don't copy verbatim):
${examples}

STYLE RULES:
- ALWAYS respond in ${language}. Every word of your output must be in ${language}.
- Apply these patterns naturally to all responses
- Match capitalization, punctuation habits, and sentence rhythm
- The style should feel authentic, not performed or exaggerated
- If the style includes profanity or slang, use it naturally — not forced
- You are capturing a writing PERSONALITY, not copying phrases`;
}

/**
 * Standalone system prompt — wraps the fragment for direct use (e.g. the writing-personality UI).
 */
function buildSystemPrompt(promptFragment, language = 'English') {
  return `You are a chatbot that writes in a very specific personal style. You must ALWAYS write in this style, no matter the topic.

${promptFragment}

Now respond to the user's message in this style. Be helpful and answer their question, but ALWAYS in this distinctive voice.`;
}

module.exports = { buildProfile };
