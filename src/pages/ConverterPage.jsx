import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCopy,
  Columns3,
  Download,
  FileJson,
  FileText,
  GitBranch,
  MinusCircle,
  PencilRuler,
  RefreshCw,
  Scale,
  ShieldCheck,
  Table2,
  Workflow,
  XCircle,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { serializeGrammar, serializeGrammarAscii } from '../algorithms/grammarSerializer.js';
import { buildJsonReport, buildTextReport } from '../engine/conversionHistory.js';
import { copyText, downloadJSON, downloadText, slugify } from '../utils/files.js';
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, cx } from '../components/ui/primitives.jsx';
import { GrammarTuple, GrammarView } from '../components/grammar/GrammarView.jsx';
import { ValidationReport } from '../components/grammar/ValidationReport.jsx';
import { GrammarStats } from '../components/grammar/GrammarStats.jsx';
import { CykTester, LanguageCheck } from '../components/grammar/LanguageTools.jsx';

function NoConversion() {
  const { navigate, runConversion, parsed, workspace } = useWorkspace();
  return (
    <div>
      <PageHeader eyebrow="CNF Converter" icon={Workflow} title="Run the conversion pipeline" />
      <EmptyState
        icon={Workflow}
        title="No conversion yet"
        description={
          parsed.ok
            ? `Convert “${workspace.name}” to see every stage, the final CNF grammar and a full validation report.`
            : 'The grammar in the editor has errors. Fix them first, then convert.'
        }
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

function PipelineOverview({ result, onOpen }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
      {result.stages.map((stage, i) => {
        const isValidation = stage.id === 'validate';
        const ok = isValidation ? result.validation.valid : true;
        const changes = stage.added.length + stage.removed.length + stage.modified.length;
        return (
          <motion.li key={stage.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <button
              type="button"
              onClick={() => onOpen(i + 1)}
              className={cx(
                'flex h-full w-full flex-col rounded-xl border p-4 text-left transition hover:-translate-y-0.5',
                isValidation
                  ? ok
                    ? 'border-success/40 bg-success/[0.06] hover:border-success/70'
                    : 'border-danger/40 bg-danger/[0.06]'
                  : stage.applied
                    ? 'border-accent/30 bg-accent/[0.05] hover:border-accent/60'
                    : 'border-line border-dashed hover:border-line',
              )}
            >
              <span className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold text-subtle">STAGE {stage.number}</span>
                {isValidation ? (
                  ok ? (
                    <CheckCircle2 className="h-4 w-4 text-success" aria-label="passed" />
                  ) : (
                    <XCircle className="h-4 w-4 text-danger" aria-label="failed" />
                  )
                ) : stage.applied ? (
                  <Badge tone="accent">{changes} change{changes === 1 ? '' : 's'}</Badge>
                ) : (
                  <Badge icon={MinusCircle}>skipped</Badge>
                )}
              </span>
              <span className="mt-2 text-sm font-semibold text-fg">{stage.title}</span>
              <span className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted">{stage.summary}</span>
              <span className="mt-auto pt-3 font-mono text-[11px] text-subtle">
                {stage.after.productions.length} rules · {stage.after.nonTerminals.length} vars
              </span>
            </button>
          </motion.li>
        );
      })}
    </ol>
  );
}

function ComparisonPanel({ result }) {
  const candidates = result.stages.filter((s) => s.id !== 'validate');
  const [stageId, setStageId] = useState(() => (candidates.find((s) => s.id === 'useless') ?? candidates[0]).id);
  const intermediate = candidates.find((s) => s.id === stageId) ?? candidates[0];
  const finalIntroduced = useMemo(() => new Set(result.introduced.map((v) => v.name)), [result]);
  const columns = [
    { title: 'Original CFG', grammar: result.original, tone: 'border-line' },
    { title: null, grammar: intermediate.after, tone: 'border-violet/30' },
    { title: 'Final CNF', grammar: result.final, tone: 'border-success/40', introduced: finalIntroduced },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {columns.map((col, i) => (
        <div key={i} className={cx('min-w-0 rounded-xl border bg-canvas/40 p-3 sm:p-4', col.tone)}>
          <div className="mb-3 flex items-center justify-between gap-2">
            {col.title ? (
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{col.title}</p>
            ) : (
              <>
                <label htmlFor="intermediate" className="text-xs font-semibold uppercase tracking-wider text-violet">
                  After
                </label>
                <select
                  id="intermediate"
                  className="input h-8 w-auto max-w-[13rem] py-0 text-xs"
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
                >
                  {candidates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.number}. {s.title}
                    </option>
                  ))}
                </select>
              </>
            )}
            <span className="font-mono text-[11px] text-subtle">{col.grammar.productions.length} rules</span>
          </div>
          <div className="scroll-panel max-h-[28rem]">
            <GrammarView grammar={col.grammar} introduced={col.introduced} emptyText="No productions (empty language)." />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ConverterPage() {
  const { conversion, isStale, runConversion, navigate, setVisualizerStep, notify, parsed } = useWorkspace();
  if (!conversion) return <NoConversion />;
  const { result, source } = conversion;
  const title = source.name || 'Grammar';

  const openStep = (step) => {
    setVisualizerStep(step);
    navigate('visualizer');
  };

  const staleBanner = isStale && (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-warn/40 bg-warn/[0.08] px-5 py-4 sm:flex-row sm:items-center">
      <AlertTriangle className="h-5 w-5 shrink-0 text-warn" aria-hidden="true" />
      <p className="flex-1 text-sm text-fg">
        The grammar in the editor has changed since this conversion. The results below still describe the grammar you
        converted earlier.
      </p>
      <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => runConversion()} disabled={!parsed.ok}>
        Convert the edited grammar
      </Button>
    </div>
  );

  if (!result.ok) {
    return (
      <div>
        <PageHeader eyebrow="CNF Converter" icon={Workflow} title={title} />
        {staleBanner}
        <Card className="card-pad">
          <CardHeader icon={XCircle} tone="danger" title="This grammar could not be converted" subtitle={`Stage: ${result.stage}`} />
          <p className="mt-4 rounded-xl border border-danger/30 bg-danger/[0.07] px-4 py-3 text-sm text-fg">{result.error}</p>
          <p className="mt-3 text-sm text-muted">
            No partial or incorrect CNF grammar is shown. Adjust the grammar in the editor and try again.
          </p>
          <Button className="mt-4" icon={PencilRuler} onClick={() => navigate('editor')}>
            Back to the editor
          </Button>
        </Card>
      </div>
    );
  }

  const download = (kind) => {
    const base = slugify(title);
    if (kind === 'cnf-txt') downloadText(`${base}-cnf.txt`, `${serializeGrammarAscii(result.final)}\n`);
    if (kind === 'cnf-json')
      downloadJSON(`${base}-cnf.json`, {
        name: `${title} (CNF)`,
        start: result.final.start,
        nonTerminals: result.final.nonTerminals,
        terminals: result.final.terminals,
        productions: result.final.productions,
        text: serializeGrammar(result.final),
      });
    if (kind === 'report-txt') downloadText(`${base}-conversion-report.txt`, buildTextReport(result, { title }));
    if (kind === 'report-json') downloadJSON(`${base}-conversion-report.json`, buildJsonReport(result, { title }));
  };

  const copyFinal = async () => {
    const ok = await copyText(serializeGrammar(result.final));
    notify(ok ? 'CNF grammar copied to clipboard.' : 'Could not access the clipboard.', ok ? 'success' : 'error');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CNF Converter"
        icon={Workflow}
        title={title}
        description={`Converted ${new Date(conversion.ranAt).toLocaleString()}. ${result.original.productions.length} input productions → ${result.final.productions.length} CNF productions, ${result.introduced.length} new variable${result.introduced.length === 1 ? '' : 's'}.`}
        actions={
          <>
            <Button icon={RefreshCw} onClick={() => runConversion()} disabled={!parsed.ok}>
              Re-run
            </Button>
            <Button variant="primary" icon={GitBranch} onClick={() => openStep(1)}>
              Step through
            </Button>
          </>
        }
      />
      {staleBanner}

      {result.warnings.length > 0 && (
        <ul className="space-y-2">
          {result.warnings.map((w) => (
            <li key={w.message} className="flex gap-2 rounded-xl border border-warn/30 bg-warn/[0.08] px-4 py-3 text-sm text-fg">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
              <span>
                <span className="font-semibold">{w.stage}:</span> {w.message}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Card className="card-pad">
        <CardHeader icon={Workflow} title="Conversion pipeline" subtitle="Select a stage to open it in the step visualizer" />
        <div className="mt-5">
          <PipelineOverview result={result} onOpen={openStep} />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="card-pad">
          <CardHeader icon={PencilRuler} tone="cyan" title="Original grammar" subtitle={`ε ∈ L(G): ${result.generatesEpsilon ? 'yes' : 'no'}`} />
          <div className="scroll-panel mt-4 max-h-[26rem] rounded-xl border border-line bg-canvas/40 p-3">
            <GrammarView grammar={result.original} />
          </div>
          <div className="mt-4">
            <GrammarTuple grammar={result.original} />
          </div>
        </Card>
        <Card className="card-pad">
          <CardHeader
            icon={result.validation.valid ? ShieldCheck : XCircle}
            tone={result.validation.valid ? 'success' : 'danger'}
            title="Final CNF grammar"
            subtitle={result.validation.valid ? 'Validated: every rule has the form A → BC or A → a' : 'Validation failed'}
            actions={
              <>
                <Button size="sm" icon={ClipboardCopy} onClick={copyFinal}>
                  Copy
                </Button>
                <Button size="sm" icon={Download} onClick={() => download('cnf-txt')}>
                  TXT
                </Button>
                <Button size="sm" icon={FileJson} onClick={() => download('cnf-json')}>
                  JSON
                </Button>
              </>
            }
          />
          <div className="scroll-panel mt-4 max-h-[26rem] rounded-xl border border-success/30 bg-success/[0.03] p-3">
            <GrammarView
              grammar={result.final}
              introduced={new Set(result.introduced.map((v) => v.name))}
              emptyText="No productions — the original grammar generates the empty language ∅."
            />
          </div>
          <div className="mt-4">
            <GrammarTuple grammar={result.final} />
          </div>
        </Card>
      </div>

      <Card className="card-pad">
        <CardHeader icon={ShieldCheck} tone="success" title="Final CNF validation" subtitle="The validator inspects every production of the final grammar" />
        <div className="mt-5">
          <ValidationReport validation={result.validation} grammar={result.final} />
        </div>
      </Card>

      <Card className="card-pad">
        <CardHeader icon={Columns3} tone="violet" title="Grammar comparison" subtitle="Original, any intermediate stage, and the final CNF side by side" />
        <div className="mt-5">
          <ComparisonPanel result={result} />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="card-pad">
          <CardHeader icon={BarChart3} title="Statistics" subtitle="Original → final CNF" />
          <div className="mt-4">
            <GrammarStats grammar={result.original} compare={result.final} />
          </div>
          {result.introduced.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Variables introduced</p>
              <ul className="flex flex-wrap gap-1.5">
                {result.introduced.map((v) => (
                  <li key={v.name}>
                    <Badge tone="violet" className="font-mono" title={`${v.stage}: ${v.reason}`}>
                      {v.name}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        <Card className="card-pad">
          <CardHeader icon={FileText} tone="cyan" title="Conversion report" subtitle="Every stage, every rule change and the validation results" />
          <ul className="mt-4 space-y-2 text-sm text-muted">
            {result.stages.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <span className="w-5 font-mono text-xs text-subtle">{s.number}.</span>
                <span className="flex-1 truncate text-fg">{s.title}</span>
                <span className="text-xs">{s.id === 'validate' ? (result.validation.valid ? 'passed' : 'failed') : s.applied ? 'applied' : 'skipped'}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" icon={Download} onClick={() => download('report-txt')}>
              Download report (TXT)
            </Button>
            <Button icon={FileJson} onClick={() => download('report-json')}>
              Report (JSON)
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="card-pad">
          <CardHeader icon={Table2} title="CYK membership test" subtitle="Parse a string with the CNF grammar" />
          <div className="mt-4">
            <CykTester cnf={result.final} original={result.original} />
          </div>
        </Card>
        <Card className="card-pad">
          <CardHeader icon={Scale} tone="violet" title="Bounded language check" subtitle="Compare L(original) and L(CNF) on short strings" />
          <div className="mt-4">
            <LanguageCheck original={result.original} cnf={result.final} />
          </div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" iconRight={ArrowRight} onClick={() => openStep(0)}>
          Open the step visualizer
        </Button>
      </div>
    </div>
  );
}
