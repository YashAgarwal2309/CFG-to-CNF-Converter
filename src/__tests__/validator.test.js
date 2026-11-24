import { describe, expect, it } from 'vitest';
import { classifyCnfRule, isCnf, validateCnf } from '../algorithms/cnfValidator.js';
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
