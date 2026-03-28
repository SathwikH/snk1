import { jest } from '@jest/globals';

// Mock callLLM before dynamic imports
const mockCallLLM = jest.fn();

jest.unstable_mockModule('../../src/llm.js', () => ({
  callLLM: mockCallLLM,
}));

// Dynamic imports AFTER mocks are registered
const { replyGenerator } = await import('../../src/pipeline/replyGenerator.js');
const { PipelineError } = await import('../../src/pipeline/pipelineError.js');

const baseCtx = {
  normalized_text: 'Can you help me with this?',
  emotion: 'anxious',
  simplified_text: 'Can you help me?',
};

beforeEach(() => jest.clearAllMocks());

describe('replyGenerator', () => {
  it('returns suggested_replies array on valid JSON array response', async () => {
    mockCallLLM.mockResolvedValue('["Sure, I can help.", "No problem at all.", "Let me know what you need."]');
    const result = await replyGenerator(baseCtx);
    expect(result.suggested_replies).toEqual([
      'Sure, I can help.',
      'No problem at all.',
      'Let me know what you need.',
    ]);
    expect(result).toMatchObject(baseCtx);
  });

  it('returns [] and logs warning on invalid JSON', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockCallLLM.mockResolvedValue('not valid json');
    const result = await replyGenerator(baseCtx);
    expect(result.suggested_replies).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('returns [] and logs warning when parsed result is not an array', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockCallLLM.mockResolvedValue('{"reply": "hello"}');
    const result = await replyGenerator(baseCtx);
    expect(result.suggested_replies).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('filters out non-string items from the array', async () => {
    mockCallLLM.mockResolvedValue('["Valid reply.", 42, null, "Another reply."]');
    const result = await replyGenerator(baseCtx);
    expect(result.suggested_replies).toEqual(['Valid reply.', 'Another reply.']);
  });

  it('trims whitespace from each reply', async () => {
    mockCallLLM.mockResolvedValue('[" trimmed reply ", "  another  "]');
    const result = await replyGenerator(baseCtx);
    expect(result.suggested_replies).toEqual(['trimmed reply', 'another']);
  });

  it('throws PipelineError when callLLM fails', async () => {
    mockCallLLM.mockRejectedValue(new Error('LLM unavailable'));
    await expect(replyGenerator(baseCtx)).rejects.toThrow(PipelineError);
    await expect(replyGenerator(baseCtx)).rejects.toThrow("Pipeline stage 'Reply_Generator' failed");
  });

  it('spreads ctx into the result', async () => {
    mockCallLLM.mockResolvedValue('["OK."]');
    const ctx = { ...baseCtx, explanation: 'some explanation', response: 'some response' };
    const result = await replyGenerator(ctx);
    expect(result.explanation).toBe('some explanation');
    expect(result.response).toBe('some response');
    expect(result.suggested_replies).toEqual(['OK.']);
  });
});
