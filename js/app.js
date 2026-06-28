import {
  ELEMENT_TYPES,
  ELEMENT_LABELS,
  ENTER_NEXT,
  UPPERCASE_TYPES,
} from './elements.js';
import {
  createLine,
  getCurrentLine,
  getAllLines,
  setLineType,
  insertLineAfter,
  focusLine,
  mergeWithPrevious,
  splitLineAtCursor,
  initEditorContent,
  serializeLines,
  detectType,
} from './editor-core.js';
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  saveToFile,
  openFromFile,
  downloadFile,
  sanitizeFilename,
  parseFileContent,
  parsePlainText,
} from './storage.js';
import { exportToFountain, parseFountain } from './fountain.js';
import {
  exportToPlainText,
  updateStats,
  updateSceneNav,
  updateCharacterNav,
  updateCursorStatus,
  updatePagination,
} from './stats.js';
import {
  createTitlePageData,
  renderTitlePage,
  readTitlePageFromDOM,
  buildPrintTitlePage,
} from './title-page.js';
import { initAutocomplete } from './autocomplete.js';
import { initFindReplace } from './find-replace.js';
import { initSyncManager } from './sync-ui.js';
import { generateLocalId, setLastOpenedScriptId } from './cloud-sync.js';
import { idbPutScript } from './idb.js';

const editor = document.getElementById('editor');
const scriptTitle = document.getElementById('script-title');
const fileInput = document.getElementById('file-input');
const elementBtns = document.querySelectorAll('.element-btn');
const sceneNav = document.getElementById('scene-nav');
const characterNav = document.getElementById('character-nav');
const titlePageView = document.getElementById('title-page-view');
const scriptView = document.getElementById('script-view');
const elementToolbar = document.getElementById('element-toolbar');
const printTitlePage = document.getElementById('print-title-page');
const statusView = document.getElementById('status-view');

const statElements = {
  statPages: document.getElementById('stat-pages'),
  statScenes: document.getElementById('stat-scenes'),
  statWords: document.getElementById('stat-words'),
};

const statusElement = document.getElementById('status-element');
const statusCursor = document.getElementById('status-cursor');
const statusSave = document.getElementById('status-save');

let currentElementType = 'scene-heading';
let fileHandle = null;
let isDirty = false;
let autoSaveTimer = null;
let titlePageData = createTitlePageData();
let viewMode = 'script'; // 'script' | 'title-page'
let syncManager = null;
let hasLoadedScript = false;

const autocomplete = initAutocomplete(editor);
const findReplace = initFindReplace(editor, () => {
  setDirty();
  scheduleAutoSave();
  refreshUI();
});

function getScriptSnapshot() {
  return {
    title: scriptTitle.value || 'Untitled Screenplay',
    lines: serializeLines(editor),
    titlePage: viewMode === 'title-page'
      ? readTitlePageFromDOM(titlePageView)
      : titlePageData,
  };
}

function setDirty(dirty = true) {
  isDirty = dirty;
  statusSave.textContent = dirty ? 'Unsaved changes' : 'Saved';
  statusSave.className = dirty ? 'unsaved' : 'saved';
}

function setCurrentElementType(type) {
  currentElementType = type;
  elementBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  statusElement.textContent = ELEMENT_LABELS[type];
}

function cycleElementType(forward = true) {
  const idx = ELEMENT_TYPES.indexOf(currentElementType);
  const next = forward
    ? ELEMENT_TYPES[(idx + 1) % ELEMENT_TYPES.length]
    : ELEMENT_TYPES[(idx - 1 + ELEMENT_TYPES.length) % ELEMENT_TYPES.length];
  setCurrentElementType(next);

  const line = getCurrentLine();
  if (line) setLineType(line, next);
}

function refreshUI() {
  const lines = serializeLines(editor);
  updateStats(editor, statElements, lines);
  updateSceneNav(editor, sceneNav);
  updateCharacterNav(editor, characterNav);
  updateCursorStatus(editor, statusCursor);
  requestAnimationFrame(() => updatePagination(editor));
}

function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    const snap = getScriptSnapshot();
    saveToLocalStorage(snap.title, snap.lines, snap.titlePage);

    const id = syncManager?.getCurrentScriptId();
    if (id) {
      await idbPutScript({
        id,
        title: snap.title,
        titlePage: snap.titlePage,
        lines: snap.lines,
        updatedAt: new Date().toISOString(),
      });
    }

    syncManager?.scheduleCloudSave();
  }, 2000);
}

function setSyncStatus(text) {
  if (text) statusSave.textContent = text;
}

function normalizeLine(line) {
  if (!line) return;
  const type = line.dataset.type;
  if (UPPERCASE_TYPES.has(type)) {
    const text = line.textContent.trim();
    if (text) line.textContent = text.toUpperCase();
  }
}

function isAutocompleteOpen() {
  return !document.querySelector('.autocomplete-dropdown')?.classList.contains('hidden');
}

function handleEnter(e) {
  if (isAutocompleteOpen()) return;
  e.preventDefault();
  const line = getCurrentLine();
  if (!line) return;

  const currentType = line.dataset.type;
  const { before, after } = splitLineAtCursor(line);
  line.textContent = before;

  let nextType = ENTER_NEXT[currentType] || 'action';

  if (currentType === 'dialogue' && !after.trim()) {
    nextType = 'action';
  }
  if (currentType === 'action' && !after.trim() && !before.trim()) {
    nextType = 'character';
  }

  insertLineAfter(line, nextType, after);
  setCurrentElementType(nextType);
  normalizeLine(line);
  setDirty();
  refreshUI();
}

function handleBackspace(e) {
  const line = getCurrentLine();
  if (!line) return;

  const sel = window.getSelection();
  if (!sel.rangeCount) return;

  const atStart =
    sel.anchorOffset === 0 &&
    (sel.anchorNode === line.firstChild || sel.anchorNode === line);

  if (atStart && line.previousElementSibling) {
    e.preventDefault();
    mergeWithPrevious(line);
    setDirty();
    refreshUI();
  }
}

function handleTab(e) {
  if (isAutocompleteOpen()) return;
  e.preventDefault();
  cycleElementType(!e.shiftKey);
  setDirty();
}

function handleElementShortcut(e) {
  const num = parseInt(e.key, 10);
  if (num >= 1 && num <= 6) {
    e.preventDefault();
    const type = ELEMENT_TYPES[num - 1];
    setCurrentElementType(type);
    const line = getCurrentLine();
    if (line) {
      setLineType(line, type);
      setDirty();
      refreshUI();
    }
  }
}

function ensureEditorStructure() {
  const lines = getAllLines(editor);
  if (lines.length === 0) {
    editor.appendChild(createLine(currentElementType));
    focusLine(editor.querySelector('.line'));
    return;
  }

  [...editor.childNodes].forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      const line = createLine(currentElementType, node.textContent);
      node.replaceWith(line);
    } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('line')) {
      const line = createLine(currentElementType, node.textContent);
      node.replaceWith(line);
    }
  });
}

function handleInput() {
  ensureEditorStructure();

  const line = getCurrentLine();
  if (line && !line.dataset.type) {
    line.dataset.type = currentElementType;
    line.classList.add(currentElementType);
  }

  setDirty();
  scheduleAutoSave();
  refreshUI();
}

function handlePaste(e) {
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  const line = getCurrentLine();
  if (!line) return;

  const pastedLines = text.split(/\r?\n/);
  const { before } = splitLineAtCursor(line);
  line.textContent = before + pastedLines[0];

  let prev = line;
  for (let i = 1; i < pastedLines.length; i++) {
    const detected = detectType(pastedLines[i]);
    const type = detected || (prev.dataset.type === 'character' ? 'dialogue' : 'action');
    prev = insertLineAfter(prev, type, pastedLines[i]);
  }

  setDirty();
  scheduleAutoSave();
  refreshUI();
}

function setViewMode(mode) {
  viewMode = mode;

  if (mode === 'title-page') {
    titlePageData.title = titlePageData.title || scriptTitle.value;
    renderTitlePage(titlePageView, titlePageData, (data) => {
      titlePageData = data;
      if (data.title) scriptTitle.value = data.title;
      setDirty();
      scheduleAutoSave();
    });
    titlePageView.classList.remove('hidden');
    scriptView.classList.add('hidden');
    elementToolbar.classList.add('hidden');
    statusView.textContent = 'Title Page';
    statusElement.textContent = '—';
    document.getElementById('btn-title-page').classList.add('active');
  } else {
    titlePageData = readTitlePageFromDOM(titlePageView);
    titlePageView.classList.add('hidden');
    scriptView.classList.remove('hidden');
    elementToolbar.classList.remove('hidden');
    statusView.textContent = 'Script';
    document.getElementById('btn-title-page').classList.remove('active');
    refreshUI();
  }
}

function toggleTitlePage() {
  setViewMode(viewMode === 'title-page' ? 'script' : 'title-page');
}

function preparePrintTitlePage() {
  printTitlePage.innerHTML = '';
  const hasContent = titlePageData.title || titlePageData.author || titlePageData.contact;
  if (hasContent) {
    printTitlePage.appendChild(buildPrintTitlePage(titlePageData));
  }
}

async function saveScript() {
  if (viewMode === 'title-page') {
    titlePageData = readTitlePageFromDOM(titlePageView);
  }
  const snap = getScriptSnapshot();
  const result = await saveToFile(snap.title, snap.lines, snap.titlePage, fileHandle);

  if (result) {
    if (result.handle) fileHandle = result.handle;
    saveToLocalStorage(snap.title, snap.lines, snap.titlePage);
    setDirty(false);
    statusSave.textContent = `Saved ${result.filename || ''}`.trim();
    statusSave.className = 'saved';
  }

  await syncManager?.pushToCloud(true);
}

async function openScript() {
  if (isDirty && !confirm('You have unsaved changes. Open anyway?')) return;

  const data = await openFromFile();
  if (!data) {
    fileInput.click();
    return;
  }

  loadScript(data);
  fileHandle = data.handle || null;
}

function loadScript({ id, title, lines, titlePage }) {
  scriptTitle.value = title;
  titlePageData = titlePage || createTitlePageData({ title });
  initEditorContent(editor, lines);
  renderTitlePage(titlePageView, titlePageData, (data) => {
    titlePageData = data;
    if (data.title) scriptTitle.value = data.title;
    setDirty();
    scheduleAutoSave();
  });
  setViewMode('script');
  setDirty(false);
  hasLoadedScript = true;

  if (id) {
    syncManager?.setCurrentScriptId(id);
    setLastOpenedScriptId(id);
  }

  refreshUI();
  syncManager?.refreshLibrary();
}

async function newScript() {
  if (isDirty && !confirm('You have unsaved changes. Create new script?')) return;

  scriptTitle.value = '';
  fileHandle = null;
  titlePageData = createTitlePageData();

  const cloudCreated = await syncManager?.handleNewScript();
  if (!cloudCreated) {
    const localId = generateLocalId();
    syncManager?.setCurrentScriptId(localId);
    initEditorContent(editor);
    renderTitlePage(titlePageView, titlePageData, (data) => {
      titlePageData = data;
      setDirty();
      scheduleAutoSave();
    });
    setViewMode('script');
    setCurrentElementType('scene-heading');
    setDirty(false);
    refreshUI();
    return;
  }

  setViewMode('script');
  setCurrentElementType('scene-heading');
  setDirty(false);
  refreshUI();
}

function exportScript(format) {
  if (viewMode === 'title-page') {
    titlePageData = readTitlePageFromDOM(titlePageView);
  }
  const title = scriptTitle.value || 'Untitled Screenplay';
  const lines = serializeLines(editor);

  if (format === 'fountain') {
    const text = exportToFountain(lines, titlePageData);
    downloadFile(`${sanitizeFilename(title)}.fountain`, text, 'text/plain');
  } else {
    const text = exportToPlainText(lines);
    downloadFile(`${sanitizeFilename(title)}.txt`, text, 'text/plain');
  }
}

function loadTheme() {
  const theme = localStorage.getItem('screenplay-theme') || 'dark';
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
}

function toggleTheme() {
  const isLight = document.documentElement.dataset.theme === 'light';
  const next = isLight ? 'dark' : 'light';
  document.documentElement.dataset.theme = next === 'light' ? 'light' : 'dark';
  localStorage.setItem('screenplay-theme', next);
}

function bindEvents() {
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleEnter(e);
    else if (e.key === 'Backspace') handleBackspace(e);
    else if (e.key === 'Tab') handleTab(e);
    else if (e.ctrlKey || e.metaKey) {
      if (e.key === 's') { e.preventDefault(); saveScript(); }
      else if (e.key === 'f') { e.preventDefault(); findReplace.open('find'); }
      else if (e.key === 'h') { e.preventDefault(); findReplace.open('replace'); }
      else if (e.key >= '1' && e.key <= '6') handleElementShortcut(e);
    }
  });

  editor.addEventListener('input', handleInput);
  editor.addEventListener('paste', handlePaste);
  editor.addEventListener('click', refreshUI);
  editor.addEventListener('keyup', refreshUI);

  editor.addEventListener('blur', (e) => {
    const line = e.target.closest?.('.line') || getCurrentLine();
    if (line) normalizeLine(line);
  }, true);

  elementBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      setCurrentElementType(btn.dataset.type);
      const line = getCurrentLine();
      if (line) {
        setLineType(line, btn.dataset.type);
        setDirty();
        refreshUI();
      }
    });
  });

  scriptTitle.addEventListener('input', () => {
    titlePageData.title = scriptTitle.value;
    setDirty();
    scheduleAutoSave();
  });

  document.getElementById('btn-new').addEventListener('click', () => newScript());
  document.getElementById('btn-open').addEventListener('click', openScript);
  document.getElementById('btn-save').addEventListener('click', saveScript);
  document.getElementById('btn-title-page').addEventListener('click', toggleTitlePage);
  document.getElementById('btn-print').addEventListener('click', () => {
    preparePrintTitlePage();
    window.print();
  });
  document.getElementById('btn-theme').addEventListener('click', toggleTheme);

  const exportBtn = document.getElementById('btn-export');
  const exportMenu = document.getElementById('export-menu');
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.classList.toggle('hidden');
  });
  exportMenu.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      exportScript(btn.dataset.format);
      exportMenu.classList.add('hidden');
    });
  });
  document.addEventListener('click', () => exportMenu.classList.add('hidden'));

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      let data;
      if (file.name.endsWith('.fountain')) {
        data = parseFountain(text);
      } else if (file.name.endsWith('.txt')) {
        data = { title: file.name.replace(/\.txt$/i, ''), lines: parsePlainText(text), titlePage: null };
      } else {
        data = parseFileContent(text);
      }
      loadScript(data);
      fileHandle = null;
    } catch (err) {
      alert('Could not open file: ' + err.message);
    }
    fileInput.value = '';
  });

  window.addEventListener('beforeprint', preparePrintTitlePage);

  window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
      const snap = getScriptSnapshot();
      saveToLocalStorage(snap.title, snap.lines, snap.titlePage);
      syncManager?.pushToCloud(true);
      e.preventDefault();
    }
  });

  document.getElementById('btn-sidebar')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
}

async function init() {
  loadTheme();
  bindEvents();

  try {
    syncManager = initSyncManager({
      loadScript,
      getSnapshot: getScriptSnapshot,
      setDirty,
      setSyncStatus,
      isDirty: () => isDirty,
      confirmDiscard: () => confirm('You have unsaved changes. Continue?'),
      hasLoadedScript: () => hasLoadedScript,
    });

    const syncResult = await syncManager.init();

    if (!syncResult.skipLocalDraft) {
      const draft = loadFromLocalStorage();
      if (draft?.lines?.length) {
        const localId = generateLocalId();
        syncManager.setCurrentScriptId(localId);
        scriptTitle.value = draft.title || '';
        titlePageData = draft.titlePage || createTitlePageData({ title: draft.title });
        initEditorContent(editor, draft.lines);
        hasLoadedScript = true;
      } else {
        initEditorContent(editor);
        syncManager.setCurrentScriptId(generateLocalId());
      }
    }
  } catch (err) {
    console.error('Sync init failed, running in local mode:', err);
    initEditorContent(editor);
  }

  renderTitlePage(titlePageView, titlePageData, (data) => {
    titlePageData = data;
    if (data.title) scriptTitle.value = data.title;
    setDirty();
    scheduleAutoSave();
  });

  setCurrentElementType('scene-heading');
  setDirty(false);
  refreshUI();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
