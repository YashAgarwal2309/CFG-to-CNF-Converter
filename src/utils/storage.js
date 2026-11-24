/**
 * Safe Local Storage access. Every read validates the stored shape and falls
 * back to a default when data is missing, corrupted or storage is unavailable
 * (private mode, disabled cookies, quota errors).
 */

export const STORAGE_KEYS = {
  workspace: 'cnf.workspace.v1',
  library: 'cnf.library.v1',
  recent: 'cnf.recent.v1',
  stats: 'cnf.stats.v1',
  theme: 'cnf.theme.v1',
  conversion: 'cnf.conversion.v1',
  quiz: 'cnf.quiz.v1',
};

export function readJSON(key, fallback, validate = () => true) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    const value = JSON.parse(raw);
    return validate(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

const isString = (v) => typeof v === 'string';

/** Validate/normalise a grammar "source" record (what the editor holds). */
export function normalizeSource(value) {
  if (!value || typeof value !== 'object' || !isString(value.text)) return null;
  return {
    name: isString(value.name) && value.name.trim() ? value.name.slice(0, 120) : 'Untitled grammar',
    text: value.text.slice(0, 50000),
    start: isString(value.start) ? value.start.slice(0, 60) : '',
    nonTerminals: isString(value.nonTerminals) ? value.nonTerminals.slice(0, 2000) : '',
    terminals: isString(value.terminals) ? value.terminals.slice(0, 2000) : '',
  };
}

export function isValidWorkspace(value) {
  return normalizeSource(value) !== null;
}

/** Saved library entries: [{ id, name, text, start, …, createdAt, updatedAt, history }] */
export function normalizeLibrary(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const source = normalizeSource(entry);
      if (!source) return null;
      return {
        ...source,
        id: isString(entry.id) ? entry.id : createId(),
        createdAt: isString(entry.createdAt) ? entry.createdAt : new Date().toISOString(),
        updatedAt: isString(entry.updatedAt) ? entry.updatedAt : new Date().toISOString(),
        history: Array.isArray(entry.history) ? entry.history.filter((h) => h && typeof h === 'object').slice(0, 25) : [],
      };
    })
    .filter(Boolean);
}

export function createId() {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
