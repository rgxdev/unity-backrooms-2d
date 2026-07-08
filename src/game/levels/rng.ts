/**
 * Small deterministic RNG utilities for procedural level generation. Seeded so
 * a given seed always yields the same map (shareable / unit testable), while
 * the scene can pass a fresh random seed per play for variety.
 */

export type Rng = () => number;

/** mulberry32 — fast, good-enough 32-bit PRNG returning [0, 1). */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of the parts → a 32-bit seed. */
export function hashSeed(...parts: Array<string | number>): number {
  const s = parts.join("|");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Integer in [min, max] inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}

/** Weighted random pick — probability proportional to each item's `weight`.
 *  Weights don't need to sum to 1 (normalized internally). Falls back to the
 *  last item if floating-point rounding leaves a sliver unconsumed. */
export function weightedPick<T extends { weight: number }>(
  rng: Rng,
  items: readonly T[],
): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng() * total;
  for (const item of items) {
    // Strict `<` (checked before subtracting) means a zero-weight item can
    // never be selected, even on the boundary roll of exactly 0.
    if (roll < item.weight) return item;
    roll -= item.weight;
  }
  return items[items.length - 1]!;
}

/** Fisher-Yates shuffle — returns a new array, leaves the input untouched. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}
