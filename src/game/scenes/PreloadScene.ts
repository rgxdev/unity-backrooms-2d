import Phaser from "phaser";
import {
  COLORS,
  PLAYER,
  SCENES,
  TEXTURES,
  TILE_SIZE,
} from "@/game/config/constants";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENES.preload);
  }

  preload(): void {
    const { width, height } = this.scale;
    const label = this.add
      .text(width / 2, height / 2, "LOADING", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#c9b458",
      })
      .setOrigin(0.5);

    this.load.on(Phaser.Loader.Events.COMPLETE, () => label.destroy());
  }

  create(): void {
    this.generateTextures();
    this.scene.start(SCENES.main);
  }

  private generateTextures(): void {
    this.makeTile(TEXTURES.floor, COLORS.floor, COLORS.floorAlt);
    this.makeTile(TEXTURES.floorAlt, COLORS.floorAlt, COLORS.floor);
    this.makeWall(TEXTURES.wall);
    this.makePlayer(TEXTURES.player);
  }

  private makeTile(key: string, base: number, speck: number): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(base, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.fillStyle(speck, 0.6);
    g.fillRect(4, 6, 2, 2);
    g.fillRect(20, 12, 2, 2);
    g.fillRect(12, 24, 2, 2);
    g.lineStyle(1, 0x000000, 0.12);
    g.strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    g.generateTexture(key, TILE_SIZE, TILE_SIZE);
    g.destroy();
  }

  private makeWall(key: string): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(COLORS.wall, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.fillStyle(COLORS.wallShade, 1);
    g.fillRect(0, TILE_SIZE - 4, TILE_SIZE, 4);
    g.fillRect(TILE_SIZE - 4, 0, 4, TILE_SIZE);
    g.fillStyle(0x000000, 0.25);
    g.fillRect(0, 0, TILE_SIZE, 2);
    g.generateTexture(key, TILE_SIZE, TILE_SIZE);
    g.destroy();
  }

  private makePlayer(key: string): void {
    const s = PLAYER.size;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(COLORS.playerOutline, 1);
    g.fillRect(0, 0, s, s);
    g.fillStyle(COLORS.player, 1);
    g.fillRect(2, 2, s - 4, s - 4);
    g.fillStyle(COLORS.playerOutline, 1);
    g.fillRect(4, 5, 2, 2);
    g.fillRect(s - 6, 5, 2, 2);
    g.generateTexture(key, s, s);
    g.destroy();
  }
}
