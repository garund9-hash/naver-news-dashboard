/** In-memory localStorage stub for Node unit tests. */

export function createMemoryLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key(index) {
      return [...store.keys()][index] ?? null;
    },
    get length() {
      return store.size;
    },
  };
}

/** Install memory storage on globalThis for modules that read localStorage. */
export function installMemoryLocalStorage() {
  const memory = createMemoryLocalStorage();
  globalThis.localStorage = memory;
  return memory;
}
