import Phaser from "phaser";
import { PLAYER } from "@/game/config/constants";
import type { Player } from "@/game/entities/Player";

type Keys = {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  w: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
  shift: Phaser.Input.Keyboard.Key;
};

/** Emitted when the player makes noise a monster can hear (sprinting). */
export type NoiseEmitter = (x: number, y: number) => void;

/** Move `current` toward `target` by at most `step`, without overshoot. */
function approach(current: number, target: number, step: number): number {
  if (current < target) return Math.min(current + step, target);
  if (current > target) return Math.max(current - step, target);
  return current;
}

/**
 * Reads input and drives the arcade body. Velocity is set on a persistent
 * Vector2 (created once) to avoid allocating in the update loop.
 *
 * Movement ramps toward the target speed instead of snapping to it, so
 * starting, stopping and turning feel smooth rather than instant/blocky.
 */
export class PlayerController {
  private readonly keys: Keys;
  private readonly velocity = new Phaser.Math.Vector2();
  private readonly targetVelocity = new Phaser.Math.Vector2();

  constructor(
    scene: Phaser.Scene,
    private readonly player: Player,
    private readonly onNoise?: NoiseEmitter,
  ) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error("Keyboard input unavailable");
    }
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = keyboard.addKeys(
      {
        up: K.UP,
        down: K.DOWN,
        left: K.LEFT,
        right: K.RIGHT,
        w: K.W,
        a: K.A,
        s: K.S,
        d: K.D,
        shift: K.SHIFT,
      },
      false,
    ) as Keys;
  }

  /** @param deltaMs Frame delta (ms) — drives the accel/decel ramp. */
  update(deltaMs: number): void {
    const k = this.keys;
    const left = k.left.isDown || k.a.isDown;
    const right = k.right.isDown || k.d.isDown;
    const up = k.up.isDown || k.w.isDown;
    const down = k.down.isDown || k.s.isDown;

    this.targetVelocity.set(
      (right ? 1 : 0) - (left ? 1 : 0),
      (down ? 1 : 0) - (up ? 1 : 0),
    );

    const moving = this.targetVelocity.lengthSq() > 0;
    const sprinting = moving && k.shift.isDown;
    if (moving) {
      this.targetVelocity
        .normalize()
        .scale(sprinting ? PLAYER.sprintSpeed : PLAYER.speed);
    }

    const dt = deltaMs / 1000;
    const rampRate = moving ? PLAYER.acceleration : PLAYER.deceleration;
    const step = rampRate * dt;
    this.velocity.set(
      approach(this.velocity.x, this.targetVelocity.x, step),
      approach(this.velocity.y, this.targetVelocity.y, step),
    );
    this.player.setVelocity(this.velocity.x, this.velocity.y);
    this.player.updateFacing(this.velocity.x, this.velocity.y);

    // Sprinting is loud — nearby monsters can hear it and start searching.
    if (sprinting) this.onNoise?.(this.player.x, this.player.y);
  }
}
