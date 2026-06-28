import { getAllLines, getCurrentLine } from './editor-core.js';

/**
 * Extract unique character names from script lines.
 */
export function getCharacterNames(editor) {
  const names = new Set();
  getAllLines(editor).forEach((line) => {
    if (line.dataset.type === 'character') {
      const name = line.textContent.trim().toUpperCase();
      if (name) names.add(name);
    }
  });
  return [...names].sort();
}

/**
 * Character name autocomplete dropdown.
 */
export function initAutocomplete(editor) {
  const dropdown = document.createElement('div');
  dropdown.className = 'autocomplete-dropdown hidden';
  dropdown.setAttribute('role', 'listbox');
  document.body.appendChild(dropdown);

  let activeIndex = -1;
  let matches = [];

  function hide() {
    dropdown.classList.add('hidden');
    activeIndex = -1;
    matches = [];
  }

  function show(line, query) {
    const names = getCharacterNames(editor).filter(
      (n) => n.startsWith(query.toUpperCase()) && n !== query.toUpperCase()
    );

    if (!names.length || !query.trim()) {
      hide();
      return;
    }

    matches = names;
    dropdown.innerHTML = names
      .map((n, i) => `<button type="button" role="option" data-index="${i}">${n}</button>`)
      .join('');

    const rect = line.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + 2}px`;
    dropdown.style.left = `${rect.left}px`;
    dropdown.classList.remove('hidden');
    activeIndex = 0;
    highlightActive();
  }

  function highlightActive() {
    dropdown.querySelectorAll('button').forEach((btn, i) => {
      btn.classList.toggle('active', i === activeIndex);
    });
  }

  function select(name) {
    const line = getCurrentLine();
    if (line) {
      line.textContent = name;
      const range = document.createRange();
      const sel = window.getSelection();
      const textNode = line.firstChild;
      if (textNode) {
        range.setStart(textNode, textNode.length);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    hide();
  }

  dropdown.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const btn = e.target.closest('button');
    if (btn) select(btn.textContent);
  });

  editor.addEventListener('input', () => {
    const line = getCurrentLine();
    if (!line || line.dataset.type !== 'character') {
      hide();
      return;
    }
    show(line, line.textContent.trim());
  });

  editor.addEventListener('keydown', (e) => {
    if (dropdown.classList.contains('hidden')) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, matches.length - 1);
      highlightActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      highlightActive();
    } else if (e.key === 'Enter' && activeIndex >= 0 && matches[activeIndex]) {
      e.preventDefault();
      e.stopImmediatePropagation();
      select(matches[activeIndex]);
    } else if (e.key === 'Escape') {
      hide();
    }
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && !editor.contains(e.target)) hide();
  });

  return { hide };
}
