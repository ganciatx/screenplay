import { getAllLines } from './editor-core.js';
import { countPages, applyPageBreaks } from './pagination.js';
import { getCharacterNames } from './autocomplete.js';

/**
 * Export lines to industry-standard plain text format.
 */
export function exportToPlainText(lines) {
  return lines
    .map(({ type, text }) => {
      const t = text || '';
      switch (type) {
        case 'scene-heading':
        case 'character':
        case 'transition':
          return t.toUpperCase();
        default:
          return t;
      }
    })
    .join('\n');
}

/**
 * Update script statistics in the sidebar.
 */
export function updateStats(editor, elements, serializedLines) {
  const lines = serializedLines || getAllLines(editor).map((l) => ({
    type: l.dataset.type,
    text: l.textContent,
  }));
  const text = lines.map((l) => l.text).join(' ');
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const scenes = lines.filter((l) => l.type === 'scene-heading' && l.text.trim()).length;
  const pages = countPages(lines);

  elements.statPages.textContent = pages;
  elements.statScenes.textContent = scenes;
  elements.statWords.textContent = words.toLocaleString();
}

/**
 * Build scene navigation from scene headings.
 */
export function updateSceneNav(editor, navEl) {
  const sceneLines = getAllLines(editor).filter(
    (l) => l.dataset.type === 'scene-heading' && l.textContent.trim()
  );

  navEl.innerHTML = '';

  if (sceneLines.length === 0) {
    navEl.innerHTML = '<p class="empty-state">No scenes yet</p>';
    return;
  }

  sceneLines.forEach((line, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = `${i + 1}. ${line.textContent.trim().slice(0, 40)}`;
    btn.title = line.textContent.trim();
    btn.addEventListener('click', () => {
      line.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(line);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    });
    navEl.appendChild(btn);
  });
}

/**
 * Update character list in sidebar.
 */
export function updateCharacterNav(editor, navEl) {
  const names = getCharacterNames(editor);
  navEl.innerHTML = '';

  if (!names.length) {
    navEl.innerHTML = '<p class="empty-state">No characters yet</p>';
    return;
  }

  names.forEach((name) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = name;
    btn.addEventListener('click', () => {
      const line = getAllLines(editor).find(
        (l) => l.dataset.type === 'character' && l.textContent.trim().toUpperCase() === name
      );
      if (line) {
        line.scrollIntoView({ behavior: 'smooth', block: 'center' });
        focusLineSimple(line);
      }
    });
    navEl.appendChild(btn);
  });
}

function focusLineSimple(line) {
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(line);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Update status bar cursor position.
 */
export function updateCursorStatus(editor, statusEl) {
  const lines = getAllLines(editor);
  const current = document.getSelection()?.anchorNode;
  let lineNum = 1;

  if (current) {
    const lineEl = current.nodeType === Node.TEXT_NODE
      ? current.parentElement?.closest?.('.line')
      : current.closest?.('.line');
    if (lineEl) {
      lineNum = lines.indexOf(lineEl) + 1;
    }
  }

  statusEl.textContent = `Line ${lineNum}`;
}

/**
 * Refresh page break markers in the editor.
 */
export function updatePagination(editor) {
  return applyPageBreaks(editor);
}
