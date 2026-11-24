/**
 * The single conversion pipeline:
 *
 *   INPUT CFG
 *     → 1. start symbol augmentation
 *     → 2. ε-production removal
 *     → 3. unit production removal
 *     → 4. useless symbol removal
 *     → 5. terminal replacement
 *     → 6. binary production conversion
 *     → 7. final CNF validation
 *   OUTPUT CNF
 *
 * Every stage receives the frozen output of the previous one, so the returned
 * result is an immutable history of snapshots that the UI can step through
 * forwards and backwards without re-running anything.
 */
import { augmentStartSymbol } from '../algorithms/augmentStartSymbol.js';
import { removeEpsilonProductions } from '../algorithms/epsilonRemoval.js';
import { removeUnitProductions } from '../algorithms/unitRemoval.js';
import { removeUselessSymbols } from '../algorithms/uselessSymbolRemoval.js';
import { replaceTerminals } from '../algorithms/terminalReplacement.js';
import { convertToBinary } from '../algorithms/binaryConversion.js';
import { validateCnf } from '../algorithms/cnfValidator.js';
import { computeNullable, grammarStatistics } from '../algorithms/grammarAnalysis.js';
import { deepFreeze } from '../algorithms/grammar.js';
import { ConversionError } from '../algorithms/stageResult.js';

export const STAGES = [
  { id: 'start', short: 'START', title: 'Start Symbol Augmentation', run: augmentStartSymbol },
  { id: 'epsilon', short: 'DEL-ε', title: 'ε-Production Removal', run: removeEpsilonProductions },
  { id: 'unit', short: 'UNIT', title: 'Unit Production Removal', run: removeUnitProductions },
  { id: 'useless', short: 'USELESS', title: 'Useless Symbol Removal', run: removeUselessSymbols },
  { id: 'term', short: 'TERM', title: 'Terminal Replacement', run: replaceTerminals },
  { id: 'bin', short: 'BIN', title: 'Binary Production Conversion', run: convertToBinary },
];

export const VALIDATION_STAGE = { id: 'validate', short: 'VALIDATE', title: 'Final CNF Validation' };

export const VALIDATION_THEORY =
  'The final grammar is checked rule by rule against the definition of Chomsky Normal Form: every production must be ' +
  'A → BC (two variables) or A → a (one terminal), with the single exception S₀ → ε for a start symbol that never ' +
  'appears on a right-hand side. The validator also checks for useless symbols and that ε is generated exactly when ' +
  'the original grammar generates ε.';

/**
 * Run the full conversion.
 * @returns {{ ok: true, original, stages, final, validation, generatesEpsilon, statistics, introduced }
 *          | { ok: false, error, stage, original, stages }}
 */
export function convertToCnf(grammar) {
  const original = grammar;
  const generatesEpsilon = computeNullable(grammar).nullable.has(grammar.start);
  const stages = [];
  let current = grammar;
  try {
    STAGES.forEach((def, index) => {
      const result = def.run(current);
      stages.push({ ...result, number: index + 1, short: def.short });
      current = result.after;
    });
  } catch (error) {
    if (error instanceof ConversionError) {
      return deepFreeze({
        ok: false,
        error: error.message,
        stage: error.stage,
        original,
        stages,
      });
    }
    throw error;
  }

  const final = current;
  const validation = validateCnf(final, { expectEpsilon: generatesEpsilon });
  const validationStage = {
    id: VALIDATION_STAGE.id,
    short: VALIDATION_STAGE.short,
    number: STAGES.length + 1,
    title: VALIDATION_STAGE.title,
    theory: VALIDATION_THEORY,
    before: final,
    after: final,
    applied: false,
    summary: validation.summary,
    steps: [
      `Checked ${validation.totalRules} production${validation.totalRules === 1 ? '' : 's'} individually.`,
      ...validation.checks.map((c) => `${c.passed ? '✓' : '✗'} ${c.label}: ${c.detail}`),
    ],
    added: [],
    removed: [],
    modified: [],
    introduced: [],
    removedVariables: [],
    details: { validation },
    warnings: validation.valid ? [] : ['The final grammar did not pass CNF validation.'],
  };

  const introduced = stages.flatMap((s) => s.introduced.map((v) => ({ ...v, stage: s.title })));
  return deepFreeze({
    ok: true,
    original,
    stages: [...stages, validationStage],
    final,
    validation,
    generatesEpsilon,
    introduced,
    statistics: {
      original: grammarStatistics(original),
      final: grammarStatistics(final),
    },
    warnings: stages.flatMap((s) => s.warnings.map((w) => ({ stage: s.title, message: w }))),
  });
}
