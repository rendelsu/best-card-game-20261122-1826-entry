// Every tuning number, colour and table position in one place. The table is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. Input hit-testing and drawing share the layout helpers here, so a
// card is clickable exactly where it is drawn.

export const FIELD = { width: 1280, height: 720 };

/** Both duelists start here; the first to 0 loses the pact. */
export const LIFE_START = 30;
/** Mana refills each turn and grows by 1, up to this. */
export const MANA_MAX = 10;
export const HAND_MAX = 8;
export const BOARD_MAX = 7;
export const START_HAND = 4;
/** Two copies of each of the 13 cards in the catalogue. */
export const DECK_COPIES = 2;

export const HAND_CARD = { width: 116, height: 158 };
export const BOARD_CARD = { width: 104, height: 140 };
export const BACK_CARD = { width: 62, height: 86 };

export const LAYOUT = {
  enemyHero: { x: 1180, y: 118, r: 46 },
  playerHero: { x: 1180, y: 602, r: 46 },
  enemyHandY: 14,
  enemyBoardY: 168,
  playerBoardY: 396,
  playerHandY: 544,
  endTurn: { x: 1112, y: 330, width: 132, height: 54 },
  logY: 352,
  manaX: 24,
  manaY: 648,
};

/** One element per card: colour AND a drawn shape tell it apart, never text alone. */
export const ELEMENTS = {
  ember: { name: 'Ember', main: '#e5533d', dark: '#7e2013', light: '#ffb199', ink: '#fff3ec', glyph: 'flame' },
  stone: { name: 'Stone', main: '#8d7d6b', dark: '#453b31', light: '#d8cbb8', ink: '#f7f1e8', glyph: 'mountain' },
  frost: { name: 'Frost', main: '#4fa8d8', dark: '#174e6e', light: '#bfe6f7', ink: '#eef8ff', glyph: 'flake' },
  storm: { name: 'Storm', main: '#9b6dd6', dark: '#452a72', light: '#d9c2f5', ink: '#f6effd', glyph: 'bolt' },
  thorn: { name: 'Thorn', main: '#5da85a', dark: '#275425', light: '#bfe8bd', ink: '#eefbee', glyph: 'leaf' },
};

export const PALETTE = {
  backdrop: '#101c17',
  felt: '#1d4a38',
  feltDark: '#143626',
  feltLine: '#2c6b4e',
  gold: '#f2c94c',
  goldDark: '#a8842a',
  panel: '#20261f',
  panelEdge: '#3a443a',
  text: '#f2f0e6',
  muted: '#a8b5a4',
  mana: '#5aa9e6',
  manaEmpty: '#2b3a44',
  life: '#e5533d',
  enemy: '#c94f6d',
  dim: 'rgba(10, 16, 12, 0.55)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the lifetime win count is kept between visits (this browser only). */
export const WINS_KEY = 'ember-pact.wins';

/** Slot positions for the player's hand, fanned a little around the table's centre. */
export function handLayout(count) {
  const positions = [];
  if (count === 0) return positions;
  const step = count === 1 ? 0 : Math.min(116, Math.max(44, (880 - HAND_CARD.width) / (count - 1)));
  const total = HAND_CARD.width + step * (count - 1);
  const mid = (count - 1) / 2;
  for (let index = 0; index < count; index += 1) {
    positions.push({
      x: FIELD.width / 2 - total / 2 + index * step,
      y: LAYOUT.playerHandY + Math.abs(index - mid) * 3,
      rotation: (index - mid) * 0.028,
    });
  }
  return positions;
}

/** Slot positions for a board row (either side), centred on the table. */
export function boardLayout(count, y) {
  const positions = [];
  const step = BOARD_CARD.width + 12;
  const total = count * step - 12;
  for (let index = 0; index < count; index += 1) {
    positions.push({ x: FIELD.width / 2 - total / 2 + index * step, y, rotation: 0 });
  }
  return positions;
}

/** Slot positions for the rival's face-down hand, across the top of the table. */
export function enemyHandLayout(count) {
  const positions = [];
  const step = 40;
  const total = BACK_CARD.width + step * (count - 1);
  for (let index = 0; index < count; index += 1) {
    positions.push({ x: FIELD.width / 2 - total / 2 + index * step, y: LAYOUT.enemyHandY, rotation: 0 });
  }
  return positions;
}
