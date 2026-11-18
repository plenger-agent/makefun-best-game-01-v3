// A small seeded random number generator (mulberry32) plus helpers.
//
// Waves, shot scenes and map dressing all draw from seeded generators, so a
// given seed always builds the same game: the screenshot scenes depend on
// it, and so does anyone replaying a wave to learn it.

/** Create a generator from a 32-bit seed. */
export function makeRng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** Float in [min, max). */
    range: (min, max) => min + next() * (max - min),
    /** Integer in [min, max] inclusive. */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** True with probability p. */
    chance: (p) => next() < p,
    /** A random element of the array. */
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** Sign: -1 or 1. */
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}

/** Hash a string seed (wave names, map names) into a 32-bit integer. */
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
