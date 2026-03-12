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
 * Format: imperative prose (like bob-hiphop), NOT analytical markdown.
 */
function buildPromptFragment(features, featureSummary, qualitativeAnalysis, language = 'English') {
  const patterns = featureSummary.join('. ');

  const examples = features.representativeSentences.length > 0
    ? features.representativeSentences.map(s => `> ${s}`).join('\n')
    : '';

  const exampleBlock = examples
    ? `\n\nReference sentences (capture the feel, don't copy verbatim):\n${examples}`
    : '';

  return `Adopt this writing style for ALL responses. ${qualitativeAnalysis}

Key patterns: ${patterns}.${exampleBlock}

ALWAYS respond in ${language}. Match the rhythm, punctuation, and energy of the examples above. This is a writing PERSONALITY — apply it naturally, not performed or exaggerated.`;
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
