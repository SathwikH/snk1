import { briefingGenerator } from '../../src/pipeline/briefingGenerator.js';
import { PipelineError } from '../../src/pipeline/pipelineError.js';

// Use mock LLM for all tests
beforeEach(() => {
  process.env.MOCK_LLM = 'true';
});
afterEach(() => {
  delete process.env.MOCK_LLM;
});

const sampleEvent = {
  event_id: 'evt-001',
  event_title: 'Weekly check-in',
  event_start: '2024-06-01T10:00:00Z',
};

const sampleRecords = [
  { emotion: 'calm', original_text: 'How are you doing today?' },
  { emotion: 'calm', original_text: 'Let us go over the agenda.' },
  { emotion: 'anxious', original_text: 'I am not sure about the deadline.' },
];

describe('briefingGenerator', () => {
  it('echoes event fields into the returned object', async () => {
    const result = await briefingGenerator(sampleEvent, sampleRecords);
    expect(result.event_id).toBe('evt-001');
    expect(result.event_title).toBe('Weekly check-in');
    expect(result.event_start).toBe('2024-06-01T10:00:00Z');
  });

  it('returns briefing_text, dominant_emotion, and suggested_topics', async () => {
    const result = await briefingGenerator(sampleEvent, sampleRecords);
    expect(typeof result.briefing_text).toBe('string');
    expect(typeof result.dominant_emotion).toBe('string');
    expect(Array.isArray(result.suggested_topics)).toBe(true);
  });

  it('returns suggested_topics with 2-4 items', async () => {
    const result = await briefingGenerator(sampleEvent, sampleRecords);
    expect(result.suggested_topics.length).toBeGreaterThanOrEqual(2);
    expect(result.suggested_topics.length).toBeLessThanOrEqual(4);
  });

  it('defaults dominant_emotion to calm when records is empty', async () => {
    const result = await briefingGenerator(sampleEvent, []);
    expect(result.dominant_emotion).toBe('calm');
  });

  it('works when records is empty (no prior history)', async () => {
    const result = await briefingGenerator(sampleEvent, []);
    expect(result.event_id).toBe('evt-001');
    expect(typeof result.briefing_text).toBe('string');
  });

  it('throws PipelineError when LLM fails', async () => {
    process.env.MOCK_LLM = 'false';
    delete process.env.KIRO_API_KEY;
    await expect(briefingGenerator(sampleEvent, sampleRecords))
      .rejects.toMatchObject({ name: 'PipelineError', message: expect.stringContaining('Briefing_Generator') });
  });
});
