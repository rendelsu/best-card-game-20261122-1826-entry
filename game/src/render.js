// Drawing only: the game's state and the current screen in, pixels out. The 1280x720
// table is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Cards are drawn as rounded rectangles with an element colour and a drawn shape
// (flame, mountain, flake, bolt, leaf), a cost gem, and attack/health orbs — the element
// is told by colour and shape, never by text alone. Display positions ease toward their
// slots, so cards slide, fan and snap into place instead of jumping.
import {
  BACK_CARD,
  BOARD_CARD,
  ELEMENTS,
  FIELD,
  FONT,
  HAND_CARD,
  LAYOUT,
  MANA_MAX,
  PALETTE,
  boardLayout,
  enemyHandLayout,
  handLayout,
} from './config.js';
import { CARDS } from './cards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';

const HOVER_LIFT = 14;

/** Ember sparks drifting over the table; placed by a pure function of time, so a shot at
 * a fixed time always shows the same sparks. */
const SPARKS = [];
for (let index = 0; index < 26; index += 1) {
  SPARKS.push({
    x: (index * 197.3) % FIELD.width,
    y: (index * 311.7) % FIELD.height,
    size: 2 + (index % 3),
    speed: 12 + (index % 5) * 6,
    drift: (index % 7) - 3,
  });
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function wrapText(context, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line === '' ? word : `${line} ${word}`;
    if (context.measureText(next).width > maxWidth && line !== '') {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line !== '') lines.push(line);
  return lines.slice(0, 2);
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, cssWidth: 0, cssHeight: 0 };
  /** Where each card is drawn now, easing toward its slot; keyed by card uid. */
  const shown = new Map();
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const cssWidth = window.innerWidth;
    const cssHeight = window.innerHeight;
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
    view.cssWidth = cssWidth;
    view.cssHeight = cssHeight;
  }

  function font(size, weight) {
    const key = `${weight ?? ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight === 'bold' ? '700 ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align, weight) {
    context.font = font(size, weight);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  /** Logical (1280x720) coordinates for a pointer event's client position. */
  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = view.scale / (window.devicePixelRatio || 1);
    return {
      x: (clientX - rect.left - view.x / (window.devicePixelRatio || 1)) / scale,
      y: (clientY - rect.top - view.y / (window.devicePixelRatio || 1)) / scale,
    };
  }

  function drawGlyph(glyph, x, y, size, color) {
    context.save();
    context.translate(x, y);
    context.fillStyle = color;
    context.strokeStyle = color;
    context.lineWidth = Math.max(2, size / 10);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    if (glyph === 'flame') {
      context.beginPath();
      context.moveTo(0, -size / 2);
      context.bezierCurveTo(size / 2, -size / 6, size / 3, size / 3, 0, size / 2);
      context.bezierCurveTo(-size / 3, size / 3, -size / 2, -size / 6, 0, -size / 2);
      context.fill();
    } else if (glyph === 'mountain') {
      context.beginPath();
      context.moveTo(-size / 2, size / 2);
      context.lineTo(0, -size / 2);
      context.lineTo(size / 2, size / 2);
      context.closePath();
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.85)';
      context.beginPath();
      context.moveTo(-size / 6, -size / 6);
      context.lineTo(0, -size / 2);
      context.lineTo(size / 6, -size / 6);
      context.lineTo(0, 0);
      context.closePath();
      context.fill();
    } else if (glyph === 'flake') {
      for (let arm = 0; arm < 3; arm += 1) {
        context.save();
        context.rotate((arm * Math.PI) / 3);
        context.beginPath();
        context.moveTo(0, -size / 2);
        context.lineTo(0, size / 2);
        context.moveTo(-size / 5, -size / 4);
        context.lineTo(0, -size / 2);
        context.lineTo(size / 5, -size / 4);
        context.moveTo(-size / 5, size / 4);
        context.lineTo(0, size / 2);
        context.lineTo(size / 5, size / 4);
        context.stroke();
        context.restore();
      }
    } else if (glyph === 'bolt') {
      context.beginPath();
      context.moveTo(size / 6, -size / 2);
      context.lineTo(-size / 3, size / 8);
      context.lineTo(-size / 24, size / 8);
      context.lineTo(-size / 6, size / 2);
      context.lineTo(size / 3, -size / 8);
      context.lineTo(size / 24, -size / 8);
      context.closePath();
      context.fill();
    } else {
      // leaf
      context.beginPath();
      context.moveTo(0, -size / 2);
      context.bezierCurveTo(size / 2, -size / 6, size / 3, size / 2, 0, size / 2);
      context.bezierCurveTo(-size / 3, size / 2, -size / 2, -size / 6, 0, -size / 2);
      context.fill();
      context.strokeStyle = 'rgba(0,0,0,0.35)';
      context.beginPath();
      context.moveTo(0, -size / 3);
      context.lineTo(0, size / 3);
      context.stroke();
    }
    context.restore();
  }

  function drawOrb(x, y, radius, fill, label) {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = fill;
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = 'rgba(255,255,255,0.75)';
    context.stroke();
    text(label, x, y + radius * 0.38, radius * 1.05, '#ffffff', 'center', 'bold');
  }

  function drawCard(card, x, y, width, height, options) {
    const opts = options ?? {};
    const element = ELEMENTS[card.element];
    const scale = width / HAND_CARD.width;
    context.save();
    if (opts.rotation) {
      context.translate(x + width / 2, y + height / 2);
      context.rotate(opts.rotation);
      context.translate(-width / 2, -height / 2);
      x = 0;
      y = 0;
    }
    if (opts.faceDown) {
      roundRect(context, x, y, width, height, 10 * scale);
      context.fillStyle = '#5d1f24';
      context.fill();
      context.lineWidth = 2;
      context.strokeStyle = PALETTE.gold;
      context.stroke();
      drawGlyph('flame', x + width / 2, y + height / 2, height * 0.4, PALETTE.gold);
      context.restore();
      return;
    }
    if (opts.dim) context.globalAlpha = 0.55;
    roundRect(context, x, y, width, height, 10 * scale);
    context.fillStyle = '#f7f1e3';
    context.fill();
    context.lineWidth = opts.selected ? 4 : 2;
    context.strokeStyle = opts.selected ? PALETTE.gold : element.dark;
    context.stroke();
    // Element band with the name.
    roundRect(context, x + 3, y + 3, width - 6, 30 * scale, 7 * scale);
    context.fillStyle = element.main;
    context.fill();
    // The name is centred in the space right of the cost orb: shrink it until it
    // fits, and cut the longest name with an ellipsis rather than letting it slide
    // under the orb or the next card.
    const nameRoom = width - 34 * scale;
    let nameSize = 13 * scale;
    context.font = font(nameSize, 'bold');
    while (nameSize > 9.5 * scale && context.measureText(card.name).width > nameRoom) {
      nameSize -= 0.5 * scale;
      context.font = font(nameSize, 'bold');
    }
    let shown = card.name;
    if (context.measureText(shown).width > nameRoom) {
      while (shown.length > 1 && context.measureText(`${shown}…`).width > nameRoom) shown = shown.slice(0, -1);
      shown += '…';
    }
    context.fillStyle = element.ink;
    context.textAlign = 'center';
    context.fillText(shown, x + width / 2 + 12 * scale, y + 21 * scale);
    // The element's shape, big in the middle.
    drawGlyph(element.glyph, x + width / 2, y + height * 0.44, 46 * scale, element.main);
    if (card.kind === 'spell') {
      text('SPELL', x + width / 2, y + height * 0.62, 11 * scale, element.dark, 'center', 'bold');
    } else if (card.guard) {
      text('GUARD', x + width / 2, y + height * 0.62, 11 * scale, element.dark, 'center', 'bold');
    }
    // Rules text, wrapped to two lines.
    context.font = font(10.5 * scale);
    context.fillStyle = '#3a352c';
    context.textAlign = 'center';
    const lines = wrapText(context, card.text, width - 16 * scale);
    lines.forEach((line, index) => {
      context.fillText(line, x + width / 2, y + height - 44 * scale + index * 13 * scale);
    });
    // Cost gem, top left.
    drawOrb(x + 14 * scale, y + 14 * scale, 13 * scale, '#2f6fb2', String(card.cost));
    if (card.kind === 'creature') {
      drawOrb(x + 16 * scale, y + height - 16 * scale, 13 * scale, '#d97b2b', String(card.atk));
      drawOrb(x + width - 16 * scale, y + height - 16 * scale, 13 * scale, '#b3372e', String(Math.max(0, card.hp)));
    }
    if (opts.ready) {
      roundRect(context, x - 3, y - 3, width + 6, height + 6, 12 * scale);
      context.lineWidth = 3;
      context.strokeStyle = '#7ee787';
      context.stroke();
    }
    context.restore();
  }

  function drawHero(side, isPlayer, selectable) {
    const spot = isPlayer ? LAYOUT.playerHero : LAYOUT.enemyHero;
    const color = isPlayer ? '#e8a13c' : PALETTE.enemy;
    context.beginPath();
    context.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
    context.fillStyle = isPlayer ? '#3a2a12' : '#3a1220';
    context.fill();
    context.lineWidth = 4;
    context.strokeStyle = color;
    context.stroke();
    if (selectable) {
      context.beginPath();
      context.arc(spot.x, spot.y, spot.r + 6, 0, Math.PI * 2);
      context.lineWidth = 3;
      context.strokeStyle = '#7ee787';
      context.stroke();
    }
    drawGlyph(isPlayer ? 'flame' : 'bolt', spot.x, spot.y - 12, 26, color);
    text(String(side.life), spot.x, spot.y + 26, 30, '#ffffff', 'center', 'bold');
    text(isPlayer ? 'YOU' : 'CINDER', spot.x, spot.y - spot.r - 8, 13, PALETTE.muted, 'center', 'bold');
    text('LIFE', spot.x, spot.y + spot.r + 16, 11, PALETTE.muted, 'center');
  }

  function drawTable(game, time) {
    context.fillStyle = PALETTE.feltDark;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.felt;
    context.beginPath();
    context.ellipse(FIELD.width / 2, FIELD.height / 2, 620, 330, 0, 0, Math.PI * 2);
    context.fill();
    context.lineWidth = 3;
    context.strokeStyle = PALETTE.feltLine;
    context.stroke();
    // Centre line between the two halves of the table.
    context.beginPath();
    context.moveTo(240, FIELD.height / 2);
    context.lineTo(1040, FIELD.height / 2);
    context.strokeStyle = 'rgba(255,255,255,0.14)';
    context.lineWidth = 2;
    context.stroke();
    // Drifting embers.
    for (const spark of SPARKS) {
      const y = ((spark.y - time * spark.speed) % FIELD.height + FIELD.height) % FIELD.height;
      const x = spark.x + Math.sin(time * 0.7 + spark.y) * 8 + spark.drift * time * 0.2;
      context.fillStyle = `rgba(242, 201, 76, ${0.25 + 0.2 * Math.sin(time + spark.x)})`;
      context.beginPath();
      context.arc(x, y, spark.size, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawTopBar(game, wins) {
    text('EMBER PACT', 24, 34, 20, PALETTE.text, 'left', 'bold');
    const banner =
      game.phase === 'over'
        ? game.winner === 'player'
          ? 'Victory is yours'
          : 'Cinder takes the pact'
        : game.turn === 'player'
          ? `TURN ${game.turnNumber} — Your move`
          : `TURN ${game.turnNumber} — Cinder is thinking…`;
    text(banner, FIELD.width / 2, 34, 18, PALETTE.gold, 'center', 'bold');
    text(`Wins ${wins}`, FIELD.width - 24, 34, 15, PALETTE.muted, 'right');
  }

  function drawMana(side) {
    text('MANA', LAYOUT.manaX, LAYOUT.manaY - 8, 13, PALETTE.muted, 'left', 'bold');
    for (let index = 0; index < MANA_MAX; index += 1) {
      const x = LAYOUT.manaX + 8 + index * 20;
      const y = LAYOUT.manaY + 12;
      context.save();
      context.translate(x, y);
      context.rotate(Math.PI / 4);
      context.fillStyle = index < side.mana ? PALETTE.mana : PALETTE.manaEmpty;
      context.fillRect(-7, -7, 14, 14);
      context.restore();
    }
    text(`${side.mana}/${side.maxMana}`, LAYOUT.manaX, LAYOUT.manaY + 44, 16, PALETTE.text, 'left', 'bold');
    text(`Deck ${side.deck.length}  ·  Discard ${side.discard.length}`, LAYOUT.manaX, LAYOUT.manaY + 66, 13, PALETTE.muted, 'left');
  }

  function drawLog(game) {
    const lines = game.log.slice(-2);
    lines.forEach((line, index) => {
      text(line, FIELD.width / 2, LAYOUT.logY + index * 20, 13, index === lines.length - 1 ? PALETTE.text : PALETTE.muted, 'center');
    });
  }

  function drawEndTurn(game, ui) {
    const button = LAYOUT.endTurn;
    const active = game.phase === 'play' && game.turn === 'player';
    roundRect(context, button.x, button.y, button.width, button.height, 10);
    context.fillStyle = active ? PALETTE.gold : '#3a443a';
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = active ? PALETTE.goldDark : PALETTE.panelEdge;
    context.stroke();
    text('END TURN', button.x + button.width / 2, button.y + 25, 16, active ? '#241c05' : PALETTE.muted, 'center', 'bold');
    text('(E)', button.x + button.width / 2, button.y + 44, 11, active ? '#5c4a12' : PALETTE.muted, 'center');
    if (ui.selectedUid !== null) {
      text('Choose a target — click a rival card or Cinder', FIELD.width / 2, LAYOUT.logY - 24, 14, PALETTE.gold, 'center', 'bold');
    }
  }

  function drawBoard(game, ui, snap) {
    const enemySlots = boardLayout(game.enemy.board.length, LAYOUT.enemyBoardY);
    game.enemy.board.forEach((creature, index) => {
      const slot = enemySlots[index];
      const shownPos = easeTo(creature.uid, slot.x, slot.y, snap);
      drawCard(creature, shownPos.x, shownPos.y, BOARD_CARD.width, BOARD_CARD.height, {
        selectable: ui.selectedUid !== null,
        ready: false,
      });
    });
    const playerSlots = boardLayout(game.player.board.length, LAYOUT.playerBoardY);
    game.player.board.forEach((creature, index) => {
      const slot = playerSlots[index];
      const shownPos = easeTo(creature.uid, slot.x, slot.y, snap);
      drawCard(creature, shownPos.x, shownPos.y, BOARD_CARD.width, BOARD_CARD.height, {
        selected: ui.selectedUid === creature.uid,
        ready: creature.canAttack && game.turn === 'player' && game.phase === 'play',
      });
    });
  }

  function easeTo(uid, x, y, snap) {
    const current = shown.get(uid);
    if (!current || snap) {
      const pos = { x, y };
      shown.set(uid, pos);
      return pos;
    }
    current.x += (x - current.x) * 0.25;
    current.y += (y - current.y) * 0.25;
    return current;
  }

  function drawHands(game, ui, snap) {
    const enemySlots = enemyHandLayout(game.enemy.hand.length);
    game.enemy.hand.forEach((card, index) => {
      const slot = enemySlots[index];
      drawCard(card, slot.x, slot.y, BACK_CARD.width, BACK_CARD.height, { faceDown: true });
    });
    const slots = handLayout(game.player.hand.length);
    game.player.hand.forEach((card, index) => {
      const slot = slots[index];
      const lifted = ui.hoverIndex === index ? HOVER_LIFT : 0;
      const shownPos = easeTo(card.uid, slot.x, slot.y - lifted, snap);
      drawCard(card, shownPos.x, shownPos.y, HAND_CARD.width, HAND_CARD.height, {
        rotation: slot.rotation,
        dim: card.cost > game.player.mana,
        selected: ui.selectedUid === card.uid,
      });
    });
  }

  function drawTitle(game, wins) {
    context.fillStyle = PALETTE.dim;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    text('EMBER PACT', FIELD.width / 2, 168, 84, PALETTE.gold, 'center', 'bold');
    text('A duel of cards and cunning', FIELD.width / 2, 208, 24, PALETTE.text, 'center');
    // Three sample cards, fanned like a dealt hand.
    const samples = [CARDS[7], CARDS[8], CARDS[10]];
    samples.forEach((card, index) => {
      const x = FIELD.width / 2 - 190 + index * 130;
      drawCard(
        { ...card, uid: `sample-${index}`, atk: card.atk ?? 0, hp: card.hp ?? 0, canAttack: false },
        x,
        268,
        HAND_CARD.width,
        HAND_CARD.height,
        { rotation: (index - 1) * 0.06 },
      );
    });
    text('Spend mana. Play creatures and spells. Reduce Cinder to 0 life.', FIELD.width / 2, 486, 17, PALETTE.text, 'center');
    text('Click a card to play it · Click your creature, then a target, to attack · E ends your turn', FIELD.width / 2, 516, 15, PALETTE.muted, 'center');
    text(wins > 0 ? `Pacts won: ${wins} — Click or press Space to duel again` : 'Click or press Space to begin', FIELD.width / 2, 570, 19, PALETTE.gold, 'center', 'bold');
  }

  function drawOver(game) {
    context.fillStyle = PALETTE.dim;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // A solid panel behind the result text: the duel underneath (board, hand, log)
    // must not show through the lines.
    roundRect(context, 300, 176, 680, 300, 16);
    context.fillStyle = PALETTE.panel;
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = PALETTE.panelEdge;
    context.stroke();
    const won = game.winner === 'player';
    text(won ? 'VICTORY' : 'DEFEAT', FIELD.width / 2, 240, 88, won ? PALETTE.gold : '#e5533d', 'center', 'bold');
    text(
      won ? 'The pact is yours — Cinder bows to the ember.' : 'Cinder takes the pact — the ember fades… for now.',
      FIELD.width / 2,
      292,
      20,
      PALETTE.text,
      'center',
    );
    text(`Final life — You ${game.player.life} · Cinder ${game.enemy.life}`, FIELD.width / 2, 336, 18, PALETTE.text, 'center');
    text(`Duel lasted ${game.turnNumber} turn${game.turnNumber === 1 ? '' : 's'}`, FIELD.width / 2, 366, 16, PALETTE.muted, 'center');
    text('Press Space or click to duel again', FIELD.width / 2, 420, 18, PALETTE.gold, 'center', 'bold');
  }

  /** Paint one frame. `ui` carries the selection and hover; `time` drives the embers. */
  function draw(game, screen, ui, time, wins, snap) {
    resize();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawTable(game, time);
    if (screen === SCREEN_TITLE) {
      drawTitle(game, wins);
      return;
    }
    drawTopBar(game, wins);
    drawHero(game.enemy, false, ui.selectedUid !== null && game.phase === 'play');
    drawHero(game.player, true, false);
    drawBoard(game, ui, snap);
    drawHands(game, ui, snap);
    drawMana(game.player);
    drawLog(game);
    drawEndTurn(game, ui);
    if (screen === SCREEN_OVER) drawOver(game);
  }

  return { draw, toLogical };
}
