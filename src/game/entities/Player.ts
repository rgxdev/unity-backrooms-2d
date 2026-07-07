import Phaser from "phaser";
import { PLAYER, TEXTURES } from "@/game/config/constants";

export class Player extends Phaser.Physics.Arcade.Sprite {
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

  get tileX(): number {
    return Math.floor(this.x / this.scene.registry.get("tileSize"));
  }
}
