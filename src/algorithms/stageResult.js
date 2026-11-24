/**
 * Shared helpers for building the result object every conversion stage returns.
 *
 * Every stage returns:
 *   id, title, theory           – identification and short theory text
 *   before, after               – immutable grammar snapshots
 *   applied                     – false when the stage had nothing to do
 *   summary                     – one-line description of what happened
 *   steps                       – ordered explanation log (strings)
 *   added    [{production, reason}]
 *   removed  [{production, reason}]
 *   modified [{from, to, reason}]       (a production rewritten into another)
 *   introduced        [{name, reason}]  (new variables)
 *   removedVariables  [{name, reason}]
 *   details           stage-specific data (nullable set, unit pairs, …)
 *   warnings          [string]
 */
import { deepFreeze, diffGrammars, productionKey } from './grammar.js';

export class ConversionError extends Error {
  constructor(message, stage) {
    super(message);
    this.name = 'ConversionError';
    this.stage = stage;
  }
}

/** Safety limit so that pathological inputs cannot freeze the browser. */
export const MAX_PRODUCTIONS = 20000;

export function assertSize(productions, stageTitle) {
  if (productions.length > MAX_PRODUCTIONS) {
    throw new ConversionError(
      `${stageTitle} would create more than ${MAX_PRODUCTIONS.toLocaleString()} productions. ` +
        'The grammar is too large for interactive conversion; try splitting long rules or reducing nullable variables.',
      stageTitle,
    );
  }
}

export function buildStage({
  id,
  title,
  theory,
  before,
  after,
  summary,
  steps = [],
  added = [],
  removed = [],
  modified = [],
  introduced = [],
  removedVariables = [],
  details = {},
  warnings = [],
}) {
  // Reconcile the recorded changes with an actual diff, so that nothing is
  // ever added or removed silently.
  const diff = diffGrammars(before, after);
  const explainedAdded = new Set([
    ...added.map((c) => productionKey(c.production)),
    ...modified.map((c) => productionKey(c.to)),
  ]);
  const explainedRemoved = new Set([
    ...removed.map((c) => productionKey(c.production)),
    ...modified.map((c) => productionKey(c.from)),
  ]);
  const finalAdded = added.filter((c) => diff.added.some((p) => productionKey(p) === productionKey(c.production)));
  const finalRemoved = removed.filter((c) =>
    diff.removed.some((p) => productionKey(p) === productionKey(c.production)),
  );
  for (const p of diff.added) {
    if (!explainedAdded.has(productionKey(p))) finalAdded.push({ production: p, reason: 'Added by this stage.' });
  }
  for (const p of diff.removed) {
    if (!explainedRemoved.has(productionKey(p))) {
      finalRemoved.push({ production: p, reason: 'Removed by this stage.' });
    }
  }

  const applied =
    finalAdded.length + finalRemoved.length + modified.length + introduced.length + removedVariables.length > 0 ||
    before.start !== after.start;

  return deepFreeze({
    id,
    title,
    theory,
    before,
    after,
    applied,
    summary,
    steps,
    added: finalAdded,
    removed: finalRemoved,
    modified,
    introduced,
    removedVariables,
    details,
    warnings,
  });
}

/** Status of each production in `after` and `before` for highlighting. */
export function productionStatuses(stage) {
  const modifiedTo = new Set(stage.modified.map((m) => productionKey(m.to)));
  const modifiedFrom = new Set(stage.modified.map((m) => productionKey(m.from)));
  const added = new Set(stage.added.map((a) => productionKey(a.production)));
  const removed = new Set(stage.removed.map((r) => productionKey(r.production)));
  const after = new Map();
  for (const p of stage.after.productions) {
    const k = productionKey(p);
    after.set(k, modifiedTo.has(k) ? 'modified' : added.has(k) ? 'added' : 'unchanged');
  }
  const before = new Map();
  for (const p of stage.before.productions) {
    const k = productionKey(p);
    before.set(k, modifiedFrom.has(k) ? 'modified' : removed.has(k) ? 'removed' : 'unchanged');
  }
  return { before, after };
}

/** Reason lookup by production key (for tooltips). */
export function reasonIndex(stage) {
  const map = new Map();
  stage.added.forEach((c) => map.set(productionKey(c.production), c.reason));
  stage.modified.forEach((c) => map.set(productionKey(c.to), c.reason));
  return map;
}

export function removalReasonIndex(stage) {
  const map = new Map();
  stage.removed.forEach((c) => map.set(productionKey(c.production), c.reason));
  stage.modified.forEach((c) => map.set(productionKey(c.from), c.reason));
  return map;
}
