import { jest } from '@jest/globals';

// --- Mock calendarClient ---
const mockGetEvent = jest.fn();
const MockCalendarError = class CalendarError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CalendarError';
  }
};

jest.unstable_mockModule('../../src/calendar/calendarClient.js', () => ({
  getEvent: mockGetEvent,
  CalendarError: MockCalendarError,
}));

// --- Mock pipeline ---
const mockBriefingGenerator = jest.fn();
const MockPipelineError = class PipelineError extends Error {
  constructor(stageName, cause) {
    super(`Pipeline stage '${stageName}' failed: ${cause?.message ?? stageName}`);
    this.name = 'PipelineError';
    this.stageName = stageName;
  }
};

jest.unstable_mockModule('../../src/pipeline/briefingGenerator.js', () => ({
  briefingGenerator: mockBriefingGenerator,
}));

jest.unstable_mockModule('../../src/pipeline/index.js', () => ({
  PipelineError: MockPipelineError,
}));

// --- Mock storage ---
const mockStore = {
  getInRange: jest.fn(),
};

jest.unstable_mockModule('../../src/storage/index.js', () => ({
  store: mockStore,
}));

// Dynamic imports AFTER mocks are registered
const { default: request } = await import('supertest');
const { default: express } = await import('express');
const { default: briefingRouter } = await import('../../src/routes/briefing.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/briefing', briefingRouter);
  return app;
}

const SAMPLE_EVENT = {
  event_id: 'evt-001',
  event_title: 'Weekly check-in',
  event_start: '2024-06-01T10:00:00.000Z',
};

const SAMPLE_BRIEFING = {
  event_id: 'evt-001',
  event_title: 'Weekly check-in',
  event_start: '2024-06-01T10:00:00.000Z',
  briefing_text: 'You have a weekly check-in coming up.',
  dominant_emotion: 'calm',
  suggested_topics: ['agenda', 'deadlines'],
};

const SAMPLE_RECORDS = [
  { id: 'r1', emotion: 'calm', original_text: 'Hello' },
];

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.CALENDAR_ENABLED;
  mockStore.getInRange.mockResolvedValue(SAMPLE_RECORDS);
  mockGetEvent.mockResolvedValue(SAMPLE_EVENT);
  mockBriefingGenerator.mockResolvedValue(SAMPLE_BRIEFING);
});

describe('GET /briefing', () => {
  describe('CALENDAR_ENABLED check', () => {
    test('returns 404 when CALENDAR_ENABLED is not set', async () => {
      const res = await request(buildApp()).get('/briefing?event_id=evt-001');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Calendar integration is not enabled');
    });

    test('returns 404 when CALENDAR_ENABLED is "false"', async () => {
      process.env.CALENDAR_ENABLED = 'false';
      const res = await request(buildApp()).get('/briefing?event_id=evt-001');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('with CALENDAR_ENABLED=true', () => {
    beforeEach(() => {
      process.env.CALENDAR_ENABLED = 'true';
    });

    afterEach(() => {
      delete process.env.CALENDAR_ENABLED;
    });

    test('returns 400 when event_id is missing', async () => {
      const res = await request(buildApp()).get('/briefing');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'event_id query parameter is required');
    });

    test('returns 502 when getEvent throws CalendarError', async () => {
      mockGetEvent.mockRejectedValue(new MockCalendarError('Calendar provider returned 503'));
      const res = await request(buildApp()).get('/briefing?event_id=evt-001');
      expect(res.status).toBe(502);
      expect(res.body).toHaveProperty('error', 'Calendar provider returned 503');
    });

    test('calls getInRange with from = event_start - 7 days and to = event_start', async () => {
      const res = await request(buildApp()).get('/briefing?event_id=evt-001');
      expect(res.status).toBe(200);
      const expectedTo = '2024-06-01T10:00:00.000Z';
      const expectedFrom = new Date(new Date(expectedTo).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      expect(mockStore.getInRange).toHaveBeenCalledWith(expectedFrom, expectedTo);
    });

    test('returns 502 when briefingGenerator throws PipelineError', async () => {
      mockBriefingGenerator.mockRejectedValue(
        new MockPipelineError('Briefing_Generator', new Error('LLM failed'))
      );
      const res = await request(buildApp()).get('/briefing?event_id=evt-001');
      expect(res.status).toBe(502);
      expect(res.body).toHaveProperty('error');
    });

    test('returns 200 with briefing object on success', async () => {
      const res = await request(buildApp()).get('/briefing?event_id=evt-001');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(SAMPLE_BRIEFING);
    });

    test('passes event and records to briefingGenerator', async () => {
      await request(buildApp()).get('/briefing?event_id=evt-001');
      expect(mockBriefingGenerator).toHaveBeenCalledWith(SAMPLE_EVENT, SAMPLE_RECORDS);
    });
  });
});
