import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/*
 * Use jsdom's spec-compliant Web Storage in every test.
 *
 * Node.js 25 enables its own Web Storage API by default (Node 22/23 behind
 * --experimental-webstorage), so `globalThis.localStorage` already exists in
 * the test process. Without a valid --localstorage-file that object is not a
 * working Storage (Node 25 warns and exposes no getItem/setItem/clear; Node 22
 * throws on access). Vitest's jsdom environment only copies a browser global
 * from jsdom when Node does not already define it (unless the name is on its
 * built-in list, which includes "Storage" but not "localStorage"), so the
 * tests would see Node's object instead of jsdom's. Vitest exposes the JSDOM
 * instance as `globalThis.jsdom`; install its real Storage objects here.
 */
for (const name of ['localStorage', 'sessionStorage']) {
  const storage = globalThis.jsdom?.window?.[name];
  if (storage) {
    Object.defineProperty(globalThis, name, { value: storage, configurable: true, enumerable: true, writable: true });
  }
}
if (!(globalThis.localStorage instanceof globalThis.Storage) || typeof globalThis.localStorage.clear !== 'function') {
  throw new Error('Test setup: window.localStorage is not a working DOM Storage (is the jsdom environment active?).');
}

// jsdom does not implement these browser APIs.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });
}
window.scrollTo = () => {};
Element.prototype.scrollIntoView = function scrollIntoView() {};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.location.hash = '';
});
