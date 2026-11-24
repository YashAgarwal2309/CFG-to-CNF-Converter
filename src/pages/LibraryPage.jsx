import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookMarked,
  Check,
  Download,
  FolderOpen,
  History,
  Library,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Workflow,
  X,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { SAMPLE_GRAMMARS } from '../data/samples.js';
import { parseGrammar } from '../algorithms/grammarParser.js';
import { STAGES } from '../engine/conversionPipeline.js';
import { downloadJSON, downloadText, parseImportedFile, readFileAsText, slugify, sourceToTxt } from '../utils/files.js';
import { Badge, Button, Card, ConfirmDialog, EmptyState, PageHeader, Tabs } from '../components/ui/primitives.jsx';
import { GrammarView } from '../components/grammar/GrammarView.jsx';

const DIFFICULTY_TONE = { Beginner: 'success', Intermediate: 'accent', Advanced: 'violet', 'Edge case': 'warn' };
const STAGE_SHORT = Object.fromEntries(STAGES.map((s) => [s.id, s.short]));

function SampleCard({ sample, onLoad, onConvert }) {
  const grammar = useMemo(() => parseGrammar(sample.text, { start: sample.start }).grammar, [sample]);
  const e = sample.expected;
  return (
    <motion.article layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card card-pad flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-fg">{sample.name}</h3>
        <Badge tone={DIFFICULTY_TONE[sample.difficulty]}>{sample.difficulty}</Badge>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{sample.description}</p>
      <div className="mt-4 rounded-xl border border-line bg-canvas/40 p-3">
        <GrammarView grammar={grammar} dense />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-surface-2/60 px-2.5 py-1.5">
          <dt className="text-subtle">Start symbol</dt>
          <dd className="font-mono font-semibold text-accent">{sample.start}</dd>
        </div>
        <div className="rounded-lg bg-surface-2/60 px-2.5 py-1.5">
          <dt className="text-subtle">ε ∈ L(G)</dt>
          <dd className="font-semibold text-fg">{e.generatesEpsilon ? 'yes' : 'no'}</dd>
        </div>
        <div className="col-span-2 rounded-lg bg-surface-2/60 px-2.5 py-1.5">
          <dt className="text-subtle">Stages that change the grammar (verified by tests)</dt>
          <dd className="mt-1 flex flex-wrap gap-1">
            {e.appliedStages.map((id) => (
              <Badge key={id} tone="accent" className="font-mono">
                {STAGE_SHORT[id]}
              </Badge>
            ))}
            {e.emptyLanguage && <Badge tone="warn">L(G) = ∅</Badge>}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-1">
        {sample.concepts.map((c) => (
          <Badge key={c}>{c}</Badge>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Button size="sm" icon={FolderOpen} onClick={onLoad}>
          Load in editor
        </Button>
        <Button size="sm" variant="primary" icon={Workflow} onClick={onConvert}>
          Convert now
        </Button>
      </div>
    </motion.article>
  );
}

function SavedRow({ entry, active, onOpen, onRename, onDelete, onExport }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(entry.name);
  const [showHistory, setShowHistory] = useState(false);
  const parsed = useMemo(() => parseGrammar(entry.text, entry), [entry]);
  const submit = (e) => {
    e.preventDefault();
    onRename(name);
    setEditing(false);
  };
  return (
    <li className="card card-pad">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={submit} className="flex items-center gap-2">
              <label htmlFor={`rename-${entry.id}`} className="sr-only">
                New name
              </label>
              <input
                id={`rename-${entry.id}`}
                className="input h-9"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <Button type="submit" size="icon" variant="success" aria-label="Save name">
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Cancel rename"
                onClick={() => {
                  setName(entry.name);
                  setEditing(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-fg">
              {entry.name}
              {active && <Badge tone="accent">open in editor</Badge>}
              {!parsed.ok && <Badge tone="danger">has errors</Badge>}
            </h3>
          )}
          <p className="mt-1 text-xs text-subtle">
            Updated {new Date(entry.updatedAt).toLocaleString()} · {parsed.ok ? `${parsed.grammar.productions.length} productions` : 'not parseable'} ·{' '}
            {entry.history.length} conversion{entry.history.length === 1 ? '' : 's'}
          </p>
          <div className="mt-3 max-h-40 overflow-auto rounded-xl border border-line bg-canvas/40 p-3">
            {parsed.ok ? <GrammarView grammar={parsed.grammar} dense /> : <pre className="font-mono text-xs text-muted">{entry.text}</pre>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:w-44 md:flex-col">
          <Button size="sm" variant="primary" icon={FolderOpen} onClick={onOpen}>
            Open
          </Button>
          <Button size="sm" icon={Pencil} onClick={() => setEditing(true)}>
            Rename
          </Button>
          <Button size="sm" icon={Download} onClick={() => onExport('txt')}>
            Export TXT
          </Button>
          <Button size="sm" icon={Download} onClick={() => onExport('json')}>
            Export JSON
          </Button>
          <Button size="sm" icon={History} onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>
            History
          </Button>
          <Button size="sm" variant="danger" icon={Trash2} onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
      {showHistory && (
        <div className="mt-4 border-t border-line pt-4">
          {entry.history.length === 0 ? (
            <p className="text-sm text-muted">No conversions recorded yet. Open this grammar and convert it to build a history.</p>
          ) : (
            <ul className="space-y-2">
              {entry.history.map((h, i) => (
                <li key={`${h.at}-${i}`} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2/50 px-3 py-2 text-xs">
                  <Badge tone={h.ok && h.valid ? 'success' : 'danger'}>{h.ok ? (h.valid ? 'valid CNF' : 'invalid') : 'failed'}</Badge>
                  <span className="text-muted">{new Date(h.at).toLocaleString()}</span>
                  {h.ok && (
                    <span className="text-fg">
                      {h.originalProductions} → {h.finalProductions} rules · {h.introduced?.length ?? 0} new variables · stages:{' '}
                      {(h.appliedStages ?? []).map((id) => STAGE_SHORT[id]).filter(Boolean).join(', ') || 'none'}
                    </span>
                  )}
                  {!h.ok && <span className="text-danger">{h.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export default function LibraryPage() {
  const { library, loadGrammar, loadSample, navigate, renameSaved, deleteSaved, importToLibrary, notify, workspace, runConversion } = useWorkspace();
  const [tab, setTab] = useState('samples');
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const fileRef = useRef(null);

  const q = query.trim().toLowerCase();
  const samples = SAMPLE_GRAMMARS.filter(
    (s) => !q || [s.name, s.description, ...s.concepts].some((t) => t.toLowerCase().includes(q)),
  );
  const saved = library.filter((g) => !q || g.name.toLowerCase().includes(q) || g.text.toLowerCase().includes(q));

  const convertSample = (sample) => {
    const next = runConversion({ source: { name: sample.name, text: sample.text, start: sample.start } });
    if (next) navigate('converter');
  };

  const onImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const sources = parseImportedFile(file.name, await readFileAsText(file));
      importToLibrary(sources);
      setTab('saved');
      notify(`Imported ${sources.length} grammar${sources.length === 1 ? '' : 's'} into your library.`, 'success');
    } catch (error) {
      notify(`Import failed: ${error.message}`, 'error');
    }
  };

  const exportAll = () =>
    downloadJSON('cnf-grammar-library.json', {
      exportedAt: new Date().toISOString(),
      grammars: library.map(({ id, name, text, start, nonTerminals, terminals, createdAt, updatedAt, history }) => ({
        id,
        name,
        text,
        start,
        nonTerminals,
        terminals,
        createdAt,
        updatedAt,
        history,
      })),
    });

  return (
    <div>
      <PageHeader
        eyebrow="Grammar Library"
        icon={Library}
        title="Samples & saved grammars"
        description="Explore curated textbook grammars — each one tested against the conversion engine — or manage the grammars you have saved in this browser."
        actions={
          <>
            <Button icon={Upload} onClick={() => fileRef.current?.click()}>
              Import TXT / JSON
            </Button>
            <input ref={fileRef} type="file" accept=".txt,.json,.cfg,text/plain,application/json" className="hidden" onChange={onImport} tabIndex={-1} aria-hidden="true" />
            <Button icon={Download} onClick={exportAll} disabled={library.length === 0}>
              Export library
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          label="library-tabs"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'samples', label: 'Sample grammars', icon: Sparkles, count: SAMPLE_GRAMMARS.length },
            { value: 'saved', label: 'My grammars', icon: BookMarked, count: library.length },
          ]}
        />
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
          <label htmlFor="lib-search" className="sr-only">
            Search grammars
          </label>
          <input id="lib-search" className="input pl-9" placeholder="Search by name or concept…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {tab === 'samples' ? (
        samples.length ? (
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {samples.map((s) => (
              <SampleCard
                key={s.id}
                sample={s}
                onLoad={() => {
                  loadSample(s.id);
                  navigate('editor');
                }}
                onConvert={() => convertSample(s)}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={Search} title="No matching samples" description="Try another search term." />
        )
      ) : saved.length ? (
        <ul className="space-y-4">
          {saved.map((entry) => (
            <SavedRow
              key={entry.id}
              entry={entry}
              active={workspace.savedId === entry.id}
              onOpen={() => {
                loadGrammar(entry, { savedId: entry.id });
                navigate('editor');
              }}
              onRename={(name) => renameSaved(entry.id, name)}
              onDelete={() => setToDelete(entry)}
              onExport={(kind) =>
                kind === 'txt'
                  ? downloadText(`${slugify(entry.name)}.txt`, sourceToTxt(entry))
                  : downloadJSON(`${slugify(entry.name)}.json`, {
                      name: entry.name,
                      text: entry.text,
                      start: entry.start,
                      nonTerminals: entry.nonTerminals,
                      terminals: entry.terminals,
                      history: entry.history,
                    })
              }
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={BookMarked}
          title={library.length ? 'No matching grammars' : 'Your library is empty'}
          description={
            library.length
              ? 'Try another search term.'
              : 'Save a grammar from the editor, or import a TXT/JSON file. Everything is stored locally in your browser.'
          }
          action={
            !library.length && (
              <Button variant="primary" icon={Pencil} onClick={() => navigate('editor')}>
                Go to the editor
              </Button>
            )
          }
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete saved grammar?"
        message={toDelete ? `“${toDelete.name}” and its conversion history will be permanently removed from this browser.` : ''}
        confirmLabel="Delete"
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          deleteSaved(toDelete.id);
          notify(`Deleted “${toDelete.name}”.`, 'info');
          setToDelete(null);
        }}
      />
    </div>
  );
}
