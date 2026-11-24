import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCopy,
  Eraser,
  Eye,
  FileJson,
  FileText,
  ListPlus,
  PencilRuler,
  Plus,
  Rows3,
  Save,
  ListChecks,
  ShieldCheck,
  TextCursorInput,
  Trash2,
  Upload,
  Workflow,
  XCircle,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { SAMPLE_GRAMMARS } from '../data/samples.js';
import { serializeGrammar } from '../algorithms/grammarSerializer.js';
import { addRow, removeRow, textToRows, updateRow } from '../utils/editorLines.js';
import {
  copyText,
  downloadJSON,
  downloadText,
  parseImportedFile,
  readFileAsText,
  slugify,
  sourceToTxt,
} from '../utils/files.js';
import { Badge, Button, Card, CardHeader, ConfirmDialog, Field, Modal, PageHeader, Tabs, cx } from '../components/ui/primitives.jsx';
import { GrammarTuple, GrammarView } from '../components/grammar/GrammarView.jsx';
import { GrammarStats } from '../components/grammar/GrammarStats.jsx';
import { CnfCheckDialog } from '../components/grammar/CnfCheckDialog.jsx';

function RuleRows({ text, onChange, errorLines }) {
  const rows = useMemo(() => textToRows(text), [text]);
  const rhsRefs = useRef([]);

  const insertEpsilon = (index, row) => {
    const rhs = row.rhs.trim() ? `${row.rhs.replace(/\s*\|?\s*$/, '')} | ε` : 'ε';
    onChange(updateRow(text, index, { ...row, rhs }));
  };

  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[2rem_8rem_1.5rem_1fr_auto] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-subtle sm:grid">
        <span>#</span>
        <span>Variable</span>
        <span />
        <span>Alternatives (separate with |)</span>
        <span className="w-[4.75rem]" />
      </div>
      <AnimatePresence initial={false}>
        {rows.map((row, index) => {
          const hasError = errorLines.has(index + 1);
          return (
            <motion.div
              key={index}
              layout="position"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className={cx(
                'grid grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-xl border p-1.5 sm:grid-cols-[2rem_8rem_1.5rem_1fr_auto]',
                hasError ? 'border-danger/50 bg-danger/[0.05]' : 'border-transparent',
              )}
            >
              <span
                className={cx('text-center font-mono text-xs', hasError ? 'text-danger' : 'text-subtle')}
                aria-label={`Line ${index + 1}${hasError ? ' has an error' : ''}`}
              >
                {index + 1}
              </span>
              {row.kind === 'raw' ? (
                <input
                  className="input col-span-1 font-mono sm:col-span-3"
                  value={row.raw}
                  aria-label={`Line ${index + 1} (raw text)`}
                  onChange={(e) => onChange(updateRow(text, index, { kind: 'raw', raw: e.target.value }))}
                  spellCheck={false}
                />
              ) : (
                <>
                  <div className="col-span-1 flex items-center gap-2 sm:contents">
                    <input
                      className="input w-20 font-mono font-semibold text-accent sm:w-full"
                      value={row.lhs}
                      placeholder="S"
                      aria-label={`Variable on line ${index + 1}`}
                      onChange={(e) => onChange(updateRow(text, index, { ...row, lhs: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') rhsRefs.current[index]?.focus();
                      }}
                      spellCheck={false}
                    />
                    <span className="text-center text-subtle" aria-hidden="true">
                      →
                    </span>
                    <input
                      ref={(el) => {
                        rhsRefs.current[index] = el;
                      }}
                      className="input min-w-0 flex-1 font-mono"
                      value={row.rhs}
                      placeholder="aA | ε"
                      aria-label={`Alternatives on line ${index + 1}`}
                      onChange={(e) => onChange(updateRow(text, index, { ...row, rhs: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && index === rows.length - 1) {
                          onChange(addRow(text));
                        }
                      }}
                      spellCheck={false}
                    />
                  </div>
                </>
              )}
              <div className="flex items-center gap-1">
                {row.kind === 'rule' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 font-mono text-sm"
                    onClick={() => insertEpsilon(index, row)}
                    aria-label={`Add ε alternative to line ${index + 1}`}
                    title="Add an ε alternative"
                  >
                    ε
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:text-danger"
                  onClick={() => onChange(rows.length === 1 ? '' : removeRow(text, index))}
                  aria-label={`Remove line ${index + 1}`}
                  title="Remove this rule"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      <Button variant="secondary" size="sm" icon={Plus} onClick={() => onChange(addRow(text))} className="ml-10">
        Add production
      </Button>
    </div>
  );
}

export default function EditorPage() {
  const { workspace, updateWorkspace, parsed, loadSample, loadGrammar, runConversion, navigate, saveToLibrary, notify, importToLibrary } =
    useWorkspace();
  const [mode, setMode] = useState('rows');
  const [confirmClear, setConfirmClear] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [cnfCheckOpen, setCnfCheckOpen] = useState(false);
  const fileRef = useRef(null);

  const errorLines = useMemo(() => new Set(parsed.errors.map((e) => e.line).filter(Boolean)), [parsed.errors]);
  const setText = (text) => updateWorkspace({ text });

  const convert = () => {
    const next = runConversion();
    if (next) navigate('converter');
  };

  const validate = () => {
    if (parsed.ok) {
      notify(
        `Grammar is valid: ${parsed.grammar.productions.length} productions, ${parsed.grammar.nonTerminals.length} variables, ${parsed.grammar.terminals.length} terminals.`,
        'success',
      );
    } else {
      notify(`${parsed.errors.length} error${parsed.errors.length === 1 ? '' : 's'} found — see the status panel.`, 'error');
    }
  };

  const onImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const sources = parseImportedFile(file.name, await readFileAsText(file));
      loadGrammar(sources[0]);
      if (sources.length > 1) {
        importToLibrary(sources);
        notify(`Imported ${sources.length} grammars into the library; the first is open in the editor.`, 'success');
      }
    } catch (error) {
      notify(`Import failed: ${error.message}`, 'error');
    }
  };

  const exportTxt = () => downloadText(`${slugify(workspace.name)}.txt`, sourceToTxt(workspace));
  const exportJson = () =>
    downloadJSON(`${slugify(workspace.name)}.json`, {
      name: workspace.name,
      start: workspace.start,
      nonTerminals: workspace.nonTerminals,
      terminals: workspace.terminals,
      text: workspace.text,
      parsed: parsed.ok
        ? {
            start: parsed.grammar.start,
            nonTerminals: parsed.grammar.nonTerminals,
            terminals: parsed.grammar.terminals,
            productions: parsed.grammar.productions,
          }
        : null,
    });

  const copy = async () => {
    const text = parsed.ok ? serializeGrammar(parsed.grammar) : workspace.text;
    notify((await copyText(text)) ? 'Grammar copied to clipboard.' : 'Could not access the clipboard.', 'info');
  };

  return (
    <div>
      <PageHeader
        eyebrow="Grammar Editor"
        icon={PencilRuler}
        title="Define your context-free grammar"
        description="Write production rules row by row or as plain text. The grammar is parsed live, with exact error locations, a formatted preview and statistics."
        actions={
          <>
            <Button variant="secondary" icon={ShieldCheck} onClick={validate}>
              Validate
            </Button>
            <Button
              variant="secondary"
              icon={ListChecks}
              onClick={() => setCnfCheckOpen(true)}
              disabled={!parsed.ok}
              title={parsed.ok ? 'Check the grammar against the CNF definition without converting it' : 'Fix the syntax errors first'}
            >
              Check if Already in CNF
            </Button>
            <Button variant="primary" icon={Workflow} onClick={convert} disabled={!parsed.ok}>
              Convert to CNF
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Card className="card-pad">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Grammar name" htmlFor="g-name">
                <input
                  id="g-name"
                  className="input"
                  value={workspace.name}
                  maxLength={120}
                  onChange={(e) => updateWorkspace({ name: e.target.value })}
                />
              </Field>
              <Field label="Start symbol" htmlFor="g-start" hint="Leave empty to use the first rule's variable.">
                <input
                  id="g-start"
                  className="input font-mono"
                  value={workspace.start}
                  placeholder={parsed.grammar?.start ?? 'S'}
                  onChange={(e) => updateWorkspace({ start: e.target.value })}
                  spellCheck={false}
                />
              </Field>
              <Field
                label="Variables (optional)"
                htmlFor="g-nts"
                hint="Declare multi-character variables, e.g. Expr, Term."
              >
                <input
                  id="g-nts"
                  className="input font-mono"
                  value={workspace.nonTerminals}
                  placeholder="S, A, B"
                  onChange={(e) => updateWorkspace({ nonTerminals: e.target.value })}
                  spellCheck={false}
                />
              </Field>
              <Field label="Terminals (optional)" htmlFor="g-ts" hint="Declare multi-character terminals, e.g. id, if.">
                <input
                  id="g-ts"
                  className="input font-mono"
                  value={workspace.terminals}
                  placeholder="a, b"
                  onChange={(e) => updateWorkspace({ terminals: e.target.value })}
                  spellCheck={false}
                />
              </Field>
            </div>
          </Card>

          <Card className="card-pad">
            <CardHeader
              icon={ListPlus}
              title="Production rules"
              subtitle="Use →, -> or ::=. Write ε, epsilon or λ for the empty string."
              actions={
                <Tabs
                  label="editor-mode"
                  value={mode}
                  onChange={setMode}
                  tabs={[
                    { value: 'rows', label: 'Rules', icon: Rows3 },
                    { value: 'text', label: 'Text', icon: TextCursorInput },
                  ]}
                />
              }
            />
            <div className="mt-5">
              {mode === 'rows' ? (
                <RuleRows text={workspace.text} onChange={setText} errorLines={errorLines} />
              ) : (
                <div>
                  <label htmlFor="grammar-text" className="sr-only">
                    Grammar text
                  </label>
                  <textarea
                    id="grammar-text"
                    className="input min-h-[18rem] resize-y font-mono leading-7"
                    value={workspace.text}
                    onChange={(e) => setText(e.target.value)}
                    spellCheck={false}
                    placeholder={'S -> AB | a\nA -> aA | ε\nB -> b'}
                  />
                  <p className="mt-2 text-xs text-subtle">
                    Tip: a line starting with <code className="font-mono">|</code> continues the previous rule;{' '}
                    <code className="font-mono">#</code> starts a comment. Press <kbd className="kbd">Ctrl</kbd>+
                    <kbd className="kbd">Enter</kbd> to convert.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <label htmlFor="sample-select" className="sr-only">
                Load a sample grammar
              </label>
              <select
                id="sample-select"
                className="input h-8 w-auto py-0 text-xs"
                value=""
                onChange={(e) => e.target.value && loadSample(e.target.value)}
              >
                <option value="">Load sample…</option>
                {SAMPLE_GRAMMARS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button size="sm" icon={Save} onClick={() => {
                setSaveName(workspace.name);
                setSaveOpen(true);
              }}>
                {workspace.savedId ? 'Update saved' : 'Save'}
              </Button>
              <Button size="sm" icon={Upload} onClick={() => fileRef.current?.click()}>
                Import
              </Button>
              <input ref={fileRef} type="file" accept=".txt,.json,.cfg,text/plain,application/json" className="hidden" onChange={onImport} aria-hidden="true" tabIndex={-1} />
              <Button size="sm" icon={FileText} onClick={exportTxt}>
                TXT
              </Button>
              <Button size="sm" icon={FileJson} onClick={exportJson}>
                JSON
              </Button>
              <Button size="sm" icon={ClipboardCopy} onClick={copy}>
                Copy
              </Button>
              <Button size="sm" variant="danger" icon={Eraser} onClick={() => setConfirmClear(true)} className="ml-auto">
                Clear
              </Button>
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="card-pad" aria-live="polite">
            <CardHeader
              icon={parsed.ok ? CheckCircle2 : XCircle}
              tone={parsed.ok ? 'success' : 'danger'}
              title={parsed.ok ? 'Grammar is well-formed' : 'Grammar has errors'}
              subtitle={
                parsed.ok
                  ? `${parsed.grammar.productions.length} productions · start symbol ${parsed.grammar.start}`
                  : `${parsed.errors.length} error${parsed.errors.length === 1 ? '' : 's'} to fix before converting`
              }
            />
            {(parsed.errors.length > 0 || parsed.warnings.length > 0) && (
              <ul className="scroll-panel mt-4 max-h-60 space-y-2">
                {parsed.errors.map((e, i) => (
                  <li key={`e${i}`} className="flex gap-2 rounded-xl border border-danger/30 bg-danger/[0.07] px-3 py-2 text-sm">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                    <span className="text-fg">
                      {e.line && <Badge tone="danger" className="mr-1.5">line {e.line}</Badge>}
                      {e.message}
                    </span>
                  </li>
                ))}
                {parsed.warnings.map((w, i) => (
                  <li key={`w${i}`} className="flex gap-2 rounded-xl border border-warn/30 bg-warn/[0.07] px-3 py-2 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
                    <span className="text-fg">
                      {w.line && <Badge tone="warn" className="mr-1.5">line {w.line}</Badge>}
                      {w.message}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="primary" className="mt-5 w-full justify-center" icon={Workflow} onClick={convert} disabled={!parsed.ok}>
              Convert to Chomsky Normal Form
            </Button>
            <Button
              variant="secondary"
              className="mt-2 w-full justify-center"
              icon={ListChecks}
              onClick={() => setCnfCheckOpen(true)}
              disabled={!parsed.ok}
            >
              Check if already in CNF (no conversion)
            </Button>
          </Card>

          <Card className="card-pad">
            <CardHeader icon={Eye} tone="cyan" title="Grammar preview" subtitle="How the parser understood your rules" />
            <div className="mt-4 space-y-4">
              {parsed.ok ? (
                <>
                  <div className="scroll-panel max-h-80 rounded-xl border border-line bg-canvas/40 p-3">
                    <GrammarView grammar={parsed.grammar} />
                  </div>
                  <GrammarTuple grammar={parsed.grammar} />
                </>
              ) : (
                <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
                  The preview appears once the grammar parses without errors.
                </p>
              )}
            </div>
          </Card>

          {parsed.ok && (
            <Card className="card-pad">
              <CardHeader icon={BarChart3} tone="violet" title="Grammar statistics" subtitle="Hover a label for its definition" />
              <div className="mt-4">
                <GrammarStats grammar={parsed.grammar} />
              </div>
            </Card>
          )}
        </div>
      </div>

      <CnfCheckDialog
        open={cnfCheckOpen && parsed.ok}
        grammar={parsed.ok ? parsed.grammar : null}
        onClose={() => setCnfCheckOpen(false)}
        onConvert={() => {
          setCnfCheckOpen(false);
          convert();
        }}
      />
      <ConfirmDialog
        open={confirmClear}
        title="Clear the editor?"
        message="All production rules and declarations in the editor will be removed. Saved grammars in your library are not affected."
        confirmLabel="Clear editor"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          updateWorkspace({ text: '', start: '', nonTerminals: '', terminals: '', name: 'Untitled grammar', savedId: null });
          setConfirmClear(false);
        }}
      />
      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title={workspace.savedId ? 'Update saved grammar' : 'Save grammar to library'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={Save}
              onClick={() => {
                saveToLibrary(saveName);
                setSaveOpen(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveToLibrary(saveName);
            setSaveOpen(false);
          }}
        >
          <Field label="Name" htmlFor="save-name">
            <input
              id="save-name"
              data-autofocus
              className="input"
              value={saveName}
              maxLength={120}
              onChange={(e) => setSaveName(e.target.value)}
            />
          </Field>
          <p className="mt-3 text-xs text-muted">Grammars are stored in this browser’s Local Storage.</p>
        </form>
      </Modal>
    </div>
  );
}
