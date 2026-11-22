// The card catalogue: every card Ember Pact can deal, all original names, art and text.
// A creature fights on the board (attack / health, Guard must be attacked first); a spell
// resolves at once and is gone. `draw` draws cards when the card is played, `heroDamage`
// hits the rival the moment the creature enters, `heal` restores its owner's life.
import { DECK_COPIES } from './config.js';

export const CARDS = [
  { id: 'ember-imp', name: 'Ember Imp', element: 'ember', kind: 'creature', cost: 1, atk: 2, hp: 1, text: 'A quick spark of the pact.' },
  { id: 'thorn-bramble', name: 'Thorn Bramble', element: 'thorn', kind: 'creature', cost: 1, atk: 1, hp: 3, guard: true, text: 'Guard. Roots hold the line.' },
  { id: 'cinder-hound', name: 'Cinder Hound', element: 'ember', kind: 'creature', cost: 2, atk: 3, hp: 2, text: 'It hunts what the fire drops.' },
  { id: 'frost-wisp', name: 'Frost Wisp', element: 'frost', kind: 'creature', cost: 2, atk: 1, hp: 3, draw: 1, text: 'Draw a card.' },
  { id: 'stone-golem', name: 'Stone Golem', element: 'stone', kind: 'creature', cost: 3, atk: 2, hp: 5, guard: true, text: 'Guard. Slow, patient, unmoved.' },
  { id: 'storm-sprite', name: 'Storm Sprite', element: 'storm', kind: 'creature', cost: 3, atk: 3, hp: 3, text: 'It laughs in the thunder.' },
  { id: 'ash-phoenix', name: 'Ash Phoenix', element: 'ember', kind: 'creature', cost: 4, atk: 4, hp: 3, heroDamage: 2, text: 'Deal 2 damage to the rival.' },
  { id: 'ember-knight', name: 'Ember Knight', element: 'ember', kind: 'creature', cost: 5, atk: 5, hp: 4, text: 'Sworn to the last ember.' },
  { id: 'storm-drake', name: 'Storm Drake', element: 'storm', kind: 'creature', cost: 6, atk: 6, hp: 5, text: 'The sky, given teeth.' },
  { id: 'lightning-bolt', name: 'Lightning Bolt', element: 'storm', kind: 'spell', cost: 2, damage: 3, text: 'Deal 3 damage.' },
  { id: 'fireball', name: 'Fireball', element: 'ember', kind: 'spell', cost: 3, damage: 4, text: 'Deal 4 damage.' },
  { id: 'mending-draught', name: 'Mending Draught', element: 'thorn', kind: 'spell', cost: 2, heal: 6, text: 'Restore 6 life.' },
  { id: 'rally-horn', name: 'Rally Horn', element: 'stone', kind: 'spell', cost: 2, draw: 2, text: 'Draw 2 cards.' },
];

export function cardById(id) {
  for (const card of CARDS) if (card.id === id) return card;
  return null;
}

/** A fresh deck: two copies of every card, in catalogue order (the caller shuffles). */
export function buildDeckIds() {
  const ids = [];
  for (const card of CARDS) {
    for (let copy = 0; copy < DECK_COPIES; copy += 1) ids.push(card.id);
  }
  return ids;
}

/** A live card in a hand or on the board, copied from its catalogue entry. */
export function makeCardInstance(uid, id) {
  const card = cardById(id);
  return {
    uid,
    id: card.id,
    name: card.name,
    element: card.element,
    kind: card.kind,
    cost: card.cost,
    atk: card.atk ?? 0,
    hp: card.hp ?? 0,
    maxHp: card.hp ?? 0,
    guard: card.guard === true,
    draw: card.draw ?? 0,
    damage: card.damage ?? 0,
    heal: card.heal ?? 0,
    heroDamage: card.heroDamage ?? 0,
    text: card.text,
    /** Creatures cannot attack the turn they are played; the next turn frees them. */
    canAttack: false,
  };
}
