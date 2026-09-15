export function readStorage(key, fallback, validate) {
  try { const value = JSON.parse(window.localStorage.getItem(key)); return value !== null && validate(value) ? value : fallback; } catch { return fallback; }
}
export function writeStorage(key, value) { try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
