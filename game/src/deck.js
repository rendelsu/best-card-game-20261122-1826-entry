// The draw pile: building, shuffling and drawing. A deck that runs out is rebuilt from
// its owner's discard pile, so a duel can never stall for want of a card.
import { buildDeckIds, makeCardInstance } from './cards.js';
import { shuffle } from './random.js';

/** A shuffled pile of card ids, ready to be drawn from the end. */
export function buildDeck(random) {
  return shuffle(buildDeckIds(), random);
}

/**
 * Draw one card into `side`'s hand. A full hand burns the drawn card; an empty deck is
 * rebuilt from the discard pile first. Returns the drawn instance, or null.
 */
export function drawCard(game, side, random) {
  if (side.deck.length === 0) {
    if (side.discard.length === 0) return null;
    side.deck = shuffle(side.discard.map((card) => card.id), random);
    side.discard = [];
    game.log.push(`${side.name}'s discard is shuffled back into the deck.`);
  }
  const id = side.deck.pop();
  const card = makeCardInstance(game.nextUid, id);
  game.nextUid += 1;
  if (side.hand.length >= 8) {
    side.discard.push(card);
    game.log.push(`${side.name} burns ${card.name} (hand full).`);
    return null;
  }
  side.hand.push(card);
  return card;
}
