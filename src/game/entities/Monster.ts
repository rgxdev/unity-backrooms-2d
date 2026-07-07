import Phaser from "phaser";
import { MONSTER, TEXTURES } from "@/game/config/constants";
import { MonsterStateMachine } from "@/game/ai/MonsterStateMachine";
import {
  MonsterState,
  type MonsterTuning,
  type Perception,
} from "@/game/ai/types";
import {
  hasReached,
  nextWaypointIndex,
  seekVelocity,
  type Vec2,
} from "@/game/ai/steering";

/**
 * A monster in the scene. Owns an arcade body and a {@link MonsterStateMachine}
 * brain; each frame the scene hands it a {@link Perception} snapshot and the
 * player position, and the entity translates the chosen state into movement.
 *
 * - Patrol: walk the looping waypoint path (idle if none).
 * - Chase:  steer straight at the player, remembering the last-known position.
 * - Search: go to the last-known position, then hold and sweep until the FSM
 *           times out back to Patrol.
 * - Attack: stop and fire {@link onCatch} once.
 * - Lost:   hold briefly (the FSM downgrades it to Search).
 */
export class Monster extends Phaser.Physics.Arcade.Sprite {
  private readonly brain: MonsterStateMachine;
  private readonly tuning: MonsterTuning;
  private readonly waypoints: Vec2[];
  private readonly spawnPoint: Vec2;

  private waypointIndex = 0;
  private lastKnown: Vec2 | null = null;
  private prevState: MonsterState = MonsterState.Patrol;

  /** Fired once each time the monster enters its Attack state. */
  onCatch?: (monster: Monster) => void;

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
    this.brain = new MonsterStateMachine(tuning.ai);
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

  get aiState(): MonsterState {
    return this.brain.current;
  }

  private pos(): Vec2 {
    return { x: this.x, y: this.y };
  }

  private drive(velocity: Vec2): void {
    this.setVelocity(velocity.x, velocity.y);
    if (velocity.x !== 0) this.setFlipX(velocity.x < 0);
  }

  private patrol(): void {
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

  private search(): void {
    const target = this.lastKnown;
    if (!target || hasReached(this.pos(), target, this.tuning.reachRadius)) {
      // Reached the last-known spot — hold and sweep; the FSM times out.
      this.setVelocity(0, 0);
      return;
    }
    this.drive(seekVelocity(this.pos(), target, this.tuning.searchSpeed));
  }

  /**
   * Advance the AI one frame. `delta` is seconds; `perception` and `playerPos`
   * are computed scene-side.
   */
  think(delta: number, perception: Perception, playerPos: Vec2): void {
    const state = this.brain.update(delta, perception);

    // Remember where the player was last detected (by sight or noise) so Search
    // and a resumed Chase have somewhere to go.
    if (perception.canSeePlayer || perception.heardNoise) {
      this.lastKnown = { x: playerPos.x, y: playerPos.y };
    }

    switch (state) {
      case MonsterState.Patrol:
        this.patrol();
        break;
      case MonsterState.Chase:
        this.drive(seekVelocity(this.pos(), playerPos, this.tuning.chaseSpeed));
        break;
      case MonsterState.Search:
        this.search();
        break;
      case MonsterState.Attack:
      case MonsterState.Lost:
        this.setVelocity(0, 0);
        break;
    }

    if (state === MonsterState.Attack && this.prevState !== MonsterState.Attack) {
      this.onCatch?.(this);
    }
    this.prevState = state;
  }

  /** Send the monster home and wipe its memory (e.g. after it catches you). */
  resetToPatrol(): void {
    this.setPosition(this.spawnPoint.x, this.spawnPoint.y);
    this.setVelocity(0, 0);
    this.brain.reset();
    this.lastKnown = null;
    this.waypointIndex = 0;
    this.prevState = MonsterState.Patrol;
  }
}
