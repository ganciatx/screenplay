/** Screenplay element types and cycling order */
export const ELEMENT_TYPES = [
  'scene-heading',
  'action',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
];

export const ELEMENT_LABELS = {
  'scene-heading': 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
};

/** Next element type after Enter, based on current type */
export const ENTER_NEXT = {
  'scene-heading': 'action',
  action: 'action',
  character: 'dialogue',
  parenthetical: 'dialogue',
  dialogue: 'action',
  transition: 'scene-heading',
};

/** Elements that should be uppercased on blur */
export const UPPERCASE_TYPES = new Set(['scene-heading', 'character', 'transition']);

/** Approximate lines per page for stats (industry ~55 lines) */
export const LINES_PER_PAGE = 55;
