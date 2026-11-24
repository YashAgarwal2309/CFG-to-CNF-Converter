import { Boxes, Code2, Cpu, FlaskConical, Info, Keyboard, Layers, ShieldCheck, TriangleAlert } from 'lucide-react';
import { STAGES } from '../engine/conversionPipeline.js';
import { SHORTCUTS } from '../components/layout/navigation.js';
import { Badge, Card, CardHeader, PageHeader } from '../components/ui/primitives.jsx';

const ALGORITHMS = [
  { stage: 'Start augmentation', method: 'Scan all right-hand sides; add S₀ → S only when S occurs on one', cost: 'O(|G|)' },
  { stage: 'ε-removal', method: 'Nullable fixed point + expansion over subsets of nullable occurrences', cost: 'O(|G|²) + O(2ᵏ) per rule' },
  { stage: 'Unit removal', method: 'Breadth-first unit closure per variable (cycle safe)', cost: 'O(|V|·|G|)' },
  { stage: 'Useless removal', method: 'Generating fixed point, then BFS reachability from S', cost: 'O(|V|·|G|)' },
  { stage: 'Terminal replacement', method: 'One shared T_a per terminal; reuse of an existing X with X → a as its only rule', cost: 'O(|G|)' },
  { stage: 'Binary conversion', method: 'Right-linear chains; identical suffixes share a chain variable', cost: 'O(|G|)' },
  { stage: 'Validation', method: 'Per-rule form check + generating/reachable analysis + ε-membership check', cost: 'O(|V|·|G|)' },
];

const STACK = [
  ['React 18', 'Component-based UI'],
  ['Vite 5', 'Development server and production build'],
  ['Tailwind CSS 3', 'Design tokens, dark and light themes'],
  ['Framer Motion', 'Page, stage and list animations'],
  ['Lucide React', 'Icon set'],
  ['Vitest + Testing Library', 'Algorithm, pipeline and UI tests'],
];

const STRUCTURE = `src/
├── algorithms/   parser, serializer, six stages, analysis, validator
├── engine/       conversion pipeline, history & reports, language checks (CYK)
├── data/         sample grammars and quiz bank
├── context/      workspace state, persistence and routing
├── components/   layout shell, UI primitives, grammar views
├── pages/        Dashboard, Editor, Converter, Visualizer, Library, Learn, About
├── utils/        Local Storage, import/export and editor helpers
└── __tests__/    Vitest suites`;

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="About Project"
        icon={Info}
        title="CFG to CNF Converter"
        description="An interactive grammar transformation simulator built for a university course in Automata Theory and Formal Languages. Every result is produced by real conversion algorithms, explained step by step and verified by an independent validator."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="card-pad lg:col-span-2">
          <CardHeader icon={Layers} title="Project objective" />
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
            <p>
              Converting a context-free grammar to Chomsky Normal Form is a standard but error-prone exercise. This application
              performs the conversion faithfully and makes each transformation visible: which variables are nullable, which unit
              pairs exist, which symbols are useless, which rules were added, removed or rewritten — and why.
            </p>
            <p>The pipeline always runs in the same, mathematically sound order:</p>
            <ol className="flex flex-wrap gap-2">
              {STAGES.map((s, i) => (
                <li key={s.id}>
                  <Badge tone="accent" className="font-mono">
                    {i + 1}. {s.short}
                  </Badge>
                </li>
              ))}
              <li>
                <Badge tone="success" className="font-mono">
                  7. VALIDATE
                </Badge>
              </li>
            </ol>
          </div>
        </Card>
        <Card className="card-pad">
          <CardHeader icon={ShieldCheck} tone="success" title="Correctness measures" />
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>• Every stage returns an immutable, deeply frozen snapshot</li>
            <li>• Every added or removed rule carries a recorded reason</li>
            <li>• Fresh names never collide with existing symbols</li>
            <li>• An independent validator checks the final grammar rule by rule</li>
            <li>• ε-membership of the result is checked against the original</li>
            <li>• Tests compare languages on all strings up to a length bound, including 150 random grammars</li>
          </ul>
        </Card>
      </div>

      <Card className="card-pad">
        <CardHeader icon={Cpu} tone="cyan" title="Algorithms implemented" subtitle="k = nullable occurrences in one rule, |G| = total size of the grammar" />
        <div className="scroll-panel mt-4 rounded-xl border border-line">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5">Stage</th>
                <th scope="col" className="px-4 py-2.5">Method</th>
                <th scope="col" className="px-4 py-2.5">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {ALGORITHMS.map((a) => (
                <tr key={a.stage}>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-fg">{a.stage}</td>
                  <td className="px-4 py-2.5 text-muted">{a.method}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-accent">{a.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="card-pad">
          <CardHeader icon={Code2} tone="violet" title="Technology stack" />
          <ul className="mt-4 divide-y divide-line/60">
            {STACK.map(([name, role]) => (
              <li key={name} className="flex items-center justify-between gap-4 py-2 text-sm">
                <span className="font-medium text-fg">{name}</span>
                <span className="text-right text-muted">{role}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-subtle">
            Fully client-side: no backend, accounts or external APIs. Saved grammars live in your browser’s Local Storage.
          </p>
        </Card>
        <Card className="card-pad">
          <CardHeader icon={Boxes} title="Architecture" subtitle="The conversion engine is independent of the UI" />
          <pre className="scroll-panel mt-4 rounded-xl border border-line bg-canvas/50 p-4 font-mono text-xs leading-relaxed text-muted">{STRUCTURE}</pre>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="card-pad">
          <CardHeader icon={Keyboard} title="Keyboard shortcuts" />
          <ul className="mt-4 divide-y divide-line/60">
            {SHORTCUTS.map((s) => (
              <li key={s.description} className="flex items-center justify-between gap-4 py-2 text-sm">
                <span className="text-muted">{s.description}</span>
                <span className="flex shrink-0 gap-1">
                  {s.keys.map((k) => (
                    <kbd key={k} className="kbd">
                      {k}
                    </kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="card-pad">
          <CardHeader icon={TriangleAlert} tone="warn" title="Known limitations" />
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>
              • Language preservation is guaranteed by the construction, and tested by bounded string enumeration. A bounded
              comparison is not a proof — CFG equivalence is undecidable in general.
            </li>
            <li>• A single rule with more than 16 nullable occurrences is rejected to avoid an exponential blow-up.</li>
            <li>• Conversions producing more than 20,000 rules are stopped with an explanation.</li>
            <li>• CYK testing is limited to strings of 30 symbols; the cross-check against the original grammar to 8.</li>
            <li>• Data is stored per browser; clearing site data removes saved grammars (export them to keep a copy).</li>
          </ul>
          <p className="mt-4 flex items-center gap-2 text-xs text-subtle">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" /> Run <code className="font-mono">npm test</code> to execute
            the automated test suite.
          </p>
        </Card>
      </div>
    </div>
  );
}
