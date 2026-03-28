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

  return { save, getAll, getByDate };
}
