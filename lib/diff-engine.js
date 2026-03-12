// Common profanity list for detection
const PROFANITY = new Set([
  'fuck', 'fucking', 'fucked', 'shit', 'shitty', 'damn', 'damned', 'dammit',
  'ass', 'asshole', 'bitch', 'bitching', 'hell', 'crap', 'crappy', 'bastard',
  'piss', 'pissed', 'bullshit', 'goddam', 'goddamn', 'goddamit', 'wtf', 'stfu',
  'lmao', 'lmfao'
]);

const SLANG = new Set([
  'gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'dunno', 'idk', 'imo', 'imho',
  'tbh', 'ngl', 'irl', 'smh', 'bruh', 'bro', 'dude', 'yo', 'yall', "y'all",
  'ain\'t', 'ur', 'u', 'r', 'tho', 'thru', 'cuz', 'bc', 'rn', 'nah', 'yep',
  'yeah', 'ok', 'omg', 'lol', 'haha', 'hahaha', 'btw', 'fyi'
]);

const INTENSIFIERS = new Set([
  'really', 'very', 'super', 'extremely', 'totally', 'absolutely', 'literally',
  'seriously', 'honestly', 'basically', 'actually', 'definitely', 'completely',
  'freaking', 'frickin', 'insanely', 'incredibly', 'so'
]);

function tokenize(text) {
  return text.split(/\s+/).filter(w => w.length > 0);
}

function sentences(text) {
  // Split on sentence-ending punctuation, but keep fragments too
  const parts = text.split(/(?<=[.!?])\s+|(?:\n\s*\n)/);
  return parts.filter(s => s.trim().length > 0);
}

function countChar(text, char) {
  return (text.split(char).length - 1);
}

function countPattern(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function countWordsInSet(text, wordSet) {
  const words = tokenize(text.toLowerCase());
  return words.filter(w => wordSet.has(w.replace(/[^a-z']/g, ''))).length;
}

// Simple Levenshtein distance to filter out translations vs actual spelling variants
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function stripWord(w) {
  // Keep Unicode letters and apostrophes (supports Danish æøå, French accents, etc.)
  return w.replace(/[^\p{L}']/gu, '');
}

function findSpellingSubstitutions(original, cleaned) {
  const origWords = tokenize(original.toLowerCase());
  const cleanWords = tokenize(cleaned.toLowerCase());

  // Detect if the text was translated rather than corrected:
  // In same-language normalization, most words remain identical.
  // If fewer than 30% of words overlap, this is likely a translation — skip entirely.
  const origSet = new Set(origWords.map(w => stripWord(w)).filter(Boolean));
  const cleanSet = new Set(cleanWords.map(w => stripWord(w)).filter(Boolean));
  let overlap = 0;
  for (const w of origSet) {
    if (cleanSet.has(w)) overlap++;
  }
  const overlapRatio = origSet.size > 0 ? overlap / origSet.size : 1;
  if (overlapRatio < 0.3) {
    // Text was likely translated, not corrected — no valid spelling substitutions
    return [];
  }

  // Simple alignment: find words that differ at similar positions
  const substitutions = {};
  const minLen = Math.min(origWords.length, cleanWords.length);

  for (let i = 0; i < minLen; i++) {
    const ow = stripWord(origWords[i]);
    const cw = stripWord(cleanWords[i]);
    if (ow && cw && ow !== cw && ow.length > 1) {
      // Skip if words are too different — likely a translation, not a spelling variant
      const dist = levenshtein(ow, cw);
      const maxLen = Math.max(ow.length, cw.length);
      if (dist / maxLen > 0.6) continue;

      if (!substitutions[ow]) substitutions[ow] = {};
      substitutions[ow][cw] = (substitutions[ow][cw] || 0) + 1;
    }
  }

  // Only keep substitutions that appear at least once
  const result = [];
  for (const [orig, replacements] of Object.entries(substitutions)) {
    const best = Object.entries(replacements).sort((a, b) => b[1] - a[1])[0];
    result.push({ original: orig, standard: best[0], count: best[1] });
  }
  return result.sort((a, b) => b.count - a.count).slice(0, 20);
}

function selectRepresentativeSentences(text, count = 5) {
  const sents = sentences(text);
  // Score sentences by "stylistic interest" — how many quirks they contain
  const scored = sents.map(s => {
    let score = 0;
    score += countPattern(s, /\.{2,}/g) * 3;        // ellipses
    score += countPattern(s, /--+|—/g) * 3;          // dashes
    score += countWordsInSet(s, PROFANITY) * 4;       // profanity
    score += countWordsInSet(s, SLANG) * 2;           // slang
    score += (s === s.toLowerCase() && s.length > 10) ? 2 : 0; // all lowercase
    score += countPattern(s, /!{2,}/g) * 2;           // multiple exclamation
    score += countPattern(s, /\?{2,}/g) * 2;          // multiple question marks
    score += countWordsInSet(s, INTENSIFIERS) * 1;    // intensifiers
    return { sentence: s.trim(), score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(s => s.sentence);
}

function extractFeatures(original, cleaned) {
  const origWords = tokenize(original);
  const origSentences = sentences(original);
  const wordCount = origWords.length || 1;
  const sentenceCount = origSentences.length || 1;

  // Punctuation features
  const commaRate = countChar(original, ',') / sentenceCount;
  const dashRate = countPattern(original, /--+|—/g) / sentenceCount;
  const ellipsisRate = countPattern(original, /\.{2,}/g) / sentenceCount;
  const exclamationRate = countChar(original, '!') / sentenceCount;
  const questionRate = countChar(original, '?') / sentenceCount;
  const semicolonRate = countChar(original, ';') / sentenceCount;

  // Lexical features
  const profanityRate = countWordsInSet(original, PROFANITY) / wordCount;
  const slangRate = countWordsInSet(original, SLANG) / wordCount;
  const intensifierRate = countWordsInSet(original, INTENSIFIERS) / wordCount;

  // Contraction detection
  const contractionCount = countPattern(original, /\w+'\w+/g);
  const contractionRate = contractionCount / wordCount;

  // Structure features
  const avgSentenceLength = wordCount / sentenceCount;
  const avgWordLength = origWords.reduce((sum, w) => sum + w.replace(/[^a-z]/gi, '').length, 0) / wordCount;

  // Capitalization
  const allLowercase = original === original.toLowerCase();
  const allCapsWords = origWords.filter(w => w === w.toUpperCase() && w.length > 1 && /[A-Z]/.test(w)).length;
  const allCapsRate = allCapsWords / wordCount;
  const startsWithLowercase = origSentences.filter(s => /^[a-z]/.test(s.trim())).length / sentenceCount;

  // Emoji detection
  const emojiCount = countPattern(original, /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu);
  const emojiRate = emojiCount / sentenceCount;

  // Spelling substitutions
  const spellingSubstitutions = findSpellingSubstitutions(original, cleaned);

  // Representative sentences
  const representativeSentences = selectRepresentativeSentences(original);

  // Paragraph/structure patterns
  const usesSeparators = countPattern(original, /^[-_=*]{3,}$/gm) > 0;
  const avgParagraphLength = original.split(/\n\s*\n/).filter(p => p.trim()).length;

  return {
    punctuation: {
      commaRate: round(commaRate),
      dashRate: round(dashRate),
      ellipsisRate: round(ellipsisRate),
      exclamationRate: round(exclamationRate),
      questionRate: round(questionRate),
      semicolonRate: round(semicolonRate),
    },
    lexical: {
      profanityRate: round(profanityRate),
      slangRate: round(slangRate),
      intensifierRate: round(intensifierRate),
      contractionRate: round(contractionRate),
    },
    structure: {
      avgSentenceLength: round(avgSentenceLength),
      avgWordLength: round(avgWordLength),
      paragraphCount: avgParagraphLength,
      usesSeparators,
    },
    capitalization: {
      allLowercase,
      allCapsRate: round(allCapsRate),
      startsWithLowercase: round(startsWithLowercase),
    },
    emoji: {
      emojiRate: round(emojiRate),
    },
    spellingSubstitutions,
    representativeSentences,
  };
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

// Generate a human-readable summary of the features
function summarizeFeatures(features) {
  const lines = [];

  // Punctuation
  if (features.punctuation.commaRate < 0.3) lines.push('Rarely uses commas');
  else if (features.punctuation.commaRate > 1.5) lines.push('Heavy comma usage');
  if (features.punctuation.dashRate > 0.2) lines.push(`Frequently uses dashes to connect thoughts (${features.punctuation.dashRate} per sentence)`);
  if (features.punctuation.ellipsisRate > 0.1) lines.push(`Uses ellipses often (${features.punctuation.ellipsisRate} per sentence)`);
  if (features.punctuation.exclamationRate > 0.3) lines.push('Frequent exclamation marks');
  if (features.punctuation.semicolonRate < 0.05) lines.push('Never uses semicolons');

  // Lexical
  if (features.lexical.profanityRate > 0.02) lines.push(`Uses profanity (${(features.lexical.profanityRate * 100).toFixed(1)}% of words)`);
  if (features.lexical.slangRate > 0.03) lines.push(`Uses slang/informal language (${(features.lexical.slangRate * 100).toFixed(1)}% of words)`);
  if (features.lexical.intensifierRate > 0.03) lines.push('Heavy use of intensifiers (really, very, super, etc.)');
  if (features.lexical.contractionRate > 0.05) lines.push('Frequent contractions');

  // Structure
  if (features.structure.avgSentenceLength < 8) lines.push(`Short, punchy sentences (avg ${features.structure.avgSentenceLength} words)`);
  else if (features.structure.avgSentenceLength > 20) lines.push(`Long, flowing sentences (avg ${features.structure.avgSentenceLength} words)`);
  if (features.structure.usesSeparators) lines.push('Uses visual separators (---, ***, etc.) between sections');

  // Capitalization
  if (features.capitalization.allLowercase) lines.push('Writes entirely in lowercase');
  if (features.capitalization.allCapsRate > 0.05) lines.push(`Uses ALL CAPS for emphasis (${(features.capitalization.allCapsRate * 100).toFixed(1)}% of words)`);
  if (features.capitalization.startsWithLowercase > 0.5) lines.push('Often starts sentences without capitalizing');

  // Spelling
  if (features.spellingSubstitutions.length > 0) {
    const subs = features.spellingSubstitutions.slice(0, 5)
      .map(s => `"${s.original}" instead of "${s.standard}"`)
      .join(', ');
    lines.push(`Consistent spelling quirks: ${subs}`);
  }

  // Emoji
  if (features.emoji.emojiRate > 0.1) lines.push('Uses emojis frequently');

  return lines;
}

module.exports = { extractFeatures, summarizeFeatures };
