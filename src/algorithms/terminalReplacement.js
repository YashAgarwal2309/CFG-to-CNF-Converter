/**
 * Stage 5 — Terminal replacement.
 *
 * In CNF a terminal may only appear alone (A → a). For every production whose
 * right-hand side has two or more symbols, each terminal a is replaced by a
 * variable T_a with the single production T_a → a. One T_a is shared by all
 * rules. If the grammar already contains a (non-start) variable whose ONLY
 * production is X → a, that variable is reused instead of creating T_a.
 * Productions consisting of a single terminal are left untouched.
 */
import { allSymbols, createGrammar, nonTerminalSet, productionsByLhs } from './grammar.js';
import { createNameFactory, terminalNameSuffix } from './symbols.js';
import { buildStage } from './stageResult.js';
import { fmtProd, plural } from './format.js';

export const TERM_THEORY =
  'In CNF a terminal may appear only on its own, as in A → a. In every rule whose right-hand side has two or more ' +
  'symbols, each terminal a is replaced by a dedicated variable T_a, and the rule T_a → a is added. A single T_a is ' +
  'shared by all rules, and an existing variable that already derives exactly that terminal is reused. Rules of the ' +
  'form A → a are already in CNF and are left unchanged.';

export function replaceTerminals(grammar) {
  const nts = nonTerminalSet(grammar);
  const base = { id: 'term', title: 'Terminal Replacement', theory: TERM_THEORY, before: grammar };
  const needsWork = grammar.productions.filter((p) => p.rhs.length >= 2 && p.rhs.some((s) => !nts.has(s)));

  if (needsWork.length === 0) {
    return buildStage({
      ...base,
      after: grammar,
      summary: 'Not needed — no terminal appears in a right-hand side of length ≥ 2.',
      steps: ['Every terminal already appears alone (A → a), so no replacement is required.'],
      details: { mapping: [] },
    });
  }

  // Existing variables that derive exactly one terminal and nothing else.
  const reusable = new Map();
  for (const [lhs, prods] of productionsByLhs(grammar)) {
    if (lhs === grammar.start) continue;
    if (prods.length === 1 && prods[0].rhs.length === 1 && !nts.has(prods[0].rhs[0])) {
      const t = prods[0].rhs[0];
      if (!reusable.has(t)) reusable.set(t, lhs);
    }
  }

  const names = createNameFactory(allSymbols(grammar));
  const mapping = new Map(); // terminal -> { variable, reused }
  const introduced = [];
  const added = [];
  const steps = [];

  const variableFor = (terminal) => {
    if (mapping.has(terminal)) return mapping.get(terminal).variable;
    if (reusable.has(terminal)) {
      const variable = reusable.get(terminal);
      mapping.set(terminal, { variable, reused: true });
      steps.push(`Reused existing variable ${variable} for terminal ${terminal}, since ${variable} → ${terminal} is its only rule.`);
      return variable;
    }
    const variable = names.fresh(`T_${terminalNameSuffix(terminal)}`);
    mapping.set(terminal, { variable, reused: false });
    introduced.push({ name: variable, reason: `Stands for terminal ${terminal} (${variable} → ${terminal}).` });
    added.push({
      production: { lhs: variable, rhs: [terminal] },
      reason: `New variable ${variable} derives exactly the terminal ${terminal}.`,
    });
    steps.push(`Introduced ${variable} → ${terminal}.`);
    return variable;
  };

  const modified = [];
  const productions = grammar.productions.map((p) => {
    if (p.rhs.length < 2 || p.rhs.every((s) => nts.has(s))) return p;
    const rhs = p.rhs.map((s) => (nts.has(s) ? s : variableFor(s)));
    const to = { lhs: p.lhs, rhs };
    const replaced = p.rhs.filter((s) => !nts.has(s));
    modified.push({
      from: p,
      to,
      reason: `Terminal${replaced.length > 1 ? 's' : ''} ${[...new Set(replaced)]
        .map((t) => `${t} → ${mapping.get(t).variable}`)
        .join(', ')} replaced so the right-hand side contains only variables.`,
    });
    return to;
  });

  const newRules = added.map((a) => a.production);
  const newVars = introduced.map((i) => i.name);
  const after = createGrammar({
    start: grammar.start,
    nonTerminals: [...grammar.nonTerminals, ...newVars],
    terminals: grammar.terminals,
    productions: [...productions, ...newRules],
  });

  steps.push(
    `Rewrote ${plural(modified.length, 'production')}: ${modified
      .map((m) => `${fmtProd(m.from)} ⟹ ${fmtProd(m.to)}`)
      .join('; ')}.`,
  );

  return buildStage({
    ...base,
    after,
    summary: `Rewrote ${plural(modified.length, 'production')}; introduced ${plural(introduced.length, 'terminal variable')}.`,
    steps,
    added,
    modified,
    introduced,
    details: {
      mapping: [...mapping].map(([terminal, v]) => ({ terminal, variable: v.variable, reused: v.reused })),
    },
  });
}
