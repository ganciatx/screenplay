import { getAllLines } from './editor-core.js';

/**
 * Find & replace panel.
 */
export function initFindReplace(editor, onChange) {
  const panel = document.getElementById('find-replace-panel');
  const findInput = document.getElementById('find-input');
  const replaceInput = document.getElementById('replace-input');
  const findCount = document.getElementById('find-count');
  const replaceRow = document.getElementById('replace-row');
  const replaceBtns = panel.querySelectorAll('.hidden-replace-btn');

  let matches = [];
  let currentMatch = -1;

  function clearLineHighlights() {
    editor.querySelectorAll('.line.find-match').forEach((l) => l.classList.remove('find-match'));
  }

  function buildMatches(query) {
    matches = [];
    if (!query) return;

    const lowerQuery = query.toLowerCase();
    getAllLines(editor).forEach((line, lineIndex) => {
      const text = line.textContent;
      const lowerText = text.toLowerCase();
      let start = 0;
      while (start < lowerText.length) {
        const idx = lowerText.indexOf(lowerQuery, start);
        if (idx === -1) break;
        matches.push({ line, lineIndex, start, end: idx + query.length });
        start = idx + 1;
      }
    });
  }

  function selectMatch(index) {
    if (index < 0 || index >= matches.length) return;

    const { line, start, end } = matches[index];
    currentMatch = index;

    line.classList.add('find-match');
    line.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const textNode = line.firstChild;
    if (textNode?.nodeType === Node.TEXT_NODE) {
      const range = document.createRange();
      const sel = window.getSelection();
      range.setStart(textNode, start);
      range.setEnd(textNode, Math.min(end, textNode.length));
      sel.removeAllRanges();
      sel.addRange(range);
    }

    findCount.textContent = `${index + 1} of ${matches.length}`;
  }

  function refreshFind() {
    clearLineHighlights();
    buildMatches(findInput.value);

    if (!matches.length) {
      currentMatch = -1;
      findCount.textContent = findInput.value ? 'No matches' : '';
      return;
    }

    selectMatch(currentMatch >= 0 ? Math.min(currentMatch, matches.length - 1) : 0);
  }

  function goToMatch(direction) {
    if (!matches.length) return;
    clearLineHighlights();
    const next = (currentMatch + direction + matches.length) % matches.length;
    selectMatch(next);
  }

  function replaceCurrent() {
    const query = findInput.value;
    const replacement = replaceInput.value;
    if (!query || currentMatch < 0) return;

    const { line, start, end } = matches[currentMatch];
    const text = line.textContent;
    line.textContent = text.slice(0, start) + replacement + text.slice(end);

    onChange();
    currentMatch = Math.min(currentMatch, matches.length - 2);
    refreshFind();
  }

  function replaceAll() {
    const query = findInput.value;
    const replacement = replaceInput.value;
    if (!query) return;

    getAllLines(editor).forEach((line) => {
      if (line.textContent.includes(query)) {
        line.textContent = line.textContent.split(query).join(replacement);
      }
    });

    onChange();
    refreshFind();
  }

  function open(mode = 'find') {
    panel.classList.remove('hidden');
    const isReplace = mode === 'replace';
    replaceRow.classList.toggle('hidden', !isReplace);
    replaceBtns.forEach((btn) => btn.classList.toggle('hidden', !isReplace));
    panel.querySelector('.panel-title').textContent = isReplace ? 'Find & Replace' : 'Find';
    findInput.focus();
    findInput.select();

    const sel = window.getSelection();
    if (sel?.toString().trim()) {
      findInput.value = sel.toString();
    }
    refreshFind();
  }

  function close() {
    panel.classList.add('hidden');
    clearLineHighlights();
    matches = [];
    currentMatch = -1;
    findCount.textContent = '';
  }

  findInput.addEventListener('input', () => {
    currentMatch = -1;
    refreshFind();
  });

  document.getElementById('find-next').addEventListener('click', () => goToMatch(1));
  document.getElementById('find-prev').addEventListener('click', () => goToMatch(-1));
  document.getElementById('find-close').addEventListener('click', close);
  document.getElementById('replace-one').addEventListener('click', replaceCurrent);
  document.getElementById('replace-all').addEventListener('click', replaceAll);

  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') goToMatch(e.shiftKey ? -1 : 1);
    if (e.key === 'Escape') close();
  });

  return { open, close };
}
