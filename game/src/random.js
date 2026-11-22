// A small seeded random number generator (mulberry32): the same seed gives the same
// shuffle and the same game, which is what makes the screenshot scenes repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** In-place Fisher-Yates shuffle driven by the seeded generator. */
export function shuffle(array, random) {
  for (let index = array.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const held = array[index];
    array[index] = array[other];
    array[other] = held;
  }
  return array;
}
