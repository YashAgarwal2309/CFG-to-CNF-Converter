/** Download, clipboard and import helpers. */
import { normalizeSource } from './storage.js';

export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJSON(filename, data) {
  downloadText(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function slugify(name) {
  return (
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'grammar'
  );
}

/** Serialize an editor source as a self-describing TXT file. */
export function sourceToTxt(source) {
  const header = [
    `# ${source.name || 'Grammar'}`,
    `# start: ${source.start || ''}`,
    source.nonTerminals ? `# variables: ${source.nonTerminals}` : null,
    source.terminals ? `# terminals: ${source.terminals}` : null,
  ].filter(Boolean);
  return `${header.join('\n')}\n${source.text}\n`;
}

/**
 * Parse an imported file into one or more editor sources.
 * Accepts: our JSON export (single object or array, or { grammars: [...] }),
 * or plain text rules with optional "# start:", "# variables:", "# terminals:" headers.
 */
export function parseImportedFile(filename, content) {
  const trimmed = content.trim();
  if (filename.toLowerCase().endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let data;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error('The file is not valid JSON.');
    }
    const list = Array.isArray(data) ? data : Array.isArray(data?.grammars) ? data.grammars : [data];
    const sources = list
      .map((item) => {
        if (item && !item.text && item.original?.text) {
          // Conversion report export: import its original grammar.
          return normalizeSource({ name: item.title, text: item.original.text, start: item.original.start });
        }
        return normalizeSource(item);
      })
      .filter(Boolean);
    if (!sources.length) throw new Error('No grammar found in the JSON file (expected a "text" field).');
    return sources;
  }
  const lines = content.split(/\r?\n/);
  const meta = { name: filename.replace(/\.[^.]+$/, ''), start: '', nonTerminals: '', terminals: '' };
  const body = [];
  let firstComment = true;
  for (const line of lines) {
    const m = line.match(/^\s*#\s*(start|variables|non-terminals|terminals)\s*:\s*(.*)$/i);
    if (m) {
      const key = m[1].toLowerCase();
      if (key === 'start') meta.start = m[2].trim();
      else if (key === 'terminals') meta.terminals = m[2].trim();
      else meta.nonTerminals = m[2].trim();
      continue;
    }
    const title = line.match(/^\s*#\s*(.+)$/);
    if (title && firstComment && body.length === 0) {
      meta.name = title[1].trim();
      firstComment = false;
      continue;
    }
    body.push(line);
  }
  const text = body.join('\n').trim();
  if (!text) throw new Error('The file does not contain any production rules.');
  return [normalizeSource({ ...meta, text })];
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 1_000_000) {
      reject(new Error('File is larger than 1 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsText(file);
  });
}
