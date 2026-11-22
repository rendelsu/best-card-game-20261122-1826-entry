// Pointer and keyboard input. Clicks are hit-tested against the same layout helpers the
// renderer draws with, so a card is clickable exactly where it is drawn. One-shot
// presses (start, restart, end turn) are queued as flags and taken once by the loop.
import { BOARD_CARD, HAND_CARD, LAYOUT, boardLayout, enemyHandLayout, handLayout } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_END_TURN = 2;

const CONFIRM = new Set(['Space', 'Enter']);
const END_TURN = new Set(['KeyE']);

function inside(point, x, y, width, height) {
  return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
}

function circleInside(point, cx, cy, radius) {
  const dx = point.x - cx;
  const dy = point.y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

export function createInput(canvas, renderer, callbacks) {
  let actions = 0;
  let hover = { x: -1, y: -1 };

  function logicalPoint(event) {
    return renderer.toLogical(event.clientX, event.clientY);
  }

  /** Which hand card, if any, sits under `point` (the hovered one is lifted, like drawn). */
  function handHit(game, point, hoverIndex) {
    const slots = handLayout(game.player.hand.length);
    for (let index = slots.length - 1; index >= 0; index -= 1) {
      const slot = slots[index];
      const y = slot.y - (hoverIndex === index ? 14 : 0);
      if (inside(point, slot.x, y, HAND_CARD.width, HAND_CARD.height)) return index;
    }
    return -1;
  }

  function boardHit(game, sideName, point) {
    const y = sideName === 'player' ? LAYOUT.playerBoardY : LAYOUT.enemyBoardY;
    const slots = boardLayout(game[sideName].board.length, y);
    for (let index = slots.length - 1; index >= 0; index -= 1) {
      if (inside(point, slots[index].x, slots[index].y, BOARD_CARD.width, BOARD_CARD.height)) {
        return game[sideName].board[index];
      }
    }
    return null;
  }

  canvas.addEventListener('pointermove', (event) => {
    hover = logicalPoint(event);
    callbacks.onHover(hover);
  });

  canvas.addEventListener('pointerdown', (event) => {
    const point = logicalPoint(event);
    callbacks.onClick(point, {
      handIndex: (game, hoverIndex) => handHit(game, point, hoverIndex),
      board: (game, sideName) => boardHit(game, sideName, point),
      inside,
      circleInside,
    });
  });

  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (END_TURN.has(event.code)) {
      if (!event.repeat) actions |= ACTION_END_TURN;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('blur', () => {
    hover = { x: -1, y: -1 };
    callbacks.onHover(hover);
  });

  return {
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    hoverPoint() {
      return hover;
    },
  };
}

/** The player's hand index under a logical point, or -1 (shared with the renderer). */
export function handIndexAt(game, point, hoverIndex) {
  const slots = handLayout(game.player.hand.length);
  for (let index = slots.length - 1; index >= 0; index -= 1) {
    const slot = slots[index];
    const y = slot.y - (hoverIndex === index ? 14 : 0);
    if (inside(point, slot.x, y, HAND_CARD.width, HAND_CARD.height)) return index;
  }
  return -1;
}

/** The board creature under a logical point, or null. */
export function boardCreatureAt(game, sideName, point) {
  const y = sideName === 'player' ? LAYOUT.playerBoardY : LAYOUT.enemyBoardY;
  const slots = boardLayout(game[sideName].board.length, y);
  for (let index = slots.length - 1; index >= 0; index -= 1) {
    if (inside(point, slots[index].x, slots[index].y, BOARD_CARD.width, BOARD_CARD.height)) {
      return game[sideName].board[index];
    }
  }
  return null;
}

/** True when a logical point falls on the rival's hero portrait. */
export function enemyHeroAt(point) {
  return circleInside(point, LAYOUT.enemyHero.x, LAYOUT.enemyHero.y, LAYOUT.enemyHero.r + 6);
}

/** True when a logical point falls on the End Turn button. */
export function endTurnAt(point) {
  const button = LAYOUT.endTurn;
  return inside(point, button.x, button.y, button.width, button.height);
}
