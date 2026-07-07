import Phaser from "phaser";
import { PLAYER, TEXTURES, WALK_CYCLE_MS } from "@/game/config/constants";

export class Player extends Phaser.Physics.Arcade.Sprite {
  private facingBack = false;
  private walkFrame = false;
  private walkTimer = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURES.player);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 0.5);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(
      PLAYER.size - PLAYER.bodyInset * 2,
      PLAYER.size - PLAYER.bodyInset * 2,
    );
    body.setCollideWorldBounds(true);

    // Gentle squash bob so walking reads as a smooth gait rather than a
    // sliding block — purely cosmetic, independent of the physics body.
    scene.tweens.add({
      targets: this,
      scaleY: 0.94,
      scaleX: 1.04,
      duration: 260,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }

  /** True while the arcade body has meaningful velocity. */
  get isMoving(): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body;
    return body.velocity.lengthSq() > 100;
  }

  /**
   * Face away from the camera walking "up", toward it otherwise; mirror
   * left/right; swap the leg-stride frame on a fixed cadence while moving.
   * Called once per frame by the controller.
   */
  updateFacing(vx: number, vy: number, deltaMs: number): void {
    if (vy < -5) this.facingBack = true;
    else if (vy > 5 || vx !== 0) this.facingBack = false;
    if (vx !== 0) this.setFlipX(vx < 0);

    const moving = vx * vx + vy * vy > 100;
    if (moving) {
      this.walkTimer += deltaMs;
      if (this.walkTimer >= WALK_CYCLE_MS) {
        this.walkTimer -= WALK_CYCLE_MS;
        this.walkFrame = !this.walkFrame;
      }
    } else {
      this.walkTimer = 0;
      this.walkFrame = false;
    }

    if (this.facingBack) {
      this.setTexture(this.walkFrame ? TEXTURES.playerBackWalk : TEXTURES.playerBack);
    } else {
      this.setTexture(this.walkFrame ? TEXTURES.playerWalk : TEXTURES.player);
    }
  }

  get tileX(): number {
    return Math.floor(this.x / this.scene.registry.get("tileSize"));
  }
}
