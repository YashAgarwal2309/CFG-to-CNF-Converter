/**
 * Grammar analysis: fixed-point computations shared by the conversion stages,
 * the validator and the statistics panel.
 */
import { nonTerminalSet } from './grammar.js';

/**
 * Nullable variables (A ⇒* ε), computed with a fixed-point iteration.
 * Returns { nullable: Set, rounds: [[A, B], [C], …] }.
 */
export function computeNullable(grammar) {
  const nts = nonTerminalSet(grammar);
  const nullable = new Set();
  const rounds = [];
  let changed = true;
  while (changed) {
    changed = false;
    const round = [];
    for (const p of grammar.productions) {
      if (nullable.has(p.lhs)) continue;
      if (p.rhs.every((s) => nts.has(s) && nullable.has(s))) {
        nullable.add(p.lhs);
        round.push({ symbol: p.lhs, production: p });
        changed = true;
      }
    }
    if (round.length) rounds.push(round);
  }
  return { nullable, rounds };
}

/**
 * Generating variables (A ⇒* w for some terminal string w), fixed point.
 * Returns { generating: Set, rounds }.
 */
export function computeGenerating(grammar) {
  const nts = nonTerminalSet(grammar);
  const generating = new Set();
  const rounds = [];
  let changed = true;
  while (changed) {
    changed = false;
    const round = [];
    for (const p of grammar.productions) {
      if (generating.has(p.lhs)) continue;
      if (p.rhs.every((s) => !nts.has(s) || generating.has(s))) {
        generating.add(p.lhs);
        round.push({ symbol: p.lhs, production: p });
        changed = true;
      }
    }
    if (round.length) rounds.push(round);
  }
  return { generating, rounds };
}

/**
 * Variables reachable from the start symbol (breadth-first search).
 * Returns { reachable: Set, order: [...], parent: Map(symbol -> production) }.
 */
export function computeReachable(grammar) {
  const nts = nonTerminalSet(grammar);
  const reachable = new Set([grammar.start]);
  const order = [grammar.start];
  const parent = new Map();
  const queue = [grammar.start];
  while (queue.length) {
    const current = queue.shift();
    for (const p of grammar.productions) {
      if (p.lhs !== current) continue;
      for (const s of p.rhs) {
        if (nts.has(s) && !reachable.has(s)) {
          reachable.add(s);
          order.push(s);
          parent.set(s, p);
          queue.push(s);
        }
      }
    }
  }
  return { reachable, order, parent };
}

export function isUnitProduction(production, nts) {
  return production.rhs.length === 1 && nts.has(production.rhs[0]);
}

/**
 * Unit closure of every variable: all B with A ⇒* B using unit rules only.
 * Uses BFS, so cycles such as A → B → C → A terminate.
 * Returns Map(A -> [{ symbol: B, path: [A, …, B] }]) with A itself first.
 */
export function computeUnitClosures(grammar) {
  const nts = nonTerminalSet(grammar);
  const edges = new Map(grammar.nonTerminals.map((n) => [n, []]));
  for (const p of grammar.productions) {
    if (isUnitProduction(p, nts)) {
      if (!edges.has(p.lhs)) edges.set(p.lhs, []);
      if (!edges.get(p.lhs).includes(p.rhs[0])) edges.get(p.lhs).push(p.rhs[0]);
    }
  }
  const closures = new Map();
  for (const a of grammar.nonTerminals) {
    const visited = new Map([[a, [a]]]);
    const queue = [a];
    while (queue.length) {
      const current = queue.shift();
      for (const next of edges.get(current) ?? []) {
        if (!visited.has(next)) {
          visited.set(next, [...visited.get(current), next]);
          queue.push(next);
        }
      }
    }
    closures.set(
      a,
      [...visited].map(([symbol, path]) => ({ symbol, path })),
    );
  }
  return closures;
}

/** Detect unit-production cycles (strongly connected parts of the unit graph). */
export function findUnitCycles(grammar) {
  const closures = computeUnitClosures(grammar);
  const cycles = [];
  const seen = new Set();
  for (const [a, list] of closures) {
    for (const { symbol: b } of list) {
      if (a === b) continue;
      const back = closures.get(b)?.some((x) => x.symbol === a);
      if (back) {
        const key = [a, b].sort().join('|');
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push([a, b]);
        }
      }
    }
  }
  return cycles;
}

/** Statistics displayed by the editor and dashboard. */
export function grammarStatistics(grammar) {
  const nts = nonTerminalSet(grammar);
  const { nullable } = computeNullable(grammar);
  const { generating } = computeGenerating(grammar);
  // Reachability is computed over productions that use only generating symbols,
  // matching the standard useless-symbol definition.
  const usefulProductions = grammar.productions.filter(
    (p) => generating.has(p.lhs) && p.rhs.every((s) => !nts.has(s) || generating.has(s)),
  );
  const { reachable } = computeReachable({ ...grammar, productions: usefulProductions });
  const useless = grammar.nonTerminals.filter((n) => !generating.has(n) || !reachable.has(n));
  const unit = grammar.productions.filter((p) => isUnitProduction(p, nts));
  const epsilon = grammar.productions.filter((p) => p.rhs.length === 0);
  const longest = grammar.productions.reduce((m, p) => Math.max(m, p.rhs.length), 0);
  return {
    nonTerminals: grammar.nonTerminals.length,
    terminals: grammar.terminals.length,
    productions: grammar.productions.length,
    nullable: [...nullable],
    unitProductions: unit,
    epsilonProductions: epsilon,
    useless,
    nonGenerating: grammar.nonTerminals.filter((n) => !generating.has(n)),
    unreachable: grammar.nonTerminals.filter((n) => !computeReachable(grammar).reachable.has(n)),
    longestRhs: longest,
    generatesEpsilon: nullable.has(grammar.start),
    emptyLanguage: !generating.has(grammar.start),
    startOnRhs: grammar.productions.some((p) => p.rhs.includes(grammar.start)),
  };
}
