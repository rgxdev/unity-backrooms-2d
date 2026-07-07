import Phaser from "phaser";
import {
  COLORS,
  SCENES,
  TEXTURES,
  TILE_SIZE,
  VISIBILITY,
} from "@/game/config/constants";
import { TileKind, type LevelData, type Zone } from "@/lib/schemas/level";
import { getLevel, FIRST_LEVEL_ID } from "@/game/levels";
import { Player } from "@/game/entities/Player";
import { PlayerController } from "@/game/systems/PlayerController";
import { AudioManager } from "@/game/systems/AudioManager";
import {
  TileVisibility,
  VisibilitySystem,
} from "@/game/visibility/VisibilitySystem";
import { getSettings } from "@/lib/settings-store";

const FOG_ALPHA: Record<number, number> = {
  [TileVisibility.Unseen]: 1,
  [TileVisibility.Discovered]: VISIBILITY.dimAlpha,
  [TileVisibility.Visible]: 0,
};

export class MainScene extends Phaser.Scene {
  private level!: LevelData;
  private player!: Player;
  private controller!: PlayerController;
  private audio!: AudioManager;
  private visibility!: VisibilitySystem;
  private walls!: Phaser.Physics.Arcade.StaticGroup;

  private fogTiles: Phaser.GameObjects.Rectangle[] = [];
  private fogState: Int8Array = new Int8Array(0);
  private hiddenZoneByTile: Int16Array = new Int16Array(0);
  private discoveredZones = new Set<number>();

  private lastTileX = -1;
  private lastTileY = -1;
  private fpsText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(SCENES.main);
  }

  create(): void {
    const level = getLevel(FIRST_LEVEL_ID);
    if (!level) {
      throw new Error(`Level "${FIRST_LEVEL_ID}" not found`);
    }
    this.level = level;

    const worldW = level.width * TILE_SIZE;
    const worldH = level.height * TILE_SIZE;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBackgroundColor(COLORS.fog);
    this.cameras.main.setZoom(2);
    this.cameras.main.roundPixels = true;

    this.buildTiles();
    this.buildHiddenZoneMask();
    this.buildFog();
    this.spawnPlayer();

    this.visibility = new VisibilitySystem(
      level.width,
      level.height,
      VISIBILITY.revealRadiusTiles,
    );
    this.audio = new AudioManager(this.sound);

    if (getSettings().showFps) {
      this.fpsText = this.add
        .text(6, 6, "", {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#e4c94a",
        })
        .setScrollFactor(0)
        .setDepth(1000);
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.audio.destroy());
  }

  private isWallTile(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.level.width || y >= this.level.height) {
      return true;
    }
    return this.level.tiles[y * this.level.width + x] === TileKind.Wall;
  }

  private buildTiles(): void {
    this.walls = this.physics.add.staticGroup();
    const { width, height, tiles } = this.level;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;
        if (tiles[y * width + x] === TileKind.Wall) {
          this.walls.create(px, py, TEXTURES.wall);
        } else {
          const alt = (x + y) % 2 === 0;
          this.add
            .image(px, py, alt ? TEXTURES.floor : TEXTURES.floorAlt)
            .setDepth(-10);
        }
      }
    }
  }

  private buildHiddenZoneMask(): void {
    const { width, height, zones } = this.level;
    this.hiddenZoneByTile = new Int16Array(width * height).fill(-1);
    zones.forEach((zone: Zone, index: number) => {
      if (!zone.hidden) return;
      for (let y = zone.y; y < zone.y + zone.height; y++) {
        for (let x = zone.x; x < zone.x + zone.width; x++) {
          if (x < width && y < height)
            this.hiddenZoneByTile[y * width + x] = index;
        }
      }
    });
  }

  private buildFog(): void {
    const { width, height } = this.level;
    this.fogState = new Int8Array(width * height).fill(TileVisibility.Unseen);
    this.fogTiles = new Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const rect = this.add
          .rectangle(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE,
            TILE_SIZE,
            COLORS.fog,
            1,
          )
          .setDepth(500);
        this.fogTiles[y * width + x] = rect;
      }
    }
  }

  private spawnPlayer(): void {
    const { spawn } = this.level;
    this.player = new Player(
      this,
      spawn.x * TILE_SIZE + TILE_SIZE / 2,
      spawn.y * TILE_SIZE + TILE_SIZE / 2,
    );
    this.player.setDepth(100);
    this.controller = new PlayerController(this, this.player);
    this.physics.add.collider(this.player, this.walls);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
  }

  private markZoneDiscovery(tileX: number, tileY: number): void {
    const zoneIndex = this.hiddenZoneByTile[tileY * this.level.width + tileX];
    if (zoneIndex !== undefined && zoneIndex >= 0) {
      this.discoveredZones.add(zoneIndex);
    }
  }

  private refreshFog(): void {
    const width = this.level.width;
    for (let i = 0; i < this.fogState.length; i++) {
      let vis = this.visibility.getState(i % width, Math.floor(i / width));
      const hidden = this.hiddenZoneByTile[i];
      if (
        hidden !== undefined &&
        hidden >= 0 &&
        !this.discoveredZones.has(hidden)
      ) {
        vis = TileVisibility.Unseen;
      }
      if (this.fogState[i] === vis) continue;
      this.fogState[i] = vis;
      this.fogTiles[i]?.setAlpha(FOG_ALPHA[vis] ?? 1);
    }
  }

  override update(): void {
    this.controller.update();

    const tileX = Math.floor(this.player.x / TILE_SIZE);
    const tileY = Math.floor(this.player.y / TILE_SIZE);
    if (tileX !== this.lastTileX || tileY !== this.lastTileY) {
      this.lastTileX = tileX;
      this.lastTileY = tileY;
      this.markZoneDiscovery(tileX, tileY);
      this.visibility.update(tileX, tileY, (x, y) => this.isWallTile(x, y));
      this.refreshFog();
    }

    if (this.fpsText) {
      this.fpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
    }
  }
}
