import { describe, test, expect } from '@jest/globals';
import { inputProcessor } from '../../src/pipeline/inputProcessor.js';

describe('inputProcessor', () => {
  test('trims leading and trailing whitespace in normalized_text', () => {
    const ctx = { raw_text: '  hello world  ' };
    const result = inputProcessor(ctx);
    expect(result.normalized_text).toBe('hello world');
  });

  test('original_text preserves the raw value unchanged', () => {
    const raw = '  hello world  ';
    const ctx = { raw_text: raw };
    const result = inputProcessor(ctx);
    expect(result.original_text).toBe(raw);
  });

  test('all-whitespace string produces empty normalized_text', () => {
    const ctx = { raw_text: '   \t\n  ' };
    const result = inputProcessor(ctx);
    expect(result.normalized_text).toBe('');
  });

  test('spreads existing ctx properties into result', () => {
    const ctx = { raw_text: 'hello', extra: 'value' };
    const result = inputProcessor(ctx);
    expect(result.extra).toBe('value');
  });

  test('text with no surrounding whitespace is unchanged', () => {
    const ctx = { raw_text: 'clean text' };
    const result = inputProcessor(ctx);
    expect(result.normalized_text).toBe('clean text');
    expect(result.original_text).toBe('clean text');
  });
});
