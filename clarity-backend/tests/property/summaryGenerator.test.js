// Feature: clarity-enhancements, Property 2: Summary output has required structure
// Validates: Requirements 2.2

import fc from 'fast-check';
import { summaryGenerator } from '../../src/pipeline/summaryGenerator.js';

const VALID_EMOTIONS = ['happy', 'excited', 'grateful', 'calm', 'surprised', 'confused', 'stressed', 'anxious', 'sad', 'angry'];

beforeAll(() => {
  process.env.MOCK_LLM = 'true';
});

afterAll(() => {
  delete process.env.MOCK_LLM;
});

describe('Property 2: Summary output has required structure', () => {
  test('recap is non-empty string, dominant_emotion is valid label, confused_moments has at most 5 items', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            original_text: fc.string({ minLength: 1 }),
            emotion: fc.constantFrom(...VALID_EMOTIONS),
          }),
          { minLength: 1 }
        ),
        async (records) => {
          const result = await summaryGenerator(records);

          // recap must be a non-empty string
          expect(typeof result.recap).toBe('string');
          expect(result.recap.length).toBeGreaterThan(0);

          // dominant_emotion must be one of the 10 valid labels
          expect(VALID_EMOTIONS).toContain(result.dominant_emotion);

          // confused_moments must be an array of at most 5 strings
          expect(Array.isArray(result.confused_moments)).toBe(true);
          expect(result.confused_moments.length).toBeLessThanOrEqual(5);
          for (const moment of result.confused_moments) {
            expect(typeof moment).toBe('string');
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);
});
