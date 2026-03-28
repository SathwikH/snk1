// Feature: clarity-enhancements, Property 3: Summary is stored with type "summary"
// Validates: Requirements 2.4, 2.8

import { jest } from '@jest/globals';
import fc from 'fast-check';

const VALID_EMOTIONS = ['happy', 'excited', 'grateful', 'calm', 'surprised', 'confused', 'stressed', 'anxious', 'sad', 'angry'];

// --- Mock storage ---
const mockStore = {
  save: jest.fn(),
  getAll: jest.fn(),
  getByIds: jest.fn(),
  getByDate: jest.fn(),
};

jest.unstable_mockModule('../../src/storage/index.js', () => ({
  store: mockStore,
}));

// Dynamic imports AFTER mocks
const { default: request } = await import('supertest');
const { default: express } = await import('express');
const { default: summaryRouter } = await import('../../src/routes/summary.js');

// Build a minimal app with just the summary route
const app = express();
app.use(express.json());
app.use('/summary', summaryRouter);

beforeAll(() => {
  process.env.MOCK_LLM = 'true';
});

afterAll(() => {
  delete process.env.MOCK_LLM;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Property 3: Summary is stored with type "summary"', () => {
  test('saved record always has type "summary" and required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            original_text: fc.string({ minLength: 1 }),
            emotion: fc.constantFrom(...VALID_EMOTIONS),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (records) => {
          const ids = records.map(r => r.id);

          mockStore.getByIds.mockResolvedValue(records);
          mockStore.save.mockImplementation(async (data) => ({
            ...data,
            id: 'saved-uuid',
            timestamp: new Date().toISOString(),
          }));

          const res = await request(app)
            .post('/summary')
            .send({ interaction_ids: ids });

          expect(res.status).toBe(201);

          // The saved call must include type: "summary"
          const saveArg = mockStore.save.mock.calls[0][0];
          expect(saveArg.type).toBe('summary');

          // Required fields must be present
          expect(typeof saveArg.recap).toBe('string');
          expect(VALID_EMOTIONS).toContain(saveArg.dominant_emotion);
          expect(Array.isArray(saveArg.confused_moments)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  }, 60000);
});
