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
  }

  get tileX(): number {
    return Math.floor(this.x / this.scene.registry.get("tileSize"));
  }
}
