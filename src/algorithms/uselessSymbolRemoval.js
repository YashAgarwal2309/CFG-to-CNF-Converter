/**
 * Stage 4 — Useless symbol removal.
 *
 * The order matters:
 *   (a) remove NON-GENERATING variables (cannot derive any terminal string),
 *   (b) then remove UNREACHABLE variables (cannot be reached from the start).
 * Doing (b) before (a) can leave useless symbols behind, e.g. S → AB | a, A → a
 * with B non-generating: A is reachable until S → AB is deleted in (a).
 */
import { createGrammar, nonTerminalSet } from './grammar.js';
import { computeGenerating, computeReachable } from './grammarAnalysis.js';
import { buildStage } from './stageResult.js';
import { fmtProd, fmtSet, plural } from './format.js';

export const USELESS_THEORY =
  'A symbol is useful only if it is generating (it can derive some string of terminals) and reachable (it appears in ' +
  'some derivation from the start symbol). First we compute the generating variables with a fixed-point iteration and ' +
  'delete every rule that mentions a non-generating variable. Then we search from the start symbol and delete rules of ' +
  'unreachable variables. This order is essential: removing non-generating symbols can make other symbols unreachable.';

export function removeUselessSymbols(grammar) {
  const nts = nonTerminalSet(grammar);
  const base = { id: 'useless', title: 'Useless Symbol Removal', theory: USELESS_THEORY, before: grammar };
  const steps = [];
  const removed = [];
  const removedVariables = [];
  const warnings = [];

  // (a) generating
  const { generating, rounds } = computeGenerating(grammar);
  rounds.forEach((round, i) => {
    steps.push(
      `Generating round ${i + 1}: ${round
        .map(({ symbol, production }) => `${symbol} (via ${fmtProd(production)})`)
        .join(', ')}.`,
    );
  });
  const nonGenerating = grammar.nonTerminals.filter((n) => !generating.has(n));
  steps.push(
    nonGenerating.length
      ? `Non-generating variables: ${fmtSet(nonGenerating)} — they can never produce a terminal string.`
      : 'Every variable is generating.',
  );

  const afterGenerating = [];
  for (const p of grammar.productions) {
    const culprit = [p.lhs, ...p.rhs].find((s) => nts.has(s) && !generating.has(s));
    if (culprit) {
      removed.push({
        production: p,
        reason:
          culprit === p.lhs
            ? `${p.lhs} is non-generating, so its productions are useless.`
            : `Uses non-generating variable ${culprit}, so this production can never finish a derivation.`,
      });
    } else {
      afterGenerating.push(p);
    }
  }
  nonGenerating.forEach((n) =>
    removedVariables.push({ name: n, reason: `${n} is non-generating (derives no terminal string).` }),
  );

  // (b) reachable (computed on the grammar left after step (a))
  const intermediate = { ...grammar, productions: afterGenerating };
  const { reachable, order } = computeReachable(intermediate);
  steps.push(`Reachable from ${grammar.start} (breadth-first search): ${fmtSet(order)}.`);
  const unreachable = grammar.nonTerminals.filter((n) => generating.has(n) && !reachable.has(n));
  steps.push(
    unreachable.length
      ? `Unreachable variables: ${fmtSet(unreachable)} — no derivation from ${grammar.start} ever uses them.`
      : 'Every remaining variable is reachable.',
  );

  const productions = [];
  for (const p of afterGenerating) {
    if (!reachable.has(p.lhs)) {
      removed.push({ production: p, reason: `${p.lhs} is unreachable from ${grammar.start}.` });
    } else {
      productions.push(p);
    }
  }
  unreachable.forEach((n) =>
    removedVariables.push({ name: n, reason: `${n} is unreachable from the start symbol ${grammar.start}.` }),
  );

  // The start symbol is always kept as a symbol (even if the language is empty).
  const keptNts = grammar.nonTerminals.filter((n) => n === grammar.start || (generating.has(n) && reachable.has(n)));
  const after = createGrammar({
    start: grammar.start,
    nonTerminals: keptNts,
    productions,
  });

  const removedTerminals = grammar.terminals.filter((t) => !after.terminals.includes(t));
  if (removedTerminals.length) {
    steps.push(`Terminals no longer used by any production: ${fmtSet(removedTerminals)}.`);
  }

  if (!generating.has(grammar.start)) {
    warnings.push(
      `The start symbol ${grammar.start} is non-generating: the grammar generates the empty language ∅. ` +
        'The resulting CNF grammar has no productions.',
    );
  }

  const changed = removed.length > 0 || removedVariables.length > 0;
  return buildStage({
    ...base,
    after,
    summary: changed
      ? `Removed ${plural(removedVariables.filter((v) => v.name !== grammar.start).length, 'useless variable')} and ${plural(
          removed.length,
          'production',
        )}.`
      : 'Not needed — every symbol is generating and reachable.',
    steps,
    removed,
    removedVariables: removedVariables.filter((v) => v.name !== grammar.start || !generating.has(v.name)),
    details: {
      generating: [...generating],
      nonGenerating,
      reachable: [...reachable],
      unreachable,
      removedTerminals,
    },
    warnings,
  });
}
