import { describe, expect, it } from 'vitest';
import { convertToCnf, STAGES } from '../engine/conversionPipeline.js';
import { compareLanguages, cyk, enumerateLanguage, tokenizeInput, wordToString } from '../engine/languageCheck.js';
import { buildJsonReport, buildTextReport, summarizeConversion } from '../engine/conversionHistory.js';
import { validateCnf } from '../algorithms/cnfValidator.js';
import { parseGrammar } from '../algorithms/grammarParser.js';
import { g, randomGrammarText, rng, rules } from './helpers.js';

/** Convert, assert structural validity and bounded language equality. */
function convertAndCheck(text, { start, bound = 6 } = {}) {
  const grammar = g(text, start ? { start } : undefined);
  const result = convertToCnf(grammar);
  expect(result.ok).toBe(true);
  expect(validateCnf(result.final, { expectEpsilon: result.generatesEpsilon }).valid).toBe(true);
  expect(result.validation.valid).toBe(true);
  // Bounded comparison: evidence, not a proof, of language equivalence.
  const cmp = compareLanguages(grammar, result.final, bound);
  expect(cmp.onlyInFirst).toEqual([]);
  expect(cmp.onlyInSecond).toEqual([]);
  return result;
}

describe('pipeline structure', () => {
  it('returns all stages in order plus validation', () => {
    const result = convertToCnf(g('S -> aSb | ε'));
    expect(result.stages.map((s) => s.id)).toEqual([...STAGES.map((s) => s.id), 'validate']);
    expect(result.stages.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('chains snapshots: each stage starts where the previous ended', () => {
    const result = convertToCnf(g('S -> ASA | aB\nA -> B | S\nB -> b | ε'));
    for (let i = 1; i < result.stages.length; i += 1) {
      expect(result.stages[i].before).toBe(result.stages[i - 1].after);
    }
    expect(result.stages[0].before).toBe(result.original);
  });

  it('is deterministic', () => {
    const text = 'S -> ASA | aB\nA -> B | S\nB -> b | ε';
    const a = convertToCnf(g(text));
    const b = convertToCnf(g(text));
    expect(a.final).toEqual(b.final);
  });

  it('returns a frozen result', () => {
    const result = convertToCnf(g('S -> ab'));
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.stages[0])).toBe(true);
  });

  it('collects introduced variables', () => {
    const result = convertToCnf(g('S -> aSb | ε'));
    expect(result.introduced.map((v) => v.name)).toEqual(['S₀', 'T_a', 'T_b', 'X₁']);
  });
});

describe('Sipser example 2.10', () => {
  it('produces a valid, language-equivalent CNF grammar', () => {
    const result = convertAndCheck('S -> ASA | aB\nA -> B | S\nB -> b | ε', { bound: 7 });
    expect(result.final.start).toBe('S₀');
    expect(result.generatesEpsilon).toBe(false);
    expect([...result.stages.find((s) => s.id === 'epsilon').details.nullable].sort()).toEqual(['A', 'B']);
  });
});

describe('mathematical edge cases', () => {
  it('1. empty language grammar', () => {
    const result = convertAndCheck('S -> AB\nA -> aA\nB -> b');
    expect(result.final.productions).toHaveLength(0);
    expect(result.validation.isEmptyLanguage).toBe(true);
    expect(result.warnings.some((w) => /empty language/.test(w.message))).toBe(true);
  });

  it('1b. start symbol without productions', () => {
    const parsed = parseGrammar('A -> a', { start: 'S' });
    const result = convertToCnf(parsed.grammar);
    expect(result.ok).toBe(true);
    expect(result.final.productions).toHaveLength(0);
    expect(result.validation.valid).toBe(true);
  });

  it('2. grammar generating ε keeps exactly one start ε-rule', () => {
    const result = convertAndCheck('S -> aSb | ε');
    const eps = result.final.productions.filter((p) => p.rhs.length === 0);
    expect(eps).toEqual([{ lhs: result.final.start, rhs: [] }]);
    expect(result.final.productions.some((p) => p.rhs.includes(result.final.start))).toBe(false);
  });

  it('2b. language {ε} only', () => {
    const result = convertAndCheck('S -> ε');
    expect(rules(result.final)).toEqual(new Set(['S → ε']));
  });

  it('2c. ε is NOT introduced when the original does not generate it', () => {
    const result = convertAndCheck('S -> AB\nA -> a | ε\nB -> b');
    expect(result.generatesEpsilon).toBe(false);
    expect(result.final.productions.some((p) => p.rhs.length === 0)).toBe(false);
  });

  it('3. start symbol on a right-hand side', () => {
    const result = convertAndCheck('S -> SS | a');
    expect(result.final.start).not.toBe('S');
  });

  it('4. multiple nullable variables', () => {
    convertAndCheck('S -> ABCD | a\nA -> a | ε\nB -> b | ε\nC -> c | ε\nD -> d | ε', { bound: 5 });
  });

  it('5. unit production cycles', () => {
    convertAndCheck('S -> A | B\nA -> B | a\nB -> A | S | b');
  });

  it('6. recursive grammar (left and right recursion)', () => {
    convertAndCheck('S -> Sa | aS | b');
  });

  it('7. unreachable variables', () => {
    const result = convertAndCheck('S -> a\nA -> b\nB -> A');
    expect(result.final.nonTerminals).toEqual(['S']);
  });

  it('8. non-generating variables', () => {
    const result = convertAndCheck('S -> a | A\nA -> aA');
    expect(rules(result.final)).toEqual(new Set(['S → a']));
  });

  it('9. duplicate productions are removed', () => {
    const result = convertAndCheck('S -> AB | AB | a\nS -> a\nA -> a\nB -> b');
    expect(result.original.productions).toHaveLength(4);
  });

  it('10. long right-hand sides', () => {
    const result = convertAndCheck('S -> ABCDEFG\nA -> a\nB -> b\nC -> c\nD -> d\nE -> e\nF -> f\nG -> g', {
      bound: 8,
    });
    expect(result.final.productions.every((p) => p.rhs.length <= 2)).toBe(true);
  });

  it('11. existing variable-name collisions (S₀, T_a, X₁ already used)', () => {
    const result = convertAndCheck('S -> S₀ T_a X₁ S | a\nS₀ -> a\nT_a -> b\nX₁ -> a b', { bound: 7 });
    const names = result.final.nonTerminals;
    expect(new Set(names).size).toBe(names.length);
    expect(result.final.start).toBe("S₀'");
  });

  it('12. multiple terminal symbols', () => {
    convertAndCheck('S -> a S b | c S d | e', { bound: 7 });
  });

  it('13. grammar with only terminal productions', () => {
    const result = convertAndCheck('S -> a | b | c');
    expect(result.stages.filter((s) => s.applied)).toHaveLength(0);
  });

  it('14. invalid grammar syntax is rejected by the parser', () => {
    const parsed = parseGrammar('S -> a | \nA b');
    expect(parsed.ok).toBe(false);
    expect(parsed.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('15. start symbol is the only generating variable', () => {
    const result = convertAndCheck('S -> a | aA | B\nA -> aA\nB -> bB');
    expect(rules(result.final)).toEqual(new Set(['S → a']));
  });

  it('multi-character variables and terminals', () => {
    const result = convertAndCheck("Expr -> Expr '+' Term | Term\nTerm -> 'id' | '(' Expr ')'", { bound: 7 });
    expect([...result.final.terminals].sort()).toEqual(['(', ')', '+', 'id']);
  });

  it('nullable variable whose only rule is ε', () => {
    const result = convertAndCheck('S -> aAb\nA -> ε');
    expect(rules(result.final).has('S → T_a T_b')).toBe(true);
  });

  it('reports an explanatory error instead of exploding on huge expansions', () => {
    const vars = 'ABCDEFGHIJKLMNOPQR'.split('');
    const text = [`S -> ${vars.join('')}`, ...vars.map((v) => `${v} -> a | ε`)].join('\n');
    const result = convertToCnf(g(text));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/nullable occurrences/);
  });
});

describe('randomised regression (bounded language comparison)', () => {
  // Bounded comparison is evidence of equivalence, not a mathematical proof.
  it('converts 150 random grammars to valid CNF with the same strings up to length 5', () => {
    const random = rng(20241124);
    for (let i = 0; i < 150; i += 1) {
      const text = randomGrammarText(random);
      const grammar = g(text);
      const result = convertToCnf(grammar);
      expect(result.ok, text).toBe(true);
      expect(result.validation.valid, text).toBe(true);
      const cmp = compareLanguages(grammar, result.final, 5);
      expect(cmp.equal, `${text}\nonly original: ${cmp.onlyInFirst}\nonly CNF: ${cmp.onlyInSecond}`).toBe(true);
    }
  });
});

describe('randomised regression with larger grammars', () => {
  // 5 variables, 3 terminals, right-hand sides up to length 4 (more nullable
  // combinations, longer chains, more unit cycles).
  it('converts 120 larger random grammars correctly (strings up to length 4)', () => {
    const random = rng(7);
    const vars = ['S', 'A', 'B', 'C', 'D'];
    const terms = ['a', 'b', 'c'];
    const pick = (list) => list[Math.floor(random() * list.length)];
    for (let i = 0; i < 120; i += 1) {
      const lines = vars.map((v) => {
        const alts = Array.from({ length: 1 + Math.floor(random() * 3) }, () => {
          const len = Math.floor(random() * 5);
          if (len === 0) return 'ε';
          return Array.from({ length: len }, () => (random() < 0.6 ? pick(vars) : pick(terms))).join('');
        });
        return `${v} -> ${alts.join(' | ')}`;
      });
      const text = lines.join('\n');
      const grammar = g(text);
      const result = convertToCnf(grammar);
      expect(result.ok, text).toBe(true);
      expect(result.validation.valid, text).toBe(true);
      expect(compareLanguages(grammar, result.final, 4).equal, text).toBe(true);
    }
  });
});

describe('language tools', () => {
  it('enumerates aⁿbⁿ up to length 6', () => {
    const words = [...enumerateLanguage(g('S -> aSb | ε'), 6)].map(wordToString).sort();
    expect(words).toEqual(['aaabbb', 'aabb', 'ab', 'ε']);
  });

  it('CYK accepts and rejects correctly on a CNF grammar', () => {
    const { final } = convertToCnf(g('S -> aSb | ε'));
    const run = (w) => cyk(final, tokenizeInput(w, final).tokens).accepted;
    expect(run('aabb')).toBe(true);
    expect(run('')).toBe(true);
    expect(run('aab')).toBe(false);
    expect(run('ba')).toBe(false);
  });

  it('CYK agrees with enumeration for every string up to length 6', () => {
    const original = g('S -> ASA | aB\nA -> B | S\nB -> b | ε');
    const { final } = convertToCnf(original);
    const lang = new Set([...enumerateLanguage(original, 6)].map(wordToString));
    const alphabet = ['a', 'b'];
    let frontier = [''];
    for (let len = 0; len <= 6; len += 1) {
      for (const w of frontier) {
        const shown = w === '' ? 'ε' : w;
        expect(cyk(final, [...w]).accepted, w).toBe(lang.has(shown));
      }
      frontier = frontier.flatMap((w) => alphabet.map((c) => w + c));
    }
  });

  it('tokenizes input with multi-character terminals', () => {
    const grammar = g("S -> 'id' '+' S | 'id'");
    expect(tokenizeInput('id+id', grammar).tokens).toEqual(['id', '+', 'id']);
    expect(tokenizeInput('id*id', grammar).ok).toBe(false);
  });
});

describe('reports', () => {
  it('builds text and JSON reports and a history summary', () => {
    const result = convertToCnf(g('S -> aSb | ε'));
    const text = buildTextReport(result, { title: 'anbn' });
    expect(text).toContain('FINAL CNF GRAMMAR');
    expect(text).toContain('VALID CNF');
    const json = buildJsonReport(result, { title: 'anbn' });
    expect(json.stages).toHaveLength(7);
    expect(json.validation.valid).toBe(true);
    expect(JSON.parse(JSON.stringify(json)).final.start).toBe('S₀');
    const summary = summarizeConversion(result);
    expect(summary.valid).toBe(true);
    expect(summary.introduced).toContain('S₀');
  });
});
