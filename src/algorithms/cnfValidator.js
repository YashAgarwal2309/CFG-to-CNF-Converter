/**
 * Final CNF validator — inspects the actual grammar, rule by rule.
 *
 * Allowed forms:
 *   A → BC   (B, C variables)
 *   A → a    (a terminal)
 *   S → ε    only for the start symbol S, and only if S never appears on a
 *            right-hand side.
 *
 * Global checks: no useless symbols, start symbol not on a right-hand side when
 * it has an ε-rule, and (optionally) that ε-membership matches the original
 * grammar.
 */
import { EPSILON, nonTerminalSet } from './grammar.js';
import { computeGenerating, computeReachable } from './grammarAnalysis.js';
import { fmtProd, fmtSet } from './format.js';

export function classifyCnfRule(production, grammar, nts = nonTerminalSet(grammar), startOnRhs) {
  const { lhs, rhs } = production;
  const onRhs =
    startOnRhs ?? grammar.productions.some((p) => p.rhs.includes(grammar.start));
  if (!nts.has(lhs)) {
    return { valid: false, form: 'invalid', reason: `Left-hand side ${lhs} is not a variable.` };
  }
  if (rhs.length === 0) {
    if (lhs !== grammar.start) {
      return {
        valid: false,
        form: 'epsilon',
        reason: `ε-production for ${lhs}; only the start symbol may derive ε directly.`,
      };
    }
    if (onRhs) {
      return {
        valid: false,
        form: 'epsilon',
        reason: `${lhs} → ε is only allowed when the start symbol ${lhs} does not appear on any right-hand side.`,
      };
    }
    return { valid: true, form: 'S → ε', reason: 'Permitted start-symbol ε-rule (S does not appear on any right-hand side).' };
  }
  if (rhs.length === 1) {
    if (nts.has(rhs[0])) {
      return { valid: false, form: 'unit', reason: `Unit production: ${lhs} → ${rhs[0]} has a single variable on the right.` };
    }
    return { valid: true, form: 'A → a', reason: `A single terminal (${rhs[0]}).` };
  }
  if (rhs.length === 2) {
    const terminals = rhs.filter((s) => !nts.has(s));
    if (terminals.length) {
      return {
        valid: false,
        form: 'mixed',
        reason: `Terminal ${terminals.join(', ')} mixed into a two-symbol right-hand side; it must be replaced by a variable.`,
      };
    }
    return { valid: true, form: 'A → BC', reason: 'Exactly two variables.' };
  }
  const terminals = rhs.filter((s) => !nts.has(s));
  return {
    valid: false,
    form: 'long',
    reason:
      `Right-hand side has ${rhs.length} symbols (CNF allows at most 2)` +
      (terminals.length ? ` and contains terminal${terminals.length > 1 ? 's' : ''} ${terminals.join(', ')}.` : '.'),
  };
}

/**
 * Validate a grammar against CNF.
 * @param {object} grammar
 * @param {object} [options]
 * @param {boolean} [options.expectEpsilon] whether the ORIGINAL grammar generates ε
 */
export function validateCnf(grammar, options = {}) {
  const nts = nonTerminalSet(grammar);
  const startOnRhs = grammar.productions.some((p) => p.rhs.includes(grammar.start));
  const rules = grammar.productions.map((production) => ({
    production,
    ...classifyCnfRule(production, grammar, nts, startOnRhs),
  }));

  const { generating } = computeGenerating(grammar);
  const usefulProductions = grammar.productions.filter(
    (p) => generating.has(p.lhs) && p.rhs.every((s) => !nts.has(s) || generating.has(s)),
  );
  const { reachable } = computeReachable({ ...grammar, productions: usefulProductions });
  const isEmptyLanguage = grammar.productions.length === 0 || !generating.has(grammar.start);
  const mentioned = new Set(grammar.productions.flatMap((p) => [p.lhs, ...p.rhs.filter((s) => nts.has(s))]));
  const uselessSymbols = grammar.nonTerminals.filter(
    (n) => mentioned.has(n) && (!generating.has(n) || !reachable.has(n)),
  );

  const hasStartEpsilon = grammar.productions.some((p) => p.lhs === grammar.start && p.rhs.length === 0);
  const checks = [];
  const add = (id, label, passed, detail) => checks.push({ id, label, passed, detail });

  const invalid = rules.filter((r) => !r.valid);
  const byForm = (form) => invalid.filter((r) => r.form === form);

  add(
    'epsilon',
    'No ε-productions except the start-symbol exception',
    byForm('epsilon').length === 0,
    byForm('epsilon').length ? byForm('epsilon').map((r) => fmtProd(r.production)).join(', ') : `Only ${grammar.start} may derive ε.`,
  );
  add(
    'unit',
    'No unit productions (A → B)',
    byForm('unit').length === 0,
    byForm('unit').length ? byForm('unit').map((r) => fmtProd(r.production)).join(', ') : 'None found.',
  );
  add(
    'mixed',
    'No terminals mixed with variables',
    byForm('mixed').length === 0 && !byForm('long').some((r) => r.production.rhs.some((s) => !nts.has(s))),
    byForm('mixed').length ? byForm('mixed').map((r) => fmtProd(r.production)).join(', ') : 'Terminals appear only alone.',
  );
  add(
    'long',
    'No right-hand side longer than two symbols',
    byForm('long').length === 0,
    byForm('long').length ? byForm('long').map((r) => fmtProd(r.production)).join(', ') : 'All right-hand sides have length ≤ 2.',
  );
  add(
    'start',
    'Start symbol ε-rule handled correctly',
    !(hasStartEpsilon && startOnRhs),
    hasStartEpsilon
      ? startOnRhs
        ? `${grammar.start} → ε exists but ${grammar.start} appears on a right-hand side.`
        : `${grammar.start} → ε is present and ${grammar.start} never appears on a right-hand side.`
      : `${grammar.start} has no ε-rule.`,
  );
  add(
    'useless',
    'No useless symbols',
    uselessSymbols.length === 0,
    uselessSymbols.length ? `Useless: ${fmtSet(uselessSymbols)}` : 'Every variable is generating and reachable.',
  );
  if (typeof options.expectEpsilon === 'boolean') {
    add(
      'epsilon-membership',
      'ε-membership matches the original grammar',
      hasStartEpsilon === options.expectEpsilon,
      options.expectEpsilon
        ? hasStartEpsilon
          ? `Original grammar generates ε and the CNF keeps ${grammar.start} → ${EPSILON}.`
          : `Original grammar generates ε but the CNF has no ${grammar.start} → ${EPSILON}.`
        : hasStartEpsilon
          ? 'Original grammar does not generate ε, but the CNF does.'
          : 'Neither the original grammar nor the CNF generates ε.',
    );
  }

  const valid = checks.every((c) => c.passed) && invalid.length === 0;
  return {
    valid,
    totalRules: rules.length,
    validCount: rules.length - invalid.length,
    invalidCount: invalid.length,
    rules,
    checks,
    uselessSymbols,
    isEmptyLanguage,
    hasStartEpsilon,
    summary: valid
      ? isEmptyLanguage
        ? 'Valid CNF (vacuously): the grammar has no productions and generates the empty language ∅.'
        : `Valid CNF: all ${rules.length} productions have the form A → BC, A → a${hasStartEpsilon ? `, or ${grammar.start} → ε` : ''}.`
      : `Not in CNF: ${invalid.length} invalid production${invalid.length === 1 ? '' : 's'}, ${checks.filter((c) => !c.passed).length} failed check${checks.filter((c) => !c.passed).length === 1 ? '' : 's'}.`,
  };
}

/** Quick boolean helper. */
export function isCnf(grammar) {
  return validateCnf(grammar).valid;
}
