import { jest } from '@jest/globals';

// --- Mock pipeline ---
const mockRunPipeline = jest.fn();
const mockPipelineError = class PipelineError extends Error {
  constructor(stageName, cause) {
    super(`Pipeline stage '${stageName}' failed: ${cause.message}`);
    this.name = 'PipelineError';
    this.stageName = stageName;
    this.cause = cause;
  }
};

jest.unstable_mockModule('../../src/pipeline/index.js', () => ({
  runPipeline: mockRunPipeline,
  PipelineError: mockPipelineError,
}));

// --- Mock storage ---
const mockStore = {
  save: jest.fn(),
  getAll: jest.fn(),
  getByDate: jest.fn(),
};

jest.unstable_mockModule('../../src/storage/index.js', () => ({
  store: mockStore,
}));

// Dynamic imports AFTER mocks are registered
const { default: request } = await import('supertest');
const { app } = await import('../../src/server.js');

const VALID_CTX = {
  original_text: 'Hello world',
  simplified_text: 'Hello world',
  explanation: 'No complex terms found.',
  emotion: 'neutral',
  response: 'That is great!',
};

const STORED_RECORD = {
  ...VALID_CTX,
  id: 'test-uuid-1234',
  timestamp: '2024-01-15T14:32:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.save.mockResolvedValue(STORED_RECORD);
  mockStore.getAll.mockResolvedValue([]);
  mockStore.getByDate.mockResolvedValue([]);
});

// ─── GET /health ────────────────────────────────────────────────────────────

describe('GET /health', () => {
  test('returns 200 with { status: ok }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

// ─── POST /process ───────────────────────────────────────────────────────────

describe('POST /process', () => {
  test('returns 400 when text is missing', async () => {
    const res = await request(app).post('/process').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when text is empty string', async () => {
    const res = await request(app).post('/process').send({ text: '' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when text is whitespace only', async () => {
    const res = await request(app).post('/process').send({ text: '   ' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when text exceeds 2000 characters', async () => {
    const res = await request(app).post('/process').send({ text: 'a'.repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 200 with all required fields on valid text', async () => {
    mockRunPipeline.mockResolvedValue(VALID_CTX);
    const res = await request(app).post('/process').send({ text: 'Hello world' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('original_text');
    expect(res.body).toHaveProperty('simplified_text');
    expect(res.body).toHaveProperty('explanation');
    expect(res.body).toHaveProperty('emotion');
    expect(res.body).toHaveProperty('response');
    expect(res.body).toHaveProperty('timestamp');
  });

  test('returns 502 when pipeline throws PipelineError', async () => {
    mockRunPipeline.mockRejectedValue(
      new mockPipelineError('Simplifier', new Error('LLM failed'))
    );
    const res = await request(app).post('/process').send({ text: 'Hello world' });
    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 200 even when store.save throws', async () => {
    mockRunPipeline.mockResolvedValue(VALID_CTX);
    mockStore.save.mockRejectedValue(new Error('disk full'));
    const res = await request(app).post('/process').send({ text: 'Hello world' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('original_text');
  });
});

// ─── GET /memory ─────────────────────────────────────────────────────────────

describe('GET /memory', () => {
  test('returns 200 with [] when no records exist', async () => {
    mockStore.getAll.mockResolvedValue([]);
    const res = await request(app).get('/memory');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns 200 with filtered records for valid date', async () => {
    mockStore.getByDate.mockResolvedValue([STORED_RECORD]);
    const res = await request(app).get('/memory?date=2024-01-15');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([STORED_RECORD]);
    expect(mockStore.getByDate).toHaveBeenCalledWith('2024-01-15');
  });

  test('returns 400 for invalid date format', async () => {
    const res = await request(app).get('/memory?date=bad-format');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── POST /memory ─────────────────────────────────────────────────────────────

describe('POST /memory', () => {
  const VALID_BODY = {
    original_text: 'Take your medicine.',
    simplified_text: 'Take your medicine.',
    explanation: 'No complex terms found.',
    emotion: 'neutral',
    response: 'You are doing great!',
  };

  test('returns 201 with id and timestamp on valid body', async () => {
    mockStore.save.mockResolvedValue({ ...VALID_BODY, id: 'abc-123', timestamp: '2024-01-15T00:00:00.000Z' });
    const res = await request(app).post('/memory').send(VALID_BODY);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('timestamp');
  });

  test('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/memory').send({ original_text: 'hi' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/Missing required fields/);
  });

  test('returns 400 when emotion is invalid', async () => {
    const res = await request(app).post('/memory').send({ ...VALID_BODY, emotion: 'happy' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/emotion must be one of/);
  });
});
