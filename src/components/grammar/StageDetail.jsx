import { useMemo, useState } from 'react';
import { ArrowRight, Columns2, FileDiff, Lightbulb, ListChecks, Minus, Plus, Repeat2, Sparkles, Trash2 } from 'lucide-react';
import { productionKey } from '../../algorithms/grammar.js';
import { productionStatuses, reasonIndex, removalReasonIndex } from '../../algorithms/stageResult.js';
import { Badge, Tabs, cx } from '../ui/primitives.jsx';
import { GrammarView, RhsText, StatusLegend, SymbolText } from './GrammarView.jsx';
import { ValidationReport } from './ValidationReport.jsx';

function ProductionLine({ production, grammar, introduced }) {
  return (
    <span className="grammar-font inline-flex flex-wrap items-baseline gap-1.5">
      <SymbolText symbol={production.lhs} isVariable introduced={introduced?.has(production.lhs)} />
      <span className="text-subtle">→</span>
      <RhsText rhs={production.rhs} grammar={grammar} introduced={introduced} />
    </span>
  );
}

function SetChips({ items, tone = 'accent', empty = '∅' }) {
  if (!items?.length) return <span className="font-mono text-sm text-muted">{empty}</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <Badge key={s} tone={tone} className="font-mono text-xs">
          {s}
        </Badge>
      ))}
    </span>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[11rem_1fr] sm:items-start">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted sm:pt-1">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** Stage-specific computed data (nullable set, closures, mapping, …). */
export function StageFacts({ stage }) {
  const d = stage.details ?? {};
  switch (stage.id) {
    case 'start':
      return (
        <dl className="space-y-3">
          <DetailRow label="Start on RHS?">
            {d.needed ? (
              <span className="text-sm text-fg">
                Yes — in {d.occurrences.length} rule{d.occurrences.length === 1 ? '' : 's'}
              </span>
            ) : (
              <span className="text-sm text-fg">No — augmentation not required</span>
            )}
          </DetailRow>
          {d.needed && (
            <DetailRow label="New start symbol">
              <SetChips items={[d.newStart]} tone="violet" />
            </DetailRow>
          )}
        </dl>
      );
    case 'epsilon':
      return (
        <dl className="space-y-3">
          {d.rounds?.length > 0 && (
            <DetailRow label="Fixed-point rounds">
              <ol className="space-y-1.5">
                {d.rounds.map((round, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-xs font-semibold text-subtle">Round {i + 1}</span>
                    <SetChips items={round} tone="cyan" />
                  </li>
                ))}
              </ol>
            </DetailRow>
          )}
          <DetailRow label="Nullable set">
            <SetChips items={d.nullable} tone="cyan" />
          </DetailRow>
          <DetailRow label="ε ∈ L(G)?">
            <Badge tone={d.generatesEpsilon ? 'success' : 'neutral'}>{d.generatesEpsilon ? 'Yes — start keeps ε' : 'No'}</Badge>
          </DetailRow>
        </dl>
      );
    case 'unit':
      return (
        <dl className="space-y-3">
          <DetailRow label="Unit pairs (A ⇒* B)">
            {d.unitPairs?.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {d.unitPairs.map((pair) => (
                  <li key={`${pair.from}-${pair.to}`}>
                    <Badge tone="accent" className="font-mono text-xs" title={pair.path.join(' ⇒ ')}>
                      ({pair.from}, {pair.to})
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-sm text-muted">None</span>
            )}
          </DetailRow>
          {d.closures && (
            <DetailRow label="Unit closures">
              <ul className="grid gap-1 sm:grid-cols-2">
                {Object.entries(d.closures)
                  .filter(([, list]) => list.length > 1)
                  .map(([a, list]) => (
                    <li key={a} className="font-mono text-sm text-muted">
                      U(<span className="text-accent">{a}</span>) = {'{ '}
                      {list.join(', ')}
                      {' }'}
                    </li>
                  ))}
              </ul>
            </DetailRow>
          )}
          {d.cycles?.length > 0 && (
            <DetailRow label="Cycles detected">
              <span className="text-sm text-warn">{d.cycles.map(([a, b]) => `${a} ⇔ ${b}`).join(', ')}</span>
            </DetailRow>
          )}
        </dl>
      );
    case 'useless':
      return (
        <dl className="space-y-3">
          <DetailRow label="Generating">
            <SetChips items={d.generating} tone="success" />
          </DetailRow>
          <DetailRow label="Non-generating">
            <SetChips items={d.nonGenerating} tone="danger" empty="none" />
          </DetailRow>
          <DetailRow label="Reachable">
            <SetChips items={d.reachable} tone="success" />
          </DetailRow>
          <DetailRow label="Unreachable">
            <SetChips items={d.unreachable} tone="danger" empty="none" />
          </DetailRow>
        </dl>
      );
    case 'term':
      return (
        <dl className="space-y-3">
          <DetailRow label="Terminal variables">
            {d.mapping?.length ? (
              <ul className="flex flex-wrap gap-2">
                {d.mapping.map((m) => (
                  <li key={m.terminal} className="grammar-font rounded-lg border border-line bg-surface-2/60 px-2.5 py-1">
                    <span className="text-violet">{m.variable}</span> <span className="text-subtle">→</span>{' '}
                    <span className="text-cyan">{m.terminal}</span>
                    {m.reused && <span className="ml-2 text-[11px] text-muted">(reused)</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-sm text-muted">None needed</span>
            )}
          </DetailRow>
        </dl>
      );
    case 'bin':
      return (
        <dl className="space-y-3">
          <DetailRow label="Chains">
            {d.chains?.length ? (
              <ul className="space-y-2">
                {d.chains.map((chain) => (
                  <li key={productionKey(chain.original)} className="flex flex-wrap items-center gap-2 text-sm">
                    <ProductionLine production={chain.original} grammar={stage.before} />
                    <ArrowRight className="h-3.5 w-3.5 text-warn" aria-label="becomes" />
                    {chain.rules.map((r, i) => (
                      <span key={productionKey(r)} className="inline-flex items-center gap-1">
                        {i > 0 && <span className="text-subtle">,</span>}
                        <ProductionLine
                          production={r}
                          grammar={stage.after}
                          introduced={new Set(stage.introduced.map((v) => v.name))}
                        />
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-sm text-muted">No long productions</span>
            )}
          </DetailRow>
        </dl>
      );
    default:
      return null;
  }
}

function ChangeList({ stage }) {
  const introduced = new Set(stage.introduced.map((v) => v.name));
  const hasAny = stage.added.length + stage.removed.length + stage.modified.length > 0;
  if (!hasAny) {
    return <p className="text-sm text-muted">No productions were added, removed or rewritten in this stage.</p>;
  }
  return (
    <div className="space-y-4">
      {stage.modified.length > 0 && (
        <section>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warn">
            <Repeat2 className="h-3.5 w-3.5" aria-hidden="true" /> Rewritten ({stage.modified.length})
          </h4>
          <ul className="space-y-2">
            {stage.modified.map((m) => (
              <li key={productionKey(m.from)} className="rounded-xl border border-warn/25 bg-warn/5 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="line-through decoration-danger/60 opacity-75">
                    <ProductionLine production={m.from} grammar={stage.before} />
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-warn" aria-label="becomes" />
                  <ProductionLine production={m.to} grammar={stage.after} introduced={introduced} />
                </div>
                <p className="mt-1 text-xs text-muted">{m.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {stage.added.length > 0 && (
        <section>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-success">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Added ({stage.added.length})
          </h4>
          <ul className="space-y-1.5">
            {stage.added.map((a) => (
              <li key={productionKey(a.production)} className="rounded-xl border border-success/25 bg-success/5 px-3 py-2">
                <ProductionLine production={a.production} grammar={stage.after} introduced={introduced} />
                <p className="mt-0.5 text-xs text-muted">{a.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {stage.removed.length > 0 && (
        <section>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-danger">
            <Minus className="h-3.5 w-3.5" aria-hidden="true" /> Removed ({stage.removed.length})
          </h4>
          <ul className="space-y-1.5">
            {stage.removed.map((r) => (
              <li key={productionKey(r.production)} className="rounded-xl border border-danger/25 bg-danger/5 px-3 py-2">
                <span className="line-through decoration-danger/60">
                  <ProductionLine production={r.production} grammar={stage.before} />
                </span>
                <p className="mt-0.5 text-xs text-muted">{r.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Before/after grammars with change highlighting. */
export function StageComparison({ stage, layout = 'split' }) {
  const statuses = useMemo(() => productionStatuses(stage), [stage]);
  const reasons = useMemo(() => reasonIndex(stage), [stage]);
  const removalReasons = useMemo(() => removalReasonIndex(stage), [stage]);
  const introduced = useMemo(() => new Set(stage.introduced.map((v) => v.name)), [stage]);
  const removedProductions = useMemo(
    () => [...stage.removed.map((r) => r.production), ...stage.modified.map((m) => m.from)],
    [stage],
  );
  const mergedStatuses = useMemo(() => {
    const map = new Map(statuses.after);
    for (const p of removedProductions) map.set(productionKey(p), 'removed');
    return map;
  }, [statuses, removedProductions]);
  const mergedReasons = useMemo(() => new Map([...reasons, ...removalReasons]), [reasons, removalReasons]);

  if (layout === 'diff') {
    return (
      <div className="rounded-xl border border-line bg-canvas/40 p-3 sm:p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Unified view (after, with removed rules struck through)</p>
        <GrammarView
          grammar={stage.after}
          statuses={mergedStatuses}
          reasons={mergedReasons}
          extra={removedProductions}
          introduced={introduced}
          emptyText="The grammar has no productions."
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="min-w-0 rounded-xl border border-line bg-canvas/40 p-3 sm:p-4">
        <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
          <span>Before</span>
          <span className="font-mono normal-case tracking-normal text-subtle">{stage.before.productions.length} rules</span>
        </p>
        <GrammarView grammar={stage.before} statuses={statuses.before} reasons={removalReasons} emptyText="No productions." />
      </div>
      <div className="min-w-0 rounded-xl border border-accent/25 bg-accent/[0.03] p-3 sm:p-4">
        <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-accent">
          <span>After</span>
          <span className="font-mono normal-case tracking-normal text-subtle">{stage.after.productions.length} rules</span>
        </p>
        <GrammarView
          grammar={stage.after}
          statuses={statuses.after}
          reasons={reasons}
          introduced={introduced}
          emptyText="The grammar has no productions (empty language)."
        />
      </div>
    </div>
  );
}

/** Full explanation panel for one pipeline stage. */
export function StageDetail({ stage, compact = false }) {
  const [view, setView] = useState('split');
  const [tab, setTab] = useState('changes');
  const isValidation = stage.id === 'validate';

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-accent/20 bg-gradient-to-br from-accent/[0.06] to-violet/[0.04] p-4">
        <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
          <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" /> Theory
        </p>
        <p className="text-sm leading-relaxed text-fg/90">{stage.theory}</p>
      </div>

      <div
        className={cx(
          'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
          stage.applied || isValidation ? 'border-line bg-surface-2/50 text-fg' : 'border-line border-dashed text-muted',
        )}
      >
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet" aria-hidden="true" />
        <p>
          <span className="font-semibold">Transformation: </span>
          {stage.summary}
        </p>
      </div>

      {stage.warnings.length > 0 && (
        <ul className="space-y-1.5">
          {stage.warnings.map((w) => (
            <li key={w} className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-2.5 text-sm text-warn">
              ⚠ {w}
            </li>
          ))}
        </ul>
      )}

      {isValidation ? (
        <ValidationReport validation={stage.details.validation} grammar={stage.after} />
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusLegend />
              <Tabs
                size="sm"
                label={`compare-${stage.id}${compact ? '-c' : ''}`}
                value={view}
                onChange={setView}
                tabs={[
                  { value: 'split', label: 'Side by side', icon: Columns2 },
                  { value: 'diff', label: 'Unified', icon: FileDiff },
                ]}
              />
            </div>
            <StageComparison stage={stage} layout={view} />
          </div>

          <div className="space-y-3">
            <Tabs
              size="sm"
              label={`detail-${stage.id}${compact ? '-c' : ''}`}
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'changes', label: 'Rule changes', icon: FileDiff },
                { value: 'steps', label: 'Step log', icon: ListChecks },
                { value: 'facts', label: 'Computed sets', icon: Sparkles },
              ]}
            />
            <div className="rounded-xl border border-line p-4">
              {tab === 'changes' && <ChangeList stage={stage} />}
              {tab === 'steps' && (
                <ol className="space-y-2">
                  {stage.steps.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">
                        {i + 1}
                      </span>
                      <span className="text-fg/90">{s}</span>
                    </li>
                  ))}
                </ol>
              )}
              {tab === 'facts' && <StageFacts stage={stage} />}
            </div>
          </div>

          {(stage.introduced.length > 0 || stage.removedVariables.length > 0) && (
            <div className="grid gap-3 md:grid-cols-2">
              {stage.introduced.length > 0 && (
                <div className="rounded-xl border border-violet/30 bg-violet/5 p-4">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet">
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New variables
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {stage.introduced.map((v) => (
                      <li key={v.name}>
                        <span className="font-mono font-semibold text-violet">{v.name}</span>{' '}
                        <span className="text-muted">— {v.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {stage.removedVariables.length > 0 && (
                <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-danger">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Removed variables
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {stage.removedVariables.map((v) => (
                      <li key={v.name}>
                        <span className="font-mono font-semibold text-danger">{v.name}</span>{' '}
                        <span className="text-muted">— {v.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
