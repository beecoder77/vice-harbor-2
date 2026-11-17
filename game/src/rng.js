// A tiny seeded random number generator (mulberry32) plus helpers.
// Port Azura is built from a fixed seed so the city, the traffic and the
// screenshot poses come out identical on every single load.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickFrom(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

export function between(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function intBetween(rng, lo, hi) {
  return Math.floor(between(rng, lo, hi + 1));
}
