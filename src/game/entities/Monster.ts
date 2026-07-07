import Phaser from "phaser";
import { MONSTER, TEXTURES, WALK_CYCLE_MS } from "@/game/config/constants";
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
  private facingBack = false;
  private walkFrame = false;
  private walkTimer = 0;
  private moving = false;
  /** When true, the leg-stride frame never swaps while moving — it glides
   *  rather than walks. Used by the Stalker: it shouldn't look like it's
   *  ambling, it should look like it's simply *closer* than it was. */
  private readonly noWalkCycle: boolean;
  private readonly idleTween: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    waypoints: Vec2[],
    tuning: MonsterTuning,
    /** Per-role tint (see MONSTER_TINT) so pursuer/lurker/jump-scare read as
     *  distinct threats at a glance. */
    tint?: number,
    opts?: { noWalkCycle?: boolean },
  ) {
    super(scene, x, y, TEXTURES.monster);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.tuning = tuning;
    this.waypoints = waypoints;
    this.spawnPoint = { x, y };
    this.noWalkCycle = opts?.noWalkCycle ?? false;
    if (tint !== undefined) this.setTint(tint);

    this.setOrigin(0.5, 0.5);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(
      MONSTER.size - MONSTER.bodyInset * 2,
      MONSTER.size - MONSTER.bodyInset * 2,
    );
    body.setCollideWorldBounds(true);

    // Slow, uneven hunch-and-lurch — unsettling rather than a mechanical
    // walk cycle, and independent of the physics body.
    this.idleTween = scene.tweens.add({
      targets: this,
      scaleY: 0.9,
      scaleX: 1.06,
      duration: 480,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }

  /** Stop dead — including the idle hunch-and-lurch tween — so it reads as
   *  perfectly, unnaturally still (the Stalker while watched). */
  freezeStill(): void {
    this.freeze();
    this.idleTween.pause();
    this.setScale(1, 1);
  }

  /** Resume the ambient hunch-and-lurch after {@link freezeStill}. */
  resumeIdle(): void {
    if (this.idleTween.isPaused()) this.idleTween.resume();
  }

  private pos(): Vec2 {
    return { x: this.x, y: this.y };
  }

  /** Swaps the leg-stride walk-cycle frame on a fixed cadence while moving —
   *  driven every frame regardless of which behaviour is currently active. */
  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.moving || this.noWalkCycle) return;
    this.walkTimer += delta;
    if (this.walkTimer >= WALK_CYCLE_MS) {
      this.walkTimer -= WALK_CYCLE_MS;
      this.walkFrame = !this.walkFrame;
      this.applyTexture();
    }
  }

  private applyTexture(): void {
    if (this.facingBack) {
      this.setTexture(
        this.walkFrame ? TEXTURES.monsterBackWalk : TEXTURES.monsterBack,
      );
    } else {
      this.setTexture(this.walkFrame ? TEXTURES.monsterWalk : TEXTURES.monster);
    }
  }

  private drive(velocity: Vec2): void {
    this.setVelocity(velocity.x, velocity.y);
    this.moving = velocity.x !== 0 || velocity.y !== 0;
    if (!this.moving) {
      this.walkTimer = 0;
      this.walkFrame = false;
    }
    if (velocity.y < -5) this.facingBack = true;
    else if (velocity.y > 5 || velocity.x !== 0) this.facingBack = false;
    if (velocity.x !== 0) this.setFlipX(velocity.x < 0);
    this.applyTexture();
  }

  /** Walk the looping patrol path (stationary if it has no waypoints).
   *  `speedMultiplier` lets the scene ramp patrol pace up (e.g. near the exit). */
  tickAmbient(speedMultiplier = 1): void {
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
    this.drive(
      seekVelocity(
        this.pos(),
        target,
        this.tuning.patrolSpeed * speedMultiplier,
      ),
    );
  }

  /** Chase the given world position at `speed` units/sec. */
  pursue(target: Vec2, speed: number): void {
    this.drive(seekVelocity(this.pos(), target, speed));
  }

  freeze(): void {
    this.setVelocity(0, 0);
    this.moving = false;
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
