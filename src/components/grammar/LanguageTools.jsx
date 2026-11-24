import { useMemo, useState } from 'react';
import { CheckCircle2, FlaskConical, Play, Scale, XCircle } from 'lucide-react';
import { compareLanguages, cyk, enumerateLanguage, tokenizeInput, wordToString } from '../../engine/languageCheck.js';
import { Badge, Button, cx } from '../ui/primitives.jsx';

/**
 * CYK membership test on the final CNF grammar, cross-checked against the
 * original grammar by bounded enumeration.
 */
export function CykTester({ cnf, original }) {
  const [input, setInput] = useState('');
  const [run, setRun] = useState(null);

  const execute = (e) => {
    e?.preventDefault();
    // Tokenise against the original alphabet (a superset of the CNF alphabet).
    const tokenized = tokenizeInput(input, original);
    if (!tokenized.ok) {
      setRun({ error: tokenized.error });
      return;
    }
    if (tokenized.tokens.length > 30) {
      setRun({ error: 'Please test strings of at most 30 symbols.' });
      return;
    }
    const result = cyk(cnf, tokenized.tokens);
    let originalAccepts = null;
    if (tokenized.tokens.length <= 8) {
      try {
        const lang = enumerateLanguage(original, tokenized.tokens.length);
        originalAccepts = lang.has(tokenized.tokens.join('\u0001'));
      } catch {
        originalAccepts = null;
      }
    }
    setRun({ ...result, originalAccepts });
  };

  const n = run?.tokens?.length ?? 0;
  return (
    <div className="space-y-4">
      <form onSubmit={execute} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="cyk-input" className="sr-only">
          String to test
        </label>
        <input
          id="cyk-input"
          className="input font-mono"
          placeholder={`e.g. ${cnf.terminals.slice(0, 3).join('') || 'ab'} (empty = ε)`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="submit" variant="primary" icon={Play}>
          Run CYK
        </Button>
      </form>
      {run?.error && <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">{run.error}</p>}
      {run && !run.error && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {run.accepted ? (
              <Badge tone="success" icon={CheckCircle2} className="px-3 py-1 text-xs">
                Accepted — “{n ? run.tokens.join(' ') : 'ε'}” ∈ L(CNF)
              </Badge>
            ) : (
              <Badge tone="danger" icon={XCircle} className="px-3 py-1 text-xs">
                Rejected — “{n ? run.tokens.join(' ') : 'ε'}” ∉ L(CNF)
              </Badge>
            )}
            {run.originalAccepts !== null && (
              <span className={cx('text-xs', run.originalAccepts === run.accepted ? 'text-success' : 'text-danger')}>
                Original grammar {run.originalAccepts ? 'also generates' : 'also does not generate'} this string
                {run.originalAccepts !== run.accepted && ' — MISMATCH'} (checked by enumeration).
              </span>
            )}
          </div>
          {n > 0 && (
            <div className="scroll-panel rounded-xl border border-line">
              <table className="min-w-full border-collapse text-center text-xs" aria-label="CYK table">
                <tbody>
                  {[...run.table].reverse().map((row, ri) => {
                    const len = n - ri;
                    return (
                      <tr key={len}>
                        <th scope="row" className="whitespace-nowrap border-b border-r border-line bg-surface-2 px-2 py-1.5 font-mono text-[11px] text-muted">
                          len {len}
                        </th>
                        {Array.from({ length: n }, (_, i) => {
                          const cell = row[i];
                          if (cell === undefined) return <td key={i} className="border-b border-line/40" />;
                          const isTop = len === n && i === 0;
                          return (
                            <td
                              key={i}
                              className={cx(
                                'min-w-[4.5rem] border-b border-r border-line/60 px-2 py-1.5 font-mono',
                                cell.length ? 'text-accent' : 'text-subtle',
                                isTop && (run.accepted ? 'bg-success/15' : 'bg-danger/10'),
                              )}
                            >
                              {cell.length ? cell.join(', ') : '∅'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr>
                    <th scope="row" className="bg-surface-2 px-2 py-1.5 text-[11px] text-muted">
                      input
                    </th>
                    {run.tokens.map((t, i) => (
                      <td key={i} className="bg-surface-2 px-2 py-1.5 font-mono font-semibold text-cyan">
                        {t}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted">
            Cell (len, i) lists the variables that derive the substring of length len starting at position i. The string is
            accepted when the top cell contains the start symbol <span className="font-mono text-accent">{cnf.start}</span>.
          </p>
        </div>
      )}
    </div>
  );
}

/** Bounded comparison of the languages of the original grammar and the CNF. */
export function LanguageCheck({ original, cnf }) {
  const [bound, setBound] = useState(6);
  const [state, setState] = useState(null);

  const run = () => {
    try {
      const t0 = performance.now();
      const cmp = compareLanguages(original, cnf, bound);
      setState({ ...cmp, ms: Math.round(performance.now() - t0) });
    } catch (error) {
      setState({ error: error.message });
    }
  };

  const preview = useMemo(() => state?.words?.slice(0, 40) ?? [], [state]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="bound" className="label">
            Max string length
          </label>
          <select id="bound" className="input w-32" value={bound} onChange={(e) => setBound(Number(e.target.value))}>
            {[3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                ≤ {n}
              </option>
            ))}
          </select>
        </div>
        <Button variant="primary" icon={Scale} onClick={run}>
          Compare languages
        </Button>
      </div>
      {state?.error && <p className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-2.5 text-sm text-warn">{state.error}</p>}
      {state && !state.error && (
        <div className="space-y-3">
          <div
            className={cx(
              'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
              state.equal ? 'border-success/40 bg-success/[0.07]' : 'border-danger/40 bg-danger/[0.07]',
            )}
          >
            {state.equal ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
            )}
            <p className="text-fg">
              {state.equal
                ? `Both grammars generate exactly the same ${state.count} string${state.count === 1 ? '' : 's'} of length ≤ ${state.maxLength}.`
                : `The languages differ on strings of length ≤ ${state.maxLength}.`}{' '}
              <span className="text-muted">({state.ms} ms)</span>
            </p>
          </div>
          {!state.equal && (
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="font-semibold text-danger">Only in original:</span>{' '}
                <span className="font-mono">{state.onlyInFirst.join(', ') || '—'}</span>
              </p>
              <p>
                <span className="font-semibold text-danger">Only in CNF:</span>{' '}
                <span className="font-mono">{state.onlyInSecond.join(', ') || '—'}</span>
              </p>
            </div>
          )}
          {preview.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                Strings found{state.words.length > preview.length ? ` (first ${preview.length} of ${state.words.length})` : ''}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {preview.map((w) => (
                  <span key={w} className="rounded-md border border-line bg-surface-2/60 px-1.5 py-0.5 font-mono text-xs text-cyan">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}
          {state.count === 0 && <p className="text-sm text-muted">Neither grammar generates any string up to this length.</p>}
        </div>
      )}
      <p className="flex items-start gap-2 rounded-xl bg-surface-2/50 px-4 py-3 text-xs leading-relaxed text-muted">
        <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        This is a bounded check: it enumerates every string up to the chosen length and compares the two sets. Agreement is
        strong evidence but not a mathematical proof that the languages are equal — equivalence of context-free grammars is
        undecidable in general. The correctness argument rests on each stage being a standard language-preserving
        transformation.
      </p>
    </div>
  );
}

export { wordToString };
