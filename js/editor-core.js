import { ELEMENT_TYPES, UPPERCASE_TYPES } from './elements.js';

/**
 * Create a new line element with the given type and optional text.
 */
export function createLine(type = 'action', text = '') {
  const line = document.createElement('div');
  line.className = `line ${type}`;
  line.dataset.type = type;
  line.textContent = text;
  return line;
}

/**
 * Get the line element containing the current selection.
 */
export function getCurrentLine() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;

  let node = sel.anchorNode;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  return node?.closest?.('.line') ?? null;
}

/**
 * Get all line elements in the editor.
 */
export function getAllLines(editor) {
  return [...editor.querySelectorAll('.line')];
}

/**
 * Set the type of a line, updating class and data attribute.
 */
export function setLineType(line, type) {
  ELEMENT_TYPES.forEach((t) => line.classList.remove(t));
  line.classList.add(type);
  line.dataset.type = type;

  if (UPPERCASE_TYPES.has(type) && line.textContent.trim()) {
    line.textContent = line.textContent.toUpperCase();
  }
}

/**
 * Insert a new line after the given line and focus it.
 */
export function insertLineAfter(line, type, text = '') {
  const newLine = createLine(type, text);
  line.after(newLine);
  focusLine(newLine, text.length);
  return newLine;
}

/**
 * Place cursor at end (or offset) of a line.
 */
export function focusLine(line, offset = null) {
  const range = document.createRange();
  const sel = window.getSelection();
  const textNode = line.firstChild;

  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
    const pos = offset ?? textNode.length;
    range.setStart(textNode, Math.min(pos, textNode.length));
    range.collapse(true);
  } else {
    range.selectNodeContents(line);
    range.collapse(false);
  }

  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Merge line content into previous line and remove current.
 */
export function mergeWithPrevious(line) {
  const prev = line.previousElementSibling;
  if (!prev) return null;

  const prevText = prev.textContent;
  prev.textContent = prevText + line.textContent;
  line.remove();
  focusLine(prev, prevText.length);
  return prev;
}

/**
 * Split line at cursor; returns { before, after } text portions.
 */
export function splitLineAtCursor(line) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return { before: line.textContent, after: '' };

  const range = sel.getRangeAt(0);
  if (!line.contains(range.startContainer)) {
    return { before: line.textContent, after: '' };
  }

  const fullRange = document.createRange();
  fullRange.selectNodeContents(line);

  const beforeRange = fullRange.cloneRange();
  beforeRange.setEnd(range.startContainer, range.startOffset);

  const afterRange = fullRange.cloneRange();
  afterRange.setStart(range.startContainer, range.startOffset);

  const div = document.createElement('div');
  div.appendChild(beforeRange.cloneContents());
  const before = div.textContent;

  div.textContent = '';
  div.appendChild(afterRange.cloneContents());
  const after = div.textContent;

  return { before, after };
}

/**
 * Initialize editor with default content or parsed lines.
 */
export function initEditorContent(editor, lines = null) {
  editor.innerHTML = '';

  if (lines && lines.length > 0) {
    lines.forEach(({ type, text }) => editor.appendChild(createLine(type, text)));
  } else {
    editor.appendChild(createLine('scene-heading', 'INT. LOCATION - DAY'));
    editor.appendChild(createLine('action', ''));
  }

  focusLine(editor.querySelector('.line'));
}

/**
 * Serialize editor lines to JSON-friendly array.
 */
export function serializeLines(editor) {
  return getAllLines(editor).map((line) => ({
    type: line.dataset.type,
    text: line.textContent,
  }));
}

/**
 * Detect element type from line content (smart formatting).
 */
export function detectType(text) {
  const trimmed = text.trim();

  if (/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.|EST\.)/i.test(trimmed)) {
    return 'scene-heading';
  }
  if (/^(FADE IN:|FADE OUT\.|CUT TO:|DISSOLVE TO:)/i.test(trimmed)) {
    return 'transition';
  }
  if (/^\(.+\)$/.test(trimmed)) {
    return 'parenthetical';
  }
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 0 && trimmed.length < 40 && !trimmed.includes('.')) {
    return 'character';
  }
  return null;
}
