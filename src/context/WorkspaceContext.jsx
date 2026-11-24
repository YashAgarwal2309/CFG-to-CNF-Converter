import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { parseGrammar } from '../algorithms/grammarParser.js';
import { convertToCnf } from '../engine/conversionPipeline.js';
import { summarizeConversion } from '../engine/conversionHistory.js';
import { SAMPLE_GRAMMARS } from '../data/samples.js';
import {
  createId,
  isValidWorkspace,
  normalizeLibrary,
  normalizeSource,
  readJSON,
  removeKey,
  STORAGE_KEYS,
  writeJSON,
} from '../utils/storage.js';

const WorkspaceContext = createContext(null);

const DEFAULT_SAMPLE = SAMPLE_GRAMMARS.find((s) => s.id === 'sipser-example') ?? SAMPLE_GRAMMARS[0];

export const DEFAULT_WORKSPACE = Object.freeze({
  name: DEFAULT_SAMPLE.name,
  text: DEFAULT_SAMPLE.text,
  start: DEFAULT_SAMPLE.start,
  nonTerminals: '',
  terminals: '',
  savedId: null,
});

const EMPTY_STATS = { conversions: 0, validConversions: 0, rulesProcessed: 0, variablesIntroduced: 0 };

export const ROUTES = ['dashboard', 'editor', 'converter', 'visualizer', 'library', 'learn', 'about'];

function readRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return ROUTES.includes(hash) ? hash : 'dashboard';
}

function sourceKey(source) {
  return JSON.stringify([source.text, source.start, source.nonTerminals, source.terminals]);
}

function parseSource(source) {
  return parseGrammar(source.text, {
    start: source.start,
    nonTerminals: source.nonTerminals,
    terminals: source.terminals,
  });
}

function loadWorkspace() {
  const stored = readJSON(STORAGE_KEYS.workspace, null, isValidWorkspace);
  if (!stored) return { ...DEFAULT_WORKSPACE };
  return { ...normalizeSource(stored), savedId: typeof stored.savedId === 'string' ? stored.savedId : null };
}

function runFromSource(source) {
  const parsed = parseSource(source);
  if (!parsed.ok) return null;
  return {
    source: { ...source },
    key: sourceKey(source),
    result: convertToCnf(parsed.grammar),
    ranAt: new Date().toISOString(),
  };
}

export function WorkspaceProvider({ children }) {
  // ---------------- theme ----------------
  const [theme, setTheme] = useState(() => (readJSON(STORAGE_KEYS.theme, 'dark') === 'light' ? 'light' : 'dark'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    writeJSON(STORAGE_KEYS.theme, theme);
  }, [theme]);
  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  // ---------------- routing (hash based) ----------------
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const navigate = useCallback((to) => {
    if (!ROUTES.includes(to)) return;
    if (window.location.hash !== `#/${to}`) window.location.hash = `/${to}`;
    setRoute(to);
    window.scrollTo?.({ top: 0 });
  }, []);

  // ---------------- toasts ----------------
  const [toasts, setToasts] = useState([]);
  const notify = useCallback((message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list.slice(-3), { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3600);
  }, []);
  const dismissToast = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  // ---------------- workspace ----------------
  const [workspace, setWorkspace] = useState(loadWorkspace);
  useEffect(() => {
    writeJSON(STORAGE_KEYS.workspace, workspace);
  }, [workspace]);
  const updateWorkspace = useCallback((patch) => setWorkspace((w) => ({ ...w, ...patch })), []);
  const parsed = useMemo(() => parseSource(workspace), [workspace]);

  // ---------------- library / recent / stats ----------------
  const [library, setLibrary] = useState(() => normalizeLibrary(readJSON(STORAGE_KEYS.library, [])));
  useEffect(() => {
    writeJSON(STORAGE_KEYS.library, library);
  }, [library]);

  const [recent, setRecent] = useState(() => {
    const list = readJSON(STORAGE_KEYS.recent, [], Array.isArray);
    return list
      .map((r) => {
        const source = normalizeSource(r);
        return source ? { ...source, at: typeof r.at === 'string' ? r.at : '', valid: !!r.valid } : null;
      })
      .filter(Boolean)
      .slice(0, 8);
  });
  useEffect(() => {
    writeJSON(STORAGE_KEYS.recent, recent);
  }, [recent]);

  const [stats, setStats] = useState(() => {
    const s = readJSON(STORAGE_KEYS.stats, EMPTY_STATS, (v) => v && typeof v === 'object');
    return Object.fromEntries(
      Object.keys(EMPTY_STATS).map((k) => [k, Number.isFinite(s[k]) && s[k] >= 0 ? s[k] : 0]),
    );
  });
  useEffect(() => {
    writeJSON(STORAGE_KEYS.stats, stats);
  }, [stats]);

  // ---------------- conversion ----------------
  // The active conversion is an immutable snapshot: editing the grammar never
  // changes it until the user explicitly converts again.
  const [conversion, setConversion] = useState(() => {
    const stored = readJSON(STORAGE_KEYS.conversion, null, isValidWorkspace);
    if (!stored) return null;
    try {
      return runFromSource(normalizeSource(stored));
    } catch {
      return null;
    }
  });
  const [visualizerStep, setVisualizerStep] = useState(0);

  const isStale = !!conversion && conversion.key !== sourceKey(workspace);

  /**
   * Convert the workspace grammar — or an explicit `source` (which is also
   * loaded into the editor) — and store the immutable result.
   */
  const runConversion = useCallback(
    ({ silent = false, source: explicit = null, savedId = null } = {}) => {
      const src = explicit ? { ...normalizeSource(explicit), savedId } : workspace;
      const srcParsed = explicit ? parseSource(src) : parsed;
      if (explicit) setWorkspace(src);
      if (!srcParsed.ok) {
        if (!silent) notify('Fix the grammar errors before converting.', 'error');
        return null;
      }
      let next;
      try {
        next = {
          source: { ...src },
          key: sourceKey(src),
          result: convertToCnf(srcParsed.grammar),
          ranAt: new Date().toISOString(),
        };
      } catch (error) {
        notify(`Conversion failed: ${error.message}`, 'error');
        return null;
      }
      setConversion(next);
      setVisualizerStep(0);
      writeJSON(STORAGE_KEYS.conversion, {
        name: src.name,
        text: src.text,
        start: src.start,
        nonTerminals: src.nonTerminals,
        terminals: src.terminals,
      });
      const { result } = next;
      const valid = result.ok && result.validation.valid;
      setStats((s) => ({
        conversions: s.conversions + 1,
        validConversions: s.validConversions + (valid ? 1 : 0),
        rulesProcessed: s.rulesProcessed + result.original.productions.length,
        variablesIntroduced: s.variablesIntroduced + (result.ok ? result.introduced.length : 0),
      }));
      const entry = {
        name: src.name,
        text: src.text,
        start: src.start,
        nonTerminals: src.nonTerminals,
        terminals: src.terminals,
        at: next.ranAt,
        valid,
      };
      setRecent((list) => [entry, ...list.filter((r) => sourceKey(r) !== next.key)].slice(0, 8));
      if (src.savedId) {
        const summary = summarizeConversion(result);
        setLibrary((lib) =>
          lib.map((g) => (g.id === src.savedId ? { ...g, history: [summary, ...g.history].slice(0, 25) } : g)),
        );
      }
      if (!silent) {
        notify(
          result.ok
            ? valid
              ? 'Converted to CNF — validation passed.'
              : 'Conversion finished, but validation failed.'
            : result.error,
          result.ok && valid ? 'success' : 'error',
        );
      }
      return next;
    },
    [parsed, workspace, notify],
  );

  // ---------------- loading grammars ----------------
  const loadGrammar = useCallback(
    (source, { savedId = null, announce = true } = {}) => {
      const normalized = normalizeSource(source);
      if (!normalized) return;
      setWorkspace({ ...normalized, savedId });
      if (announce) notify(`Loaded “${normalized.name}” into the editor.`, 'info');
    },
    [notify],
  );

  const loadSample = useCallback(
    (sampleId) => {
      const sample = SAMPLE_GRAMMARS.find((s) => s.id === sampleId);
      if (sample) loadGrammar({ name: sample.name, text: sample.text, start: sample.start });
    },
    [loadGrammar],
  );

  const resetWorkspace = useCallback(() => {
    setWorkspace({ ...DEFAULT_WORKSPACE });
    setConversion(null);
    setVisualizerStep(0);
    removeKey(STORAGE_KEYS.conversion);
    notify('Workspace reset to the default grammar.', 'info');
  }, [notify]);

  // ---------------- library actions ----------------
  const saveToLibrary = useCallback(
    (name) => {
      const now = new Date().toISOString();
      const finalName = (name ?? workspace.name).trim() || 'Untitled grammar';
      const existing = workspace.savedId && library.find((g) => g.id === workspace.savedId);
      if (existing) {
        setLibrary((lib) =>
          lib.map((g) =>
            g.id === existing.id
              ? {
                  ...g,
                  name: finalName,
                  text: workspace.text,
                  start: workspace.start,
                  nonTerminals: workspace.nonTerminals,
                  terminals: workspace.terminals,
                  updatedAt: now,
                }
              : g,
          ),
        );
        setWorkspace((w) => ({ ...w, name: finalName }));
        notify(`Updated “${finalName}” in your library.`, 'success');
        return existing.id;
      }
      const id = createId();
      setLibrary((lib) => [
        {
          id,
          name: finalName,
          text: workspace.text,
          start: workspace.start,
          nonTerminals: workspace.nonTerminals,
          terminals: workspace.terminals,
          createdAt: now,
          updatedAt: now,
          history: [],
        },
        ...lib,
      ]);
      setWorkspace((w) => ({ ...w, name: finalName, savedId: id }));
      notify(`Saved “${finalName}” to your library.`, 'success');
      return id;
    },
    [workspace, library, notify],
  );

  const renameSaved = useCallback((id, name) => {
    const clean = name.trim().slice(0, 120);
    if (!clean) return;
    setLibrary((lib) => lib.map((g) => (g.id === id ? { ...g, name: clean, updatedAt: new Date().toISOString() } : g)));
    setWorkspace((w) => (w.savedId === id ? { ...w, name: clean } : w));
  }, []);

  const deleteSaved = useCallback((id) => {
    setLibrary((lib) => lib.filter((g) => g.id !== id));
    setWorkspace((w) => (w.savedId === id ? { ...w, savedId: null } : w));
  }, []);

  const importToLibrary = useCallback((sources) => {
    const now = new Date().toISOString();
    const entries = sources.map((s) => ({ ...s, id: createId(), createdAt: now, updatedAt: now, history: [] }));
    setLibrary((lib) => [...entries, ...lib]);
    return entries;
  }, []);

  const clearHistory = useCallback(() => {
    setRecent([]);
    setStats({ ...EMPTY_STATS });
  }, []);

  // ---------------- help modal ----------------
  const [helpOpen, setHelpOpen] = useState(false);

  // Keep a ref to the latest runConversion for keyboard shortcuts.
  const runRef = useRef(runConversion);
  runRef.current = runConversion;

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      route,
      navigate,
      toasts,
      notify,
      dismissToast,
      workspace,
      updateWorkspace,
      parsed,
      loadGrammar,
      loadSample,
      resetWorkspace,
      conversion,
      runConversion,
      runRef,
      isStale,
      visualizerStep,
      setVisualizerStep,
      library,
      saveToLibrary,
      renameSaved,
      deleteSaved,
      importToLibrary,
      recent,
      stats,
      clearHistory,
      helpOpen,
      setHelpOpen,
    }),
    [
      theme,
      toggleTheme,
      route,
      navigate,
      toasts,
      notify,
      dismissToast,
      workspace,
      updateWorkspace,
      parsed,
      loadGrammar,
      loadSample,
      resetWorkspace,
      conversion,
      runConversion,
      isStale,
      visualizerStep,
      library,
      saveToLibrary,
      renameSaved,
      deleteSaved,
      importToLibrary,
      recent,
      stats,
      clearHistory,
      helpOpen,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>.');
  return ctx;
}
