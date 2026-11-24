/**
 * Core grammar data model.
 *
 * A grammar is a plain, deeply-frozen object:
 *
 *   {
 *     start: 'S',
 *     nonTerminals: ['S', 'A', 'B'],   // ordered, unique
 *     terminals: ['a', 'b'],           // ordered, unique
 *     productions: [                   // ordered, unique
 *       { lhs: 'S', rhs: ['A', 'B'] },
 *       { lhs: 'A', rhs: [] },         // empty rhs  ==  A → ε
 *     ],
 *   }
 *
 * Every algorithm treats grammars as immutable values and returns new ones,
 * which lets the UI keep a reliable snapshot of every conversion stage.
 */

export const EPSILON = 'ε';

/** Recursively freeze an object graph (arrays + plain objects). */
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

/** Stable key used for de-duplication and set membership of productions. */
export function productionKey(production) {
  return `${production.lhs}\u0000${production.rhs.join('\u0001')}`;
}

export function rhsKey(rhs) {
  return rhs.join('\u0001');
}

export function isEpsilonProduction(production) {
  return production.rhs.length === 0;
}

export function uniqueInOrder(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

export function dedupeProductions(productions) {
  const seen = new Set();
  const out = [];
  for (const p of productions) {
    const key = productionKey(p);
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ lhs: p.lhs, rhs: [...p.rhs] });
    }
  }
  return out;
}

/**
 * Sort productions so that they are grouped by left-hand side, following the
 * order of `nonTerminals`, while keeping the relative order of alternatives.
 */
export function orderProductions(productions, nonTerminals) {
  const rank = new Map(nonTerminals.map((nt, i) => [nt, i]));
  return productions
    .map((p, i) => ({ p, i }))
    .sort((x, y) => {
      const rx = rank.has(x.p.lhs) ? rank.get(x.p.lhs) : Number.MAX_SAFE_INTEGER;
      const ry = rank.has(y.p.lhs) ? rank.get(y.p.lhs) : Number.MAX_SAFE_INTEGER;
      return rx - ry || x.i - y.i;
    })
    .map(({ p }) => p);
}

/**
 * Build a normalised, frozen grammar.
 *
 * - productions are de-duplicated and grouped by LHS
 * - non-terminals keep the given order (start first), plus any symbol that
 *   appears as an LHS but was not listed
 * - terminals default to the ones actually used, unless `keepTerminals` given
 */
export function createGrammar({ start, nonTerminals = [], terminals, productions = [] }) {
  const prods = dedupeProductions(productions);
  const nts = uniqueInOrder([start, ...nonTerminals, ...prods.map((p) => p.lhs)]);
  const ntSet = new Set(nts);
  const usedTerminals = [];
  for (const p of prods) {
    for (const s of p.rhs) if (!ntSet.has(s)) usedTerminals.push(s);
  }
  const terms = uniqueInOrder(terminals ? [...terminals, ...usedTerminals] : usedTerminals).filter(
    (t) => !ntSet.has(t),
  );
  return deepFreeze({
    start,
    nonTerminals: nts,
    terminals: terms,
    productions: orderProductions(prods, nts),
  });
}

/** Convenience: return a new grammar with some fields replaced. */
export function withChanges(grammar, changes) {
  return createGrammar({
    start: changes.start ?? grammar.start,
    nonTerminals: changes.nonTerminals ?? grammar.nonTerminals,
    terminals: changes.terminals ?? grammar.terminals,
    productions: changes.productions ?? grammar.productions,
  });
}

export function isNonTerminal(grammar, symbol) {
  return grammar.nonTerminals.includes(symbol);
}

export function nonTerminalSet(grammar) {
  return new Set(grammar.nonTerminals);
}

/** Map LHS → list of productions, keeping production order. */
export function productionsByLhs(grammar) {
  const map = new Map(grammar.nonTerminals.map((nt) => [nt, []]));
  for (const p of grammar.productions) {
    if (!map.has(p.lhs)) map.set(p.lhs, []);
    map.get(p.lhs).push(p);
  }
  return map;
}

/** Every symbol name in use (used to avoid collisions for fresh variables). */
export function allSymbols(grammar) {
  const set = new Set([...grammar.nonTerminals, ...grammar.terminals]);
  for (const p of grammar.productions) {
    set.add(p.lhs);
    p.rhs.forEach((s) => set.add(s));
  }
  return set;
}

/** Does any production contain `symbol` on its right-hand side? */
export function appearsOnRhs(grammar, symbol) {
  return grammar.productions.some((p) => p.rhs.includes(symbol));
}

/** Compare two grammars structurally (start, productions as sets). */
export function grammarsEqual(a, b) {
  if (a.start !== b.start) return false;
  if (a.productions.length !== b.productions.length) return false;
  const keys = new Set(a.productions.map(productionKey));
  return b.productions.every((p) => keys.has(productionKey(p)));
}

/**
 * Classify productions of `after` relative to `before`.
 * Returns maps keyed by productionKey.
 */
export function diffGrammars(before, after) {
  const beforeKeys = new Set(before.productions.map(productionKey));
  const afterKeys = new Set(after.productions.map(productionKey));
  return {
    added: after.productions.filter((p) => !beforeKeys.has(productionKey(p))),
    removed: before.productions.filter((p) => !afterKeys.has(productionKey(p))),
    unchanged: after.productions.filter((p) => beforeKeys.has(productionKey(p))),
  };
}
