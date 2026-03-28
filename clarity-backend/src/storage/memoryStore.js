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

  function getByIds(ids) {
    return records.filter(r => ids.includes(r.id));
  }

  function getInRange(from, to) {
    return records
      .filter(r => r.timestamp >= from && r.timestamp <= to)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  function deleteById(id) {
    const idx = records.findIndex(r => r.id === id);
    if (idx !== -1) records.splice(idx, 1);
  }

  function clear() {
    records.length = 0;
  }

  return { save, getAll, getByDate, getByIds, getInRange, deleteById, clear };
}
