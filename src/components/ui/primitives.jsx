import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

const cx = (...classes) => classes.filter(Boolean).join(' ');
export { cx };

const BUTTON_VARIANTS = {
  primary:
    'bg-gradient-to-r from-accent-strong to-accent text-white shadow-glow hover:brightness-110 disabled:shadow-none',
  secondary: 'border border-line bg-surface-2 text-fg hover:border-accent/50 hover:bg-elevated',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg',
  danger: 'border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20',
  success: 'border border-success/40 bg-success/10 text-success hover:bg-success/20',
};

const BUTTON_SIZES = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2.5 px-6 text-base',
  icon: 'h-9 w-9 justify-center',
};

export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconRight: IconRight, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex shrink-0 items-center rounded-xl font-medium transition-all duration-150 active:scale-[0.98]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />}
      {children}
      {IconRight && <IconRight className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
});

export function Card({ className, children, as: Tag = 'section', ...props }) {
  return (
    <Tag className={cx('card', className)} {...props}>
      {children}
    </Tag>
  );
}

export function CardHeader({ icon: Icon, title, subtitle, actions, className, tone = 'accent' }) {
  const toneClass = {
    accent: 'bg-accent/15 text-accent',
    cyan: 'bg-cyan/15 text-cyan',
    violet: 'bg-violet/15 text-violet',
    success: 'bg-success/15 text-success',
    danger: 'bg-danger/15 text-danger',
    warn: 'bg-warn/15 text-warn',
  }[tone];
  return (
    <div className={cx('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className={cx('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl', toneClass)}>
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-fg">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const BADGE_TONES = {
  neutral: 'border-line bg-surface-2 text-muted',
  accent: 'border-accent/30 bg-accent/10 text-accent',
  cyan: 'border-cyan/30 bg-cyan/10 text-cyan',
  violet: 'border-violet/30 bg-violet/10 text-violet',
  success: 'border-success/30 bg-success/10 text-success',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  warn: 'border-warn/30 bg-warn/10 text-warn',
};

export function Badge({ tone = 'neutral', className, children, icon: Icon, ...props }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function PageHeader({ eyebrow, title, description, actions, icon: Icon }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-12 text-center',
        className,
      )}
    >
      {Icon && (
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-accent/15 via-cyan/10 to-violet/15 text-accent">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
      )}
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Accessible tooltip (hover + focus). */
export function Tooltip({ content, children, side = 'top', className }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!content) return children;
  return (
    <span
      className={cx('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: side === 'top' ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className={cx(
              'pointer-events-none absolute left-1/2 z-50 w-max max-w-[18rem] -translate-x-1/2 rounded-lg border border-line bg-elevated px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-fg shadow-xl',
              side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
            )}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** Modal dialog with focus trap-lite, Escape to close and restore focus. */
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const panelRef = useRef(null);
  const titleId = useId();
  // Keep the latest onClose in a ref so the effect below only runs when the
  // dialog opens or closes (not on every parent re-render while typing).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => panelRef.current?.querySelector('[data-autofocus], input, button')?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      previous?.focus?.();
    };
  }, [open]);

  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }[size];
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={cx(
              'relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl',
              width,
            )}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 id={titleId} className="text-base font-semibold text-fg">
                {title}
              </h2>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="scroll-panel flex-1 px-5 py-4">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', tone = 'danger', onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-muted">{message}</p>
    </Modal>
  );
}

/** Segmented tabs (keyboard accessible with arrow keys). */
export function Tabs({ tabs, value, onChange, className, size = 'md', label }) {
  const refs = useRef([]);
  const onKeyDown = (e, index) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cx('inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface-2/70 p-1', className)}
    >
      {tabs.map((tab, index) => {
        const active = tab.value === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cx(
              'relative inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              active ? 'text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {active && (
              <motion.span
                layoutId={`tab-${label}`}
                className="absolute inset-0 rounded-lg border border-line bg-surface shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
              {tab.label}
              {tab.count !== undefined && <span className="text-[11px] text-subtle">{tab.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function StatTile({ icon: Icon, label, value, hint, tone = 'accent' }) {
  const toneClass = {
    accent: 'text-accent bg-accent/10',
    cyan: 'text-cyan bg-cyan/10',
    violet: 'text-violet bg-violet/10',
    success: 'text-success bg-success/10',
    warn: 'text-warn bg-warn/10',
    danger: 'text-danger bg-danger/10',
  }[tone];
  return (
    <div className="card card-pad flex items-start gap-4">
      {Icon && (
        <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl', toneClass)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-fg">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-subtle">{hint}</p>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }) {
  return (
    <div>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

/** Small disclosure/accordion item. */
export function Disclosure({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="rounded-xl border border-line bg-surface-2/40">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-fg"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {title}
        <motion.span animate={{ rotate: open ? 45 : 0 }} className="text-lg leading-none text-muted" aria-hidden="true">
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 text-sm leading-relaxed text-muted">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
