import Phaser from "phaser";
import { SCENES, TILE_SIZE } from "@/game/config/constants";

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    this.registry.set("tileSize", TILE_SIZE);
    this.scene.start(SCENES.preload);
  }
}
