export class LLMError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
  }
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function doRequest(apiKey, systemPrompt, userContent) {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  });

  return response;
}

export async function callLLM(systemPrompt, userContent) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new LLMError('OPENAI_API_KEY is not set');
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
