/**
 * Export screenplay lines to Fountain format.
 * @see https://fountain.io/syntax
 */
export function exportToFountain(lines, titlePage = {}) {
  const parts = [];

  if (titlePage.title) parts.push(`Title: ${titlePage.title}`);
  if (titlePage.author) parts.push(`Author: ${titlePage.author}`);
  if (titlePage.basedOn) parts.push(`Based on: ${titlePage.basedOn}`);
  if (titlePage.contact) parts.push(`Contact: ${titlePage.contact.replace(/\n/g, ' ')}`);
  if (titlePage.draftDate) parts.push(`Draft date: ${titlePage.draftDate}`);

  if (parts.length) parts.push('');

  for (const { type, text } of lines) {
    const t = (text || '').trim();
    if (!t && type !== 'action') continue;

    switch (type) {
      case 'scene-heading':
        parts.push(t.toUpperCase());
        break;
      case 'action':
        if (t) parts.push(t);
        break;
      case 'character':
        parts.push(t.toUpperCase());
        break;
      case 'parenthetical':
        parts.push(t.startsWith('(') ? t : `(${t.replace(/^\(|\)$/g, '')})`);
        break;
      case 'dialogue':
        parts.push(t);
        break;
      case 'transition':
        parts.push(`> ${t.toUpperCase().replace(/^>\s*/, '')}`);
        break;
      default:
        if (t) parts.push(t);
    }
    parts.push('');
  }

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/**
 * Parse Fountain plain text into lines and title page (basic).
 */
export function parseFountain(text) {
  const rawLines = text.split(/\r?\n/);
  const titlePage = { title: '', author: '', basedOn: '', contact: '', draftDate: '' };
  const lines = [];
  let inTitlePage = true;
  let prevType = null;

  for (const raw of rawLines) {
    const trimmed = raw.trim();

    if (inTitlePage && /^[\w\s]+:/.test(trimmed) && !/^(INT\.|EXT\.)/i.test(trimmed)) {
      const [key, ...rest] = trimmed.split(':');
      const val = rest.join(':').trim();
      const k = key.trim().toLowerCase();
      if (k === 'title') titlePage.title = val;
      else if (k === 'author') titlePage.author = val;
      else if (k === 'based on') titlePage.basedOn = val;
      else if (k === 'contact') titlePage.contact = val;
      else if (k === 'draft date') titlePage.draftDate = val;
      continue;
    }

    if (!trimmed) {
      if (lines.length > 0 || !inTitlePage) inTitlePage = false;
      continue;
    }
    inTitlePage = false;

    let type = 'action';
    if (/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.|EST\.)/i.test(trimmed)) {
      type = 'scene-heading';
    } else if (/^>\s*/.test(trimmed) || /^(FADE IN:|FADE OUT\.|CUT TO:|DISSOLVE TO:)/i.test(trimmed)) {
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
    } else if (prevType === 'character' || prevType === 'parenthetical') {
      type = 'dialogue';
    }

    lines.push({ type, text: trimmed.replace(/^>\s*/, '') });
    prevType = type;
  }

  return {
    title: titlePage.title || 'Untitled Screenplay',
    titlePage,
    lines: lines.length ? lines : [{ type: 'action', text: '' }],
  };
}
