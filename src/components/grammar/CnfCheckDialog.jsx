import { useMemo } from 'react';
import { Info, Workflow } from 'lucide-react';
import { checkAlreadyCnf } from '../../algorithms/cnfValidator.js';
import { Button, Modal } from '../ui/primitives.jsx';
import { GrammarView } from './GrammarView.jsx';
import { ValidationReport } from './ValidationReport.jsx';

/**
 * "Check if already in CNF": validates the user's grammar exactly as written,
 * without running any conversion stage.
 */
export function CnfCheckDialog({ open, onClose, grammar, onConvert }) {
  const validation = useMemo(() => (open && grammar ? checkAlreadyCnf(grammar) : null), [open, grammar]);
  if (!grammar) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Is this grammar already in Chomsky Normal Form?"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {validation && !validation.valid && (
            <Button variant="primary" icon={Workflow} onClick={onConvert}>
              Convert it to CNF
            </Button>
          )}
        </>
      }
    >
      {validation && (
        <div className="space-y-5">
          <div className="flex gap-3 rounded-xl border border-accent/25 bg-accent/[0.05] px-4 py-3 text-sm leading-relaxed text-fg/90">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <p>
              The grammar is checked <strong>exactly as written</strong> — nothing is converted. A grammar G = (V, Σ, R,{' '}
              {grammar.start}) is in CNF when every rule has the form <span className="font-mono">A → BC</span> (B, C ∈ V)
              or <span className="font-mono">A → a</span> (a ∈ Σ). The only exception is{' '}
              <span className="font-mono">{grammar.start} → ε</span>, allowed for the start symbol {grammar.start} only if{' '}
              {grammar.start} appears on no right-hand side. Useless symbols do not violate this definition, so they are
              reported as an advisory.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-canvas/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Grammar being checked</p>
            <GrammarView grammar={grammar} dense />
          </div>
          <ValidationReport validation={validation} grammar={grammar} />
        </div>
      )}
    </Modal>
  );
}
