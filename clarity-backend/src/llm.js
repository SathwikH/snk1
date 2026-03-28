export class LLMError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
  }
}

// Use LLM_BASE_URL env var if provided, otherwise fall back to OpenAI
const DEFAULT_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

async function doRequest(apiKey, systemPrompt, userContent) {
  const baseUrl = process.env.LLM_BASE_URL || DEFAULT_URL;
  const model = process.env.LLM_MODEL || DEFAULT_MODEL;

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'x-api-key': apiKey, // some proxies use this header instead
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  });

  return response;
}

// Mock responses for testing without a real API key
const MOCK_RESPONSES = {
  simplifier: 'The doctor said you need to take your medicine two times a day. Eat food when you take it.',
  explainer: 'physician: a doctor who helps people stay healthy.\nbilateral: happening on both sides.\nnephrectomy: an operation to remove a kidney.\nrenal carcinoma: a type of cancer that grows in the kidney.',
  emotion: 'neutral',
  response: "You're doing a great job keeping track of your health. It's okay to take things one step at a time. I'm here if you need anything explained more simply.",
};

export async function callLLM(systemPrompt, userContent) {
  if (process.env.MOCK_LLM === 'true') {
    await new Promise(r => setTimeout(r, 300)); // simulate latency
    if (systemPrompt.includes('simplification')) return MOCK_RESPONSES.simplifier;
    if (systemPrompt.includes('vocabulary')) return MOCK_RESPONSES.explainer;
    if (systemPrompt.includes('emotion classifier')) return MOCK_RESPONSES.emotion;
    return MOCK_RESPONSES.response;
  }

  const apiKey = process.env.KIRO_API_KEY;
  if (!apiKey) {
    throw new LLMError('KIRO_API_KEY is not set');
  }

  let response = await doRequest(apiKey, systemPrompt, userContent);

  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    response = await doRequest(apiKey, systemPrompt, userContent);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new LLMError(
      `LLM request failed with status ${response.status}: ${body}`,
      response.status
    );
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
