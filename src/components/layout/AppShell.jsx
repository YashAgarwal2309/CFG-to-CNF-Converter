import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
  Menu,
  Moon,
  RotateCcw,
  Sun,
  X,
  XCircle,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { Button, ConfirmDialog, Modal, Tooltip, cx } from '../ui/primitives.jsx';
import { NAV_ITEMS, SHORTCUTS } from './navigation.js';

export function Logo({ compact = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent-strong via-cyan to-violet p-[1.5px] shadow-glow">
        <span className="grid h-full w-full place-items-center rounded-[10px] bg-surface">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path d="M12 4 L6 15 M12 4 L18 15" stroke="rgb(var(--accent))" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="4" r="2.4" fill="rgb(var(--accent))" />
            <circle cx="6" cy="17" r="2.4" fill="rgb(var(--cyan))" />
            <circle cx="18" cy="17" r="2.4" fill="rgb(var(--violet))" />
          </svg>
        </span>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-sm font-bold text-fg">CFG → CNF</span>
          <span className="block text-[11px] font-medium text-muted">Grammar Transformation Simulator</span>
        </span>
      )}
    </span>
  );
}

function Sidebar({ open, onClose }) {
  const { route, navigate, conversion } = useWorkspace();
  const content = (
    <nav aria-label="Main navigation" className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <button type="button" onClick={() => navigate('dashboard')} className="rounded-xl" aria-label="Go to dashboard">
          <Logo />
        </button>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose} aria-label="Close navigation">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ul className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = route === item.id;
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  navigate(item.id);
                  onClose();
                }}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
                  active ? 'text-fg' : 'text-muted hover:bg-surface-2/70 hover:text-fg',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl border border-accent/30 bg-gradient-to-r from-accent/15 to-violet/5"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon className={cx('relative h-[18px] w-[18px]', active ? 'text-accent' : '')} aria-hidden="true" />
                <span className="relative flex-1">{item.label}</span>
                {item.id === 'visualizer' && conversion?.result.ok && (
                  <span className="relative h-2 w-2 rounded-full bg-success" title="A conversion is ready" />
                )}
                <span className="kbd relative hidden opacity-0 transition-opacity group-hover:opacity-100 xl:inline-flex">
                  {item.key}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="m-3 rounded-2xl border border-line bg-gradient-to-br from-accent/10 via-transparent to-violet/10 p-4">
        <p className="text-xs font-semibold text-fg">CNF in one line</p>
        <p className="mt-1 font-mono text-xs leading-relaxed text-muted">
          A → BC &nbsp;|&nbsp; A → a
          <br />
          S₀ → ε (only if ε ∈ L)
        </p>
      </div>
    </nav>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line/70 bg-surface/80 backdrop-blur-xl lg:block">
        {content}
      </aside>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface"
            >
              {content}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function TopBar({ onMenu, onReset }) {
  const { theme, toggleTheme, workspace, navigate, setHelpOpen, route, isStale, conversion } = useWorkspace();
  const current = NAV_ITEMS.find((n) => n.id === route);
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="lg:hidden">
          <Logo compact />
        </div>
        <div className="hidden min-w-0 items-center gap-2 text-sm sm:flex">
          <span className="font-semibold text-fg">{current?.label}</span>
          <span className="text-subtle">/</span>
          <button
            type="button"
            onClick={() => navigate('editor')}
            className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-muted hover:bg-surface-2 hover:text-fg"
            title="Current workspace grammar — open in editor"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Workspace</span>
            <span className="max-w-[14rem] truncate font-medium text-fg">{workspace.name}</span>
            {conversion && (
              <span
                className={cx('h-2 w-2 shrink-0 rounded-full', isStale ? 'bg-warn' : 'bg-success')}
                title={isStale ? 'Grammar edited since last conversion' : 'Conversion up to date'}
              />
            )}
          </button>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Tooltip content="Help & keyboard shortcuts (?)" side="bottom">
            <Button variant="ghost" size="icon" onClick={() => setHelpOpen(true)} aria-label="Help">
              <HelpCircle className="h-[18px] w-[18px]" />
            </Button>
          </Tooltip>
          <Tooltip content={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} side="bottom">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle colour theme">
              {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </Button>
          </Tooltip>
          <Button variant="secondary" size="sm" icon={RotateCcw} onClick={onReset} className="hidden sm:inline-flex">
            Reset workspace
          </Button>
          <Tooltip content="Reset workspace" side="bottom" className="sm:hidden">
            <Button variant="ghost" size="icon" onClick={onReset} aria-label="Reset workspace">
              <RotateCcw className="h-[18px] w-[18px]" />
            </Button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}

function Toasts() {
  const { toasts, dismissToast } = useWorkspace();
  const icons = { success: CheckCircle2, error: XCircle, warn: AlertTriangle, info: Info };
  const tones = {
    success: 'border-success/40 text-success',
    error: 'border-danger/40 text-danger',
    warn: 'border-warn/40 text-warn',
    info: 'border-accent/40 text-accent',
  };
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = icons[t.tone] ?? Info;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              className={cx(
                'pointer-events-auto flex items-start gap-3 rounded-xl border bg-elevated/95 px-4 py-3 text-sm shadow-2xl backdrop-blur',
                tones[t.tone],
              )}
              role="status"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="flex-1 text-fg">{t.message}</p>
              <button type="button" onClick={() => dismissToast(t.id)} className="text-muted hover:text-fg" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function HelpModal() {
  const { helpOpen, setHelpOpen, navigate } = useWorkspace();
  return (
    <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Help & keyboard shortcuts" size="lg">
      <div className="space-y-6">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-fg">Writing grammars</h3>
          <ul className="space-y-1.5 text-sm text-muted">
            <li>
              One rule per line: <code className="font-mono text-fg">S -&gt; AB | a</code> or{' '}
              <code className="font-mono text-fg">S → AB | a</code> (also <code className="font-mono text-fg">::=</code>).
            </li>
            <li>
              Empty string: <code className="font-mono text-fg">ε</code>, <code className="font-mono text-fg">epsilon</code>,{' '}
              <code className="font-mono text-fg">λ</code> or <code className="font-mono text-fg">''</code>.
            </li>
            <li>
              Uppercase letters are variables, other characters are terminals. Spaces separate symbols but are optional.
            </li>
            <li>
              Multi-character variables are recognised once they appear on a left-hand side (e.g.{' '}
              <code className="font-mono text-fg">Expr</code>) or are declared. Use{' '}
              <code className="font-mono text-fg">&lt;name&gt;</code> for variables and{' '}
              <code className="font-mono text-fg">'id'</code> for multi-character terminals.
            </li>
            <li>
              A line starting with <code className="font-mono text-fg">|</code> continues the previous rule;{' '}
              <code className="font-mono text-fg">#</code> starts a comment.
            </li>
          </ul>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold text-fg">Keyboard shortcuts</h3>
          <ul className="divide-y divide-line/60 rounded-xl border border-line">
            {SHORTCUTS.map((s) => (
              <li key={s.description} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
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
        </section>
        <section className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setHelpOpen(false);
              navigate('learn');
            }}
          >
            Open the Learn CNF guide
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setHelpOpen(false);
              navigate('library');
            }}
          >
            Browse sample grammars
          </Button>
        </section>
      </div>
    </Modal>
  );
}

function useGlobalShortcuts() {
  const { navigate, setHelpOpen, runRef } = useWorkspace();
  useEffect(() => {
    const onKey = (e) => {
      const target = e.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit[1-7]$/.test(e.code)) {
        e.preventDefault();
        const item = NAV_ITEMS[Number(e.code.slice(5)) - 1];
        if (item) navigate(item.id);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const next = runRef.current();
        if (next) navigate('converter');
        return;
      }
      if (!typing && e.key === '?') {
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, setHelpOpen, runRef]);
}

export function AppShell({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const { resetWorkspace, route } = useWorkspace();
  useGlobalShortcuts();

  useEffect(() => {
    const label = NAV_ITEMS.find((n) => n.id === route)?.label ?? '';
    document.title = `${label} · CFG → CNF Converter`;
    // Start every page at the top (also for back/forward and direct links).
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="lg:pl-64">
        <TopBar onMenu={() => setMenuOpen(true)} onReset={() => setConfirmReset(true)} />
        <main id="main-content" className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {/* Enter-only page transition. An exit animation (AnimatePresence
              mode="wait") can leave a stale page instance on screen when the
              browser pauses animation frames, e.g. in a background tab. */}
          <motion.div
            key={route}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {children}
          </motion.div>
        </main>
        <footer className="border-t border-line/60 px-4 py-6 text-center text-xs text-subtle sm:px-8">
          CFG → CNF Converter · An Automata Theory &amp; Formal Languages project · Runs entirely in your browser
        </footer>
      </div>
      <Toasts />
      <HelpModal />
      <ConfirmDialog
        open={confirmReset}
        title="Reset workspace?"
        message="The editor will be restored to the default example grammar and the current conversion will be cleared. Your saved library grammars are not affected."
        confirmLabel="Reset workspace"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetWorkspace();
          setConfirmReset(false);
        }}
      />
    </div>
  );
}
