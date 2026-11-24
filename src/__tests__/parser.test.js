import { describe, expect, it } from 'vitest';
import { parseGrammar, parseSymbolList, tokenizeAlternative } from '../algorithms/grammarParser.js';
import { serializeGrammar, serializeGrammarAscii } from '../algorithms/grammarSerializer.js';
import { grammarsEqual } from '../algorithms/grammar.js';
import { g, hasRule, rules } from './helpers.js';
import { SAMPLE_GRAMMARS } from '../data/samples.js';

describe('grammar parser — notation', () => {
  it('parses standard arrow notation with alternatives', () => {
    const grammar = g('S → AB | a\nA → aA | ε\nB → b');
    expect(grammar.start).toBe('S');
    expect(grammar.nonTerminals).toEqual(['S', 'A', 'B']);
    expect(grammar.terminals).toEqual(['a', 'b']);
    expect(rules(grammar)).toEqual(new Set(['S → AB', 'S → a', 'A → aA', 'A → ε', 'B → b']));
  });

  it('accepts ASCII arrows and the word "epsilon"', () => {
    const a = g('S -> AB | a\nA -> aA | epsilon\nB -> b');
    const b = g('S → AB | a\nA → aA | ε\nB → b');
    expect(grammarsEqual(a, b)).toBe(true);
  });

  it.each(['ε', 'epsilon', 'λ', 'lambda', "''", '""'])('treats %s as the empty string', (eps) => {
    const grammar = g(`S -> a | ${eps}`);
    expect(hasRule(grammar, 'S', [])).toBe(true);
  });

  it('accepts ::= arrows', () => {
    expect(rules(g('S ::= a S | b'))).toEqual(new Set(['S → aS', 'S → b']));
  });

  it('ignores whitespace, blank lines and comments', () => {
    const grammar = g('# a comment\n\n   S   ->   A   B   |   a  \n// another\nA -> a\nB->b');
    expect(rules(grammar)).toEqual(new Set(['S → AB', 'S → a', 'A → a', 'B → b']));
  });

  it('merges repeated left-hand sides and continuation lines', () => {
    const grammar = g('S -> a\nS -> b\n  | c\nA -> a');
    expect(rules(grammar)).toEqual(new Set(['S → a', 'S → b', 'S → c', 'A → a']));
  });

  it('removes duplicate productions with a warning', () => {
    const result = parseGrammar('S -> a | a | b\nS -> b');
    expect(result.ok).toBe(true);
    expect(result.grammar.productions).toHaveLength(2);
    expect(result.warnings.filter((w) => w.message.includes('Duplicate'))).toHaveLength(2);
  });

  it('uses an explicit start symbol when given', () => {
    const grammar = g('A -> aB\nB -> b', { start: 'B' });
    expect(grammar.start).toBe('B');
    expect(grammar.nonTerminals[0]).toBe('B');
  });
});

describe('grammar parser — tokenizer', () => {
  it('splits juxtaposed single-letter symbols', () => {
    expect(g('S -> aSbB\nB -> b').productions[0].rhs).toEqual(['a', 'S', 'b', 'B']);
  });

  it('does not split multi-character variables defined on a left-hand side', () => {
    const grammar = g('Expr -> Expr + Term | Term\nTerm -> a');
    expect(grammar.nonTerminals).toEqual(['Expr', 'Term']);
    expect(grammar.productions[0].rhs).toEqual(['Expr', '+', 'Term']);
  });

  it('does not split declared multi-character variables even without spaces', () => {
    const grammar = g('S -> AB\nAB -> a', { nonTerminals: 'S, AB' });
    expect(grammar.productions[0].rhs).toEqual(['AB']);
  });

  it('supports declared multi-character terminals', () => {
    const grammar = g('S -> if S then S | x', { terminals: 'if then x' });
    expect(grammar.productions[0].rhs).toEqual(['if', 'S', 'then', 'S']);
    expect(grammar.terminals).toEqual(expect.arrayContaining(['if', 'then', 'x']));
  });

  it('supports quoted terminals and angle-bracket variables', () => {
    const grammar = g("<expr> -> <expr> '+' <term> | <term>\n<term> -> 'id'");
    expect(grammar.productions[0].rhs).toEqual(['<expr>', '+', '<term>']);
    expect(grammar.terminals).toEqual(['+', 'id']);
  });

  it('prefers known symbols: "0S1" is 0 · S · 1 when S is defined', () => {
    expect(g('S -> 0S1 | ε').productions[0].rhs).toEqual(['0', 'S', '1']);
  });

  it('reads undefined identifiers such as X1, T_a and S₀ as single variables', () => {
    const { rhs } = g('S -> X1 T_a S₀').productions[0];
    expect(rhs).toEqual(['X1', 'T_a', 'S₀']);
  });

  it('tokenizes punctuation terminals', () => {
    expect(g('F -> ( E ) | a\nE -> F').productions[0].rhs).toEqual(['(', 'E', ')']);
  });

  it('drops ε inside a longer alternative with a warning', () => {
    const result = parseGrammar('S -> aεb');
    expect(result.grammar.productions[0].rhs).toEqual(['a', 'b']);
    expect(result.warnings[0].message).toMatch(/ignored/);
  });

  it('tokenizeAlternative reports empty alternatives', () => {
    const r = tokenizeAlternative('   ', { knownNonTerminals: new Set(), knownTerminals: new Set() });
    expect(r.errors[0]).toMatch(/Empty alternative/);
  });

  it('parseSymbolList splits on commas and spaces', () => {
    expect(parseSymbolList('S, A  B;C')).toEqual(['S', 'A', 'B', 'C']);
  });
});

describe('grammar parser — errors', () => {
  const errorOf = (text, options) => {
    const r = parseGrammar(text, options);
    expect(r.ok).toBe(false);
    return r.errors.map((e) => e.message).join('\n');
  };

  it('requires at least one rule', () => {
    expect(errorOf('')).toMatch(/at least one production/);
    expect(errorOf('# only a comment')).toMatch(/at least one production/);
  });

  it('reports missing arrows with the line number', () => {
    const r = parseGrammar('S -> a\nA a b');
    expect(r.ok).toBe(false);
    expect(r.errors[0].line).toBe(2);
    expect(r.errors[0].message).toMatch(/Missing arrow/);
  });

  it('reports empty alternatives', () => {
    expect(errorOf('S -> a |')).toMatch(/Empty alternative/);
  });

  it('rejects non-context-free left-hand sides', () => {
    expect(errorOf('a S -> b')).toMatch(/Invalid left-hand side/);
    expect(errorOf('-> b')).toMatch(/Missing left-hand side/);
  });

  it('rejects ε on the left-hand side', () => {
    expect(errorOf('ε -> a')).toMatch(/left-hand side/);
  });

  it('rejects multiple arrows on one line', () => {
    expect(errorOf('S -> a -> b')).toMatch(/one arrow/);
  });

  it('rejects unclosed quotes', () => {
    expect(errorOf("S -> 'ab")).toMatch(/Unclosed quote/);
  });

  it('rejects a symbol used both as terminal and variable', () => {
    expect(errorOf("S -> 'S' S | a")).toMatch(/both as a terminal and as a non-terminal/);
  });

  it('rejects conflicting declarations', () => {
    expect(errorOf('S -> a', { terminals: 'a', nonTerminals: 'S a' })).toMatch(/declared both/);
    expect(errorOf('S -> a\nB -> b', { terminals: 'a b B' })).toMatch(/declared as a terminal but has productions/);
  });

  it('rejects a terminal as start symbol', () => {
    expect(errorOf('S -> a', { start: 'a' })).toMatch(/is a terminal/);
  });

  it('a continuation line must follow a rule', () => {
    expect(errorOf('| a')).toMatch(/continuation/);
  });

  it('warns (but parses) when the start symbol has no productions', () => {
    const r = parseGrammar('A -> a', { start: 'S' });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => /empty language/.test(w.message))).toBe(true);
  });

  it('warns about variables without productions', () => {
    const r = parseGrammar('S -> AB\nA -> a');
    expect(r.warnings.some((w) => /"B" has no productions/.test(w.message))).toBe(true);
  });

  it('warns about undeclared symbols when declarations are given', () => {
    const r = parseGrammar('S -> aB\nB -> c', { nonTerminals: 'S', terminals: 'a' });
    expect(r.ok).toBe(true);
    const messages = r.warnings.map((w) => w.message).join('\n');
    expect(messages).toMatch(/"B" is used but was not declared/);
    expect(messages).toMatch(/Terminal "c" is used but was not declared/);
  });
});

describe('grammar parser — error ordering', () => {
  it('sorts errors by line number regardless of detection order', () => {
    // Detected in the order 2, 3, 1, 4 (arrow/LHS problems are found before RHS problems).
    const r = parseGrammar("S → AB | a |\nA aA | ε\na B → b\nC → 'x");
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.line)).toEqual([1, 2, 3, 4]);
  });

  it('places errors that are not tied to a line after line errors', () => {
    const r = parseGrammar('S -> a |\nA -> b', { terminals: 'x', nonTerminals: 'x' });
    expect(r.errors.map((e) => e.line)).toEqual([1, null]);
  });

  it('sorts warnings by line number too', () => {
    const r = parseGrammar('S -> a | a\nA -> b\nS -> aεb\nA -> b');
    const lines = r.warnings.map((w) => w.line);
    expect(lines).toEqual([...lines].sort((x, y) => (x ?? Infinity) - (y ?? Infinity)));
  });
});

describe('serializer round trip', () => {
  it.each(SAMPLE_GRAMMARS.map((s) => [s.id, s]))('re-parses %s identically', (_, sample) => {
    const grammar = g(sample.text, { start: sample.start });
    const text = serializeGrammar(grammar);
    expect(grammarsEqual(g(text, { start: grammar.start }), grammar)).toBe(true);
    const ascii = serializeGrammarAscii(grammar);
    expect(grammarsEqual(g(ascii, { start: grammar.start }), grammar)).toBe(true);
  });

  it('quotes multi-character and uppercase terminals', () => {
    const grammar = g("S -> 'id' | 'A' S", { start: 'S' });
    const text = serializeGrammar(grammar);
    expect(text).toContain("'id'");
    expect(text).toContain("'A'");
    expect(grammarsEqual(g(text), grammar)).toBe(true);
  });
});
