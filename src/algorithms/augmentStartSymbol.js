/**
 * Stage 1 — Start symbol augmentation.
 *
 * CNF allows S₀ → ε only when the start symbol never appears on a right-hand
 * side. If the current start symbol S occurs on some RHS, we add a fresh start
 * symbol S₀ with the single rule S₀ → S. Otherwise nothing is changed: adding
 * a new start symbol would be unnecessary.
 */
import { allSymbols, createGrammar } from './grammar.js';
import { createNameFactory, isPlainIdentifier } from './symbols.js';
import { buildStage } from './stageResult.js';
import { fmtProd } from './format.js';

export const AUGMENT_THEORY =
  'In CNF the start symbol may derive ε only if it never appears on the right-hand side of any rule. ' +
  'If the start symbol S is used inside some right-hand side, we introduce a new start symbol S₀ with the rule S₀ → S. ' +
  'This does not change the language, because S₀ can only begin a derivation by producing S.';

export function augmentStartSymbol(grammar) {
  const base = { id: 'start', title: 'Start Symbol Augmentation', theory: AUGMENT_THEORY, before: grammar };
  const { start } = grammar;
  const offending = grammar.productions.filter((p) => p.rhs.includes(start));

  if (offending.length === 0) {
    return buildStage({
      ...base,
      after: grammar,
      summary: `Not needed — ${start} never appears on a right-hand side.`,
      steps: [
        `Checked every right-hand side for the start symbol ${start}.`,
        `${start} does not occur on any right-hand side, so it can safely keep the role of start symbol.`,
        'No new start symbol is introduced.',
      ],
      details: { needed: false, occurrences: [] },
    });
  }

  const names = createNameFactory(allSymbols(grammar));
  const newStart = names.fresh(isPlainIdentifier(start) ? `${start}₀` : 'S₀');
  const newRule = { lhs: newStart, rhs: [start] };
  const after = createGrammar({
    start: newStart,
    nonTerminals: [newStart, ...grammar.nonTerminals],
    terminals: grammar.terminals,
    productions: [newRule, ...grammar.productions],
  });

  return buildStage({
    ...base,
    after,
    summary: `Introduced new start symbol ${newStart} with ${newStart} → ${start}.`,
    steps: [
      `${start} appears on the right-hand side of ${offending.length} rule${offending.length === 1 ? '' : 's'}: ${offending
        .map(fmtProd)
        .join(', ')}.`,
      `Created a fresh variable ${newStart} (its name does not clash with any existing symbol).`,
      `Added ${newStart} → ${start} and made ${newStart} the start symbol.`,
      `${newStart} never appears on a right-hand side, so it may later receive ${newStart} → ε if needed.`,
    ],
    added: [
      {
        production: newRule,
        reason: `New start symbol: ${start} occurs on a right-hand side, so ${newStart} → ${start} starts every derivation.`,
      },
    ],
    introduced: [{ name: newStart, reason: `New start symbol replacing ${start}.` }],
    details: { needed: true, previousStart: start, newStart, occurrences: offending },
  });
}
