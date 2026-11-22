// The duel's rules and state, with no drawing and no browser in it. A side holds life,
// mana, a deck, a hand, a board and a discard pile; the game holds whose turn it is, the
// turn count, the log and the winner. Every move is a plain function call that returns
// true when the move was legal, so the live game, the AI and the screenshot scenes all
// play the same rules.
import { BOARD_MAX, HAND_MAX, LIFE_START, MANA_MAX, START_HAND } from './config.js';
import { buildDeck } from './deck.js';
import { drawCard } from './deck.js';

export const PHASE_TITLE = 'title';
export const PHASE_PLAY = 'play';
export const PHASE_OVER = 'over';

export function otherSide(side) {
  return side === 'player' ? 'enemy' : 'player';
}

function makeSide(name, random) {
  return {
    name,
    life: LIFE_START,
    maxLife: LIFE_START,
    mana: 0,
    maxMana: 0,
    deck: buildDeck(random),
    hand: [],
    board: [],
    discard: [],
  };
}

export function createGame(random) {
  const game = {
    random,
    phase: PHASE_TITLE,
    turn: 'player',
    turnNumber: 1,
    winner: null,
    log: ['The pact is sealed. Draw your opening hand.'],
    nextUid: 1,
    player: makeSide('You', random),
    enemy: makeSide('Cinder', random),
  };
  for (let index = 0; index < START_HAND; index += 1) {
    drawCard(game, game.player, random);
    drawCard(game, game.enemy, random);
  }
  return game;
}

/** Begin a fresh duel from the same shuffled decks: life, mana and hands reset. */
export function startMatch(game) {
  game.phase = PHASE_PLAY;
  game.turn = 'player';
  game.turnNumber = 1;
  game.winner = null;
  game.log = ['The duel begins. Your move — spend mana, play cards, strike.'];
  for (const side of [game.player, game.enemy]) {
    side.life = LIFE_START;
    side.mana = 0;
    side.maxMana = 0;
    side.hand = [];
    side.board = [];
    side.discard = [];
    side.deck = buildDeck(game.random);
  }
  for (let index = 0; index < START_HAND; index += 1) {
    drawCard(game, game.player, game.random);
    drawCard(game, game.enemy, game.random);
  }
  beginTurn(game, 'player');
}

/** Refill mana (growing by 1 a turn, up to the cap), free the board, draw a card. */
export function beginTurn(game, sideName) {
  const side = game[sideName];
  side.maxMana = Math.min(MANA_MAX, side.maxMana + 1);
  side.mana = side.maxMana;
  for (const creature of side.board) creature.canAttack = true;
  const drawn = drawCard(game, side, game.random);
  if (drawn !== null) game.log.push(`${side.name} draw${sideName === 'player' ? '' : 's'} a card.`);
}

/** The rival's guards, if any: attacks must go through them first. */
export function guardOnBoard(game, sideName) {
  return game[sideName].board.some((creature) => creature.guard);
}

/** Where a damage spell may be aimed: any creature, or either duelist. */
export function spellTargets(game) {
  const targets = [{ kind: 'hero', side: 'enemy' }, { kind: 'hero', side: 'player' }];
  for (const creature of game.enemy.board) targets.push({ kind: 'creature', uid: creature.uid });
  for (const creature of game.player.board) targets.push({ kind: 'creature', uid: creature.uid });
  return targets;
}

function findCreature(game, uid) {
  for (const sideName of ['player', 'enemy']) {
    for (const creature of game[sideName].board) {
      if (creature.uid === uid) return { creature, sideName };
    }
  }
  return null;
}

function damageCreature(game, creature, amount) {
  creature.hp -= amount;
  if (creature.hp > 0) return false;
  return true;
}

function killCreature(game, sideName, creature) {
  const side = game[sideName];
  const index = side.board.indexOf(creature);
  if (index !== -1) side.board.splice(index, 1);
  side.discard.push(creature);
  game.log.push(`${creature.name} falls.`);
}

function damageHero(game, sideName, amount) {
  const side = game[sideName];
  side.life = Math.max(0, side.life - amount);
  if (side.life === 0) {
    game.phase = PHASE_OVER;
    game.winner = otherSide(sideName);
    game.log.push(`${side.name} falls to 0 life. ${game[game.winner].name} win${game.winner === 'player' ? '' : 's'} the pact!`);
  }
}

function healHero(game, sideName, amount) {
  const side = game[sideName];
  side.life = Math.min(side.maxLife, side.life + amount);
}

/**
 * Play the card at `handIndex` from `sideName`'s hand. Damage spells need a target
 * ({ kind: 'creature', uid } or { kind: 'hero', side }); other cards ignore it.
 * Returns true when the card was played.
 */
export function playCard(game, sideName, handIndex, target) {
  if (game.phase !== PHASE_PLAY || game.turn !== sideName) return false;
  const side = game[sideName];
  const card = side.hand[handIndex];
  if (!card || card.cost > side.mana) return false;
  if (card.kind === 'creature' && side.board.length >= BOARD_MAX) return false;
  if (card.kind === 'spell' && card.damage > 0 && !target) return false;

  side.hand.splice(handIndex, 1);
  side.mana -= card.cost;
  if (card.kind === 'creature') {
    card.canAttack = false;
    side.board.push(card);
    game.log.push(`${side.name} summon${sideName === 'player' ? '' : 's'} ${card.name} (${card.atk}/${card.hp}).`);
    if (card.heroDamage > 0) {
      damageHero(game, otherSide(sideName), card.heroDamage);
      game.log.push(`${card.name} burns the rival for ${card.heroDamage}.`);
      if (game.phase === PHASE_OVER) return true;
    }
    for (let count = 0; count < card.draw; count += 1) drawCard(game, side, game.random);
    return true;
  }
  // A spell resolves at once and is discarded.
  side.discard.push(card);
  if (card.damage > 0 && target) {
    if (target.kind === 'hero') {
      damageHero(game, target.side, card.damage);
      game.log.push(`${card.name} hits ${game[target.side].name} for ${card.damage}.`);
    } else {
      const found = findCreature(game, target.uid);
      if (found) {
        const dead = damageCreature(game, found.creature, card.damage);
        game.log.push(`${card.name} hits ${found.creature.name} for ${card.damage}.`);
        if (dead) killCreature(game, found.sideName, found.creature);
      }
    }
    return true;
  }
  if (card.heal > 0) {
    healHero(game, sideName, card.heal);
    game.log.push(`${side.name} restore${sideName === 'player' ? '' : 's'} ${card.heal} life.`);
    return true;
  }
  for (let count = 0; count < card.draw; count += 1) drawCard(game, side, game.random);
  game.log.push(`${side.name} play${sideName === 'player' ? '' : 's'} ${card.name}.`);
  return true;
}

/**
 * One creature strikes one target: a creature trades blows with a creature, or hits a
 * hero straight. Guarded boards force the attack onto a guard first. Returns true when
 * the attack happened.
 */
export function attack(game, sideName, attackerUid, target) {
  if (game.phase !== PHASE_PLAY || game.turn !== sideName) return false;
  const side = game[sideName];
  const foe = game[otherSide(sideName)];
  const attacker = side.board.find((creature) => creature.uid === attackerUid);
  if (!attacker || !attacker.canAttack) return false;
  if (target.kind === 'hero') {
    if (target.side !== otherSide(sideName)) return false;
    if (guardOnBoard(game, otherSide(sideName))) return false;
    attacker.canAttack = false;
    damageHero(game, target.side, attacker.atk);
    game.log.push(`${attacker.name} strikes ${foe.name} for ${attacker.atk}.`);
    return true;
  }
  const found = findCreature(game, target.uid);
  if (!found || found.sideName !== otherSide(sideName)) return false;
  if (found.creature.guard === false && guardOnBoard(game, otherSide(sideName))) return false;
  const defender = found.creature;
  attacker.canAttack = false;
  const defenderDead = damageCreature(game, defender, attacker.atk);
  const attackerDead = damageCreature(game, attacker, defender.atk);
  game.log.push(`${attacker.name} (${attacker.atk}/${Math.max(0, attacker.hp)}) trades with ${defender.name} (${defender.atk}/${Math.max(0, defender.hp)}).`);
  if (defenderDead) killCreature(game, found.sideName, defender);
  if (attackerDead) killCreature(game, sideName, attacker);
  return true;
}

/** Hand the turn over: the other side draws, refills and frees its board. */
export function endTurn(game) {
  if (game.phase !== PHASE_PLAY) return false;
  const next = otherSide(game.turn);
  game.turn = next;
  if (next === 'player') game.turnNumber += 1;
  beginTurn(game, next);
  return true;
}

/** Every legal attack for `sideName`'s ready creatures, as { attackerUid, target }. */
export function legalAttacks(game, sideName) {
  const attacks = [];
  const foeName = otherSide(sideName);
  const guarded = guardOnBoard(game, foeName);
  for (const attacker of game[sideName].board) {
    if (!attacker.canAttack) continue;
    for (const defender of game[foeName].board) {
      if (guarded && !defender.guard) continue;
      attacks.push({ attackerUid: attacker.uid, target: { kind: 'creature', uid: defender.uid } });
    }
    if (!guarded) attacks.push({ attackerUid: attacker.uid, target: { kind: 'hero', side: foeName } });
  }
  return attacks;
}

/** The newest log lines, oldest first, at most `count`. */
export function recentLog(game, count) {
  return game.log.slice(-count);
}
