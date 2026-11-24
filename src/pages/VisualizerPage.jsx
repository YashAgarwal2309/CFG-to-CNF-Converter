import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  ListTree,
  Pause,
  PencilRuler,
  Play,
  RefreshCw,
  RotateCcw,
  Workflow,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { Badge, Button, Card, EmptyState, PageHeader, Tooltip, cx } from '../components/ui/primitives.jsx';
import { GrammarStats } from '../components/grammar/GrammarStats.jsx';
import { GrammarTuple, GrammarView } from '../components/grammar/GrammarView.jsx';
import { StageDetail } from '../components/grammar/StageDetail.jsx';

const PLAY_INTERVAL_MS = 3200;

function ProgressTracker({ stages, step, onSelect }) {
  const items = [{ id: 'input', short: 'INPUT', title: 'Input CFG', applied: true }, ...stages];
  return (
    <nav aria-label="Conversion progress">
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-accent-strong via-cyan to-violet"
          animate={{ width: `${(step / (items.length - 1)) * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
      <ol className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        {items.map((item, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={active ? 'step' : undefined}
                aria-label={`${i === 0 ? 'Input' : `Stage ${i}`}: ${item.title}${item.applied === false ? ' (no change)' : ''}`}
                className={cx(
                  'flex w-full flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center transition',
                  active
                    ? 'border-accent/60 bg-accent/10 shadow-glow'
                    : done
                      ? 'border-line bg-surface-2/60 hover:border-accent/40'
                      : 'border-line/60 hover:border-line hover:bg-surface-2/40',
                )}
              >
                <span
                  className={cx(
                    'grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold',
                    active ? 'bg-accent text-white' : done ? 'bg-success/20 text-success' : 'bg-surface-2 text-subtle',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i}
                </span>
                <span className={cx('text-[10px] font-semibold tracking-wide', active ? 'text-accent' : 'text-muted')}>
                  {item.short}
                </span>
                {item.applied === false && <span className="text-[9px] text-subtle">no change</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function InputStep({ result }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
      <div className="rounded-xl border border-line bg-canvas/40 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Input grammar</p>
        <GrammarView grammar={result.original} />
      </div>
      <div className="space-y-4">
        <GrammarTuple grammar={result.original} />
        <GrammarStats grammar={result.original} columns={2} />
        <p className="rounded-xl border border-accent/20 bg-accent/[0.05] px-4 py-3 text-sm leading-relaxed text-fg/90">
          The grammar {result.generatesEpsilon ? 'generates' : 'does not generate'} the empty string ε, so the final CNF
          grammar {result.generatesEpsilon ? 'must keep exactly one rule S₀ → ε' : 'must contain no ε-rule at all'}. Press{' '}
          <kbd className="kbd">→</kbd> or <span className="font-semibold">Next</span> to apply stage 1.
        </p>
      </div>
    </div>
  );
}

export default function VisualizerPage() {
  const { conversion, visualizerStep: step, setVisualizerStep: setStep, navigate, isStale, runConversion, parsed, workspace } =
    useWorkspace();
  const [playing, setPlaying] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const result = conversion?.result;
  const stages = result?.ok ? result.stages : [];
  const last = stages.length;

  const go = useCallback((n) => setStep(Math.max(0, Math.min(last, n))), [last, setStep]);

  useEffect(() => {
    if (!playing) return undefined;
    if (step >= last) {
      setPlaying(false);
      return undefined;
    }
    const t = setTimeout(() => go(step + 1), PLAY_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [playing, step, last, go]);

  useEffect(() => {
    if (!result?.ok) return undefined;
    const onKey = (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPlaying(false);
        go(step + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPlaying(false);
        go(step - 1);
      } else if (e.key === ' ' && !(t instanceof HTMLButtonElement)) {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'Home') {
        e.preventDefault();
        go(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        go(last);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [result, step, last, go]);

  if (!conversion) {
    return (
      <div>
        <PageHeader eyebrow="Step Visualizer" icon={GitBranch} title="Walk through the conversion" />
        <EmptyState
          icon={GitBranch}
          title="Nothing to visualize yet"
          description={`Convert a grammar first. Every stage is stored as an immutable snapshot, so you can move back and forth freely.`}
          action={
            parsed.ok ? (
              <Button variant="primary" icon={Workflow} onClick={() => runConversion()}>
                Convert “{workspace.name}”
              </Button>
            ) : (
              <Button variant="primary" icon={PencilRuler} onClick={() => navigate('editor')}>
                Open the editor
              </Button>
            )
          }
        />
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div>
        <PageHeader eyebrow="Step Visualizer" icon={GitBranch} title="Conversion failed" description={result.error} />
        <Button icon={Workflow} onClick={() => navigate('converter')}>
          View details
        </Button>
      </div>
    );
  }

  const stage = step === 0 ? null : stages[step - 1];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step Visualizer"
        icon={GitBranch}
        title={conversion.source.name}
        description="Each stage shows the grammar before and after, what changed and why. Snapshots are immutable: moving backwards never re-runs the conversion."
        actions={
          <Button variant={showAll ? 'primary' : 'secondary'} icon={ListTree} onClick={() => setShowAll((v) => !v)} aria-pressed={showAll}>
            {showAll ? 'Back to step mode' : 'View complete conversion'}
          </Button>
        }
      />

      {isStale && (
        <div className="flex flex-col gap-3 rounded-2xl border border-warn/40 bg-warn/[0.08] px-5 py-3 sm:flex-row sm:items-center">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warn" aria-hidden="true" />
          <p className="flex-1 text-sm text-fg">You are viewing the conversion of an earlier version of the grammar.</p>
          <Button size="sm" icon={RefreshCw} onClick={() => runConversion()} disabled={!parsed.ok}>
            Convert current grammar
          </Button>
        </div>
      )}

      {showAll ? (
        <div className="space-y-6">
          <Card className="card-pad">
            <h2 className="mb-4 text-lg font-semibold text-fg">Input grammar</h2>
            <InputStep result={result} />
          </Card>
          {stages.map((s) => (
            <Card key={s.id} className="card-pad">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 font-mono text-sm font-bold text-accent">{s.number}</span>
                <h2 className="text-lg font-semibold text-fg">{s.title}</h2>
                {s.id !== 'validate' && <Badge tone={s.applied ? 'accent' : 'neutral'}>{s.applied ? 'applied' : 'no change'}</Badge>}
              </div>
              <StageDetail stage={s} compact />
            </Card>
          ))}
        </div>
      ) : (
        <>
          <Card className="card-pad sticky top-[4.5rem] z-20 bg-surface/95 backdrop-blur-xl">
            <ProgressTracker
              stages={stages}
              step={step}
              onSelect={(i) => {
                setPlaying(false);
                go(i);
              }}
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Tooltip content="Previous step (←)">
                  <Button icon={ChevronLeft} onClick={() => { setPlaying(false); go(step - 1); }} disabled={step === 0}>
                    Previous
                  </Button>
                </Tooltip>
                <Button
                  variant="primary"
                  icon={playing ? Pause : Play}
                  onClick={() => {
                    if (!playing && step >= last) go(0);
                    setPlaying((p) => !p);
                  }}
                  aria-pressed={playing}
                >
                  {playing ? 'Pause' : 'Play'}
                </Button>
                <Tooltip content="Next step (→)">
                  <Button iconRight={ChevronRight} onClick={() => { setPlaying(false); go(step + 1); }} disabled={step === last}>
                    Next
                  </Button>
                </Tooltip>
                <Tooltip content="Back to the input grammar (Home)">
                  <Button variant="ghost" icon={RotateCcw} onClick={() => { setPlaying(false); go(0); }}>
                    Reset
                  </Button>
                </Tooltip>
              </div>
              <p className="text-sm text-muted" aria-live="polite">
                Step <span className="font-semibold text-fg">{step}</span> of {last}
                {playing && <span className="ml-2 text-accent">· playing</span>}
              </p>
            </div>
          </Card>

          {/* Enter-only transition: keeps working while autoplay runs in a background tab. */}
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22 }}
            >
              <Card className="card-pad">
                <div className="mb-5 flex flex-wrap items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-accent/25 to-violet/20 font-mono text-base font-bold text-accent">
                    {step}
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                      {step === 0 ? 'Starting point' : `Stage ${stage.number} of ${last}`}
                    </p>
                    <h2 className="text-xl font-bold text-fg">{step === 0 ? 'Input Context-Free Grammar' : stage.title}</h2>
                  </div>
                  {stage && stage.id !== 'validate' && (
                    <Badge tone={stage.applied ? 'accent' : 'neutral'} className="ml-auto">
                      {stage.applied ? 'Transformation applied' : 'No change needed'}
                    </Badge>
                  )}
                </div>
                {step === 0 ? <InputStep result={result} /> : <StageDetail stage={stage} />}
              </Card>
            </motion.div>
        </>
      )}
    </div>
  );
}
