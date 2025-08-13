// scripts/storage.js
export const store = {
    set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
    get(key, fallback = []) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
      catch { return fallback; }
    },
    remove(...keys) { keys.forEach(k => localStorage.removeItem(k)); }
  };
  