/**
 * Deterministic pseudo-random 0..1 from integer coordinates. Shared by the
 * preload-time pixel dither (breaks up flat texture fills) and the
 * runtime per-tile variant/decoration placement (breaks up the level into
 * something less uniform without needing extra state) — same cheap
 * integer-hash, two different coordinate scales.
 */
export function hash01(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2654435761) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return ((h >>> 0) % 1000) / 1000;
}
