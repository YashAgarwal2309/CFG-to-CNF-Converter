import { describe, expect, it } from 'vitest';
import { QUIZ_QUESTIONS } from '../data/quiz.js';
import { computeNullable } from '../algorithms/grammarAnalysis.js';
import { classifyCnfRule, isCnf } from '../algorithms/cnfValidator.js';
import { removeEpsilonProductions } from '../algorithms/epsilonRemoval.js';
import { convertToBinary } from '../algorithms/binaryConversion.js';
import { augmentStartSymbol } from '../algorithms/augmentStartSymbol.js';
import { removeUselessSymbols } from '../algorithms/uselessSymbolRemoval.js';
import { fmtProd } from '../algorithms/format.js';
import { g } from './helpers.js';

describe('quiz bank', () => {
  it('every question has a valid answer index and an explanation', () => {
    for (const q of QUIZ_QUESTIONS) {
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.options.length);
      expect(q.explanation.length).toBeGreaterThan(10);
    }
  });

  it.each(QUIZ_QUESTIONS.filter((q) => q.verify).map((q) => [q.id, q]))('answer key for %s agrees with the engine', (_, q) => {
    const v = q.verify;
    const grammar = g(v.grammar);
    switch (v.kind) {
      case 'cnf-valid': {
        const valid = grammar.productions
          .filter((p) => p.lhs === v.lhs)
          .filter((p) => classifyCnfRule(p, grammar).valid)
          .map((p) => fmtProd(p).replace(/\s+/g, ''));
        // The correct option (whitespace removed) is the only valid rule among the options.
        const optionRules = q.options.map((o) => o.replace(/\s+/g, ''));
        const validOptions = optionRules.filter((o) => valid.includes(o));
        expect(validOptions).toEqual([optionRules[q.answer]]);
        break;
      }
      case 'nullable':
        expect([...computeNullable(grammar).nullable].sort()).toEqual(v.expected);
        break;
      case 'epsilon-count': {
        const after = removeEpsilonProductions(grammar).after;
        // Non-empty S-rules: the 7 combinations of ABC plus S → d. (S is itself
        // nullable, so S → ε is kept as well, but it is not counted here.)
        expect(after.productions.filter((p) => p.lhs === v.lhs && p.rhs.length > 0)).toHaveLength(v.expected);
        expect(Number(q.options[q.answer])).toBe(v.expected - 1);
        break;
      }
      case 'binary-count': {
        const stage = convertToBinary(grammar);
        const chain = stage.details.chains[0].rules;
        expect(chain).toHaveLength(v.expected);
        expect(Number(q.options[q.answer])).toBe(v.expected);
        break;
      }
      case 'augmented':
        expect(augmentStartSymbol(grammar).applied).toBe(v.expected);
        break;
      case 'useless':
        expect(removeUselessSymbols(grammar).after.productions.map(fmtProd)).toEqual(v.expectedRemaining);
        break;
      case 'is-cnf':
        expect(isCnf(grammar)).toBe(v.expected);
        break;
      default:
        throw new Error(`Unknown verify kind ${v.kind}`);
    }
  });
});
