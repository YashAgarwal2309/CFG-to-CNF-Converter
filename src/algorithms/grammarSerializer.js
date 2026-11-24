/**
 * Turn grammars back into text (for display, copy, export and re-parsing).
 */
import { EPSILON, productionsByLhs } from './grammar.js';
import { isPlainIdentifier } from './symbols.js';

const SPECIAL_TERMINAL_CHARS = new Set(['|', "'", '"', '<', '>', 'ε', 'λ', 'ϵ', '#', '-', '→', ':']);

function needsQuotes(terminal) {
  if ([...terminal].length !== 1) return true;
  if (/[A-Z]/.test(terminal)) return true;
  if (/\s/u.test(terminal)) return true;
  return SPECIAL_TERMINAL_CHARS.has(terminal);
}

function quoteTerminal(t) {
  return t.includes("'") ? `"${t}"` : `'${t}'`;
}

export function symbolToText(symbol, grammar) {
  const isNT = grammar.nonTerminals.includes(symbol);
  if (isNT) {
    if (isPlainIdentifier(symbol) || /^<[^<>\s|]+>$/u.test(symbol)) return symbol;
    return `<${symbol.replace(/[<>\s|]/g, '_')}>`;
  }
  return needsQuotes(symbol) ? quoteTerminal(symbol) : symbol;
}

/** Can every RHS be written without spaces and still re-parse identically? */
export function canWriteCompact(grammar) {
  const symbols = [...grammar.nonTerminals, ...grammar.terminals];
  if (symbols.some((s) => [...s].length !== 1)) return false;
  // digits/primes/underscores directly after a non-terminal would merge with it
  return !grammar.terminals.some((t) => /[0-9₀-₉'_]/u.test(t) || needsQuotes(t));
}

export function rhsToText(rhs, grammar, { compact, epsilon = EPSILON } = {}) {
  if (rhs.length === 0) return epsilon;
  const useCompact = compact ?? canWriteCompact(grammar);
  return rhs.map((s) => symbolToText(s, grammar)).join(useCompact ? '' : ' ');
}

export function productionToText(production, grammar, options = {}) {
  const arrow = options.arrow ?? '→';
  return `${symbolToText(production.lhs, grammar)} ${arrow} ${rhsToText(production.rhs, grammar, options)}`;
}

/** Group productions by LHS: [{ lhs, productions: [...] }] in non-terminal order. */
export function groupProductions(grammar) {
  const groups = [];
  for (const [lhs, productions] of productionsByLhs(grammar)) {
    if (productions.length) groups.push({ lhs, productions });
  }
  return groups;
}

/**
 * Serialize a grammar as rule lines: "S → AB | a".
 * options.arrow ('→' | '->'), options.epsilon ('ε' | 'epsilon'), options.compact
 */
export function serializeGrammar(grammar, options = {}) {
  const arrow = options.arrow ?? '→';
  const compact = options.compact ?? canWriteCompact(grammar);
  return groupProductions(grammar)
    .map(
      ({ lhs, productions }) =>
        `${symbolToText(lhs, grammar)} ${arrow} ${productions
          .map((p) => rhsToText(p.rhs, grammar, { ...options, compact }))
          .join(' | ')}`,
    )
    .join('\n');
}

/** Plain-ASCII serialization that the parser accepts back. */
export function serializeGrammarAscii(grammar) {
  return serializeGrammar(grammar, { arrow: '->', epsilon: 'epsilon' });
}

export function grammarToJSON(grammar) {
  return {
    start: grammar.start,
    nonTerminals: [...grammar.nonTerminals],
    terminals: [...grammar.terminals],
    productions: grammar.productions.map((p) => ({ lhs: p.lhs, rhs: [...p.rhs] })),
    text: serializeGrammar(grammar),
  };
}

/** A formal 4-tuple description G = (V, Σ, R, S). */
export function describeTuple(grammar) {
  return {
    V: `{ ${grammar.nonTerminals.join(', ')} }`,
    Sigma: `{ ${grammar.terminals.join(', ')} }`,
    R: `${grammar.productions.length} production${grammar.productions.length === 1 ? '' : 's'}`,
    S: grammar.start,
  };
}
