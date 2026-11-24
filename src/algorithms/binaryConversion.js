/**
 * Stage 6 — Binary production conversion.
 *
 * Every production A → B₁B₂…Bₙ with n ≥ 3 is split into a chain
 *   A → B₁X₁,  X₁ → B₂X₂,  …,  Xₙ₋₂ → Bₙ₋₁Bₙ
 * using fresh variables. A chain variable is identified by the exact suffix
 * it derives, so identical suffixes (e.g. "CD" in A → BCD and S → ACD) share
 * the same variable. Every Xᵢ derives exactly one sentential form, so sharing
 * does not change the language.
 */
import { allSymbols, createGrammar, rhsKey } from './grammar.js';
import { createNameFactory } from './symbols.js';
import { buildStage } from './stageResult.js';
import { fmtProd, fmtRhs, plural } from './format.js';

export const BIN_THEORY =
  'CNF rules have at most two variables on the right. A long rule A → B₁B₂…Bₙ (n ≥ 3) is broken into a chain of ' +
  'binary rules A → B₁X₁, X₁ → B₂X₂, …, Xₙ₋₂ → Bₙ₋₁Bₙ, where each Xᵢ is a fresh variable that stands for the ' +
  'remaining suffix. Fresh names are checked against every existing symbol, and identical suffixes share one variable.';

export function convertToBinary(grammar) {
  const base = { id: 'bin', title: 'Binary Production Conversion', theory: BIN_THEORY, before: grammar };
  const long = grammar.productions.filter((p) => p.rhs.length >= 3);

  if (long.length === 0) {
    return buildStage({
      ...base,
      after: grammar,
      summary: 'Not needed — no right-hand side has more than two symbols.',
      steps: ['Every right-hand side has at most two symbols.'],
      details: { chains: [] },
    });
  }

  const names = createNameFactory(allSymbols(grammar));
  const suffixVariable = new Map(); // rhsKey(suffix) -> variable
  const introduced = [];
  const added = [];
  const modified = [];
  const chains = [];
  const steps = [];

  const variableForSuffix = (suffix) => {
    const key = rhsKey(suffix);
    if (suffixVariable.has(key)) return { variable: suffixVariable.get(key), reused: true };
    const variable = names.indexed('X');
    suffixVariable.set(key, variable);
    return { variable, reused: false };
  };

  const productions = [];
  for (const p of grammar.productions) {
    if (p.rhs.length < 3) {
      productions.push(p);
      continue;
    }
    const chain = [];
    const head = variableForSuffix(p.rhs.slice(1));
    const first = { lhs: p.lhs, rhs: [p.rhs[0], head.variable] };
    productions.push(first);
    chain.push(first);
    modified.push({
      from: p,
      to: first,
      reason: `${fmtProd(p)} has ${p.rhs.length} symbols; ${head.variable} stands for the suffix ${fmtRhs(p.rhs.slice(1))}.`,
    });

    let current = head;
    let i = 1;
    while (!current.reused) {
      const suffix = p.rhs.slice(i);
      const rest = suffix.slice(1);
      let rhs;
      let next = null;
      if (rest.length === 1) {
        rhs = [suffix[0], rest[0]];
      } else {
        next = variableForSuffix(rest);
        rhs = [suffix[0], next.variable];
      }
      const rule = { lhs: current.variable, rhs };
      productions.push(rule);
      chain.push(rule);
      introduced.push({ name: current.variable, reason: `Derives exactly ${fmtRhs(suffix)} (from ${fmtProd(p)}).` });
      added.push({ production: rule, reason: `Chain rule: ${current.variable} derives the suffix ${fmtRhs(suffix)}.` });
      if (!next) break;
      current = next;
      i += 1;
    }
    if (current.reused) {
      steps.push(`${fmtProd(p)} ⟹ ${chain.map(fmtProd).join(', ')} (reusing ${current.variable} for ${fmtRhs(p.rhs.slice(i))}).`);
    } else {
      steps.push(`${fmtProd(p)} ⟹ ${chain.map(fmtProd).join(', ')}.`);
    }
    chains.push({ original: p, rules: chain });
  }

  const after = createGrammar({
    start: grammar.start,
    nonTerminals: [...grammar.nonTerminals, ...introduced.map((v) => v.name)],
    terminals: grammar.terminals,
    productions,
  });

  return buildStage({
    ...base,
    after,
    summary: `Split ${plural(long.length, 'long production')} using ${plural(introduced.length, 'new variable')}.`,
    steps: [
      `Found ${plural(long.length, 'production')} with three or more symbols on the right.`,
      ...steps,
    ],
    added,
    modified,
    introduced,
    details: { chains },
  });
}
