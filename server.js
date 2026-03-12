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

app.listen(PORT, () => {
  console.log(`Writing Personality server running at http://localhost:${PORT}`);
});
