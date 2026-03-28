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

// --- getByIds / getInRange tests (memoryStore) ---

describe('memoryStore – getByIds', () => {
  let store;
  beforeEach(() => { store = createMemoryStore(); });

  test('returns records matching the given ids', () => {
    const r1 = store.save({ original_text: 'a' });
    const r2 = store.save({ original_text: 'b' });
    store.save({ original_text: 'c' });
    const result = store.getByIds([r1.id, r2.id]);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.id)).toEqual(expect.arrayContaining([r1.id, r2.id]));
  });

  test('returns [] when no ids match', () => {
    store.save({ original_text: 'a' });
    expect(store.getByIds(['non-existent-id'])).toEqual([]);
  });

  test('returns [] for empty ids array', () => {
    store.save({ original_text: 'a' });
    expect(store.getByIds([])).toEqual([]);
  });
});

describe('memoryStore – getInRange', () => {
  let store;
  beforeEach(() => { store = createMemoryStore(); });

  test('returns records within the inclusive range', () => {
    const r1 = store.save({ original_text: 'a' });
    const r2 = store.save({ original_text: 'b' });
    const r3 = store.save({ original_text: 'c' });
    const result = store.getInRange(r1.timestamp, r3.timestamp);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  test('returns [] when range excludes all records', () => {
    store.save({ original_text: 'a' });
    expect(store.getInRange('1990-01-01T00:00:00.000Z', '1990-01-02T00:00:00.000Z')).toEqual([]);
  });

  test('returns records sorted newest-first', () => {
    store.save({ original_text: 'x' });
    store.save({ original_text: 'y' });
    const all = store.getAll();
    const result = store.getInRange(all[all.length - 1].timestamp, all[0].timestamp);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].timestamp >= result[i + 1].timestamp).toBe(true);
    }
  });
});

// --- getByIds / getInRange tests (fileStore) ---

describe('fileStore – getByIds', () => {
  let tmpDir, filePath, store;
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'clarity-test-'));
    filePath = join(tmpDir, 'test.json');
    store = createFileStore(filePath);
  });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  test('returns records matching the given ids', () => {
    const r1 = store.save({ original_text: 'a' });
    const r2 = store.save({ original_text: 'b' });
    store.save({ original_text: 'c' });
    const result = store.getByIds([r1.id, r2.id]);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.id)).toEqual(expect.arrayContaining([r1.id, r2.id]));
  });

  test('returns [] when no ids match', () => {
    store.save({ original_text: 'a' });
    expect(store.getByIds(['non-existent-id'])).toEqual([]);
  });

  test('returns [] for empty ids array', () => {
    store.save({ original_text: 'a' });
    expect(store.getByIds([])).toEqual([]);
  });
});

describe('fileStore – getInRange', () => {
  let tmpDir, filePath, store;
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'clarity-test-'));
    filePath = join(tmpDir, 'test.json');
    store = createFileStore(filePath);
  });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  test('returns records within the inclusive range', () => {
    const r1 = store.save({ original_text: 'a' });
    const r3 = store.save({ original_text: 'c' });
    const result = store.getInRange(r1.timestamp, r3.timestamp);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  test('returns [] when range excludes all records', () => {
    store.save({ original_text: 'a' });
    expect(store.getInRange('1990-01-01T00:00:00.000Z', '1990-01-02T00:00:00.000Z')).toEqual([]);
  });

  test('returns records sorted newest-first', async () => {
    store.save({ original_text: 'x' });
    await new Promise(r => setTimeout(r, 5));
    store.save({ original_text: 'y' });
    const all = store.getAll();
    const result = store.getInRange(all[all.length - 1].timestamp, all[0].timestamp);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].timestamp >= result[i + 1].timestamp).toBe(true);
    }
  });
});
