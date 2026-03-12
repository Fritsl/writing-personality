// The style applicator is responsible for generating styled responses
// using the profile built by the style-profiler.
// Most of the heavy lifting is in the system prompt (built by style-profiler).
// This module provides convenience methods for the server routes.

function createStyledMessages(profile, userMessage, conversationHistory = []) {
  return [
    { role: 'system', content: profile.systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];
}

function createCleanMessages(userMessage, conversationHistory = []) {
  return [
    { role: 'system', content: 'You are a helpful assistant. Respond naturally and helpfully.' },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];
}

module.exports = { createStyledMessages, createCleanMessages };
