import { describe, expect, it } from 'vitest';
import { SAMPLE_GRAMMARS } from '../data/samples.js';
import { parseGrammar } from '../algorithms/grammarParser.js';
import { convertToCnf } from '../engine/conversionPipeline.js';
import { compareLanguages } from '../engine/languageCheck.js';

describe('sample grammar library', () => {
  it('has at least 8 samples with complete metadata', () => {
    expect(SAMPLE_GRAMMARS.length).toBeGreaterThanOrEqual(8);
    for (const s of SAMPLE_GRAMMARS) {
      expect(s.name && s.text && s.start && s.description).toBeTruthy();
      expect(s.concepts.length).toBeGreaterThan(0);
      expect(s.expected).toBeDefined();
    }
    expect(new Set(SAMPLE_GRAMMARS.map((s) => s.id)).size).toBe(SAMPLE_GRAMMARS.length);
  });

  describe.each(SAMPLE_GRAMMARS.map((s) => [s.name, s]))('%s', (_, sample) => {
    const parsed = parseGrammar(sample.text, { start: sample.start });
    const result = parsed.ok ? convertToCnf(parsed.grammar) : null;

    it('parses without errors', () => {
      expect(parsed.errors).toEqual([]);
      expect(parsed.ok).toBe(true);
    });

    it('converts to a validated CNF grammar', () => {
      expect(result.ok).toBe(true);
      expect(result.validation.valid).toBe(true);
      expect(result.validation.invalidCount).toBe(0);
    });

    it('matches its documented expected properties', () => {
      expect(result.generatesEpsilon).toBe(sample.expected.generatesEpsilon);
      expect(result.stages[0].applied).toBe(sample.expected.augmented);
      expect(result.validation.isEmptyLanguage).toBe(sample.expected.emptyLanguage);
      const applied = result.stages.filter((s) => s.applied && s.id !== 'validate').map((s) => s.id);
      expect(applied).toEqual(sample.expected.appliedStages);
    });

    it('generates the same strings up to length 6 (bounded check, not a proof)', () => {
      const cmp = compareLanguages(parsed.grammar, result.final, 6);
      expect(cmp.onlyInFirst).toEqual([]);
      expect(cmp.onlyInSecond).toEqual([]);
    });
  });
});
