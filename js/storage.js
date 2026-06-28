import { parseFountain } from './fountain.js';

const STORAGE_KEY = 'screenplay-draft';
export const FILE_VERSION = 3;

export function buildScriptData(title, lines, titlePage = null, notes = null) {
  return {
    version: FILE_VERSION,
    title,
    titlePage: titlePage || defaultTitlePage(title),
    lines,
    notes: notes || { story: '', characters: {}, scenes: {} },
    savedAt: new Date().toISOString(),
  };
}

function defaultTitlePage(title) {
  return {
    title: title || '',
    author: '',
    basedOn: '',
    contact: '',
    draftDate: '',
  };
}

/**
 * Save script to localStorage as auto-backup.
 */
export function saveToLocalStorage(title, lines, titlePage, notes) {
  const data = buildScriptData(title, lines, titlePage, notes);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

/**
 * Load script from localStorage.
 */
export function loadFromLocalStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Build .spx file content.
 */
export function buildFileContent(title, lines, titlePage, notes) {
  return JSON.stringify(buildScriptData(title, lines, titlePage, notes), null, 2);
}

/**
 * Parse .spx or .json file content.
 */
export function parseFileContent(text) {
  const data = JSON.parse(text);
  if (!data.lines || !Array.isArray(data.lines)) {
    throw new Error('Invalid screenplay file format');
  }
  return {
    title: data.title || 'Untitled Screenplay',
    titlePage: data.titlePage || defaultTitlePage(data.title),
    lines: data.lines.map((l) => ({
      type: l.type || 'action',
      text: l.text || '',
    })),
    notes: data.notes || { story: '', characters: {}, scenes: {} },
  };
}

/**
 * Download file to disk.
 */
export function downloadFile(filename, content, mimeType = 'application/json') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Sanitize title for use as filename.
 */
export function sanitizeFilename(title) {
  return (title || 'untitled-screenplay')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60) || 'untitled-screenplay';
}

/**
 * Try File System Access API save; fall back to download.
 */
export async function saveToFile(title, lines, titlePage, existingHandle = null, notes = null) {
  const content = buildFileContent(title, lines, titlePage, notes);
  const filename = `${sanitizeFilename(title)}.spx`;

  if (existingHandle) {
    try {
      const writable = await existingHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return { handle: existingHandle, filename: existingHandle.name };
    } catch {
      // fall through to download
    }
  }

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'Screenplay File',
            accept: { 'application/json': ['.spx', '.json'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return { handle, filename: handle.name };
    } catch (err) {
      if (err.name === 'AbortError') return null;
    }
  }

  downloadFile(filename, content);
  return { handle: null, filename };
}

/**
 * Open file via File System Access API or file input.
 */
export async function openFromFile() {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Screenplay File',
            accept: {
              'application/json': ['.spx', '.json'],
              'text/plain': ['.txt', '.fountain'],
            },
          },
        ],
      });
      const file = await handle.getFile();
      const text = await file.text();
      let parsed;
      if (file.name.endsWith('.fountain')) {
        parsed = parseFountain(text);
      } else if (file.name.endsWith('.txt')) {
        parsed = { title: file.name.replace(/\.txt$/i, ''), lines: parsePlainText(text), titlePage: null };
      } else {
        parsed = parseFileContent(text);
      }
      return { ...parsed, handle };
    } catch (err) {
      if (err.name === 'AbortError') return null;
      throw err;
    }
  }
  return null;
}

/**
 * Parse plain text screenplay into lines (basic heuristic).
 */
export function parsePlainText(text) {
  const rawLines = text.split(/\r?\n/);
  const lines = [];

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    let type = 'action';
    if (/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.|EST\.)/i.test(trimmed)) {
      type = 'scene-heading';
    } else if (/^(FADE IN:|FADE OUT\.|CUT TO:|DISSOLVE TO:|>\s*)/i.test(trimmed)) {
      type = 'transition';
    } else if (/^\(.+\)$/.test(trimmed)) {
      type = 'parenthetical';
    } else if (
      trimmed === trimmed.toUpperCase() &&
      trimmed.length < 40 &&
      !trimmed.includes('.') &&
      !/^(INT|EXT)/.test(trimmed)
    ) {
      type = 'character';
    } else if (lines.length > 0 && lines[lines.length - 1].type === 'character') {
      type = 'dialogue';
    }

    lines.push({ type, text: trimmed.replace(/^>\s*/, '') });
  }

  return lines.length ? lines : [{ type: 'action', text: '' }];
}
