export const DEFAULT_TITLE_PAGE = {
  title: '',
  author: '',
  basedOn: '',
  contact: '',
  draftDate: '',
};

export function createTitlePageData(overrides = {}) {
  return { ...DEFAULT_TITLE_PAGE, ...overrides };
}

export function renderTitlePage(container, data, onChange) {
  container.innerHTML = `
    <div class="title-page">
      <div class="title-page-spacer"></div>
      <input type="text" class="tp-field tp-title" placeholder="TITLE" value="${esc(data.title)}" spellcheck="false">
      <p class="tp-by">by</p>
      <input type="text" class="tp-field tp-author" placeholder="Author Name" value="${esc(data.author)}" spellcheck="false">
      ${data.basedOn || container.dataset.showBasedOn === 'true' ? `<input type="text" class="tp-field tp-based" placeholder="Based on..." value="${esc(data.basedOn)}" spellcheck="false">` : ''}
      <div class="title-page-bottom">
        <textarea class="tp-field tp-contact" placeholder="Contact info" rows="4" spellcheck="false">${esc(data.contact)}</textarea>
        <input type="text" class="tp-field tp-date" placeholder="Draft date" value="${esc(data.draftDate)}" spellcheck="false">
      </div>
    </div>
  `;

  container.querySelectorAll('.tp-field').forEach((field) => {
    field.addEventListener('input', () => {
      onChange(readTitlePageFromDOM(container));
    });
  });
}

export function readTitlePageFromDOM(container) {
  return {
    title: container.querySelector('.tp-title')?.value || '',
    author: container.querySelector('.tp-author')?.value || '',
    basedOn: container.querySelector('.tp-based')?.value || '',
    contact: container.querySelector('.tp-contact')?.value || '',
    draftDate: container.querySelector('.tp-date')?.value || '',
  };
}

export function syncTitlePageFields(container, data) {
  const map = {
    '.tp-title': data.title,
    '.tp-author': data.author,
    '.tp-based': data.basedOn,
    '.tp-contact': data.contact,
    '.tp-date': data.draftDate,
  };
  for (const [sel, val] of Object.entries(map)) {
    const el = container.querySelector(sel);
    if (el) el.value = val || '';
  }
}

function esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

export function buildPrintTitlePage(data) {
  const page = document.createElement('div');
  page.className = 'title-page print-title-page';
  page.innerHTML = `
    <div class="title-page-spacer"></div>
    ${data.title ? `<p class="tp-display tp-title">${escText(data.title)}</p>` : ''}
    ${data.author ? `<p class="tp-by">by</p><p class="tp-display tp-author">${escText(data.author)}</p>` : ''}
    ${data.basedOn ? `<p class="tp-display tp-based">Based on ${escText(data.basedOn)}</p>` : ''}
    <div class="title-page-bottom">
      ${data.contact ? `<p class="tp-display tp-contact">${escText(data.contact).replace(/\n/g, '<br>')}</p>` : ''}
      ${data.draftDate ? `<p class="tp-display tp-date">${escText(data.draftDate)}</p>` : ''}
    </div>
  `;
  return page;
}

function escText(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
