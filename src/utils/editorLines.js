/**
 * The editor keeps grammar source as text (one rule per line). The structured
 * "rule rows" view is derived from that text, so both editing modes always
 * agree and parser line numbers map directly to rows.
 */
const ARROW = /->|→|⟶|::=/;

/** Split the source text into editable rows. */
export function textToRows(text) {
  return text.split(/\r?\n/).map((line) => {
    const match = line.match(ARROW);
    const trimmed = line.trim();
    if (trimmed === '') return { kind: 'rule', lhs: '', rhs: '' };
    const isRaw = !match || trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('|');
    if (isRaw) return { kind: 'raw', raw: line };
    // The RHS is not trimmed (only the single separator space written by
    // rowToLine is dropped), so users can type spaces between symbols.
    const after = line.slice(match.index + match[0].length);
    return {
      kind: 'rule',
      lhs: line.slice(0, match.index).trim(),
      rhs: after.startsWith(' ') ? after.slice(1) : after,
    };
  });
}

export function rowToLine(row) {
  if (row.kind === 'raw') return row.raw;
  if (!row.lhs && !row.rhs) return '';
  return `${row.lhs} -> ${row.rhs}`;
}

export function rowsToText(rows) {
  return rows.map(rowToLine).join('\n');
}

/** Replace one row and return new text. */
export function updateRow(text, index, row) {
  const rows = textToRows(text);
  rows[index] = row;
  return rowsToText(rows);
}

export function removeRow(text, index) {
  const rows = textToRows(text);
  rows.splice(index, 1);
  return rowsToText(rows);
}

/** Append a row (an empty row is stored as a blank line). */
export function addRow(text, row = { kind: 'rule', lhs: '', rhs: '' }) {
  return `${text}\n${rowToLine(row)}`;
}
