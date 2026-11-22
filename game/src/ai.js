// The rival's brain — and the autopilot that plays the other seat in the screenshot
// scenes. One action at a time: the caller asks for the next move, applies it through
// the rules in state.js, and asks again until the turn ends. Nothing here touches the
// DOM; the same chooser drives the live rival, the aggressive shot player and the
// passive loser, so every scene is a real game.
//
// Styles: 'balanced' plays like a thinking rival, 'aggressive' pushes face damage and
// never holds back, 'passive' never acts at all.
import { legalAttacks, otherSide, playCard, attack, guardOnBoard } from './state.js';

/** How much a creature is worth on the board, in mana terms. */
function creatureValue(card) {
  return card.atk + card.hp + (card.guard ? 1.5 : 0) + card.draw * 2 + card.heroDamage * 1;
}

/** Pick a damage spell's target: a creature worth killing, else the rival hero. */
function spellTarget(game, sideName, card, aggressive) {
  const foeName = otherSide(sideName);
  let best = null;
  let bestScore = -1;
  for (const creature of game[foeName].board) {
    if (creature.hp > card.damage) continue;
    const score = creature.atk + creature.hp + (aggressive ? 0 : 2);
    if (score > bestScore) {
      bestScore = score;
      best = { kind: 'creature', uid: creature.uid };
    }
  }
  if (best !== null) return best;
  if (aggressive) return { kind: 'hero', side: foeName };
  // A balanced rival only burns the hero when nothing better is on the table.
  for (const creature of game[foeName].board) {
    if (creature.atk >= 4) return { kind: 'hero', side: foeName };
  }
  return { kind: 'hero', side: foeName };
}

/** The next thing `sideName` should do, or { type: 'end' } when its turn is spent. */
export function nextAction(game, sideName, style) {
  if (game.phase !== 'play' || game.turn !== sideName) return { type: 'end' };
  if (style === 'passive') return { type: 'end' };
  const me = game[sideName];
  const foeName = otherSide(sideName);
  const aggressive = style === 'aggressive';

  // Heal before anything else when the pact is nearly lost.
  const healIndex = me.hand.findIndex((card) => card.kind === 'spell' && card.heal > 0 && card.cost <= me.mana);
  if (healIndex !== -1 && me.life <= 12) {
    return { type: 'play', handIndex: healIndex, target: null };
  }

  // Removal first: a damage spell that kills a real threat is worth more than a creature.
  for (let index = 0; index < me.hand.length; index += 1) {
    const card = me.hand[index];
    if (card.kind !== 'spell' || card.damage === 0 || card.cost > me.mana) continue;
    const threat = game[foeName].board.find((creature) => creature.hp <= card.damage && creature.atk >= 3);
    if (threat !== null && threat !== undefined) {
      return { type: 'play', handIndex: index, target: { kind: 'creature', uid: threat.uid } };
    }
  }

  // Draw while the hand is thin.
  const drawIndex = me.hand.findIndex(
    (card) => card.kind === 'spell' && card.draw > 0 && card.cost <= me.mana,
  );
  if (drawIndex !== -1 && me.hand.length <= 3) {
    return { type: 'play', handIndex: drawIndex, target: null };
  }

  // Play the best creature the mana affords.
  let bestIndex = -1;
  let bestValue = aggressive ? -999 : 0;
  for (let index = 0; index < me.hand.length; index += 1) {
    const card = me.hand[index];
    if (card.kind !== 'creature' || card.cost > me.mana) continue;
    const value = creatureValue(card) - card.cost;
    if (value > bestValue) {
      bestValue = value;
      bestIndex = index;
    }
  }
  if (bestIndex !== -1) return { type: 'play', handIndex: bestIndex, target: null };

  // Spend leftover mana on a burn spell to the rival's face.
  for (let index = 0; index < me.hand.length; index += 1) {
    const card = me.hand[index];
    if (card.kind !== 'spell' || card.damage === 0 || card.cost > me.mana) continue;
    return { type: 'play', handIndex: index, target: spellTarget(game, sideName, card, aggressive) };
  }

  // Nothing to play: attack with the best trade on the table.
  const attacks = legalAttacks(game, sideName);
  let bestAttack = null;
  let bestScore = -1;
  for (const option of attacks) {
    const attacker = me.board.find((creature) => creature.uid === option.attackerUid);
    let score;
    if (option.target.kind === 'hero') {
      score = attacker.atk * (aggressive ? 1.4 : 0.9) + 1;
    } else {
      const defender = game[foeName].board.find((creature) => creature.uid === option.target.uid);
      const kills = defender.hp <= attacker.atk;
      const survives = defender.atk < attacker.hp;
      score = kills ? defender.atk + defender.hp + (survives ? 2 : 0) : (survives ? 1 : -2);
      if (guardOnBoard(game, foeName) && defender.guard) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestAttack = option;
    }
  }
  if (bestAttack !== null && bestScore > 0) {
    return { type: 'attack', attackerUid: bestAttack.attackerUid, target: bestAttack.target };
  }
  return { type: 'end' };
}

/** Apply one action object from nextAction through the rules. Returns false on 'end'. */
export function applyAction(game, sideName, action) {
  if (action.type === 'play') return playCard(game, sideName, action.handIndex, action.target);
  if (action.type === 'attack') return attack(game, sideName, action.attackerUid, action.target);
  return false;
}
