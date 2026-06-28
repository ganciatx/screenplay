/**
 * Per-script notes: story, character, and scene banks.
 */

export function createEmptyNotes() {
  return { story: '', characters: {}, scenes: {} };
}

export function normalizeNotes(notes) {
  if (!notes || typeof notes !== 'object') return createEmptyNotes();
  return {
    story: typeof notes.story === 'string' ? notes.story : '',
    characters: notes.characters && typeof notes.characters === 'object' ? { ...notes.characters } : {},
    scenes: notes.scenes && typeof notes.scenes === 'object' ? { ...notes.scenes } : {},
  };
}

export function getCharactersFromLines(lines) {
  const names = new Set();
  (lines || []).forEach((line) => {
    if (line.type === 'character') {
      const name = (line.text || '').trim().toUpperCase();
      if (name) names.add(name);
    }
  });
  return [...names].sort();
}

export function getScenesFromLines(lines) {
  const scenes = [];
  (lines || []).forEach((line) => {
    if (line.type === 'scene-heading' && (line.text || '').trim()) {
      scenes.push({
        key: String(scenes.length),
        heading: line.text.trim(),
      });
    }
  });
  return scenes;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/**
 * Render the notes panel into container.
 * @param {HTMLElement} container
 * @param {object} notes
 * @param {object[]} lines - serialized script lines
 * @param {object} [focus] - { type: 'story'|'character'|'scene', key?: string }
 */
export function renderNotesPanel(container, notes, lines, focus = null) {
  const data = normalizeNotes(notes);
  const characters = getCharactersFromLines(lines);
  const scenes = getScenesFromLines(lines);

  container.innerHTML = `
    <div class="notes-panel">
      <section class="notes-section" id="notes-section-story">
        <h2 class="notes-section-title">Story Notes</h2>
        <p class="notes-section-desc">Big-picture ideas, themes, arcs, and research for this script.</p>
        <textarea class="notes-textarea notes-textarea-story" data-note-type="story" spellcheck="true" placeholder="Overall story notes, logline, theme, structure, research…">${escapeHtml(data.story)}</textarea>
      </section>

      <section class="notes-section" id="notes-section-characters">
        <h2 class="notes-section-title">Character Notes</h2>
        <p class="notes-section-desc">Backstory, motivation, voice, and arc for each character in this script.</p>
        <div class="notes-list" id="notes-characters-list"></div>
      </section>

      <section class="notes-section" id="notes-section-scenes">
        <h2 class="notes-section-title">Scene Notes</h2>
        <p class="notes-section-desc">Purpose, beats, staging, and revision notes for each scene heading.</p>
        <div class="notes-list" id="notes-scenes-list"></div>
      </section>
    </div>
  `;

  const charList = container.querySelector('#notes-characters-list');
  if (!characters.length) {
    charList.innerHTML = '<p class="empty-state">Add character lines in the script to create character note sections.</p>';
  } else {
    characters.forEach((name) => {
      charList.appendChild(buildNoteBlock({
        id: `notes-char-${name}`,
        label: name,
        type: 'character',
        key: name,
        value: data.characters[name] || '',
        placeholder: `Notes for ${name} — backstory, motivation, voice, relationships…`,
      }));
    });
  }

  const sceneList = container.querySelector('#notes-scenes-list');
  if (!scenes.length) {
    sceneList.innerHTML = '<p class="empty-state">Add scene headings in the script to create scene note sections.</p>';
  } else {
    scenes.forEach((scene, i) => {
      sceneList.appendChild(buildNoteBlock({
        id: `notes-scene-${scene.key}`,
        label: `${i + 1}. ${scene.heading}`,
        type: 'scene',
        key: scene.key,
        value: data.scenes[scene.key] || '',
        placeholder: `Notes for this scene — purpose, beats, staging, to-do…`,
      }));
    });
  }

  if (focus) {
    requestAnimationFrame(() => scrollToNoteFocus(container, focus));
  }
}

function buildNoteBlock({ id, label, type, key, value, placeholder }) {
  const block = document.createElement('div');
  block.className = 'notes-block';
  block.id = id;
  block.innerHTML = `
    <label class="notes-block-label">${escapeHtml(label)}</label>
    <textarea
      class="notes-textarea notes-textarea-entry"
      data-note-type="${type}"
      data-note-key="${escapeHtml(key)}"
      spellcheck="true"
      placeholder="${escapeHtml(placeholder)}"
    >${escapeHtml(value)}</textarea>
  `;
  return block;
}

export function scrollToNoteFocus(container, focus) {
  if (!focus?.type) return;

  let target = null;
  if (focus.type === 'story') {
    target = container.querySelector('#notes-section-story');
  } else if (focus.type === 'character' && focus.key) {
    target = container.querySelector(`#notes-char-${CSS.escape(focus.key)}`);
  } else if (focus.type === 'scene' && focus.key != null) {
    target = container.querySelector(`#notes-scene-${CSS.escape(String(focus.key))}`);
  }

  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const textarea = target.querySelector('textarea');
    if (textarea) textarea.focus();
  }
}

export function readNotesFromDOM(container) {
  const notes = createEmptyNotes();
  const storyEl = container.querySelector('[data-note-type="story"]');
  if (storyEl) notes.story = storyEl.value;

  container.querySelectorAll('[data-note-type="character"]').forEach((el) => {
    const key = el.dataset.noteKey;
    if (key) notes.characters[key] = el.value;
  });

  container.querySelectorAll('[data-note-type="scene"]').forEach((el) => {
    const key = el.dataset.noteKey;
    if (key) notes.scenes[key] = el.value;
  });

  return notes;
}

export function bindNotesInput(container, onChange) {
  let timer = null;
  const handler = () => {
    clearTimeout(timer);
    timer = setTimeout(() => onChange(readNotesFromDOM(container)), 400);
  };

  container.addEventListener('input', (e) => {
    if (e.target.matches('.notes-textarea')) handler();
  });

  return () => {
    clearTimeout(timer);
    container.removeEventListener('input', handler);
  };
}
