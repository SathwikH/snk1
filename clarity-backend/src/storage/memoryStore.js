import { randomUUID } from 'node:crypto';

export function createMemoryStore() {
  const records = [];

  function save(interaction) {
    const record = {
      ...interaction,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    records.push(record);
    return record;
  }

  function getAll() {
    return [...records].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  function getByDate(dateStr) {
    return records
      .filter(r => r.timestamp.slice(0, 10) === dateStr)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  return { save, getAll, getByDate };
}
