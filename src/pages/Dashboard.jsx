import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  GitBranch,
  GraduationCap,
  History,
  Layers,
  PencilRuler,
  Play,
  ShieldCheck,
  Sparkles,
  Trash2,
  Variable,
  Workflow,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { SAMPLE_GRAMMARS } from '../data/samples.js';
import { parseGrammar } from '../algorithms/grammarParser.js';
import { STAGES } from '../engine/conversionPipeline.js';
import { Badge, Button, Card, CardHeader, EmptyState, StatTile } from '../components/ui/primitives.jsx';
import { GrammarView } from '../components/grammar/GrammarView.jsx';

const DIFFICULTY_TONE = { Beginner: 'success', Intermediate: 'accent', Advanced: 'violet', 'Edge case': 'warn' };

function formatWhen(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return date.toLocaleDateString();
}

function PipelineRibbon() {
  const steps = [{ short: 'CFG', title: 'Input grammar' }, ...STAGES, { short: 'CNF', title: 'Validated output' }];
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
      {steps.map((s, i) => (
        <li key={s.short} className="flex items-center gap-1.5">
          <motion.span
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
            title={s.title}
            className={
              i === 0 || i === steps.length - 1
                ? 'rounded-lg border border-accent/40 bg-accent/15 px-2 py-1 text-accent'
                : 'rounded-lg border border-line bg-surface-2/80 px-2 py-1 text-muted'
            }
          >
            {s.short}
          </motion.span>
          {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-subtle" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

export default function Dashboard() {
  const { navigate, stats, recent, library, loadGrammar, loadSample, runConversion, conversion, clearHistory, workspace } =
    useWorkspace();

  const featured = SAMPLE_GRAMMARS.slice(0, 6);
  const previews = useMemo(
    () =>
      Object.fromEntries(
        featured.map((s) => [s.id, parseGrammar(s.text, { start: s.start }).grammar]),
      ),
    [featured],
  );

  const startNew = () => {
    loadGrammar({ name: 'New grammar', text: '', start: 'S' }, { announce: false });
    navigate('editor');
  };

  const tryInstantly = () => {
    const next = runConversion({ silent: true });
    if (next) navigate('visualizer');
    else navigate('editor');
  };

  const successRate = stats.conversions ? Math.round((stats.validConversions / stats.conversions) * 100) : null;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-line/70 bg-surface px-6 py-10 sm:px-10 sm:py-12">
        <div className="bg-grid absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-violet/15 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <div>
            <Badge tone="accent" icon={Sparkles} className="mb-4">
              Automata Theory · Formal Languages
            </Badge>
            <h1 className="text-3xl font-extrabold leading-tight text-fg sm:text-4xl lg:text-[2.75rem]">
              Transform any context-free grammar into <span className="text-gradient">Chomsky Normal Form</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
              An interactive simulator that runs the real conversion algorithms — nullable fixed points, unit closures,
              useless-symbol elimination, terminal replacement and binarisation — and explains every rule it adds or removes.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="primary" size="lg" icon={PencilRuler} onClick={startNew}>
                Start new conversion
              </Button>
              <Button variant="secondary" size="lg" icon={Play} onClick={tryInstantly}>
                Visualize “{workspace.name.length > 22 ? `${workspace.name.slice(0, 22)}…` : workspace.name}”
              </Button>
            </div>
            <div className="mt-7">
              <PipelineRibbon />
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-canvas/60 p-5 shadow-card backdrop-blur">
            <p className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
              <span>Example: Sipser 2.10</span>
              <span className="text-accent">CFG</span>
            </p>
            <GrammarView grammar={parseGrammar('S -> ASA | aB\nA -> B | S\nB -> b | ε').grammar} dense />
            <div className="my-4 flex items-center gap-2 text-xs text-subtle">
              <span className="h-px flex-1 bg-line" />
              <Workflow className="h-3.5 w-3.5 text-accent" aria-hidden="true" />6 stages
              <span className="h-px flex-1 bg-line" />
            </div>
            <p className="font-mono text-xs leading-relaxed text-muted">
              <span className="text-accent">S₀</span> → <span className="text-accent">A X₁</span> |{' '}
              <span className="text-accent">S A</span> | <span className="text-accent">A S</span> |{' '}
              <span className="text-accent">T_a B</span> | <span className="text-cyan">a</span>
              <br />
              <span className="text-accent">X₁</span> → <span className="text-accent">S A</span> &nbsp;·&nbsp;{' '}
              <span className="text-accent">T_a</span> → <span className="text-cyan">a</span> &nbsp;·&nbsp; …
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-success">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Every result is checked by the CNF validator
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section aria-label="Conversion statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Workflow} label="Conversions run" value={stats.conversions} hint="Stored in this browser" />
        <StatTile
          icon={CheckCircle2}
          tone="success"
          label="Validated CNF"
          value={stats.validConversions}
          hint={successRate === null ? 'No conversions yet' : `${successRate}% passed validation`}
        />
        <StatTile icon={Layers} tone="cyan" label="Rules processed" value={stats.rulesProcessed} hint="Input productions converted" />
        <StatTile
          icon={Variable}
          tone="violet"
          label="Variables introduced"
          value={stats.variablesIntroduced}
          hint={`${library.length} grammar${library.length === 1 ? '' : 's'} saved in library`}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {/* Samples */}
        <Card className="card-pad">
          <CardHeader
            icon={Sparkles}
            tone="violet"
            title="Sample grammars"
            subtitle="Each sample highlights a different conversion challenge."
            actions={
              <Button variant="ghost" size="sm" iconRight={ArrowRight} onClick={() => navigate('library')}>
                All {SAMPLE_GRAMMARS.length} samples
              </Button>
            }
          />
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {featured.map((s, i) => (
              <motion.button
                key={s.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => {
                  loadSample(s.id);
                  navigate('editor');
                }}
                className="group flex flex-col rounded-xl border border-line bg-surface-2/40 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface-2"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-fg">{s.name}</span>
                  <Badge tone={DIFFICULTY_TONE[s.difficulty]}>{s.difficulty}</Badge>
                </span>
                <span className="mt-3 block rounded-lg bg-canvas/50 px-3 py-2">
                  <GrammarView grammar={previews[s.id]} dense />
                </span>
                <span className="mt-3 flex flex-wrap gap-1">
                  {s.concepts.slice(0, 3).map((c) => (
                    <Badge key={c}>{c}</Badge>
                  ))}
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent opacity-80 group-hover:opacity-100">
                  Load into editor <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </span>
              </motion.button>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          {/* Recent */}
          <Card className="card-pad">
            <CardHeader
              icon={History}
              tone="cyan"
              title="Recent grammars"
              subtitle="Your latest conversions"
              actions={
                recent.length > 0 && (
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={clearHistory} aria-label="Clear recent grammars and statistics">
                    Clear
                  </Button>
                )
              }
            />
            <div className="mt-4">
              {recent.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="No conversions yet"
                  description="Convert a grammar and it will appear here for quick access."
                  className="py-8"
                />
              ) : (
                <ul className="space-y-2">
                  {recent.map((r) => (
                    <li key={`${r.at}-${r.name}`}>
                      <button
                        type="button"
                        onClick={() => {
                          loadGrammar(r);
                          navigate('editor');
                        }}
                        className="flex w-full items-center gap-3 rounded-xl border border-line/60 px-3 py-2.5 text-left transition hover:border-accent/40 hover:bg-surface-2/60"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${r.valid ? 'bg-success' : 'bg-danger'}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-fg">{r.name}</span>
                          <span className="block truncate font-mono text-[11px] text-subtle">{r.text.split('\n')[0]}</span>
                        </span>
                        <span className="shrink-0 text-[11px] text-subtle">{formatWhen(r.at)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {/* Learn */}
          <Card className="card-pad">
            <CardHeader icon={GraduationCap} title="Learn the theory" subtitle="Short, exam-oriented explanations" />
            <ul className="mt-4 space-y-2">
              {[
                { label: 'What is Chomsky Normal Form?', icon: BookOpen },
                { label: 'Nullable variables & ε-removal', icon: Sparkles },
                { label: 'Worked example, stage by stage', icon: GitBranch },
                { label: 'Test yourself with the quiz', icon: GraduationCap },
              ].map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => navigate('learn')}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-muted transition hover:bg-surface-2 hover:text-fg"
                  >
                    <item.icon className="h-4 w-4 text-accent" aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            {conversion?.result.ok && (
              <Button variant="secondary" className="mt-4 w-full justify-center" icon={GitBranch} onClick={() => navigate('visualizer')}>
                Resume step visualizer
              </Button>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
