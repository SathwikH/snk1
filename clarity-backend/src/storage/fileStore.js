import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export function createFileStore(filePath = 'memory.json') {
  function readRecords() {
    if (!existsSync(filePath)) return [];
    try {
      const raw = readFileSync(filePath, 'utf8');
      return raw.trim() ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function save(interaction) {
    const records = readRecords();
    const record = {
      ...interaction,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    records.push(record);
    writeFileSync(filePath, JSON.stringify(records, null, 2));
    return record;
  }

  function getAll() {
    return readRecords().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  function getByDate(dateStr) {
    return readRecords()
      .filter(r => r.timestamp.slice(0, 10) === dateStr)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  function getByIds(ids) {
    return readRecords().filter(r => ids.includes(r.id));
  }

  function getInRange(from, to) {
    return readRecords()
      .filter(r => r.timestamp >= from && r.timestamp <= to)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  function deleteById(id) {
    const records = readRecords().filter(r => r.id !== id);
    writeFileSync(filePath, JSON.stringify(records, null, 2));
  }

  function clear() {
    writeFileSync(filePath, '[]');
  }

  return { save, getAll, getByDate, getByIds, getInRange, clear };
}
