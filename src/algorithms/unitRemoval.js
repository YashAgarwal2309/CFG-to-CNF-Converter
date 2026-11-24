/**
 * Stage 3 — Unit production removal.
 *
 * A unit production has the form A → B with B a single variable.
 * 1. Compute, for every A, its unit closure U(A) = { B | A ⇒* B by unit rules }
 *    using breadth-first search (cycles such as A → B → C → A terminate).
 * 2. For every B ∈ U(A) and every non-unit production B → α, add A → α.
 * 3. Delete every unit production.
 */
import { createGrammar, nonTerminalSet, productionKey } from './grammar.js';
import { computeUnitClosures, findUnitCycles, isUnitProduction } from './grammarAnalysis.js';
import { assertSize, buildStage } from './stageResult.js';
import { fmtProd, plural } from './format.js';

export const UNIT_THEORY =
  'A unit production A → B only renames one variable into another and is not allowed in CNF. For each variable A we ' +
  'compute its unit closure: every B reachable from A using unit productions alone (a graph search, so cycles are safe). ' +
  'A then receives copies of all non-unit productions of every B in its closure, after which all unit productions are ' +
  'deleted. Any derivation A ⇒ B ⇒ … ⇒ C ⇒ α can now be done in one step A ⇒ α.';

export function removeUnitProductions(grammar) {
  const nts = nonTerminalSet(grammar);
  const units = grammar.productions.filter((p) => isUnitProduction(p, nts));
  const base = { id: 'unit', title: 'Unit Production Removal', theory: UNIT_THEORY, before: grammar };

  if (units.length === 0) {
    return buildStage({
      ...base,
      after: grammar,
      summary: 'Not needed — the grammar has no unit productions.',
      steps: ['Searched for productions of the form A → B (a single variable on the right). None were found.'],
      details: { unitPairs: [], cycles: [] },
    });
  }

  const closures = computeUnitClosures(grammar);
  const cycles = findUnitCycles(grammar);
  const nonUnitByLhs = new Map(grammar.nonTerminals.map((n) => [n, []]));
  for (const p of grammar.productions) {
    if (!isUnitProduction(p, nts)) nonUnitByLhs.get(p.lhs)?.push(p);
  }

  const productions = [];
  const keys = new Set();
  const added = [];
  const unitPairs = [];
  const beforeKeys = new Set(grammar.productions.map(productionKey));

  for (const a of grammar.nonTerminals) {
    for (const { symbol: b, path } of closures.get(a)) {
      if (b !== a) unitPairs.push({ from: a, to: b, path });
      for (const p of nonUnitByLhs.get(b) ?? []) {
        const prod = { lhs: a, rhs: p.rhs };
        const key = productionKey(prod);
        if (keys.has(key)) continue;
        keys.add(key);
        productions.push(prod);
        if (!beforeKeys.has(key)) {
          added.push({
            production: prod,
            reason: `${path.join(' ⇒ ')} by unit rules, so ${a} inherits ${fmtProd(p)}.`,
            via: path,
          });
        }
      }
    }
    assertSize(productions, 'Unit removal');
  }

  const removed = units.map((p) => ({
    production: p,
    reason:
      p.lhs === p.rhs[0]
        ? `Trivial unit production ${fmtProd(p)} derives nothing new and is deleted.`
        : `Unit production deleted; ${p.lhs} now has direct copies of ${p.rhs[0]}'s non-unit productions.`,
  }));

  const after = createGrammar({
    start: grammar.start,
    nonTerminals: grammar.nonTerminals,
    terminals: grammar.terminals,
    productions,
  });

  const steps = [
    `Found ${plural(units.length, 'unit production')}: ${units.map(fmtProd).join(', ')}.`,
    ...grammar.nonTerminals
      .filter((a) => closures.get(a).length > 1)
      .map(
        (a) =>
          `Unit closure of ${a}: { ${closures
            .get(a)
            .map((x) => x.symbol)
            .join(', ')} } — ${a} inherits the non-unit productions of ${closures
            .get(a)
            .filter((x) => x.symbol !== a)
            .map((x) => x.symbol)
            .join(', ')}.`,
      ),
  ];
  if (cycles.length) {
    steps.push(
      `Unit cycles detected (${cycles.map(([x, y]) => `${x} ⇔ ${y}`).join(', ')}); breadth-first search visits each variable once, so the cycle is handled safely.`,
    );
  }
  steps.push(`Added ${plural(added.length, 'inherited production')} and deleted all unit productions.`);

  return buildStage({
    ...base,
    after,
    summary: `Removed ${plural(units.length, 'unit production')}, added ${plural(added.length, 'inherited production')}.`,
    steps,
    added,
    removed,
    details: {
      unitPairs,
      cycles,
      closures: Object.fromEntries([...closures].map(([k, v]) => [k, v.map((x) => x.symbol)])),
    },
  });
}
