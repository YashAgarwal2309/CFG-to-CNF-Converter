import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { productionKey } from '../../algorithms/grammar.js';
import { Badge, Tabs, cx } from '../ui/primitives.jsx';
import { RhsText, SymbolText } from './GrammarView.jsx';

/** Detailed CNF validation report: overall result, checks and per-rule table. */
export function ValidationReport({ validation, grammar }) {
  const [filter, setFilter] = useState('all');
  const rows = validation.rules.filter((r) => (filter === 'all' ? true : filter === 'valid' ? r.valid : !r.valid));
  return (
    <div className="space-y-5">
      <div
        className={cx(
          'flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center',
          validation.valid ? 'border-success/40 bg-success/[0.07]' : 'border-danger/40 bg-danger/[0.07]',
        )}
      >
        <span
          className={cx(
            'grid h-14 w-14 shrink-0 place-items-center rounded-2xl',
            validation.valid ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger',
          )}
        >
          {validation.valid ? <ShieldCheck className="h-7 w-7" aria-hidden="true" /> : <ShieldAlert className="h-7 w-7" aria-hidden="true" />}
        </span>
        <div className="flex-1">
          <p className={cx('text-lg font-bold', validation.valid ? 'text-success' : 'text-danger')}>
            {validation.valid ? 'Valid Chomsky Normal Form' : 'Not in Chomsky Normal Form'}
          </p>
          <p className="mt-0.5 text-sm text-muted">{validation.summary}</p>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface/70 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Total</dt>
            <dd className="text-xl font-bold tabular-nums text-fg">{validation.totalRules}</dd>
          </div>
          <div className="rounded-xl bg-surface/70 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Valid</dt>
            <dd className="text-xl font-bold tabular-nums text-success">{validation.validCount}</dd>
          </div>
          <div className="rounded-xl bg-surface/70 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Invalid</dt>
            <dd className={cx('text-xl font-bold tabular-nums', validation.invalidCount ? 'text-danger' : 'text-fg')}>
              {validation.invalidCount}
            </dd>
          </div>
        </dl>
      </div>

      <ul className="grid gap-2 md:grid-cols-2">
        {validation.checks.map((c) => {
          const advisory = !c.passed && c.severity === 'warning';
          return (
            <li
              key={c.id}
              className={cx(
                'flex items-start gap-3 rounded-xl border px-4 py-3',
                c.passed ? 'border-line bg-surface-2/40' : advisory ? 'border-warn/40 bg-warn/[0.06]' : 'border-danger/40 bg-danger/[0.06]',
              )}
            >
              {c.passed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Passed" />
              ) : advisory ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-label="Advisory" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="Failed" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">{c.label}</p>
                <p className="mt-0.5 break-words text-xs text-muted">{c.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {validation.rules.length > 0 && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-fg">Rule-by-rule validation</h4>
            <Tabs
              size="sm"
              label="validation-filter"
              value={filter}
              onChange={setFilter}
              tabs={[
                { value: 'all', label: 'All', count: validation.totalRules },
                { value: 'valid', label: 'Valid', count: validation.validCount },
                { value: 'invalid', label: 'Invalid', count: validation.invalidCount },
              ]}
            />
          </div>
          <div className="scroll-panel max-h-[26rem] rounded-xl border border-line">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="sticky top-0 bg-surface-2 text-left text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Production
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Form
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {rows.map((r) => (
                  <tr key={productionKey(r.production)} className={r.valid ? '' : 'bg-danger/[0.05]'}>
                    <td className="px-4 py-2">
                      {r.valid ? (
                        <Badge tone="success" icon={CheckCircle2}>
                          valid
                        </Badge>
                      ) : (
                        <Badge tone="danger" icon={XCircle}>
                          invalid
                        </Badge>
                      )}
                    </td>
                    <td className="grammar-font whitespace-nowrap px-4 py-2">
                      <SymbolText symbol={r.production.lhs} isVariable /> <span className="text-subtle">→</span>{' '}
                      <RhsText rhs={r.production.rhs} grammar={grammar} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted">{r.form}</td>
                    <td className="px-4 py-2 text-xs text-muted">{r.reason}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted">
                      No rules in this category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
