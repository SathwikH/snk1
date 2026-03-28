import { createMemoryStore } from './memoryStore.js';
import { createFileStore } from './fileStore.js';

export function getStore() {
  if (process.env.STORAGE_TYPE === 'file') {
    return createFileStore();
  }
  return createMemoryStore();
}

export const store = getStore();
