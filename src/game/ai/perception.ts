import type { Perception } from "./types";
import { distance, type Vec2 } from "./steering";

/**
 * Everything the scene must supply for one monster's perception this frame.
 * `hasLineOfSight` is injected (tile-space Bresenham from the visibility
 * system) so this builder stays pure and engine-independent.
 */
export interface PerceptionInput {
  monster: Vec2;
  player: Vec2;
  /** Max world distance the player can be acquired by sight. */
  sightRange: number;
  /** World radius within which a noise event is heard. */
  hearingRange: number;
  /** World positions of noise events emitted this frame. */
  noises: readonly Vec2[];
  /** Clear line of sight between the two world points (occlusion aware). */
  hasLineOfSight: (monster: Vec2, player: Vec2) => boolean;
}

/**
 * Fold detection sources into the {@link Perception} snapshot the FSM consumes.
 * Priority mirrors the design doc: line of sight + distance first, then noise.
 */
export function buildPerception(input: PerceptionInput): Perception {
  const dist = distance(input.monster, input.player);
  const canSeePlayer =
    dist <= input.sightRange && input.hasLineOfSight(input.monster, input.player);

  const heardNoise = input.noises.some(
    (n) => distance(input.monster, n) <= input.hearingRange,
  );

  return {
    canSeePlayer,
    distanceToPlayer: dist,
    heardNoise,
  };
}
