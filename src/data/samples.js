/**
 * Sample grammar library. The `expected` block is verified against the real
 * conversion engine by the automated tests (src/__tests__/samples.test.js).
 */
export const SAMPLE_GRAMMARS = [
  {
    id: 'simple-binary',
    name: 'Simple Terminal & Binary Rules',
    difficulty: 'Beginner',
    start: 'S',
    text: 'S -> AB | aB\nA -> a\nB -> b',
    description:
      'An almost-CNF grammar. Only the mixed rule S → aB needs fixing, and the existing variable A (whose only rule is A → a) is reused for the terminal a.',
    concepts: ['Terminal replacement', 'Variable reuse', 'Binary rules'],
    expected: {
      generatesEpsilon: false,
      augmented: false,
      emptyLanguage: false,
      appliedStages: ['term'],
    },
  },
  {
    id: 'epsilon-basic',
    name: 'ε-Productions: a*b*',
    difficulty: 'Beginner',
    start: 'S',
    text: 'S -> AB\nA -> aA | ε\nB -> bB | ε',
    description:
      'Generates every string of a’s followed by b’s, including ε. A and B are nullable, so S → AB expands to S → AB | A | B, and S keeps S → ε.',
    concepts: ['Nullable variables', 'ε-removal', 'Start ε-rule', 'Unit removal'],
    expected: {
      generatesEpsilon: true,
      augmented: false,
      emptyLanguage: false,
      appliedStages: ['epsilon', 'unit', 'term'],
    },
  },
  {
    id: 'expression-units',
    name: 'Arithmetic Expressions (Unit Chains)',
    difficulty: 'Intermediate',
    start: 'E',
    text: 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | a',
    description:
      'The classic expression grammar. The unit chain E → T → F must be collapsed, terminals such as +, * and parentheses are replaced, and long rules are split.',
    concepts: ['Unit productions', 'Unit closure', 'Start augmentation', 'Terminal replacement', 'Binary conversion'],
    expected: {
      generatesEpsilon: false,
      augmented: true,
      emptyLanguage: false,
      appliedStages: ['start', 'unit', 'term', 'bin'],
    },
  },
  {
    id: 'useless-symbols',
    name: 'Useless Symbols',
    difficulty: 'Intermediate',
    start: 'S',
    text: 'S -> aS | A | C\nA -> a\nB -> aa\nC -> aCb',
    description:
      'C can never finish a derivation (non-generating) and B can never be reached from S (unreachable). Both are removed along with every rule that mentions them.',
    concepts: ['Non-generating symbols', 'Unreachable symbols', 'Fixed-point iteration'],
    expected: {
      generatesEpsilon: false,
      augmented: true,
      emptyLanguage: false,
      appliedStages: ['start', 'unit', 'useless', 'term'],
    },
  },
  {
    id: 'long-productions',
    name: 'Long Productions',
    difficulty: 'Beginner',
    start: 'S',
    text: 'S -> ABCD | aCD | BbD\nA -> a\nB -> b\nC -> c\nD -> d',
    description:
      'Right-hand sides of length three and four are broken into chains of binary rules. S → ABCD and S → aCD both end with the suffix CD, so they share one chain variable; the existing variables A and B are reused for the terminals a and b.',
    concepts: ['Binary conversion', 'Fresh variable names', 'Terminal replacement'],
    expected: {
      generatesEpsilon: false,
      augmented: false,
      emptyLanguage: false,
      appliedStages: ['term', 'bin'],
    },
  },
  {
    id: 'multi-nullable',
    name: 'Multiple Nullable Variables',
    difficulty: 'Intermediate',
    start: 'S',
    text: 'S -> ABC | a\nA -> aA | ε\nB -> bB | ε\nC -> c | ε',
    description:
      'Three nullable variables in one rule: S → ABC produces all 2³ − 1 = 7 non-empty combinations (ABC, BC, AC, AB, C, B, A).',
    concepts: ['Nullable fixed point', 'Subset expansion', 'ε ∈ L(G)'],
    expected: {
      generatesEpsilon: true,
      augmented: false,
      emptyLanguage: false,
      appliedStages: ['epsilon', 'unit', 'term', 'bin'],
    },
  },
  {
    id: 'recursive-anbn',
    name: 'Recursive: aⁿbⁿ',
    difficulty: 'Beginner',
    start: 'S',
    text: 'S -> aSb | ε',
    description:
      'The textbook non-regular language { aⁿbⁿ | n ≥ 0 }. S appears on its own right-hand side and is nullable, so a new start symbol S₀ is required to keep ε.',
    concepts: ['Recursion', 'Start augmentation', 'ε ∈ L(G)'],
    expected: {
      generatesEpsilon: true,
      augmented: true,
      emptyLanguage: false,
      appliedStages: ['start', 'epsilon', 'unit', 'term', 'bin'],
    },
  },
  {
    id: 'sipser-example',
    name: 'Everything at Once (Sipser 2.10)',
    difficulty: 'Advanced',
    start: 'S',
    text: 'S -> ASA | aB\nA -> B | S\nB -> b | ε',
    description:
      'The well-known textbook example: S on a right-hand side, nullable variables, unit productions, mixed terminals and long rules — every stage has work to do.',
    concepts: ['Every stage', 'Unit cycles via S', 'Nullable variables', 'Binary conversion'],
    expected: {
      generatesEpsilon: false,
      augmented: true,
      emptyLanguage: false,
      appliedStages: ['start', 'epsilon', 'unit', 'term', 'bin'],
    },
  },
  {
    id: 'unit-cycle',
    name: 'Unit Production Cycle',
    difficulty: 'Intermediate',
    start: 'S',
    text: 'S -> A\nA -> B | a\nB -> C | b\nC -> A | c',
    description:
      'A → B → C → A forms a cycle of unit productions. Breadth-first unit closures terminate and every variable ends up deriving a, b and c directly.',
    concepts: ['Unit cycles', 'Graph search', 'Unit closure'],
    expected: {
      generatesEpsilon: false,
      augmented: false,
      emptyLanguage: false,
      appliedStages: ['unit', 'useless'],
    },
  },
  {
    id: 'palindromes',
    name: 'Palindromes over {a, b}',
    difficulty: 'Intermediate',
    start: 'S',
    text: 'S -> aSa | bSb | a | b | ε',
    description: 'All palindromes, including the empty string. Recursion on both sides of S plus ε.',
    concepts: ['Recursion', 'ε ∈ L(G)', 'Terminal replacement'],
    expected: {
      generatesEpsilon: true,
      augmented: true,
      emptyLanguage: false,
      appliedStages: ['start', 'epsilon', 'unit', 'term', 'bin'],
    },
  },
  {
    id: 'multichar-identifiers',
    name: 'Multi-Character Symbols',
    difficulty: 'Advanced',
    start: 'Expr',
    text: "Expr -> Expr '+' Term | Term\nTerm -> 'id' | '(' Expr ')'",
    description:
      'Variables are whole words (Expr, Term) and the terminal id is quoted, so the tokenizer never splits them into single letters.',
    concepts: ['Tokenizer', 'Multi-character variables', 'Quoted terminals'],
    expected: {
      generatesEpsilon: false,
      augmented: true,
      emptyLanguage: false,
      appliedStages: ['start', 'unit', 'term', 'bin'],
    },
  },
  {
    id: 'empty-language',
    name: 'Empty Language',
    difficulty: 'Edge case',
    start: 'S',
    text: 'S -> AB\nA -> aA\nB -> b',
    description:
      'A can never stop producing a’s, so A — and therefore S — is non-generating. The language is ∅ and the resulting CNF grammar has no productions.',
    concepts: ['Non-generating start symbol', 'L(G) = ∅'],
    expected: {
      generatesEpsilon: false,
      augmented: false,
      emptyLanguage: true,
      appliedStages: ['useless'],
    },
  },
];

export function findSample(id) {
  return SAMPLE_GRAMMARS.find((s) => s.id === id) ?? null;
}
