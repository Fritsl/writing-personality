require('dotenv').config();
const express = require('express');
const path = require('path');
const MistralClient = require('./lib/mistral-client');
const { buildProfile } = require('./lib/style-profiler');
const { createStyledMessages, createCleanMessages } = require('./lib/style-applicator');

const app = express();
const PORT = process.env.PORT || 3456;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const mistral = new MistralClient(process.env.MISTRAL_API_KEY);

// In-memory store for the current style profile
let currentProfile = null;

// POST /api/analyze — Takes text samples, returns normalized + style profile
app.post('/api/analyze', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 20) {
      return res.status(400).json({ error: 'Please provide at least a few sentences of text.' });
    }

    // Run normalization and style analysis in parallel
    const [cleanedText, qualitativeAnalysis] = await Promise.all([
      mistral.normalize(text),
      mistral.analyzeStyle(text),
    ]);

    // Build the profile
    currentProfile = buildProfile(text, cleanedText, qualitativeAnalysis);

    res.json({
      originalText: text,
      cleanedText,
      features: currentProfile.features,
      featureSummary: currentProfile.featureSummary,
      qualitativeAnalysis,
      representativeSentences: currentProfile.features.representativeSentences,
    });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat — Chat with the styled bot
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], styled = true } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }
    if (!currentProfile && styled) {
      return res.status(400).json({ error: 'No style profile loaded. Analyze text first.' });
    }

    let response;
    if (styled && currentProfile) {
      const messages = createStyledMessages(currentProfile, message, history);
      response = await mistral.chat(messages, { temperature: 0.7 });
    } else {
      const messages = createCleanMessages(message, history);
      response = await mistral.chat(messages, { temperature: 0.7 });
    }

    res.json({ response });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/profile — Get current profile
app.get('/api/profile', (req, res) => {
  if (!currentProfile) {
    return res.status(404).json({ error: 'No profile loaded.' });
  }
  res.json({
    features: currentProfile.features,
    featureSummary: currentProfile.featureSummary,
    qualitativeAnalysis: currentProfile.qualitativeAnalysis,
  });
});

// GET /api/export-persona — Download persona package as markdown
app.get('/api/export-persona', (req, res) => {
  if (!currentProfile) {
    return res.status(404).json({ error: 'No profile loaded.' });
  }

  const name = req.query.name || 'Extracted Persona';
  const { features, featureSummary, qualitativeAnalysis, systemPrompt, originalText } = currentProfile;

  const spellingSection = features.spellingSubstitutions.length > 0
    ? features.spellingSubstitutions.map(s => `- Write "${s.original}" instead of "${s.standard}" (seen ${s.count}x)`).join('\n')
    : '_No consistent spelling quirks detected._';

  const sentencesSection = features.representativeSentences.length > 0
    ? features.representativeSentences.map(s => `> ${s}`).join('\n>\n')
    : '_No strongly stylistic sentences found._';

  const rulesSection = featureSummary.length > 0
    ? featureSummary.map(line => `- ${line}`).join('\n')
    : '_No strong style deviations detected._';

  const md = `# Persona Package: ${name}

> Extracted by [writing-personality](https://github.com/Fritsl/writing-personality) on ${new Date().toISOString().split('T')[0]}

---

## How to Implement This Persona

1. **Copy the System Prompt** (Section 3 below) into your LLM's system message — it works with any model (Mistral, OpenAI, Claude, etc.)
2. **That's it.** The system prompt contains all quantitative rules, spelling quirks, qualitative description, and example sentences baked in.
3. For fine-tuning or custom implementations, use the individual sections below as structured data.

---

## 1. Quantitative Style Rules

These are the measurable deviations from "standard" AI writing:

${rulesSection}

### Raw Metrics

| Category | Metric | Value |
|----------|--------|-------|
| Punctuation | Commas per sentence | ${features.punctuation.commaRate} |
| Punctuation | Dashes per sentence | ${features.punctuation.dashRate} |
| Punctuation | Ellipses per sentence | ${features.punctuation.ellipsisRate} |
| Punctuation | Exclamations per sentence | ${features.punctuation.exclamationRate} |
| Punctuation | Questions per sentence | ${features.punctuation.questionRate} |
| Punctuation | Semicolons per sentence | ${features.punctuation.semicolonRate} |
| Lexical | Profanity rate | ${(features.lexical.profanityRate * 100).toFixed(1)}% |
| Lexical | Slang rate | ${(features.lexical.slangRate * 100).toFixed(1)}% |
| Lexical | Intensifier rate | ${(features.lexical.intensifierRate * 100).toFixed(1)}% |
| Lexical | Contraction rate | ${(features.lexical.contractionRate * 100).toFixed(1)}% |
| Structure | Avg sentence length | ${features.structure.avgSentenceLength} words |
| Structure | Avg word length | ${features.structure.avgWordLength} chars |
| Capitalization | All lowercase | ${features.capitalization.allLowercase ? 'Yes' : 'No'} |
| Capitalization | ALL CAPS rate | ${(features.capitalization.allCapsRate * 100).toFixed(1)}% |
| Capitalization | Lowercase sentence starts | ${(features.capitalization.startsWithLowercase * 100).toFixed(1)}% |
| Emoji | Emoji per sentence | ${features.emoji.emojiRate} |

---

## 2. Spelling Substitutions

${spellingSection}

---

## 3. Ready-to-Use System Prompt

Copy this entire block as your LLM system message:

\`\`\`
${systemPrompt}
\`\`\`

---

## 4. Qualitative Style Description

AI-generated analysis of the writing voice:

${qualitativeAnalysis}

---

## 5. Representative Sentences

The most stylistically distinctive sentences from the original sample:

${sentencesSection}

---

## 6. Original Writing Sample

The source text this persona was extracted from:

\`\`\`
${originalText}
\`\`\`
`;

  const filename = `persona-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(md);
});

app.listen(PORT, () => {
  console.log(`Writing Personality server running at http://localhost:${PORT}`);
});
