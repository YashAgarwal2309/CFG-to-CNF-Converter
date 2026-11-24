import { describe, expect, it } from 'vitest';
import { checkAlreadyCnf, classifyCnfRule, isCnf, validateCnf } from '../algorithms/cnfValidator.js';
import { createGrammar } from '../algorithms/grammar.js';
import { g } from './helpers.js';

const formsOf = (grammar) => validateCnf(grammar).rules.map((r) => r.form);

describe('CNF validator', () => {
  it('accepts a correct CNF grammar', () => {
    const result = validateCnf(g('S -> AB | a\nA -> a\nB -> b'));
    expect(result.valid).toBe(true);
    expect(result.validCount).toBe(4);
    expect(result.invalidCount).toBe(0);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it('accepts S₀ → ε when S₀ is not on a right-hand side', () => {
    expect(isCnf(g('S₀ -> AB | ε\nA -> a\nB -> b', { start: 'S₀' }))).toBe(true);
  });

  it('rejects S → ε when S appears on a right-hand side', () => {
    const result = validateCnf(g('S -> SS | a | ε'));
    expect(result.valid).toBe(false);
    expect(result.checks.find((c) => c.id === 'start').passed).toBe(false);
  });

  it('rejects ε-productions of non-start variables', () => {
    const result = validateCnf(g('S -> AB\nA -> ε | a\nB -> b'));
    expect(result.valid).toBe(false);
    const bad = result.rules.find((r) => !r.valid);
    expect(bad.form).toBe('epsilon');
    expect(bad.reason).toMatch(/only the start symbol/);
  });

  it('rejects unit, mixed and long productions with exact reasons', () => {
    const grammar = g('S -> A | aB | ABC\nA -> a\nB -> b\nC -> c');
    expect(formsOf(grammar)).toEqual(['unit', 'mixed', 'long', 'A → a', 'A → a', 'A → a']);
    const result = validateCnf(grammar);
    expect(result.invalidCount).toBe(3);
    expect(result.rules[0].reason).toMatch(/Unit production/);
    expect(result.rules[1].reason).toMatch(/Terminal a mixed/);
    expect(result.rules[2].reason).toMatch(/3 symbols/);
  });

  it('detects useless symbols', () => {
    const result = validateCnf(g('S -> AB | a\nA -> a\nB -> BB\nC -> c'));
    expect(result.valid).toBe(false);
    // B is non-generating; A is only used in S → AB, which needs B, so A is useless too.
    expect([...result.uselessSymbols].sort()).toEqual(['A', 'B', 'C']);
  });

  it('checks ε-membership against the original grammar', () => {
    const grammar = g('S -> AB | a\nA -> a\nB -> b');
    expect(validateCnf(grammar, { expectEpsilon: true }).valid).toBe(false);
    expect(validateCnf(grammar, { expectEpsilon: false }).valid).toBe(true);
  });

  it('treats a grammar without productions as vacuously CNF (empty language)', () => {
    const result = validateCnf(createGrammar({ start: 'S', productions: [] }));
    expect(result.valid).toBe(true);
    expect(result.isEmptyLanguage).toBe(true);
  });

  it('classifies a single rule', () => {
    const grammar = g('S -> AB\nA -> a\nB -> b');
    expect(classifyCnfRule({ lhs: 'S', rhs: ['A', 'B'] }, grammar).valid).toBe(true);
    expect(classifyCnfRule({ lhs: 'a', rhs: ['A'] }, grammar).reason).toMatch(/not a variable/);
  });
});

describe('checkAlreadyCnf — validating a user grammar without converting it', () => {
  const byRule = (result) =>
    Object.fromEntries(result.rules.map((r) => [`${r.production.lhs} → ${r.production.rhs.join(' ') || 'ε'}`, r]));

  it('rejects the practical demo grammar with exact per-rule reasons', () => {
    const result = checkAlreadyCnf(g('S -> AB | a\nA -> aA | ε\nB -> b | ε'));
    expect(result.valid).toBe(false);
    expect(result.validCount).toBe(3);
    expect(result.invalidCount).toBe(3);
    const r = byRule(result);
    expect(r['S → A B']).toMatchObject({ valid: true, form: 'A → BC' });
    expect(r['S → A B'].reason).toMatch(/A, B ∈ V/);
    expect(r['S → a']).toMatchObject({ valid: true, form: 'A → a' });
    expect(r['S → a'].reason).toMatch(/a ∈ Σ/);
    expect(r['A → a A']).toMatchObject({ valid: false, form: 'mixed' });
    expect(r['A → a A'].reason).toMatch(/Terminal a mixed.*a ∈ Σ/);
    expect(r['A → ε']).toMatchObject({ valid: false, form: 'epsilon' });
    expect(r['A → ε'].reason).toMatch(/only the start symbol may derive ε directly, and A ≠ S/);
    expect(r['B → ε'].valid).toBe(false);
    expect(result.checks.find((c) => c.id === 'epsilon').passed).toBe(false);
    expect(result.checks.find((c) => c.id === 'mixed').passed).toBe(false);
  });

  it('does not change the input grammar (no conversion happens)', () => {
    const grammar = g('S -> AB | a\nA -> aA | ε\nB -> b | ε');
    const before = JSON.stringify(grammar);
    checkAlreadyCnf(grammar);
    expect(JSON.stringify(grammar)).toBe(before);
  });

  it('accepts the start-symbol ε exception when S is on no right-hand side', () => {
    const result = checkAlreadyCnf(g('S -> AB | ε\nA -> a\nB -> b'));
    expect(result.valid).toBe(true);
    const eps = byRule(result)['S → ε'];
    expect(eps).toMatchObject({ valid: true, form: 'S → ε' });
    expect(eps.reason).toMatch(/Start-symbol exception/);
    expect(result.checks.find((c) => c.id === 'start').passed).toBe(true);
  });

  it('rejects S → ε when the start symbol appears on a right-hand side', () => {
    const result = checkAlreadyCnf(g('S -> SA | a | ε\nA -> a'));
    expect(result.valid).toBe(false);
    const eps = byRule(result)['S → ε'];
    expect(eps.valid).toBe(false);
    expect(eps.reason).toMatch(/does not appear on any right-hand side, but S does/);
    expect(result.checks.find((c) => c.id === 'start').passed).toBe(false);
    // The other rules are still individually valid.
    expect(byRule(result)['S → S A'].valid).toBe(true);
  });

  it('accepts the start symbol on a right-hand side when there is no ε-rule', () => {
    expect(checkAlreadyCnf(g('S -> SS | a')).valid).toBe(true);
  });

  it('rejects an ε-rule of a non-start variable even if the start symbol is nullable', () => {
    const result = checkAlreadyCnf(g('S₀ -> AB | ε\nA -> a | ε\nB -> b', { start: 'S₀' }));
    expect(byRule(result)['S₀ → ε'].valid).toBe(true);
    expect(byRule(result)['A → ε'].valid).toBe(false);
    expect(result.valid).toBe(false);
  });

  it('reports unit and long productions', () => {
    const r = byRule(checkAlreadyCnf(g('S -> A | aBc\nA -> a\nB -> b')));
    expect(r['S → A']).toMatchObject({ valid: false, form: 'unit' });
    expect(r['S → A'].reason).toMatch(/single variable \(A ∈ V\)/);
    expect(r['S → a B c']).toMatchObject({ valid: false, form: 'long' });
    expect(r['S → a B c'].reason).toMatch(/3 symbols.*terminals a, c/);
  });

  it('treats useless symbols as an advisory, not a CNF violation', () => {
    const grammar = g('S -> AB | a\nA -> a\nB -> b\nC -> c');
    const check = checkAlreadyCnf(grammar);
    expect(check.valid).toBe(true);
    expect(check.warnings.map((w) => w.id)).toEqual(['useless']);
    expect(check.checks.find((c) => c.id === 'useless').severity).toBe('warning');
    // The final-output validation used by the pipeline stays strict.
    expect(validateCnf(grammar).valid).toBe(false);
  });
});
