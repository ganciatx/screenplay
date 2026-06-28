/** Usable script height per page (11in page minus 1in top/bottom padding) */
const PAGE_CONTENT_HEIGHT_PX = 9 * 96;

/** Extra spacing weight for elements with top margin (in line units) */
const SPACING_LINES = {
  'scene-heading': 1.5,
  action: 1,
  character: 1,
  parenthetical: 0,
  dialogue: 0,
  transition: 1,
};

/** Approximate characters per line by element type (Courier 12pt) */
const CHARS_PER_LINE = {
  'scene-heading': 60,
  action: 60,
  character: 30,
  parenthetical: 28,
  dialogue: 35,
  transition: 40,
};

/**
 * Estimate how many rendered lines a text line occupies.
 */
function estimateLineCount(type, text) {
  const chars = CHARS_PER_LINE[type] || 60;
  const textLines = Math.max(1, Math.ceil((text || '').length / chars) || (text === '' ? 1 : 0));
  const spacing = SPACING_LINES[type] || 0;
  return textLines + spacing;
}

/**
 * Calculate page breaks from serialized lines.
 * Returns array of line indices where a new page starts (0 always included).
 */
export function calculatePageBreaks(lines) {
  const breaks = [0];
  let currentLines = 0;
  const maxLines = 54;

  lines.forEach((line, index) => {
    const count = estimateLineCount(line.type, line.text);
    if (currentLines + count > maxLines && index > 0) {
      breaks.push(index);
      currentLines = count;
    } else {
      currentLines += count;
    }
  });

  return breaks;
}

/**
 * Count total pages from serialized lines.
 */
export function countPages(lines) {
  if (!lines.length) return 1;
  return calculatePageBreaks(lines).length;
}

/**
 * Apply page-break markers to live editor DOM based on measured positions.
 */
export function applyPageBreaks(editor) {
  const lines = [...editor.querySelectorAll('.line')];
  lines.forEach((line) => {
    line.classList.remove('page-start');
    line.removeAttribute('data-page');
  });

  if (!lines.length) return 1;

  const editorRect = editor.getBoundingClientRect();
  const pageHeight = PAGE_CONTENT_HEIGHT_PX;
  let pageNum = 1;
  let pageStartY = editorRect.top;

  lines[0].classList.add('page-start');
  lines[0].dataset.page = '1';

  for (const line of lines) {
    const rect = line.getBoundingClientRect();
    const y = rect.top - pageStartY;

    if (y >= pageHeight && !line.classList.contains('page-start')) {
      pageNum++;
      line.classList.add('page-start');
      line.dataset.page = String(pageNum);
      pageStartY = rect.top;
    }
  }

  return pageNum;
}
