import Phaser from "phaser";
import { MONSTER, TEXTURES } from "@/game/config/constants";
import type { MonsterTuning } from "@/game/ai/types";
import {
  hasReached,
  nextWaypointIndex,
  seekVelocity,
  type Vec2,
} from "@/game/ai/steering";

/**
 * A monster in the scene. Its behaviour is driven by the {@link MonsterDirector}
 * phase (owned by the scene), not by reacting to the player:
 *
 * - Ambient — {@link tickAmbient} walks a looping patrol path, indifferent to
 *   the player; it only ever gives fleeting glimpses and sounds.
 * - Pursuit — {@link pursue} bee-lines toward the player at the chase speed.
 * - Escaped — {@link freeze} stops it dead.
 *
 * There is no attack: the player cannot die, so the monster only ever creates
 * pressure, never a game-over.
 */
export class Monster extends Phaser.Physics.Arcade.Sprite {
  private readonly tuning: MonsterTuning;
  private readonly waypoints: Vec2[];
  private readonly spawnPoint: Vec2;
  private waypointIndex = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    waypoints: Vec2[],
    tuning: MonsterTuning,
  ) {
    super(scene, x, y, TEXTURES.monster);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.tuning = tuning;
    this.waypoints = waypoints;
    this.spawnPoint = { x, y };

    this.setOrigin(0.5, 0.5);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(
      MONSTER.size - MONSTER.bodyInset * 2,
      MONSTER.size - MONSTER.bodyInset * 2,
    );
    body.setCollideWorldBounds(true);
  }

  private pos(): Vec2 {
    return { x: this.x, y: this.y };
  }

  private drive(velocity: Vec2): void {
    this.setVelocity(velocity.x, velocity.y);
    if (velocity.x !== 0) this.setFlipX(velocity.x < 0);
  }

  /** Walk the looping patrol path (stationary if it has no waypoints). */
  tickAmbient(): void {
    if (this.waypoints.length === 0) {
      this.setVelocity(0, 0);
      return;
    }
    let target = this.waypoints[this.waypointIndex]!;
    if (hasReached(this.pos(), target, this.tuning.reachRadius)) {
      this.waypointIndex = nextWaypointIndex(
        this.waypointIndex,
        this.waypoints.length,
      );
      target = this.waypoints[this.waypointIndex]!;
    }
    this.drive(seekVelocity(this.pos(), target, this.tuning.patrolSpeed));
  }

  /** Chase the given world position at `speed` units/sec. */
  pursue(target: Vec2, speed: number): void {
    this.drive(seekVelocity(this.pos(), target, speed));
  }

  freeze(): void {
    this.setVelocity(0, 0);
  }

  /** World distance from this monster to the given point. */
  distanceTo(point: Vec2): number {
    return Phaser.Math.Distance.Between(this.x, this.y, point.x, point.y);
  }

  resetToSpawn(): void {
    this.setPosition(this.spawnPoint.x, this.spawnPoint.y);
    this.setVelocity(0, 0);
    this.waypointIndex = 0;
  }
}
