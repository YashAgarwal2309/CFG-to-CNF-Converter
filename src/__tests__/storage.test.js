import { describe, expect, it } from 'vitest';
import { normalizeLibrary, readJSON, removeKey, writeJSON } from '../utils/storage.js';

/**
 * The test environment must provide a real, browser-like Web Storage
 * (jsdom's), not Node's built-in localStorage (enabled by default in Node 25).
 * See src/test/setup.js.
 */
describe('test environment Web Storage', () => {
  it('is a DOM Storage instance shared by window and globalThis', () => {
    expect(window.localStorage).toBeInstanceOf(Storage);
    expect(window.sessionStorage).toBeInstanceOf(Storage);
    expect(window.localStorage).toBe(globalThis.localStorage);
  });

  it.each(['localStorage', 'sessionStorage'])('%s supports getItem, setItem, removeItem, clear, key and length', (name) => {
    const storage = window[name];
    storage.clear();
    expect(storage.length).toBe(0);
    expect(storage.getItem('missing')).toBeNull();
    expect(storage.key(0)).toBeNull();

    storage.setItem('a', '1');
    storage.setItem('b', 2); // values are converted to strings, as in browsers
    expect(storage.length).toBe(2);
    expect(storage.getItem('a')).toBe('1');
    expect(storage.getItem('b')).toBe('2');
    expect([storage.key(0), storage.key(1)].sort()).toEqual(['a', 'b']);
    expect(storage.key(2)).toBeNull();

    storage.setItem('a', 'updated');
    expect(storage.length).toBe(2);
    expect(storage.getItem('a')).toBe('updated');

    storage.removeItem('a');
    expect(storage.getItem('a')).toBeNull();
    expect(storage.length).toBe(1);
    storage.removeItem('does-not-exist'); // no error
    expect(storage.length).toBe(1);

    storage.clear();
    expect(storage.length).toBe(0);
  });

  it('starts every test empty (cleared by the shared afterEach)', () => {
    window.localStorage.setItem('leak-check', 'x');
  });

  it('did not leak data from the previous test', () => {
    expect(window.localStorage.getItem('leak-check')).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });
});

describe('application storage helpers on top of Web Storage', () => {
  it('round-trips JSON values', () => {
    expect(writeJSON('k', { a: [1, 2] })).toBe(true);
    expect(window.localStorage.getItem('k')).toBe('{"a":[1,2]}');
    expect(readJSON('k', null)).toEqual({ a: [1, 2] });
    removeKey('k');
    expect(window.localStorage.getItem('k')).toBeNull();
  });

  it('falls back safely on missing, corrupted or invalid data', () => {
    expect(readJSON('absent', 'fallback')).toBe('fallback');
    window.localStorage.setItem('broken', '{not json');
    expect(readJSON('broken', 'fallback')).toBe('fallback');
    window.localStorage.setItem('wrong-shape', '42');
    expect(readJSON('wrong-shape', [], Array.isArray)).toEqual([]);
    expect(normalizeLibrary([{ text: 'S -> a', name: 'ok' }, { nope: true }, null])).toHaveLength(1);
  });
});
