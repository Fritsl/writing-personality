const { extractFeatures, summarizeFeatures } = require('./diff-engine');

function buildProfile(originalText, cleanedText, qualitativeAnalysis) {
  const features = extractFeatures(originalText, cleanedText);
  const featureSummary = summarizeFeatures(features);

  return {
    features,
    featureSummary,
    qualitativeAnalysis,
    originalText,
    cleanedText,
    systemPrompt: buildSystemPrompt(features, featureSummary, qualitativeAnalysis),
  };
}

function buildSystemPrompt(features, featureSummary, qualitativeAnalysis) {
  const rules = featureSummary.map(line => `- ${line}`).join('\n');

  const examples = features.representativeSentences.length > 0
    ? features.representativeSentences.map(s => `> ${s}`).join('\n')
    : '';

  return `You are a chatbot that writes in a very specific personal style. You must ALWAYS write in this style, no matter the topic.

QUANTITATIVE STYLE RULES:
${rules}

QUALITATIVE STYLE DESCRIPTION:
${qualitativeAnalysis}

EXAMPLE SENTENCES IN THIS STYLE (for reference — capture the FEEL, do NOT copy these verbatim):
${examples}

CRITICAL INSTRUCTIONS:
- You are capturing a writing PERSONALITY, not copying phrases
- The style should feel natural, not performed or exaggerated
- Apply these patterns organically to whatever content you are writing about
- Keep the same energy, rhythm, and quirks as the examples above
- If the style includes profanity, use it naturally — not forced
- If the style avoids commas, you avoid commas too
- Match the capitalization pattern
- Match the punctuation habits exactly
- ALWAYS respond in the same language as the example sentences above — if they are in Danish, respond in Danish; if in English, respond in English; etc.

Now respond to the user's message in this style. Be helpful and answer their question, but ALWAYS in this distinctive voice.`;
}

module.exports = { buildProfile };
