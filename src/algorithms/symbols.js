/**
 * Symbol utilities: naming rules, fresh-name generation and display helpers.
 */

const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

export function toSubscript(n) {
  return String(n)
    .split('')
    .map((d) => SUBSCRIPT_DIGITS[Number(d)])
    .join('');
}

/**
 * Pattern for a non-terminal written without declaration:
 * an uppercase letter, optionally followed by `_suffix`, digits (ASCII or
 * subscript) and primes. Examples: A, S0, S₀, A1, X₁₂, T_a, T_plus, A'
 */
export const IMPLICIT_NON_TERMINAL = /^[A-Z](?:_[A-Za-z0-9]+)?[0-9₀-₉]*'*/u;

/** A name that can be written without quotes or angle brackets. */
export function isPlainIdentifier(name) {
  return /^[A-Za-z][A-Za-z0-9_₀-₉']*$/u.test(name);
}

const TERMINAL_NAMES = {
  '+': 'plus',
  '-': 'minus',
  '*': 'star',
  '/': 'slash',
  '(': 'lpar',
  ')': 'rpar',
  '[': 'lbrack',
  ']': 'rbrack',
  '{': 'lbrace',
  '}': 'rbrace',
  '=': 'eq',
  '<': 'lt',
  '>': 'gt',
  ',': 'comma',
  ';': 'semi',
  '.': 'dot',
  ':': 'colon',
  '!': 'bang',
  '?': 'qmark',
  '#': 'hash',
  '$': 'dollar',
  '%': 'pct',
  '&': 'amp',
  '^': 'caret',
  '~': 'tilde',
  '@': 'at',
  '|': 'bar',
};

/** Readable suffix used in terminal-replacement variable names (T_a, T_plus, …). */
export function terminalNameSuffix(terminal) {
  if (/^[A-Za-z0-9]+$/.test(terminal)) return terminal;
  if (TERMINAL_NAMES[terminal]) return TERMINAL_NAMES[terminal];
  const cleaned = terminal.replace(/[^A-Za-z0-9]/g, '');
  if (cleaned) return cleaned;
  return `u${[...terminal].map((c) => c.codePointAt(0).toString(16)).join('')}`;
}

/**
 * Create a generator of fresh symbol names that never collide with names in
 * `taken` (a Set, which is updated as names are handed out).
 */
export function createNameFactory(taken) {
  const used = taken instanceof Set ? taken : new Set(taken);
  return {
    used,
    /** Use `preferred` if free, otherwise `preferred'`, `preferred''`, … */
    fresh(preferred) {
      let name = preferred;
      while (used.has(name)) name += "'";
      used.add(name);
      return name;
    },
    /** Next free name of the form base₁, base₂, … (counter shared per base). */
    indexed(base, counters = this._counters) {
      let i = (counters.get(base) ?? 0) + 1;
      let name = `${base}${toSubscript(i)}`;
      while (used.has(name)) {
        i += 1;
        name = `${base}${toSubscript(i)}`;
      }
      counters.set(base, i);
      used.add(name);
      return name;
    },
    _counters: new Map(),
  };
}
