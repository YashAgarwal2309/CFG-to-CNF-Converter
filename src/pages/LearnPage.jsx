import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GitBranch,
  GraduationCap,
  HelpCircle,
  RotateCcw,
  Trophy,
  XCircle,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { parseGrammarOrThrow } from '../algorithms/grammarParser.js';
import { convertToCnf } from '../engine/conversionPipeline.js';
import { QUIZ_QUESTIONS } from '../data/quiz.js';
import { findSample } from '../data/samples.js';
import { readJSON, STORAGE_KEYS, writeJSON } from '../utils/storage.js';
import { Badge, Button, Card, Disclosure, PageHeader, cx } from '../components/ui/primitives.jsx';
import { GrammarView } from '../components/grammar/GrammarView.jsx';

const SECTIONS = [
  { id: 'cfg', title: 'Context-free grammars' },
  { id: 'symbols', title: 'Terminals & variables' },
  { id: 'cnf', title: 'Chomsky Normal Form' },
  { id: 'why', title: 'Why CNF is useful' },
  { id: 'nullable', title: 'Nullable variables' },
  { id: 'unit', title: 'Unit productions' },
  { id: 'useless', title: 'Useless symbols' },
  { id: 'binary', title: 'Binary productions' },
  { id: 'example', title: 'Worked example' },
  { id: 'faq', title: 'FAQ' },
  { id: 'quiz', title: 'Quiz' },
];

function Formula({ children }) {
  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-line bg-canvas/50 px-4 py-3 font-mono text-sm leading-relaxed text-fg">
      {children}
    </div>
  );
}

function Section({ id, title, eyebrow, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card className="card-pad">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>}
        <h2 className="mb-3 text-xl font-bold text-fg">{title}</h2>
        <div className="space-y-3 text-[15px] leading-relaxed text-muted [&_strong]:text-fg">{children}</div>
      </Card>
    </section>
  );
}

function WorkedExample() {
  const { runConversion, navigate } = useWorkspace();
  const sample = findSample('sipser-example');
  const result = useMemo(() => convertToCnf(parseGrammarOrThrow(sample.text, { start: sample.start })), [sample]);
  return (
    <div className="space-y-4">
      <p>
        We convert Sipser’s Example 2.10. The output below is computed live by the same engine the converter uses — nothing
        is hard-coded.
      </p>
      <div className="rounded-xl border border-line bg-canvas/40 p-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Input</p>
        <GrammarView grammar={result.original} dense />
      </div>
      <ol className="space-y-3">
        {result.stages
          .filter((s) => s.id !== 'validate')
          .map((stage) => (
            <li key={stage.id} className="rounded-xl border border-line p-4">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/15 text-xs text-accent">{stage.number}</span>
                {stage.title}
                {!stage.applied && <Badge>no change</Badge>}
              </p>
              <p className="mt-1.5 text-sm">{stage.summary}</p>
              {stage.applied && (
                <div className="mt-3 rounded-lg bg-canvas/40 p-2">
                  <GrammarView grammar={stage.after} introduced={new Set(stage.introduced.map((v) => v.name))} dense />
                </div>
              )}
            </li>
          ))}
      </ol>
      <p className="flex items-center gap-2 text-sm font-medium text-success">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {result.validation.summary}
      </p>
      <Button
        variant="primary"
        icon={GitBranch}
        onClick={() => {
          if (runConversion({ source: { name: sample.name, text: sample.text, start: sample.start }, silent: true })) navigate('visualizer');
        }}
      >
        Explore this example in the Step Visualizer
      </Button>
    </div>
  );
}

const FAQ = [
  {
    q: 'Does converting to CNF change the language?',
    a: 'No — with one subtlety. Every stage is a standard language-preserving transformation. The only special case is ε: CNF can only produce ε through the rule S₀ → ε, so that rule is kept exactly when the original grammar generates ε.',
  },
  {
    q: 'Why is the CNF grammar so much bigger?',
    a: 'ε-removal can add up to 2ᵏ variants of a rule with k nullable occurrences, unit removal copies productions between variables, and binarisation adds chain variables. Growth is expected; a CNF grammar can be quadratically larger (or worse, when many nullable symbols share one rule).',
  },
  {
    q: 'Is the CNF of a grammar unique?',
    a: 'No. Different orders of the steps, naming choices and sharing of helper variables give different (but equivalent) CNF grammars. This tool uses the order START → DEL → UNIT → USELESS → TERM → BIN.',
  },
  {
    q: 'Why remove ε-productions before unit productions?',
    a: 'ε-removal can create new unit productions (e.g. S → AB with B nullable yields S → A). Removing unit productions afterwards guarantees none survive.',
  },
  {
    q: 'Why is “useless symbol removal” placed after unit removal?',
    a: 'Unit removal can leave variables that are no longer reachable (their only use was in a deleted unit rule). Removing useless symbols afterwards cleans them up, and the later TERM and BIN stages never create useless symbols.',
  },
  {
    q: 'Can the start symbol appear on a right-hand side in CNF?',
    a: 'Yes, as long as the grammar has no S → ε rule. If ε must be kept, a fresh start symbol S₀ that never appears on the right is required.',
  },
  {
    q: 'How do I know the result is correct?',
    a: 'The final grammar is checked rule by rule by an independent validator. On the converter page you can also compare all strings up to a length bound between the original and the CNF grammar, and test strings with the CYK algorithm. A bounded check is evidence, not a proof: equivalence of CFGs is undecidable in general.',
  },
];

function Quiz() {
  const [order] = useState(() => QUIZ_QUESTIONS.map((q) => q.id));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [best, setBest] = useState(() => {
    const v = readJSON(STORAGE_KEYS.quiz, 0, Number.isFinite);
    return v >= 0 && v <= QUIZ_QUESTIONS.length ? v : 0;
  });
  const q = QUIZ_QUESTIONS.find((x) => x.id === order[index]);
  const answered = selected !== null;

  const choose = (i) => {
    if (answered) return;
    setSelected(i);
    if (i === q.answer) setScore((s) => s + 1);
  };

  const next = () => {
    if (index + 1 >= order.length) {
      setDone(true);
      if (score > best) {
        setBest(score);
        writeJSON(STORAGE_KEYS.quiz, score);
      }
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  };

  const restart = () => {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setDone(false);
  };

  if (done) {
    const pct = Math.round((score / order.length) * 100);
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-accent/20 to-violet/20 text-accent">
          <Trophy className="h-8 w-8" aria-hidden="true" />
        </span>
        <p className="mt-4 text-2xl font-bold text-fg">
          {score} / {order.length}
        </p>
        <p className="mt-1 text-sm text-muted">
          {pct >= 85 ? 'Excellent — you are ready for the exam.' : pct >= 60 ? 'Good work. Review the explanations you missed.' : 'Keep practising — revisit the sections above.'}
        </p>
        <p className="mt-1 text-xs text-subtle">Best score in this browser: {Math.max(best, score)}</p>
        <Button className="mt-5" variant="primary" icon={RotateCcw} onClick={restart}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-xs text-muted">
        <span>
          Question {index + 1} of {order.length} · <span className="text-accent">{q.topic}</span>
        </span>
        <span>Score: {score}</span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-gradient-to-r from-accent to-violet transition-all" style={{ width: `${(index / order.length) * 100}%` }} />
      </div>
      <motion.div key={q.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
          <p className="mb-4 text-base font-semibold text-fg" id={`q-${q.id}`}>
            {q.question}
          </p>
          <div role="radiogroup" aria-labelledby={`q-${q.id}`} className="grid gap-2 sm:grid-cols-2">
            {q.options.map((opt, i) => {
              const isCorrect = i === q.answer;
              const isChosen = i === selected;
              return (
                <button
                  key={opt}
                  type="button"
                  role="radio"
                  aria-checked={isChosen}
                  disabled={answered}
                  onClick={() => choose(i)}
                  className={cx(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-left font-mono text-sm transition',
                    !answered && 'border-line hover:border-accent/50 hover:bg-surface-2',
                    answered && isCorrect && 'border-success/60 bg-success/10 text-fg',
                    answered && isChosen && !isCorrect && 'border-danger/60 bg-danger/10 text-fg',
                    answered && !isCorrect && !isChosen && 'border-line opacity-60',
                  )}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-[11px] font-sans font-bold text-muted">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{opt}</span>
                  {answered && isCorrect && <CheckCircle2 className="h-4 w-4 text-success" aria-label="correct answer" />}
                  {answered && isChosen && !isCorrect && <XCircle className="h-4 w-4 text-danger" aria-label="your answer, incorrect" />}
                </button>
              );
            })}
          </div>
          {answered && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cx(
                'mt-4 rounded-xl border px-4 py-3 text-sm',
                selected === q.answer ? 'border-success/30 bg-success/[0.07]' : 'border-danger/30 bg-danger/[0.07]',
              )}
              role="status"
            >
              <p className="font-semibold text-fg">{selected === q.answer ? 'Correct!' : 'Not quite.'}</p>
              <p className="mt-1 text-muted">{q.explanation}</p>
            </motion.div>
          )}
          <div className="mt-5 flex justify-end">
            <Button variant="primary" iconRight={ArrowRight} onClick={next} disabled={!answered}>
              {index + 1 >= order.length ? 'See results' : 'Next question'}
            </Button>
          </div>
      </motion.div>
    </div>
  );
}

export default function LearnPage() {
  const [active, setActive] = useState('cfg');
  const jump = (id) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <div>
      <PageHeader
        eyebrow="Learn CNF"
        icon={BookOpen}
        title="Chomsky Normal Form, explained"
        description="A compact, exam-oriented guide to context-free grammars and every step of the CNF conversion — with a live worked example and a quiz."
      />
      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Guide contents" className="lg:sticky lg:top-24 lg:self-start">
          <ol className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECTIONS.map((s, i) => (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => jump(s.id)}
                  className={cx(
                    'flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm transition',
                    active === s.id ? 'bg-accent/10 font-semibold text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  <span className="font-mono text-[11px] text-subtle">{String(i + 1).padStart(2, '0')}</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-6">
          <Section id="cfg" eyebrow="Foundations" title="What is a context-free grammar?">
            <p>
              A <strong>context-free grammar (CFG)</strong> is a 4-tuple <strong className="font-mono">G = (V, Σ, R, S)</strong>:
              a finite set of variables V, a finite alphabet of terminals Σ (disjoint from V), a finite set of rules R, and a
              start variable S ∈ V. Every rule has the form
            </p>
            <Formula>A → α &nbsp;&nbsp; where A ∈ V and α ∈ (V ∪ Σ)*</Formula>
            <p>
              “Context-free” means a variable can be rewritten regardless of what surrounds it. The language L(G) is the set of
              all terminal strings derivable from S. For example, S → aSb | ε generates {'{'} aⁿbⁿ | n ≥ 0 {'}'}, a language no
              finite automaton can recognise.
            </p>
          </Section>

          <Section id="symbols" title="Terminals and non-terminals">
            <p>
              <strong>Terminals</strong> are the actual characters of the strings in the language (here shown in{' '}
              <span className="font-mono text-cyan">cyan</span>). They can never be rewritten. <strong>Non-terminals</strong>{' '}
              (variables, shown in <span className="font-mono font-semibold text-accent">blue</span>) are placeholders that rules
              rewrite until only terminals remain.
            </p>
            <Formula>
              S ⇒ aSb ⇒ aaSbb ⇒ aabb &nbsp;&nbsp;(S is a variable; a and b are terminals)
            </Formula>
          </Section>

          <Section id="cnf" eyebrow="Definition" title="What is Chomsky Normal Form?">
            <p>A grammar is in <strong>Chomsky Normal Form</strong> if every rule has one of the forms</p>
            <Formula>
              A → BC &nbsp;&nbsp;&nbsp;(B, C variables — neither is the start symbol if S₀ → ε is present)
              <br />A → a &nbsp;&nbsp;&nbsp;&nbsp;(a a terminal)
              <br />S₀ → ε &nbsp;&nbsp;(only for the start symbol, only if ε ∈ L, and S₀ never appears on a right-hand side)
            </Formula>
            <p>
              Every context-free language has a grammar in CNF. The conversion runs six stages:{' '}
              <strong>START → DEL-ε → UNIT → USELESS → TERM → BIN</strong>, followed by validation.
            </p>
          </Section>

          <Section id="why" title="Why is CNF useful?">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Parsing:</strong> the CYK algorithm decides membership in O(n³·|G|) time, but requires CNF.
              </li>
              <li>
                <strong>Proofs:</strong> derivation trees are binary, so a string of length n ≥ 1 always needs exactly 2n − 1
                steps. This is the basis of the pumping lemma for CFLs.
              </li>
              <li>
                <strong>Algorithms:</strong> deciding emptiness or finiteness, and many textbook constructions, become simpler.
              </li>
            </ul>
          </Section>

          <Section id="nullable" eyebrow="Stage 2" title="Nullable variables and ε-removal">
            <p>
              A variable A is <strong>nullable</strong> if A ⇒* ε. We find them all with a fixed-point computation:
            </p>
            <Formula>
              N₀ = {'{'} A | A → ε {'}'}
              <br />
              Nᵢ₊₁ = Nᵢ ∪ {'{'} A | A → X₁…Xₖ with every Xⱼ ∈ Nᵢ {'}'}
              <br />
              stop when Nᵢ₊₁ = Nᵢ
            </Formula>
            <p>
              Each rule is then copied once for every way of leaving out nullable occurrences. With A and B nullable:
            </p>
            <Formula>S → AB &nbsp;⟹&nbsp; S → AB | A | B</Formula>
            <p>All ε-rules are deleted, and S₀ → ε is kept only if the start symbol is nullable.</p>
          </Section>

          <Section id="unit" eyebrow="Stage 3" title="Unit productions">
            <p>
              A <strong>unit production</strong> A → B only renames one variable into another. For each A we compute its{' '}
              <strong>unit closure</strong> — every B reachable through unit rules alone, using graph search so that cycles such
              as A → B → C → A terminate. A then receives every non-unit rule of each B in its closure.
            </p>
            <Formula>
              A → B, &nbsp;B → C, &nbsp;C → c &nbsp;⟹&nbsp; A → c, &nbsp;B → c, &nbsp;C → c
            </Formula>
          </Section>

          <Section id="useless" eyebrow="Stage 4" title="Useless symbols">
            <p>
              A symbol is <strong>useful</strong> if it takes part in some derivation of a terminal string from S. Otherwise it is
              useless, because it is either
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>non-generating</strong>: it can never derive a terminal string (e.g. A → aA only), or
              </li>
              <li>
                <strong>unreachable</strong>: no derivation from S ever produces it.
              </li>
            </ul>
            <p>
              Non-generating symbols must be removed <strong>first</strong>, because deleting their rules can make other symbols
              unreachable.
            </p>
          </Section>

          <Section id="binary" eyebrow="Stages 5 & 6" title="Terminal replacement and binary productions">
            <p>
              In a rule with two or more symbols, every terminal a is replaced by a variable T_a with T_a → a. Then each rule
              longer than two symbols is split into a chain of binary rules with fresh variables:
            </p>
            <Formula>
              A → aBC &nbsp;⟹&nbsp; A → T_a X₁, &nbsp;X₁ → BC, &nbsp;T_a → a
            </Formula>
            <p>A right-hand side of length n becomes n − 1 binary rules.</p>
          </Section>

          <Section id="example" eyebrow="Putting it together" title="Complete worked example">
            <WorkedExample />
          </Section>

          <Section id="faq" title="Frequently asked questions">
            <div className="space-y-2">
              {FAQ.map((f) => (
                <Disclosure key={f.q} title={f.q}>
                  {f.a}
                </Disclosure>
              ))}
            </div>
          </Section>

          <section id="quiz" className="scroll-mt-24">
            <Card className="card-pad">
              <div className="mb-5 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet/15 text-violet">
                  <GraduationCap className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-fg">Test your understanding</h2>
                  <p className="text-sm text-muted">
                    {QUIZ_QUESTIONS.length} questions on CNF forms, ε- and unit productions and the conversion steps.
                  </p>
                </div>
                <HelpCircle className="ml-auto hidden h-5 w-5 text-subtle sm:block" aria-hidden="true" />
              </div>
              <Quiz />
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
