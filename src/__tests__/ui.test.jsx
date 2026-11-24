import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App.jsx';
import { STORAGE_KEYS } from '../utils/storage.js';
import { addRow, removeRow, rowsToText, textToRows, updateRow } from '../utils/editorLines.js';
import { parseImportedFile, sourceToTxt } from '../utils/files.js';

function go(route) {
  act(() => {
    window.location.hash = `/${route}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

describe('application shell', () => {
  it('renders the dashboard and every navigation page', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: /Chomsky Normal Form/ })).toBeInTheDocument();
    const nav = screen.getAllByRole('navigation', { name: 'Main navigation' })[0];
    const expected = {
      'Grammar Editor': /Define your context-free grammar/,
      'CNF Converter': /Run the conversion pipeline/,
      'Step Visualizer': /Walk through the conversion/,
      'Grammar Library': /Samples & saved grammars/,
      'Learn CNF': /Chomsky Normal Form, explained/,
      'About Project': /CFG to CNF Converter/,
    };
    for (const [label, heading] of Object.entries(expected)) {
      fireEvent.click(within(nav).getByRole('button', { name: new RegExp(label) }));
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    }
  });

  it('toggles and persists the colour theme', () => {
    render(<App />);
    expect(document.documentElement).toHaveClass('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Toggle colour theme' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.theme))).toBe('light');
  });

  it('opens the help dialog', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.getByRole('dialog', { name: /Help & keyboard shortcuts/ })).toBeInTheDocument();
  });
});

describe('editor → converter → visualizer flow', () => {
  it('shows live parse errors with line numbers', () => {
    render(<App />);
    go('editor');
    fireEvent.click(screen.getByRole('tab', { name: /Text/ }));
    fireEvent.change(screen.getByLabelText('Grammar text'), { target: { value: 'S -> aB |\nB b' } });
    expect(screen.getByText('Grammar has errors')).toBeInTheDocument();
    expect(screen.getByText(/Missing arrow/)).toBeInTheDocument();
    expect(screen.getAllByText(/line 2/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Convert to/ })[0]).toBeDisabled();
  });

  it('converts the grammar and validates the result', () => {
    render(<App />);
    go('editor');
    fireEvent.click(screen.getByRole('tab', { name: /Text/ }));
    fireEvent.change(screen.getByLabelText('Grammar text'), { target: { value: 'S -> aSb | ε' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Convert to CNF' })[0]);
    expect(screen.getAllByText('Valid Chomsky Normal Form').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/S₀/).length).toBeGreaterThan(0);
  });

  it('steps forwards and backwards through immutable snapshots', () => {
    render(<App />);
    go('editor');
    fireEvent.click(screen.getAllByRole('button', { name: 'Convert to CNF' })[0]);
    go('visualizer');
    expect(screen.getByText(/Input Context-Free Grammar/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Start Symbol Augmentation' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { level: 2, name: 'ε-Production Removal' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'End' });
    expect(screen.getByRole('heading', { level: 2, name: 'Final CNF Validation' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Binary Production Conversion' })).toBeInTheDocument();
  });

  it('marks a conversion as stale after editing', () => {
    render(<App />);
    go('editor');
    fireEvent.click(screen.getAllByRole('button', { name: 'Convert to CNF' })[0]);
    go('editor');
    fireEvent.change(screen.getByLabelText('Grammar name'), { target: { value: 'Edited' } });
    fireEvent.click(screen.getByRole('tab', { name: /Text/ }));
    fireEvent.change(screen.getByLabelText('Grammar text'), { target: { value: 'S -> ab' } });
    go('converter');
    expect(screen.getByText(/has changed since this conversion/)).toBeInTheDocument();
  });
});

describe('library', () => {
  it('saves, renames and deletes grammars in Local Storage', () => {
    render(<App />);
    go('editor');
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Exam grammar' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.library))[0].name).toBe('Exam grammar');

    go('library');
    fireEvent.click(screen.getByRole('tab', { name: /My grammars/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('New name'), { target: { value: 'Renamed grammar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.library))[0].name).toBe('Renamed grammar');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.library))).toEqual([]);
  });

  it('survives corrupted Local Storage', () => {
    localStorage.setItem(STORAGE_KEYS.library, '{broken');
    localStorage.setItem(STORAGE_KEYS.workspace, '42');
    localStorage.setItem(STORAGE_KEYS.stats, '"x"');
    render(<App />);
    go('library');
    expect(screen.getByRole('heading', { level: 1, name: /Samples & saved grammars/ })).toBeInTheDocument();
  });

  it('converts a sample directly from the library', () => {
    render(<App />);
    go('library');
    fireEvent.click(screen.getAllByRole('button', { name: 'Convert now' })[6]);
    expect(screen.getByRole('heading', { level: 1, name: /aⁿbⁿ/ })).toBeInTheDocument();
    expect(screen.getAllByText('Valid Chomsky Normal Form').length).toBeGreaterThan(0);
  });
});

describe('editor helpers', () => {
  it('round-trips rows and keeps spaces typed in the right-hand side', () => {
    const text = 'S -> A B | a\n# comment\nA -> a ';
    const rows = textToRows(text);
    expect(rows[0]).toEqual({ kind: 'rule', lhs: 'S', rhs: 'A B | a' });
    expect(rows[1].kind).toBe('raw');
    expect(rows[2].rhs).toBe('a ');
    expect(rowsToText(rows)).toBe(text);
    expect(updateRow(text, 0, { kind: 'rule', lhs: 'S', rhs: 'b' }).split('\n')[0]).toBe('S -> b');
    expect(removeRow(text, 1)).toBe('S -> A B | a\nA -> a ');
    expect(textToRows(addRow('S -> a'))).toHaveLength(2);
  });

  it('imports TXT and JSON files', () => {
    const txt = sourceToTxt({ name: 'My G', start: 'S', nonTerminals: '', terminals: '', text: 'S -> a' });
    const [fromTxt] = parseImportedFile('g.txt', txt);
    expect(fromTxt).toMatchObject({ name: 'My G', start: 'S', text: 'S -> a' });
    const fromJson = parseImportedFile('g.json', JSON.stringify({ grammars: [{ name: 'A', text: 'S -> b' }, { name: 'B', text: 'S -> c' }] }));
    expect(fromJson.map((s) => s.name)).toEqual(['A', 'B']);
    expect(() => parseImportedFile('bad.json', '{"x":1}')).toThrow(/No grammar/);
    expect(() => parseImportedFile('bad.json', '{nope')).toThrow(/not valid JSON/);
  });
});
