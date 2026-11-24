import { describe, expect, it } from 'vitest';
import { augmentStartSymbol } from '../algorithms/augmentStartSymbol.js';
import { expandNullable, removeEpsilonProductions } from '../algorithms/epsilonRemoval.js';
import { removeUnitProductions } from '../algorithms/unitRemoval.js';
import { removeUselessSymbols } from '../algorithms/uselessSymbolRemoval.js';
import { replaceTerminals } from '../algorithms/terminalReplacement.js';
import { convertToBinary } from '../algorithms/binaryConversion.js';
import {
  computeGenerating,
  computeNullable,
  computeReachable,
  computeUnitClosures,
  findUnitCycles,
  grammarStatistics,
} from '../algorithms/grammarAnalysis.js';
import { createNameFactory, terminalNameSuffix } from '../algorithms/symbols.js';
import { createGrammar, diffGrammars, productionKey } from '../algorithms/grammar.js';
import { ConversionError } from '../algorithms/stageResult.js';
import { compareLanguages } from '../engine/languageCheck.js';
import { g, hasRule, rules } from './helpers.js';

/** Every recorded change must match the real difference between snapshots. */
function expectConsistentStage(stage) {
  const diff = diffGrammars(stage.before, stage.after);
  const added = new Set([
    ...stage.added.map((a) => productionKey(a.production)),
    ...stage.modified.map((m) => productionKey(m.to)),
  ]);
  const removed = new Set([
    ...stage.removed.map((r) => productionKey(r.production)),
    ...stage.modified.map((m) => productionKey(m.from)),
  ]);
  for (const p of diff.added) expect(added.has(productionKey(p))).toBe(true);
  for (const p of diff.removed) expect(removed.has(productionKey(p))).toBe(true);
  for (const a of stage.added) expect(a.reason).toBeTruthy();
  for (const r of stage.removed) expect(r.reason).toBeTruthy();
  expect(Object.isFrozen(stage.after)).toBe(true);
  expect(Object.isFrozen(stage.after.productions)).toBe(true);
}

describe('analysis', () => {
  it('computes nullable variables by fixed point (including indirect ones)', () => {
    const grammar = g('S -> AB | c\nA -> ε | a\nB -> C\nC -> AA | b');
    const { nullable, rounds } = computeNullable(grammar);
    expect([...nullable].sort()).toEqual(['A', 'B', 'C', 'S']);
    expect(rounds.length).toBeGreaterThan(1);
  });

  it('computes generating variables', () => {
    const grammar = g('S -> AB | a\nA -> aA\nB -> b');
    expect([...computeGenerating(grammar).generating].sort()).toEqual(['B', 'S']);
  });

  it('computes reachable variables', () => {
    const grammar = g('S -> aA\nA -> b\nB -> c');
    expect([...computeReachable(grammar).reachable].sort()).toEqual(['A', 'S']);
  });

  it('computes unit closures with cycles', () => {
    const grammar = g('A -> B | a\nB -> C\nC -> A | c');
    const closure = computeUnitClosures(grammar).get('A').map((x) => x.symbol);
    expect(closure).toEqual(['A', 'B', 'C']);
    expect(findUnitCycles(grammar).length).toBeGreaterThan(0);
  });

  it('reports statistics', () => {
    const stats = grammarStatistics(g('S -> A | aSb | ε\nA -> a\nB -> b'));
    expect(stats.nonTerminals).toBe(3);
    expect(stats.terminals).toBe(2);
    expect(stats.nullable).toEqual(['S']);
    expect(stats.unitProductions).toHaveLength(1);
    expect(stats.useless).toEqual(['B']);
    expect(stats.generatesEpsilon).toBe(true);
    expect(stats.startOnRhs).toBe(true);
  });
});

describe('symbol naming', () => {
  it('never reuses taken names', () => {
    const names = createNameFactory(new Set(['S₀', "S₀'", 'X₁']));
    expect(names.fresh('S₀')).toBe("S₀''");
    expect(names.indexed('X')).toBe('X₂');
    expect(names.indexed('X')).toBe('X₃');
  });

  it('creates readable terminal suffixes', () => {
    expect(terminalNameSuffix('a')).toBe('a');
    expect(terminalNameSuffix('+')).toBe('plus');
    expect(terminalNameSuffix('id')).toBe('id');
    expect(terminalNameSuffix('→')).toMatch(/^u/);
  });
});

describe('Stage 1: start symbol augmentation', () => {
  it('adds S₀ → S when S appears on a right-hand side', () => {
    const stage = augmentStartSymbol(g('S -> aSb | ε'));
    expect(stage.applied).toBe(true);
    expect(stage.after.start).toBe('S₀');
    expect(hasRule(stage.after, 'S₀', ['S'])).toBe(true);
    expect(stage.after.productions.some((p) => p.rhs.includes('S₀'))).toBe(false);
    expect(stage.introduced.map((v) => v.name)).toEqual(['S₀']);
    expectConsistentStage(stage);
  });

  it('does nothing when the start symbol is not on any right-hand side', () => {
    const grammar = g('S -> AB | a\nA -> a\nB -> b');
    const stage = augmentStartSymbol(grammar);
    expect(stage.applied).toBe(false);
    expect(stage.after).toBe(grammar);
  });

  it('avoids name collisions with an existing S₀', () => {
    const stage = augmentStartSymbol(g('S -> S₀ S | a\nS₀ -> b'));
    expect(stage.after.start).toBe("S₀'");
  });
});

describe('Stage 2: ε-removal', () => {
  it('expands a production over all nullable subsets', () => {
    const nts = new Set(['A', 'B']);
    const variants = expandNullable(['A', 'b', 'B'], new Set(['A', 'B']), nts).map((v) => v.rhs.join(''));
    expect(variants.sort()).toEqual(['AbB', 'Ab', 'b', 'bB'].sort());
  });

  it('handles S → AB with A, B nullable (the spec example)', () => {
    const stage = removeEpsilonProductions(g('S -> AB\nA -> a | ε\nB -> b | ε'));
    expect(rules(stage.after)).toEqual(
      new Set(['S → AB', 'S → A', 'S → B', 'S → ε', 'A → a', 'B → b']),
    );
    expect([...stage.details.nullable].sort()).toEqual(['A', 'B', 'S']);
    expect(stage.details.generatesEpsilon).toBe(true);
    expectConsistentStage(stage);
  });

  it('does not keep S → ε when ε is not in the language', () => {
    const stage = removeEpsilonProductions(g('S -> aA\nA -> b | ε'));
    expect(rules(stage.after)).toEqual(new Set(['S → aA', 'S → a', 'A → b']));
    expect(stage.after.productions.some((p) => p.rhs.length === 0)).toBe(false);
  });

  it('handles repeated nullable occurrences (A A)', () => {
    const stage = removeEpsilonProductions(g('S -> AAb\nA -> a | ε'));
    expect(rules(stage.after)).toEqual(new Set(['S → AAb', 'S → Ab', 'S → b', 'A → a']));
  });

  it('produces no duplicates', () => {
    const stage = removeEpsilonProductions(g('S -> ABC\nA -> ε\nB -> ε\nC -> c'));
    const keys = stage.after.productions.map(productionKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('is a no-op without nullable variables', () => {
    const stage = removeEpsilonProductions(g('S -> aS | b'));
    expect(stage.applied).toBe(false);
  });

  it('refuses a nullable start symbol that appears on a right-hand side', () => {
    expect(() => removeEpsilonProductions(g('S -> aS | ε'))).toThrow(ConversionError);
  });

  it('preserves the language (bounded check)', () => {
    const grammar = g('S -> AbB | c\nA -> aA | ε\nB -> bB | ε');
    const stage = removeEpsilonProductions(grammar);
    expect(compareLanguages(grammar, stage.after, 6).equal).toBe(true);
  });
});

describe('Stage 3: unit production removal', () => {
  it('collapses unit chains', () => {
    const stage = removeUnitProductions(g('S -> A | ab\nA -> B\nB -> b'));
    expect(rules(stage.after)).toEqual(new Set(['S → ab', 'S → b', 'A → b', 'B → b']));
    expectConsistentStage(stage);
  });

  it('terminates on unit cycles and distributes productions', () => {
    const stage = removeUnitProductions(g('A -> B | a\nB -> C | b\nC -> A | c'));
    for (const v of ['A', 'B', 'C']) {
      for (const t of ['a', 'b', 'c']) expect(hasRule(stage.after, v, [t])).toBe(true);
    }
    expect(stage.details.cycles.length).toBeGreaterThan(0);
    expect(stage.after.productions).toHaveLength(9);
  });

  it('removes self loops A → A', () => {
    const stage = removeUnitProductions(g('S -> S | a'));
    expect(rules(stage.after)).toEqual(new Set(['S → a']));
  });

  it('keeps the start ε-rule', () => {
    const stage = removeUnitProductions(g('S₀ -> S | ε\nS -> a', { start: 'S₀' }));
    expect(rules(stage.after)).toEqual(new Set(['S₀ → ε', 'S₀ → a', 'S → a']));
  });

  it('preserves the language (bounded check)', () => {
    const grammar = g('E -> E + T | T\nT -> T * F | F\nF -> ( E ) | a');
    expect(compareLanguages(grammar, removeUnitProductions(grammar).after, 7).equal).toBe(true);
  });
});

describe('Stage 4: useless symbol removal', () => {
  it('removes non-generating then unreachable symbols', () => {
    const stage = removeUselessSymbols(g('S -> AB | a\nA -> a\nB -> bB'));
    // B is non-generating; after removing S → AB, A becomes unreachable.
    expect(rules(stage.after)).toEqual(new Set(['S → a']));
    expect(stage.details.nonGenerating).toEqual(['B']);
    expect(stage.details.unreachable).toEqual(['A']);
    expectConsistentStage(stage);
  });

  it('removes unreachable variables', () => {
    const stage = removeUselessSymbols(g('S -> a\nB -> b'));
    expect(stage.after.nonTerminals).toEqual(['S']);
    expect(stage.after.terminals).toEqual(['a']);
    expect(stage.details.removedTerminals).toEqual(['b']);
  });

  it('empties a grammar whose start symbol is non-generating', () => {
    const stage = removeUselessSymbols(g('S -> aS'));
    expect(stage.after.productions).toHaveLength(0);
    expect(stage.after.start).toBe('S');
    expect(stage.warnings[0]).toMatch(/empty language/);
  });

  it('is a no-op on a clean grammar', () => {
    expect(removeUselessSymbols(g('S -> aS | b')).applied).toBe(false);
  });
});

describe('Stage 5: terminal replacement', () => {
  it('replaces terminals in long right-hand sides and shares T_a', () => {
    const stage = replaceTerminals(g('S -> aBa | a\nB -> b'));
    expect(hasRule(stage.after, 'S', ['T_a', 'B', 'T_a'])).toBe(true);
    expect(hasRule(stage.after, 'T_a', ['a'])).toBe(true);
    expect(hasRule(stage.after, 'S', ['a'])).toBe(true); // single terminal untouched
    expect(stage.introduced.map((v) => v.name)).toEqual(['T_a']);
    expectConsistentStage(stage);
  });

  it('reuses an existing variable whose only rule is X → a', () => {
    const stage = replaceTerminals(g('S -> aB\nA -> a\nB -> b | A'));
    expect(hasRule(stage.after, 'S', ['A', 'B'])).toBe(true);
    expect(stage.introduced).toHaveLength(0);
    expect(stage.details.mapping[0]).toMatchObject({ terminal: 'a', variable: 'A', reused: true });
  });

  it('avoids collisions with an existing T_a', () => {
    const stage = replaceTerminals(g('S -> aS | T_a\nT_a -> b | S'));
    expect(stage.introduced[0].name).toBe("T_a'");
  });

  it('names punctuation terminals readably', () => {
    const stage = replaceTerminals(g('S -> ( S ) | a'));
    expect(stage.introduced.map((v) => v.name)).toEqual(['T_lpar', 'T_rpar']);
  });
});

describe('Stage 6: binary conversion', () => {
  it('splits S → ABCD into a chain (the spec example)', () => {
    const stage = convertToBinary(g('S -> ABCD\nA -> a\nB -> b\nC -> c\nD -> d'));
    expect(rules(stage.after)).toEqual(
      new Set(['S → A X₁', 'X₁ → B X₂', 'X₂ → CD', 'A → a', 'B → b', 'C → c', 'D → d']),
    );
    expect(stage.after.productions.every((p) => p.rhs.length <= 2)).toBe(true);
    expectConsistentStage(stage);
  });

  it('shares chain variables for identical suffixes', () => {
    const stage = convertToBinary(g('S -> ABC | BBC\nA -> a\nB -> b\nC -> c'));
    expect(stage.introduced.map((v) => v.name)).toEqual(['X₁']);
    expect(hasRule(stage.after, 'S', ['A', 'X₁'])).toBe(true);
    expect(hasRule(stage.after, 'S', ['B', 'X₁'])).toBe(true);
  });

  it('avoids collisions with existing X₁', () => {
    const stage = convertToBinary(g('S -> X₁X₁X₁\nX₁ -> a'));
    expect(stage.introduced[0].name).toBe('X₂');
  });

  it('preserves the language (bounded check)', () => {
    const grammar = g('S -> ABCA | AB\nA -> a\nB -> b\nC -> c | S', { start: 'S' });
    expect(compareLanguages(grammar, convertToBinary(grammar).after, 8).equal).toBe(true);
  });
});

describe('immutability', () => {
  it('createGrammar returns deeply frozen objects', () => {
    const grammar = createGrammar({ start: 'S', productions: [{ lhs: 'S', rhs: ['a'] }] });
    expect(() => {
      grammar.productions[0].rhs.push('b');
    }).toThrow();
  });
});
