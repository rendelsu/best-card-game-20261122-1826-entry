// Boot and the one loop: the rival's turn is driven one AI action at a time so its plays
// can be watched, the player's clicks go through the rules in state.js, and the renderer
// paints what is there every frame. The game moves between three screens: title, play
// and game over.
//
// ?seed=N fixes the shuffle. ?shot=start|play|win|loss (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.
import { WINS_KEY } from './config.js';
import { createRandom } from './random.js';
import { PHASE_OVER, PHASE_PLAY, PHASE_TITLE, attack, createGame, endTurn, playCard, startMatch } from './state.js';
import { applyAction, nextAction } from './ai.js';
import { ACTION_CONFIRM, ACTION_END_TURN, boardCreatureAt, createInput, enemyHeroAt, endTurnAt, handIndexAt } from './input.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, createRenderer } from './render.js';
import { stageShot } from './shots.js';
import { createSound } from './sound.js';

/** How long the rival waits between its plays, so its turn can be followed. */
const ENEMY_STEP_MS = 520;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = createGame(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readWins() {
  try {
    return Number.parseInt(window.localStorage.getItem(WINS_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveWins(value) {
  try {
    window.localStorage.setItem(WINS_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the win count then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, game);
  let painted = 0;
  function paint() {
    const screen = scene.screen === PHASE_TITLE ? SCREEN_TITLE : scene.screen === PHASE_OVER ? SCREEN_OVER : SCREEN_PLAY;
    renderer.draw(game, screen, { selectedUid: null, hoverIndex: -1 }, 2.0, readWins(), true);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const ui = { selectedUid: null, hoverIndex: -1 };
  let screen = SCREEN_TITLE;
  let wins = readWins();
  let enemyTimer = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startDuel() {
    startMatch(game);
    ui.selectedUid = null;
    screen = SCREEN_PLAY;
    announce('The duel begins. Your move.');
  }

  function finishDuel() {
    screen = SCREEN_OVER;
    if (game.winner === 'player') {
      wins += 1;
      saveWins(wins);
      sound.win();
      announce(`Victory. Final life, you ${game.player.life}, Cinder ${game.enemy.life}.`);
    } else {
      sound.lose();
      announce(`Defeat. Final life, you ${game.player.life}, Cinder ${game.enemy.life}.`);
    }
  }

  /** One click on the table: play a card, pick an attacker, pick a target, end a turn. */
  function handleClick(point, hit) {
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      startDuel();
      return;
    }
    if (game.phase !== PHASE_PLAY || game.turn !== 'player') return;
    if (endTurnAt(point)) {
      endPlayerTurn();
      return;
    }
    const handIndex = handIndexAt(game, point, ui.hoverIndex);
    if (handIndex !== -1) {
      const card = game.player.hand[handIndex];
      if (card.kind === 'creature') {
        if (playCard(game, 'player', handIndex, null)) sound.play();
      } else if (card.damage > 0) {
        // A damage spell wants a target: remember it, and let the next click aim it.
        ui.selectedUid = card.uid;
        announce(`${card.name}: click a creature or Cinder to aim it.`);
      } else if (playCard(game, 'player', handIndex, null)) {
        sound.spell();
      }
      if (game.phase === PHASE_OVER) finishDuel();
      return;
    }
    // A selected spell is aimed by this click; a selected creature attacks with it.
    if (ui.selectedUid !== null) {
      const spellIndex = game.player.hand.findIndex((card) => card.uid === ui.selectedUid);
      if (spellIndex !== -1) {
        const target = enemyHeroAt(point)
          ? { kind: 'hero', side: 'enemy' }
          : pickCreatureTarget(game, point, 'enemy');
        if (target !== null && playCard(game, 'player', spellIndex, target)) sound.spell();
        ui.selectedUid = null;
        if (game.phase === PHASE_OVER) finishDuel();
        return;
      }
      const target = enemyHeroAt(point)
        ? { kind: 'hero', side: 'enemy' }
        : pickCreatureTarget(game, point, 'enemy');
      if (target !== null && attack(game, 'player', ui.selectedUid, target)) sound.attack();
      ui.selectedUid = null;
      if (game.phase === PHASE_OVER) finishDuel();
      return;
    }
    const own = boardCreatureAt(game, 'player', point);
    if (own !== null && own.canAttack) {
      ui.selectedUid = own.uid;
      announce(`${own.name} selected. Click a rival card or Cinder to attack.`);
    }
  }

  /** The enemy creature under the point, as an attack target, or null. */
  function pickCreatureTarget(gameState, point, sideName) {
    const creature = boardCreatureAt(gameState, sideName, point);
    return creature === null ? null : { kind: 'creature', uid: creature.uid };
  }

  function endPlayerTurn() {
    if (game.phase !== PHASE_PLAY || game.turn !== 'player') return;
    ui.selectedUid = null;
    endTurn(game);
    enemyTimer = ENEMY_STEP_MS;
    sound.turn();
    announce("Cinder's turn.");
  }

  function stepEnemy(now) {
    if (game.phase !== PHASE_PLAY || game.turn !== 'enemy') return;
    if (now < enemyTimer) return;
    enemyTimer = now + ENEMY_STEP_MS;
    const action = nextAction(game, 'enemy', 'balanced');
    if (action.type === 'end') {
      endTurn(game);
      sound.turn();
      announce('Your move.');
      return;
    }
    const before = game.phase;
    applyAction(game, 'enemy', action);
    if (action.type === 'play') sound.play();
    else if (action.type === 'attack') sound.attack();
    if (game.phase === PHASE_OVER && before === PHASE_PLAY) finishDuel();
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startDuel();
    else if (actions & ACTION_END_TURN && screen === SCREEN_PLAY) endPlayerTurn();
  }

  const input = createInput(canvas, renderer, {
    onClick: (point, hit) => handleClick(point, hit),
    onHover: (point) => {
      ui.hoverIndex = game.phase === PHASE_PLAY ? handIndexAt(game, point, ui.hoverIndex) : -1;
    },
  });

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = now - last;
    last = now;
    void elapsed;
    handleActions();
    stepEnemy(now);
    const time = now / 1000;
    renderer.draw(game, screen, ui, time, wins, false);
  }

  announce('Ember Pact. Click or press Space to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
