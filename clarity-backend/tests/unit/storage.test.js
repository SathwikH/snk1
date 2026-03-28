import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createMemoryStore } from '../../src/storage/memoryStore.js';

// --- memoryStore tests ---

describe('memoryStore', () => {
  let store;

  beforeEach(() => {
    store = createMemoryStore();
  });

  test('save assigns a UUID id', () => {
    const record = store.save({ original_text: 'hello' });
    expect(record.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  test('save assigns an ISO 8601 timestamp', () => {
    const record = store.save({ original_text: 'hello' });
    expect(new Date(record.timestamp).toISOString()).toBe(record.timestamp);
  });

  test('save preserves all interaction fields', () => {
    const interaction = { original_text: 'hi', emotion: 'neutral', response: 'ok' };
    const record = store.save(interaction);
    expect(record.original_text).toBe('hi');
    expect(record.emotion).toBe('neutral');
    expect(record.response).toBe('ok');
  });

  test('getAll returns records newest-first', () => {
    store.save({ original_text: 'first' });
    store.save({ original_text: 'second' });
    store.save({ original_text: 'third' });
    const all = store.getAll();
    // timestamps are assigned in order; newest should be last saved
    for (let i = 0; i < all.length - 1; i++) {
      expect(all[i].timestamp >= all[i + 1].timestamp).toBe(true);
    }
  });

  test('getAll returns a copy (mutations do not affect internal state)', () => {
    store.save({ original_text: 'a' });
    const all = store.getAll();
    all.push({ fake: true });
    expect(store.getAll()).toHaveLength(1);
  });

  test('getByDate returns only records matching the date', () => {
    // Manually craft records by saving and then checking filter
    const r1 = store.save({ original_text: 'a' });
    const r2 = store.save({ original_text: 'b' });
    const date = r1.timestamp.slice(0, 10);
    const filtered = store.getByDate(date);
    expect(filtered.every(r => r.timestamp.slice(0, 10) === date)).toBe(true);
    expect(filtered.length).toBeGreaterThanOrEqual(1);
  });

  test('getByDate returns [] for a date with no records', () => {
    store.save({ original_text: 'a' });
    expect(store.getByDate('1990-01-01')).toEqual([]);
  });

  test('getByDate returns records sorted newest-first', () => {
    store.save({ original_text: 'x' });
    store.save({ original_text: 'y' });
    const date = store.getAll()[0].timestamp.slice(0, 10);
    const filtered = store.getByDate(date);
    for (let i = 0; i < filtered.length - 1; i++) {
      expect(filtered[i].timestamp >= filtered[i + 1].timestamp).toBe(true);
    }
  });
});

// --- fileStore tests (using a temp file) ---

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFileStore } from '../../src/storage/fileStore.js';

describe('fileStore', () => {
  let tmpDir;
  let filePath;
  let store;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'clarity-test-'));
    filePath = join(tmpDir, 'test.json');
    store = createFileStore(filePath);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('save assigns a UUID id', () => {
    const record = store.save({ original_text: 'hello' });
    expect(record.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  test('save assigns an ISO 8601 timestamp', () => {
    const record = store.save({ original_text: 'hello' });
    expect(new Date(record.timestamp).toISOString()).toBe(record.timestamp);
  });

  test('save preserves all interaction fields', () => {
    const interaction = { original_text: 'hi', emotion: 'neutral', response: 'ok' };
    const record = store.save(interaction);
    expect(record.original_text).toBe('hi');
    expect(record.emotion).toBe('neutral');
    expect(record.response).toBe('ok');
  });

  test('getAll returns records newest-first', async () => {
    store.save({ original_text: 'a' });
    // Small delay to ensure distinct timestamps
    await new Promise(r => setTimeout(r, 5));
    store.save({ original_text: 'b' });
    const all = store.getAll();
    expect(all[0].original_text).toBe('b');
    expect(all[1].original_text).toBe('a');
  });

  test('getAll returns [] when file does not exist', () => {
    expect(store.getAll()).toEqual([]);
  });

  test('getByDate filters correctly', () => {
    const r1 = store.save({ original_text: 'a' });
    store.save({ original_text: 'b' });
    const date = r1.timestamp.slice(0, 10);
    const filtered = store.getByDate(date);
    expect(filtered.every(r => r.timestamp.slice(0, 10) === date)).toBe(true);
    expect(filtered.length).toBeGreaterThanOrEqual(1);
  });

  test('getByDate returns [] for a date with no records', () => {
    store.save({ original_text: 'a' });
    expect(store.getByDate('1990-01-01')).toEqual([]);
  });

  test('getByDate returns records sorted newest-first', () => {
    store.save({ original_text: 'x' });
    store.save({ original_text: 'y' });
    const date = store.getAll()[0].timestamp.slice(0, 10);
    const filtered = store.getByDate(date);
    for (let i = 0; i < filtered.length - 1; i++) {
      expect(filtered[i].timestamp >= filtered[i + 1].timestamp).toBe(true);
    }
  });
});
