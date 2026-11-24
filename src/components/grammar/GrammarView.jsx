import { AnimatePresence, motion } from 'framer-motion';
import { EPSILON, productionKey } from '../../algorithms/grammar.js';
import { groupProductions } from '../../algorithms/grammarSerializer.js';
import { cx } from '../ui/primitives.jsx';

/**
 * Status colours, used consistently across the application:
 *   added → green, removed → red, modified → amber, unchanged → neutral,
 *   newly introduced variable → violet.
 */
export const STATUS_STYLES = {
  added: 'border-success/40 bg-success/10 ring-1 ring-success/20',
  removed: 'border-danger/40 bg-danger/10 line-through decoration-danger/70 opacity-80',
  modified: 'border-warn/40 bg-warn/10 ring-1 ring-warn/20',
  unchanged: 'border-transparent bg-surface-2/60',
  invalid: 'border-danger/50 bg-danger/10 ring-1 ring-danger/30',
};

export const STATUS_LABELS = {
  added: 'Added',
  removed: 'Removed',
  modified: 'Rewritten',
  unchanged: 'Unchanged',
  introduced: 'New variable',
};

/** Render one grammar symbol with consistent typography. */
export function SymbolText({ symbol, isVariable, introduced, className }) {
  return (
    <span
      className={cx(
        isVariable ? 'font-semibold text-accent' : 'text-cyan',
        introduced && isVariable && 'rounded bg-violet/15 px-0.5 text-violet',
        className,
      )}
    >
      {symbol}
    </span>
  );
}

export function RhsText({ rhs, grammar, introduced }) {
  if (rhs.length === 0) return <span className="italic text-muted">{EPSILON}</span>;
  const nts = new Set(grammar.nonTerminals);
  const spaced = rhs.some((s) => [...s].length > 1);
  return (
    <span className={cx('inline-flex flex-wrap items-baseline', spaced ? 'gap-x-1.5' : 'gap-x-[1px]')}>
      {rhs.map((s, i) => (
        <SymbolText key={i} symbol={s} isVariable={nts.has(s)} introduced={introduced?.has(s)} />
      ))}
    </span>
  );
}

/**
 * Display a grammar as aligned rule lines: A → α₁ | α₂ | …
 *
 * props:
 *   grammar     the grammar to show
 *   statuses    Map(productionKey → 'added' | 'removed' | 'modified' | 'unchanged' | 'invalid')
 *   reasons     Map(productionKey → string) shown as hover tooltip (title)
 *   extra       productions to show as well (e.g. removed rules in the "after" view)
 *   introduced  Set of variable names to highlight in violet
 *   emptyText   message when there are no productions
 */
export function GrammarView({
  grammar,
  statuses,
  reasons,
  extra = [],
  introduced,
  emptyText = 'No productions.',
  className,
  showStart = true,
  dense = false,
}) {
  if (!grammar) return null;
  const merged = extra.length
    ? { ...grammar, productions: [...grammar.productions, ...extra] }
    : grammar;
  const groups = groupProductions(merged);
  // Keep any extra-only LHS groups (e.g. removed variables) at the end.
  const extraLhs = [...new Set(extra.map((p) => p.lhs))].filter((l) => !groups.some((g) => g.lhs === l));
  for (const lhs of extraLhs) groups.push({ lhs, productions: extra.filter((p) => p.lhs === lhs) });

  if (groups.length === 0) {
    return (
      <div className={cx('rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted', className)}>
        {emptyText}
      </div>
    );
  }

  const nts = new Set([...merged.nonTerminals, ...extra.map((p) => p.lhs)]);
  const displayGrammar = { ...merged, nonTerminals: [...nts] };

  return (
    <div className={cx('grammar-font', className)} role="list" aria-label="Production rules">
      <AnimatePresence initial={false}>
        {groups.map(({ lhs, productions }) => (
          <motion.div
            key={lhs}
            layout="position"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="listitem"
            className={cx(
              'grid grid-cols-[minmax(2.5rem,auto)_1.25rem_1fr] items-start gap-x-1.5 border-b border-line/40 last:border-b-0',
              dense ? 'py-1' : 'py-1.5',
            )}
          >
            <span className="flex items-center gap-1 pt-1 text-right">
              <SymbolText symbol={lhs} isVariable introduced={introduced?.has(lhs)} className="ml-auto" />
              {showStart && lhs === grammar.start && (
                <span className="sr-only">(start symbol)</span>
              )}
            </span>
            <span className="pt-1 text-center text-subtle" aria-hidden="true">
              →
            </span>
            <span className="flex flex-wrap items-center gap-1">
              {productions.map((p, i) => {
                const key = productionKey(p);
                const status = statuses?.get(key) ?? 'unchanged';
                const reason = reasons?.get(key);
                return (
                  <span key={key} className="inline-flex items-center gap-1">
                    {i > 0 && (
                      <span className="text-subtle" aria-hidden="true">
                        |
                      </span>
                    )}
                    <span
                      title={reason}
                      className={cx(
                        'inline-flex items-center rounded-md border px-1.5 py-0.5 transition-colors',
                        STATUS_STYLES[status] ?? STATUS_STYLES.unchanged,
                      )}
                    >
                      <RhsText rhs={p.rhs} grammar={displayGrammar} introduced={introduced} />
                      {status !== 'unchanged' && <span className="sr-only"> ({STATUS_LABELS[status] ?? status})</span>}
                    </span>
                  </span>
                );
              })}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Colour legend for highlighted grammars. */
export function StatusLegend({ items = ['added', 'modified', 'removed', 'unchanged', 'introduced'] }) {
  const swatch = {
    added: 'bg-success/30 border-success/60',
    removed: 'bg-danger/30 border-danger/60',
    modified: 'bg-warn/30 border-warn/60',
    unchanged: 'bg-surface-2 border-line',
    introduced: 'bg-violet/30 border-violet/60',
  };
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Colour legend">
      {items.map((item) => (
        <li key={item} className="inline-flex items-center gap-1.5">
          <span className={cx('h-3 w-3 rounded border', swatch[item])} aria-hidden="true" />
          {STATUS_LABELS[item]}
        </li>
      ))}
    </ul>
  );
}

/** G = (V, Σ, R, S) summary line. */
export function GrammarTuple({ grammar }) {
  return (
    <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
      <div className="rounded-lg bg-surface-2/60 px-3 py-2">
        <dt className="font-semibold text-muted">Variables V</dt>
        <dd className="mt-0.5 break-words font-mono text-accent">{`{ ${grammar.nonTerminals.join(', ')} }`}</dd>
      </div>
      <div className="rounded-lg bg-surface-2/60 px-3 py-2">
        <dt className="font-semibold text-muted">Terminals Σ</dt>
        <dd className="mt-0.5 break-words font-mono text-cyan">
          {grammar.terminals.length ? `{ ${grammar.terminals.join(', ')} }` : '∅'}
        </dd>
      </div>
      <div className="rounded-lg bg-surface-2/60 px-3 py-2">
        <dt className="font-semibold text-muted">Start symbol S</dt>
        <dd className="mt-0.5 font-mono text-accent">{grammar.start}</dd>
      </div>
      <div className="rounded-lg bg-surface-2/60 px-3 py-2">
        <dt className="font-semibold text-muted">Productions |R|</dt>
        <dd className="mt-0.5 font-mono text-fg">{grammar.productions.length}</dd>
      </div>
    </dl>
  );
}
