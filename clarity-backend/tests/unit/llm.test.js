import { jest } from '@jest/globals';

// Mock fetch globally before importing the module
const mockFetch = jest.fn();
global.fetch = mockFetch;

const { callLLM, LLMError } = await import('../../src/llm.js');

function makeResponse(status, body) {
  const isOk = status >= 200 && status < 300;
  return {
    ok: isOk,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => body,
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  process.env.KIRO_API_KEY = 'test-key';
  delete process.env.MOCK_LLM;
});

afterEach(() => {
  delete process.env.KIRO_API_KEY;
});

describe('callLLM', () => {
  test('returns assistant message content on success', async () => {
    const successBody = {
      choices: [{ message: { content: 'Hello, world!' } }],
    };
    mockFetch.mockResolvedValueOnce(makeResponse(200, successBody));

    const result = await callLLM('system prompt', 'user content');
    expect(result).toBe('Hello, world!');
  });

  test('throws LLMError if KIRO_API_KEY is missing', async () => {
    delete process.env.KIRO_API_KEY;

    await expect(callLLM('system', 'user')).rejects.toThrow(LLMError);
    await expect(callLLM('system', 'user')).rejects.toThrow('KIRO_API_KEY is not set');
  });

  test('retries once on 429 and succeeds on second attempt', async () => {
    jest.useFakeTimers();

    const successBody = {
      choices: [{ message: { content: 'Retry success' } }],
    };
    mockFetch
      .mockResolvedValueOnce(makeResponse(429, 'Too Many Requests'))
      .mockResolvedValueOnce(makeResponse(200, successBody));

    const resultPromise = callLLM('system', 'user');
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('Retry success');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  test('throws LLMError on 429 followed by another non-2xx', async () => {
    jest.useFakeTimers();

    mockFetch
      .mockResolvedValueOnce(makeResponse(429, 'Too Many Requests'))
      .mockResolvedValueOnce(makeResponse(500, 'Internal Server Error'));

    const resultPromise = callLLM('system', 'user');
    // Run timers and await the promise together to avoid unhandled rejection warning
    await Promise.all([jest.runAllTimersAsync(), resultPromise.catch(() => {})]);

    await expect(resultPromise).rejects.toThrow(LLMError);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  test('throws LLMError with status and body on non-2xx response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(503, 'Service Unavailable'));
    await expect(callLLM('system', 'user')).rejects.toThrow(LLMError);

    mockFetch.mockResolvedValueOnce(makeResponse(503, 'Service Unavailable'));
    await expect(callLLM('system', 'user')).rejects.toThrow('503');
  });

  test('LLMError has descriptive message on failure', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(401, 'Unauthorized'));

    let error;
    try {
      await callLLM('system', 'user');
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(LLMError);
    expect(error.message).toContain('401');
    expect(error.message).toContain('Unauthorized');
    expect(error.status).toBe(401);
  });

  test('sends correct request to OpenAI API', async () => {
    const successBody = {
      choices: [{ message: { content: 'response' } }],
    };
    mockFetch.mockResolvedValueOnce(makeResponse(200, successBody));

    await callLLM('my system prompt', 'my user content');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        }),
      })
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.temperature).toBe(0.3);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'my system prompt' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'my user content' });
  });
});
