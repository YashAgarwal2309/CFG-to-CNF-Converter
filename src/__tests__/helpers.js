import { parseGrammarOrThrow } from '../algorithms/grammarParser.js';
import { productionKey } from '../algorithms/grammar.js';
import { fmtProd } from '../algorithms/format.js';

export const g = (text, options) => parseGrammarOrThrow(text, options);

/** Set of "A → xyz" strings for easy assertions. */
export const rules = (grammar) => new Set(grammar.productions.map(fmtProd));

export const hasRule = (grammar, lhs, rhs) =>
  grammar.productions.some((p) => productionKey(p) === productionKey({ lhs, rhs }));

/** Deterministic pseudo-random generator (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random small grammar text over variables S,A,B,C and terminals a,b. */
export function randomGrammarText(random) {
  const vars = ['S', 'A', 'B', 'C'];
  const terms = ['a', 'b'];
  const pick = (list) => list[Math.floor(random() * list.length)];
  const lines = [];
  for (const v of vars) {
    const count = 1 + Math.floor(random() * 3);
    const alts = [];
    for (let i = 0; i < count; i += 1) {
      const len = Math.floor(random() * 4); // 0..3
      if (len === 0) {
        alts.push('ε');
        continue;
      }
      let rhs = '';
      for (let j = 0; j < len; j += 1) rhs += random() < 0.55 ? pick(vars) : pick(terms);
      alts.push(rhs);
    }
    lines.push(`${v} -> ${alts.join(' | ')}`);
  }
  return lines.join('\n');
}
