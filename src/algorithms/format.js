/** Plain-text formatting helpers used inside explanations. */
import { EPSILON } from './grammar.js';

export function fmtRhs(rhs) {
  if (rhs.length === 0) return EPSILON;
  const spaced = rhs.some((s) => [...s].length > 1);
  return rhs.join(spaced ? ' ' : '');
}

export function fmtProd(p) {
  return `${p.lhs} → ${fmtRhs(p.rhs)}`;
}

export function fmtSet(items) {
  const list = [...items];
  return list.length ? `{ ${list.join(', ')} }` : '∅';
}

export function plural(n, word, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}
