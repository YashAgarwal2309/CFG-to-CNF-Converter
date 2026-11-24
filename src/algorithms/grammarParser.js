/**
 * Grammar parser and symbol tokenizer.
 *
 * Accepted notation (one rule per line):
 *
 *   S  -> A B | a        S → AB | a        S ::= AB | a
 *   A  -> a A | ε        A -> aA | epsilon  A -> aA | λ  | ''
 *      | b               (a line starting with "|" continues the previous rule)
 *   # comment            // comment
 *
 * Symbol tokenisation (applied to each alternative, left to right):
 *   1. whitespace separates symbols but is otherwise ignored
 *   2. <name>            → non-terminal written in angle brackets
 *   3. 'text' / "text"   → terminal (allows multi-character terminals)
 *   4. ε, λ              → epsilon marker
 *   5. the longest KNOWN symbol (any LHS name, or a declared non-terminal or
 *      terminal) starting at this position — unless an identifier extends it
 *      with subscripts, primes or an _suffix (S₀, A', T_a after S, A, T)
 *   6. otherwise an implicit non-terminal: an uppercase letter optionally
 *      followed by _suffix, digits/subscripts and primes (A, S0, X₁, T_a, A')
 *   7. any other single character → terminal
 *
 * Because known symbols win, "S -> 0S1" (with S defined) reads as 0 · S · 1,
 * while an undefined "X1" is read as a single non-terminal X1.
 *
 * Multi-character identifiers that are defined (on a left-hand side or in the
 * non-terminal declaration) are therefore never split into single letters.
 */
import { createGrammar, EPSILON, productionKey } from './grammar.js';
import { IMPLICIT_NON_TERMINAL } from './symbols.js';

const ARROW = /->|→|⟶|::=/;
const EPSILON_WORDS = new Set(['ε', 'epsilon', 'Epsilon', 'EPSILON', 'λ', 'lambda', "''", '""', 'ϵ']);
const EPSILON_CHARS = new Set(['ε', 'λ', 'ϵ']);
const LHS_PATTERN = /^(?:<[^<>\s|]+>|[A-Za-z][A-Za-z0-9_₀-₉']*)$/u;

/** Split a declaration string such as "S, A, B" or "a b c" into names. */
export function parseSymbolList(input) {
  if (Array.isArray(input)) return input.map((s) => String(s).trim()).filter(Boolean);
  if (!input) return [];
  return String(input)
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Split on "|" while respecting quoted terminals such as '|'. */
function splitAlternatives(text) {
  const parts = [];
  let current = '';
  let quote = null;
  for (const ch of text) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
    } else if (ch === '|') {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/**
 * Tokenise one alternative. Returns { symbols: [{name, kind}], epsilon, errors, warnings }.
 * kind is 'N' (non-terminal) or 'T' (terminal).
 */
export function tokenizeAlternative(text, context) {
  const { knownNonTerminals, knownTerminals } = context;
  const errors = [];
  const warnings = [];
  const trimmed = text.trim();
  if (trimmed === '') {
    errors.push('Empty alternative. Write ε (or "epsilon") for an empty production.');
    return { symbols: [], epsilon: false, errors, warnings };
  }
  if (EPSILON_WORDS.has(trimmed)) return { symbols: [], epsilon: true, errors, warnings };

  const chars = [...trimmed];
  const known = [
    ...[...knownNonTerminals].map((name) => ({ name, kind: 'N' })),
    ...[...knownTerminals].map((name) => ({ name, kind: 'T' })),
  ].sort((a, b) => [...b.name].length - [...a.name].length);

  const symbols = [];
  let sawEpsilon = false;
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i];
    if (/\s/u.test(ch)) {
      i += 1;
      continue;
    }
    const rest = chars.slice(i).join('');

    // Angle-bracket non-terminal: <expr>
    if (ch === '<') {
      const m = rest.match(/^<[^<>\s|]+>/u);
      if (m) {
        symbols.push({ name: m[0], kind: 'N' });
        i += [...m[0]].length;
        continue;
      }
    }

    // Quoted terminal: 'if' or "id"
    if (ch === "'" || ch === '"') {
      const close = chars.indexOf(ch, i + 1);
      if (close === -1) {
        errors.push(`Unclosed quote ${ch} in "${trimmed}".`);
        break;
      }
      const content = chars.slice(i + 1, close).join('');
      if (content === '') sawEpsilon = true;
      else symbols.push({ name: content, kind: 'T' });
      i = close + 1;
      continue;
    }

    if (EPSILON_CHARS.has(ch)) {
      sawEpsilon = true;
      i += 1;
      continue;
    }

    // Longest known symbol first, then an implicit non-terminal identifier.
    let knownMatch = known.find((k) => rest.startsWith(k.name));
    const implicit = rest.match(IMPLICIT_NON_TERMINAL);
    // A known name may be extended into a longer identifier only by
    // subscripts, primes or an _suffix (S₀, A', T_a) — never by plain ASCII
    // digits, so that "0S1" still reads as 0 · S · 1.
    if (knownMatch && implicit && [...implicit[0]].length > [...knownMatch.name].length) {
      const extra = [...implicit[0]].slice([...knownMatch.name].length).join('');
      if (/[₀-₉'_]/u.test(extra)) knownMatch = null;
    }

    if (knownMatch) {
      symbols.push({ name: knownMatch.name, kind: knownMatch.kind });
      i += [...knownMatch.name].length;
    } else if (implicit) {
      symbols.push({ name: implicit[0], kind: 'N' });
      i += [...implicit[0]].length;
    } else {
      symbols.push({ name: ch, kind: 'T' });
      i += 1;
    }
  }

  if (sawEpsilon && symbols.length > 0) {
    warnings.push(`ε inside "${trimmed}" was ignored (αεβ = αβ).`);
  }
  return { symbols, epsilon: symbols.length === 0 && sawEpsilon, errors, warnings };
}

/**
 * Parse grammar source text.
 *
 * @param {string} text         production rules, one per line
 * @param {object} [options]
 * @param {string} [options.start]         start symbol (defaults to first LHS)
 * @param {string|string[]} [options.nonTerminals] optional declared non-terminals
 * @param {string|string[]} [options.terminals]    optional declared terminals
 * @returns {{ ok: boolean, grammar: object|null, errors: object[], warnings: object[], rules: object[] }}
 */
export function parseGrammar(text, options = {}) {
  const errors = [];
  const warnings = [];
  const declaredNT = parseSymbolList(options.nonTerminals);
  const declaredT = parseSymbolList(options.terminals);
  const source = typeof text === 'string' ? text : '';

  for (const t of declaredT) {
    if (declaredNT.includes(t)) {
      errors.push({ line: null, message: `"${t}" is declared both as a terminal and as a non-terminal.` });
    }
    if (EPSILON_WORDS.has(t) || EPSILON_CHARS.has(t)) {
      errors.push({ line: null, message: `ε cannot be declared as a terminal; it denotes the empty string.` });
    }
  }
  for (const n of declaredNT) {
    if (EPSILON_WORDS.has(n) || EPSILON_CHARS.has(n)) {
      errors.push({ line: null, message: `ε cannot be declared as a non-terminal.` });
    }
  }

  // ---- Pass 1: split lines into raw rules -------------------------------
  const rawRules = [];
  const lines = source.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#') || line.startsWith('//')) return;

    if (line.startsWith('|')) {
      const prev = rawRules[rawRules.length - 1];
      if (!prev) {
        errors.push({ line: lineNo, message: 'A continuation line ("| …") must follow a rule.' });
        return;
      }
      prev.parts.push({ text: line.slice(1), line: lineNo });
      return;
    }

    const match = line.match(ARROW);
    if (!match) {
      errors.push({
        line: lineNo,
        message: `Missing arrow in "${line}". Use "A -> α" or "A → α".`,
      });
      return;
    }
    const lhs = line.slice(0, match.index).trim();
    const rhsText = line.slice(match.index + match[0].length);
    if (lhs === '') {
      errors.push({ line: lineNo, message: 'Missing left-hand side before the arrow.' });
      return;
    }
    if (EPSILON_WORDS.has(lhs) || EPSILON_CHARS.has(lhs)) {
      errors.push({ line: lineNo, message: 'ε cannot appear on the left-hand side of a production.' });
      return;
    }
    if (!LHS_PATTERN.test(lhs)) {
      errors.push({
        line: lineNo,
        message: `Invalid left-hand side "${lhs}". A context-free rule has exactly one non-terminal on the left (e.g. "A", "Expr", "<term>").`,
      });
      return;
    }
    if (ARROW.test(rhsText)) {
      errors.push({ line: lineNo, message: 'Only one arrow is allowed per line.' });
      return;
    }
    if (declaredT.includes(lhs)) {
      errors.push({ line: lineNo, message: `"${lhs}" is declared as a terminal but has productions.` });
      return;
    }
    rawRules.push({ lhs, line: lineNo, parts: [{ text: rhsText, line: lineNo }] });
  });

  if (rawRules.length === 0 && errors.length === 0) {
    errors.push({ line: null, message: 'Enter at least one production rule, e.g. "S -> aSb | ε".' });
  }

  // ---- Pass 2: tokenise right-hand sides ---------------------------------
  const knownNonTerminals = new Set([...declaredNT, ...rawRules.map((r) => r.lhs)]);
  const knownTerminals = new Set(declaredT);
  const kinds = new Map(); // symbol name -> 'N' | 'T'
  for (const n of knownNonTerminals) kinds.set(n, 'N');
  for (const t of knownTerminals) if (!kinds.has(t)) kinds.set(t, 'T');

  const productions = [];
  const seen = new Set();
  const rules = [];
  for (const rule of rawRules) {
    const alternatives = [];
    for (const part of rule.parts) {
      for (const altText of splitAlternatives(part.text)) {
        const result = tokenizeAlternative(altText, { knownNonTerminals, knownTerminals });
        result.errors.forEach((message) => errors.push({ line: part.line, message: `${rule.lhs}: ${message}` }));
        result.warnings.forEach((message) => warnings.push({ line: part.line, message }));
        if (result.errors.length) continue;

        for (const sym of result.symbols) {
          const prev = kinds.get(sym.name);
          if (prev && prev !== sym.kind) {
            errors.push({
              line: part.line,
              message: `"${sym.name}" is used both as a terminal and as a non-terminal.`,
            });
          } else if (!prev) {
            kinds.set(sym.name, sym.kind);
          }
        }
        const production = { lhs: rule.lhs, rhs: result.symbols.map((s) => s.name) };
        const key = productionKey(production);
        if (seen.has(key)) {
          const shown = production.rhs.length ? production.rhs.join(' ') : EPSILON;
          warnings.push({ line: part.line, message: `Duplicate production ${rule.lhs} → ${shown} ignored.` });
          continue;
        }
        seen.add(key);
        productions.push(production);
        alternatives.push(production.rhs);
      }
    }
    rules.push({ lhs: rule.lhs, line: rule.line, alternatives });
  }

  // ---- Start symbol --------------------------------------------------------
  let start = (options.start ?? '').trim();
  if (!start) start = rawRules[0]?.lhs ?? declaredNT[0] ?? '';
  if (!start) {
    if (!errors.length) errors.push({ line: null, message: 'No start symbol could be determined.' });
  } else if (kinds.get(start) === 'T') {
    errors.push({ line: null, message: `Start symbol "${start}" is a terminal; it must be a non-terminal.` });
  } else if (!rawRules.some((r) => r.lhs === start) && errors.length === 0) {
    warnings.push({
      line: null,
      message: `Start symbol "${start}" has no productions, so the grammar generates the empty language ∅.`,
    });
  }

  // ---- Declaration consistency warnings ---------------------------------
  const nonTerminals = [...kinds].filter(([, k]) => k === 'N').map(([n]) => n);
  const terminals = [...kinds].filter(([, k]) => k === 'T').map(([n]) => n);
  if (declaredNT.length) {
    for (const n of nonTerminals) {
      if (!declaredNT.includes(n) && n !== start) {
        warnings.push({ line: null, message: `Non-terminal "${n}" is used but was not declared.` });
      }
    }
  }
  if (declaredT.length) {
    for (const t of terminals) {
      if (!declaredT.includes(t)) {
        warnings.push({ line: null, message: `Terminal "${t}" is used but was not declared.` });
      }
    }
  }
  const definedLhs = new Set(rawRules.map((r) => r.lhs));
  for (const n of nonTerminals) {
    if (!definedLhs.has(n) && n !== start && productions.some((p) => p.rhs.includes(n))) {
      warnings.push({
        line: null,
        message: `Non-terminal "${n}" has no productions; it can never derive a terminal string.`,
      });
    }
  }

  // Report problems in source order: by line number, then messages that are
  // not tied to a line (declarations, start symbol, whole-grammar warnings).
  sortByLine(errors);
  sortByLine(warnings);

  if (errors.length) return { ok: false, grammar: null, errors, warnings, rules };

  const grammar = createGrammar({
    start,
    nonTerminals: [start, ...rawRules.map((r) => r.lhs), ...declaredNT, ...nonTerminals],
    terminals: [...declaredT, ...terminals],
    productions,
  });
  return { ok: true, grammar, errors, warnings, rules };
}

/** Stable in-place sort by line number; entries without a line go last. */
export function sortByLine(list) {
  const key = (entry) => (typeof entry.line === 'number' ? entry.line : Number.POSITIVE_INFINITY);
  list.sort((a, b) => key(a) - key(b));
  return list;
}

/** Parse and throw on error — convenient for tests and samples. */
export function parseGrammarOrThrow(text, options) {
  const result = parseGrammar(text, options);
  if (!result.ok) {
    throw new Error(result.errors.map((e) => (e.line ? `Line ${e.line}: ${e.message}` : e.message)).join('\n'));
  }
  return result.grammar;
}
