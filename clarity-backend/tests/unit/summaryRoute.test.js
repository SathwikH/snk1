import { jest } from '@jest/globals';

// --- Mock PipelineError and summaryGenerator ---
const MockPipelineError = class PipelineError extends Error {
  constructor(stageName, cause) {
    super(`Pipeline stage '${stageName}' failed: ${cause?.message ?? stageName}`);
    this.name = 'PipelineError';
  }
};

const mockSummaryGenerator = jest.fn();

jest.unstable_mockModule('../../src/pipeline/index.js', () => ({
  PipelineError: MockPipelineError,
}));

jest.unstable_mockModule('../../src/pipeline/summaryGenerator.js', () => ({
  summaryGenerator: mockSummaryGenerator,
}));

// --- Mock storage ---
const mockStore = {
  save: jest.fn(),
  getByIds: jest.fn(),
};

jest.unstable_mockModule('../../src/storage/index.js', () => ({
  store: mockStore,
}));

// Dynamic imports AFTER mocks
const { default: request } = await import('supertest');
const { default: express } = await import('express');
const { default: summaryRouter } = await import('../../src/routes/summary.js');

const app = express();
app.use(express.json());
app.use('/summary', summaryRouter);

const SAMPLE_RECORDS = [
  { id: 'id-1', original_text: 'Hello', emotion: 'calm' },
];

const SUMMARY_RESULT = {
  recap: 'We discussed a topic.',
  dominant_emotion: 'calm',
  confused_moments: [],
};

const SAVED_SUMMARY = {
  id: 'sum-uuid',
  type: 'summary',
  ...SUMMARY_RESULT,
  timestamp: '2024-01-15T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /summary — 502 on PipelineError', () => {
  test('returns 502 when summaryGenerator throws PipelineError', async () => {
    mockStore.getByIds.mockResolvedValue(SAMPLE_RECORDS);
    mockSummaryGenerator.mockRejectedValue(
      new MockPipelineError('Summary_Generator', new Error('LLM failed'))
    );
    const res = await request(app).post('/summary').send({ interaction_ids: ['id-1'] });
    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 201 with saved record on success', async () => {
    mockStore.getByIds.mockResolvedValue(SAMPLE_RECORDS);
    mockSummaryGenerator.mockResolvedValue(SUMMARY_RESULT);
    mockStore.save.mockResolvedValue(SAVED_SUMMARY);
    const res = await request(app).post('/summary').send({ interaction_ids: ['id-1'] });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('type', 'summary');
    expect(mockStore.save).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'summary', ...SUMMARY_RESULT })
    );
  });
});
