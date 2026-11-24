import { useMemo } from 'react';
import { grammarStatistics } from '../../algorithms/grammarAnalysis.js';
import { fmtProd } from '../../algorithms/format.js';
import { Tooltip, cx } from '../ui/primitives.jsx';

const METRICS = [
  { key: 'nonTerminals', label: 'Variables', tip: 'Non-terminals |V|: symbols that can be rewritten.' },
  { key: 'terminals', label: 'Terminals', tip: 'Terminals |Σ|: the alphabet of the generated strings.' },
  { key: 'productions', label: 'Productions', tip: 'Number of rules A → α (each alternative counts separately).' },
  { key: 'nullable', label: 'Nullable', tip: 'Variables A with A ⇒* ε, found by fixed-point iteration.' },
  { key: 'unitProductions', label: 'Unit rules', tip: 'Rules of the form A → B, a single variable on the right.' },
  { key: 'useless', label: 'Useless', tip: 'Variables that are non-generating or unreachable from the start symbol.' },
];

/** Grammar statistics panel; values are computed by the analysis module. */
export function GrammarStats({ grammar, compare, columns = 3 }) {
  const stats = useMemo(() => grammarStatistics(grammar), [grammar]);
  const other = useMemo(() => (compare ? grammarStatistics(compare) : null), [compare]);
  const value = (s, key) => (Array.isArray(s[key]) ? s[key].length : s[key]);
  const detail = (s, key) => {
    if (key === 'nullable' || key === 'useless') return s[key].length ? s[key].join(', ') : null;
    if (key === 'unitProductions') return s[key].length ? s[key].map(fmtProd).join(', ') : null;
    return null;
  };
  return (
    <dl className={cx('grid gap-2', columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2')}>
      {METRICS.map((m) => {
        const v = value(stats, m.key);
        const d = detail(stats, m.key);
        return (
          <div key={m.key} className="rounded-xl border border-line/70 bg-surface-2/50 px-3 py-2.5">
            <dt className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Tooltip content={m.tip}>
                <span tabIndex={0} className="cursor-help border-b border-dotted border-subtle">
                  {m.label}
                </span>
              </Tooltip>
            </dt>
            <dd className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold tabular-nums text-fg">{v}</span>
              {other && (
                <span className="text-xs text-subtle">
                  → <span className="font-semibold text-accent">{value(other, m.key)}</span>
                </span>
              )}
            </dd>
            {d && !other && <p className="mt-0.5 truncate font-mono text-[11px] text-subtle" title={d}>{d}</p>}
          </div>
        );
      })}
    </dl>
  );
}
