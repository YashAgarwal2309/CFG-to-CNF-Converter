/**
 * Conversion history records and human-readable reports.
 */
import { serializeGrammar, productionToText } from '../algorithms/grammarSerializer.js';
import { EPSILON } from '../algorithms/grammar.js';
import { fmtProd } from '../algorithms/format.js';

/** Compact summary of a conversion, suitable for Local Storage. */
export function summarizeConversion(result) {
  if (!result.ok) {
    return { ok: false, error: result.error, at: new Date().toISOString() };
  }
  return {
    ok: true,
    at: new Date().toISOString(),
    valid: result.validation.valid,
    originalProductions: result.original.productions.length,
    finalProductions: result.final.productions.length,
    finalVariables: result.final.nonTerminals.length,
    introduced: result.introduced.map((v) => v.name),
    appliedStages: result.stages.filter((s) => s.applied).map((s) => s.id),
    generatesEpsilon: result.generatesEpsilon,
  };
}

function indent(text, prefix = '    ') {
  return text
    .split('\n')
    .map((l) => prefix + l)
    .join('\n');
}

/** Full plain-text conversion report (downloadable). */
export function buildTextReport(result, { title = 'Grammar' } = {}) {
  const lines = [];
  const hr = '─'.repeat(72);
  lines.push('CFG → CNF CONVERSION REPORT');
  lines.push(hr);
  lines.push(`Grammar:   ${title}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push('');
  lines.push('ORIGINAL GRAMMAR');
  lines.push(indent(serializeGrammar(result.original) || '(no productions)'));
  lines.push(`    Start symbol: ${result.original.start}`);
  lines.push(`    Variables:    { ${result.original.nonTerminals.join(', ')} }`);
  lines.push(`    Terminals:    { ${result.original.terminals.join(', ')} }`);
  lines.push('');

  if (!result.ok) {
    lines.push(`CONVERSION FAILED: ${result.error}`);
    return lines.join('\n');
  }

  lines.push(`ε ∈ L(G): ${result.generatesEpsilon ? 'yes' : 'no'}`);
  lines.push('');
  for (const stage of result.stages) {
    lines.push(hr);
    lines.push(`STAGE ${stage.number}: ${stage.title.toUpperCase()}${stage.applied || stage.id === 'validate' ? '' : '  (no change)'}`);
    lines.push(hr);
    lines.push(stage.summary);
    lines.push('');
    stage.steps.forEach((s) => lines.push(`  • ${s}`));
    if (stage.introduced.length) {
      lines.push('');
      lines.push('  Variables introduced:');
      stage.introduced.forEach((v) => lines.push(`    + ${v.name}: ${v.reason}`));
    }
    if (stage.removedVariables.length) {
      lines.push('');
      lines.push('  Variables removed:');
      stage.removedVariables.forEach((v) => lines.push(`    - ${v.name}: ${v.reason}`));
    }
    if (stage.modified.length) {
      lines.push('');
      lines.push('  Rules rewritten:');
      stage.modified.forEach((m) => lines.push(`    ~ ${fmtProd(m.from)}  ⟹  ${fmtProd(m.to)}`));
    }
    if (stage.added.length) {
      lines.push('');
      lines.push('  Rules added:');
      stage.added.forEach((a) => lines.push(`    + ${fmtProd(a.production)}   (${a.reason})`));
    }
    if (stage.removed.length) {
      lines.push('');
      lines.push('  Rules removed:');
      stage.removed.forEach((r) => lines.push(`    - ${fmtProd(r.production)}   (${r.reason})`));
    }
    stage.warnings.forEach((w) => lines.push(`  ⚠ ${w}`));
    if (stage.id !== 'validate') {
      lines.push('');
      lines.push('  Grammar after this stage:');
      lines.push(indent(serializeGrammar(stage.after) || '(no productions)', '    '));
    }
    lines.push('');
  }

  lines.push(hr);
  lines.push('FINAL CNF GRAMMAR');
  lines.push(hr);
  lines.push(serializeGrammar(result.final) || '(no productions — the language is empty)');
  lines.push('');
  lines.push('VALIDATION');
  lines.push(`  Result:  ${result.validation.valid ? 'VALID CNF' : 'NOT CNF'}`);
  lines.push(`  Rules:   ${result.validation.validCount} valid / ${result.validation.invalidCount} invalid`);
  result.validation.checks.forEach((c) => lines.push(`  [${c.passed ? '✓' : '✗'}] ${c.label} — ${c.detail}`));
  lines.push('');
  lines.push('  Per-rule results:');
  result.validation.rules.forEach((r) =>
    lines.push(`    ${r.valid ? '✓' : '✗'} ${productionToText(r.production, result.final)}  [${r.form}] ${r.valid ? '' : r.reason}`),
  );
  lines.push('');
  lines.push(
    `Note: structural CNF validation does not by itself prove that L(CNF) = L(original). Each stage is a standard language-preserving transformation; ${EPSILON}-membership is checked explicitly.`,
  );
  return lines.join('\n');
}

/** JSON export of the conversion (all snapshots). */
export function buildJsonReport(result, { title = 'Grammar' } = {}) {
  const g = (grammar) => ({
    start: grammar.start,
    nonTerminals: grammar.nonTerminals,
    terminals: grammar.terminals,
    productions: grammar.productions.map((p) => ({ lhs: p.lhs, rhs: p.rhs })),
    text: serializeGrammar(grammar),
  });
  return {
    title,
    generatedAt: new Date().toISOString(),
    ok: result.ok,
    error: result.ok ? undefined : result.error,
    original: g(result.original),
    generatesEpsilon: result.generatesEpsilon,
    stages: (result.stages ?? []).map((s) => ({
      number: s.number,
      id: s.id,
      title: s.title,
      applied: s.applied,
      summary: s.summary,
      steps: s.steps,
      introduced: s.introduced,
      removedVariables: s.removedVariables,
      added: s.added.map((a) => ({ rule: fmtProd(a.production), reason: a.reason })),
      removed: s.removed.map((r) => ({ rule: fmtProd(r.production), reason: r.reason })),
      modified: s.modified.map((m) => ({ from: fmtProd(m.from), to: fmtProd(m.to), reason: m.reason })),
      after: g(s.after),
    })),
    final: result.ok ? g(result.final) : undefined,
    validation: result.ok
      ? {
          valid: result.validation.valid,
          validCount: result.validation.validCount,
          invalidCount: result.validation.invalidCount,
          checks: result.validation.checks,
          rules: result.validation.rules.map((r) => ({
            rule: fmtProd(r.production),
            valid: r.valid,
            form: r.form,
            reason: r.reason,
          })),
        }
      : undefined,
  };
}
