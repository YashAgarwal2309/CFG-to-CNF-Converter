/**
 * Stage 2 — ε-production removal.
 *
 * 1. Compute the nullable variables N = { A | A ⇒* ε } by fixed-point iteration.
 * 2. For every production A → X₁…Xₙ, add every variant obtained by omitting
 *    any subset of the nullable occurrences (except the variant that would be
 *    empty).
 * 3. Delete all ε-productions.
 * 4. If the start symbol is nullable (ε ∈ L(G)), add back S → ε for the start
 *    symbol only.
 */
import { createGrammar, EPSILON, nonTerminalSet, productionKey } from './grammar.js';
import { computeNullable } from './grammarAnalysis.js';
import { assertSize, buildStage, ConversionError } from './stageResult.js';
import { fmtProd, fmtSet, plural } from './format.js';

export const EPSILON_THEORY =
  'A variable is nullable if it can derive the empty string ε. We find all nullable variables with a fixed-point ' +
  'computation: first every A with A → ε, then every A with a rule whose right-hand side consists only of nullable ' +
  'variables, repeating until nothing changes. Every rule containing nullable variables is then copied once for each ' +
  'way of leaving those variables out, and all ε-rules are deleted. Only the start symbol may keep S → ε, and only if ' +
  'the original language contains ε.';

const MAX_NULLABLE_OCCURRENCES = 16;

/** All non-empty variants of `rhs` obtained by omitting nullable occurrences. */
export function expandNullable(rhs, nullable, nts) {
  const positions = rhs.map((s, i) => (nts.has(s) && nullable.has(s) ? i : -1)).filter((i) => i >= 0);
  if (positions.length > MAX_NULLABLE_OCCURRENCES) {
    throw new ConversionError(
      `A right-hand side has ${positions.length} nullable occurrences (limit ${MAX_NULLABLE_OCCURRENCES}); ` +
        'expanding it would create too many productions.',
      'ε-removal',
    );
  }
  const variants = [];
  const total = 1 << positions.length;
  // mask bit = 1 means "omit this nullable occurrence"; mask 0 keeps the original.
  for (let mask = 0; mask < total; mask += 1) {
    const omitted = new Set(positions.filter((_, bit) => mask & (1 << bit)));
    const result = rhs.filter((_, i) => !omitted.has(i));
    variants.push({ rhs: result, omitted: [...omitted].map((i) => rhs[i]) });
  }
  return variants;
}

export function removeEpsilonProductions(grammar) {
  const nts = nonTerminalSet(grammar);
  const { nullable, rounds } = computeNullable(grammar);
  const startNullable = nullable.has(grammar.start);
  const startOnRhs = grammar.productions.some((p) => p.rhs.includes(grammar.start));
  const base = {
    id: 'epsilon',
    title: 'ε-Production Removal',
    theory: EPSILON_THEORY,
    before: grammar,
  };

  const steps = [];
  if (rounds.length === 0) {
    steps.push('No variable can derive ε, so the set of nullable variables is empty.');
  } else {
    rounds.forEach((round, i) => {
      steps.push(
        `Round ${i + 1}: ${round
          .map(({ symbol, production }) =>
            production.rhs.length === 0
              ? `${symbol} is nullable because ${symbol} → ${EPSILON}`
              : `${symbol} is nullable because ${fmtProd(production)} and every symbol on the right is nullable`,
          )
          .join('; ')}.`,
      );
    });
    steps.push(`Fixed point reached: nullable variables = ${fmtSet(nullable)}.`);
  }

  const epsilonProductions = grammar.productions.filter((p) => p.rhs.length === 0);
  if (nullable.size === 0 && epsilonProductions.length === 0) {
    return buildStage({
      ...base,
      after: grammar,
      summary: 'Not needed — the grammar has no ε-productions and no nullable variables.',
      steps,
      details: { nullable: [], rounds: [], generatesEpsilon: false },
    });
  }

  if (startNullable && startOnRhs) {
    // Stage 1 guarantees this cannot happen inside the pipeline.
    throw new ConversionError(
      'The start symbol is nullable and appears on a right-hand side. Run start symbol augmentation first.',
      'ε-removal',
    );
  }

  const productions = [];
  const keys = new Set();
  const added = [];
  const removed = [];
  for (const p of grammar.productions) {
    if (p.rhs.length === 0) {
      removed.push({
        production: p,
        reason:
          p.lhs === grammar.start
            ? `ε-production removed; it is re-added for the start symbol at the end because ε ∈ L(G).`
            : `ε-production removed; the empty choice for ${p.lhs} is now covered by omitting ${p.lhs} wherever it appears.`,
      });
      continue;
    }
    for (const variant of expandNullable(p.rhs, nullable, nts)) {
      if (variant.rhs.length === 0) continue; // would be a new ε-rule
      const prod = { lhs: p.lhs, rhs: variant.rhs };
      const key = productionKey(prod);
      if (keys.has(key)) continue;
      keys.add(key);
      productions.push(prod);
      if (variant.omitted.length > 0) {
        added.push({
          production: prod,
          reason: `From ${fmtProd(p)} by omitting nullable ${variant.omitted.join(', ')}.`,
          source: p,
          omitted: variant.omitted,
        });
      }
    }
    assertSize(productions, 'ε-removal');
  }

  if (startNullable) {
    const startEps = { lhs: grammar.start, rhs: [] };
    productions.push(startEps);
    added.push({
      production: startEps,
      reason: `${grammar.start} is nullable, so ε ∈ L(G). The start symbol (which never appears on a right-hand side) keeps ${grammar.start} → ${EPSILON}.`,
    });
  }

  const after = createGrammar({
    start: grammar.start,
    nonTerminals: grammar.nonTerminals,
    terminals: grammar.terminals,
    productions,
  });

  // Only report as "added" what is genuinely new compared to the input grammar.
  const beforeKeys = new Set(grammar.productions.map(productionKey));
  const trulyAdded = added.filter((a) => !beforeKeys.has(productionKey(a.production)));
  const trulyRemoved = removed.filter(
    (r) => !after.productions.some((p) => productionKey(p) === productionKey(r.production)),
  );

  const generated = trulyAdded.filter((a) => a.production.rhs.length > 0).length;
  steps.push(
    `Expanded every rule containing nullable variables, creating ${plural(generated, 'new production')} (duplicates skipped).`,
  );
  steps.push(`Removed ${plural(epsilonProductions.length, 'ε-production')}.`);
  steps.push(
    startNullable
      ? `${grammar.start} is nullable, so the language contains ε: kept ${grammar.start} → ${EPSILON} for the start symbol only.`
      : `${grammar.start} is not nullable, so ε ∉ L(G) and no ε-production is kept.`,
  );

  const warnings = [];
  const lostAll = grammar.nonTerminals.filter(
    (n) =>
      n !== grammar.start &&
      grammar.productions.some((p) => p.lhs === n) &&
      !after.productions.some((p) => p.lhs === n),
  );
  if (lostAll.length) {
    warnings.push(
      `${lostAll.join(', ')} only derived ε, so ${lostAll.length === 1 ? 'it has' : 'they have'} no productions left; ` +
        'the remaining occurrences will be removed as non-generating in the useless-symbol stage.',
    );
  }

  return buildStage({
    ...base,
    after,
    summary: `Nullable: ${fmtSet(nullable)}. Removed ${plural(epsilonProductions.length, 'ε-rule')}, added ${plural(
      generated,
      'compensating rule',
    )}.`,
    steps,
    added: trulyAdded,
    removed: trulyRemoved,
    details: {
      nullable: [...nullable],
      rounds: rounds.map((r) => r.map((x) => x.symbol)),
      generatesEpsilon: startNullable,
    },
    warnings,
  });
}
