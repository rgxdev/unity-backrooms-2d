import Phaser from "phaser";
import {
  DIFFICULTY_CONFIG,
  DREAD,
  SCENES,
  TEXTURES,
  TILE_SIZE,
  VISIBILITY,
} from "@/game/config/constants";
import type { Difficulty } from "@/lib/schemas/settings";
import { TileKind, type LevelData, type Zone } from "@/lib/schemas/level";
import {
  generateLevel,
  getOfficialLevel,
  LAST_LEVEL_INDEX,
  type LevelTheme,
} from "@/game/levels";
import { Player } from "@/game/entities/Player";
import { Monster } from "@/game/entities/Monster";
import { PlayerController } from "@/game/systems/PlayerController";
import { AudioManager } from "@/game/systems/AudioManager";
import {
  TileVisibility,
  VisibilitySystem,
} from "@/game/visibility/VisibilitySystem";
import { GamePhase, MonsterDirector } from "@/game/ai/MonsterDirector";
import { DEFAULT_MONSTER_TUNING } from "@/game/ai/types";
import type { Vec2 } from "@/game/ai/steering";
import { getSettings } from "@/lib/settings-store";
import { completeLevel, getProgress } from "@/lib/progress-store";

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
  private monsters: Monster[] = [];

  private readonly director = new MonsterDirector();
  private phase: GamePhase = GamePhase.Ambient;
  private presenceOverlay!: Phaser.GameObjects.Rectangle;
  private lastCueAt = -Infinity;

  private theme!: LevelTheme;
  private difficulty: Difficulty = "easy";
  private levelIndex = 0;
  private lethal = false;
  private pursuitSpeed = DIFFICULTY_CONFIG.easy.pursuitSpeed;
  /** True once the level has resolved (escaped or died); freezes gameplay. */
  private ended = false;
  private restarted = false;

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
    // Scene.restart re-runs create() on the same instance — reset run state.
    this.resetRunState();

    const settings = getSettings();
    const progress = getProgress();
    this.levelIndex = progress.currentLevel;
    this.difficulty = settings.difficulty;
    const cfg = DIFFICULTY_CONFIG[this.difficulty];
    this.lethal = cfg.lethal;
    this.pursuitSpeed = cfg.pursuitSpeed;

    const official = getOfficialLevel(this.levelIndex);
    this.theme = official.theme;
    // Fresh random layout each play (deterministic per seed for testing).
    const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    this.level = generateLevel({
      levelId: official.id,
      levelName: official.name,
      difficulty: this.difficulty,
      levelIndex: this.levelIndex,
      seed,
    });
    const level = this.level;

    const worldW = level.width * TILE_SIZE;
    const worldH = level.height * TILE_SIZE;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBackgroundColor(this.theme.fog);
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
    this.spawnMonsters();
    this.buildExit();
    this.buildPresenceOverlay();
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

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.audio.destroy();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
    });
  }

  private resetRunState(): void {
    this.director.reset();
    this.phase = GamePhase.Ambient;
    this.monsters = [];
    this.lastCueAt = -Infinity;
    this.ended = false;
    this.restarted = false;
    this.lastTileX = -1;
    this.lastTileY = -1;
    this.discoveredZones.clear();
    this.fpsText = null;
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
        const tint = this.theme.tint;
        if (tiles[y * width + x] === TileKind.Wall) {
          (this.walls.create(px, py, TEXTURES.wall) as Phaser.GameObjects.Image)
            .setTint(tint);
        } else {
          const alt = (x + y) % 2 === 0;
          this.add
            .image(px, py, alt ? TEXTURES.floor : TEXTURES.floorAlt)
            .setTint(tint)
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
            this.theme.fog,
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

  private centreOf(tileX: number, tileY: number): Vec2 {
    return {
      x: tileX * TILE_SIZE + TILE_SIZE / 2,
      y: tileY * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  private spawnMonsters(): void {
    this.monsters = this.level.monsters.map((spawn) => {
      const origin = this.centreOf(spawn.x, spawn.y);
      const waypoints = spawn.patrol.map((p) => this.centreOf(p.x, p.y));
      const monster = new Monster(
        this,
        origin.x,
        origin.y,
        waypoints,
        DEFAULT_MONSTER_TUNING,
      );
      monster.setDepth(90);
      this.physics.add.collider(monster, this.walls);
      return monster;
    });
  }

  private buildExit(): void {
    const exit = this.level.exit;
    if (!exit) return;
    const c = this.centreOf(exit.x, exit.y);
    const door = this.add.image(c.x, c.y, TEXTURES.exit).setDepth(-5);
    // Gentle pulse so the way out reads as the goal.
    this.tweens.add({
      targets: door,
      alpha: { from: 0.7, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }

  private readonly handleResize = (): void => {
    const cam = this.cameras.main;
    if (this.presenceOverlay?.active) {
      this.presenceOverlay.setSize(cam.width, cam.height);
    }
  };

  /** Full-screen dark pulse used to sell the monster's unseen presence. */
  private buildPresenceOverlay(): void {
    const cam = this.cameras.main;
    this.presenceOverlay = this.add
      .rectangle(0, 0, cam.width, cam.height, 0x120018, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(900);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
  }

  private playerTile(): Vec2 {
    return {
      x: Math.floor(this.player.x / TILE_SIZE),
      y: Math.floor(this.player.y / TILE_SIZE),
    };
  }

  private inRect(px: number, py: number, r: LevelData["pursuitTrigger"]): boolean {
    if (!r) return false;
    return px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height;
  }

  /** Advance the dread director and drive the monsters for the current phase. */
  private updateAi(time: number): void {
    if (this.ended) {
      for (const m of this.monsters) m.freeze();
      return;
    }
    if (this.monsters.length === 0) return;

    const tile = this.playerTile();
    const atExit =
      !!this.level.exit &&
      tile.x === this.level.exit.x &&
      tile.y === this.level.exit.y;
    const inPursuitTrigger = this.inRect(
      tile.x,
      tile.y,
      this.level.pursuitTrigger,
    );

    const prev = this.phase;
    this.phase = this.director.update({ inPursuitTrigger, atExit });
    if (this.phase !== prev) this.onPhaseChange(this.phase);

    const playerPos: Vec2 = { x: this.player.x, y: this.player.y };
    switch (this.phase) {
      case GamePhase.Ambient:
        for (const m of this.monsters) m.tickAmbient();
        this.presenceCue(time, playerPos);
        break;
      case GamePhase.Pursuit: {
        let nearest = Infinity;
        for (const m of this.monsters) {
          m.pursue(playerPos, this.pursuitSpeed);
          nearest = Math.min(nearest, m.distanceTo(playerPos));
        }
        // On middle/hard the chase is lethal — it can catch and kill you.
        if (this.lethal && nearest <= DREAD.killRadius) this.onDeath();
        break;
      }
      case GamePhase.Escaped:
        for (const m of this.monsters) m.freeze();
        break;
    }
  }

  private onPhaseChange(phase: GamePhase): void {
    if (phase === GamePhase.Pursuit) {
      // The end is near — the monster wakes with a roar and a jolt.
      this.audio.roar();
      this.cameras.main.flash(320, 90, 0, 0);
      this.cameras.main.shake(400, 0.006);
    } else if (phase === GamePhase.Escaped) {
      this.onEscape();
    }
  }

  /** Robustly restart the scene once (Space or the auto-timer, whichever first). */
  private scheduleRestart(delayMs: number): void {
    const go = () => {
      if (this.restarted) return;
      this.restarted = true;
      this.scene.restart();
    };
    this.time.delayedCall(delayMs, go);
    this.input.keyboard?.once("keydown-SPACE", go);
  }

  private onEscape(): void {
    if (this.ended) return;
    this.ended = true;
    // Unlock and advance to the next official level.
    const wasLast = this.levelIndex >= LAST_LEVEL_INDEX;
    completeLevel(this.levelIndex);
    const next = getOfficialLevel(this.levelIndex + 1);
    const heading = wasLast ? "BACKROOMS BEZWUNGEN" : "ENTKOMMEN";
    const sub = wasLast
      ? "Du hast alle Level überlebt."
      : `Du bist gerade so entkommen — weiter zu ${next.name}.`;
    this.showBanner(heading, sub, "#9dffc0", 0x02040a);
    this.scheduleRestart(2800);
  }

  private onDeath(): void {
    if (this.ended) return;
    this.ended = true;
    this.player.setVelocity(0, 0);
    this.audio.roar();
    this.cameras.main.shake(500, 0.012);
    this.cameras.main.flash(500, 150, 0, 0);
    this.showBanner(
      "GEFANGEN",
      "Das Monster hat dich erwischt. Leertaste: erneut versuchen.",
      "#ff6a4a",
      0x160202,
    );
    this.scheduleRestart(2800);
  }

  /** Occasional "you can hear it" beat while the monster lurks nearby. */
  private presenceCue(time: number, playerPos: Vec2): void {
    if (time - this.lastCueAt < DREAD.cueCooldownMs) return;
    const nearest = Math.min(
      ...this.monsters.map((m) => m.distanceTo(playerPos)),
    );
    if (nearest > DREAD.presenceRadius) return;

    this.lastCueAt = time;
    // Louder the closer it is.
    const closeness = 1 - nearest / DREAD.presenceRadius;
    this.audio.growl(0.25 + closeness * 0.4);
    this.tweens.add({
      targets: this.presenceOverlay,
      alpha: { from: 0, to: 0.18 + closeness * 0.15 },
      duration: 380,
      yoyo: true,
      ease: "Sine.InOut",
    });
  }

  /** End-of-run overlay (escape or death). */
  private showBanner(
    heading: string,
    sub: string,
    color: string,
    veilColor: number,
  ): void {
    const cam = this.cameras.main;
    const veil = this.add
      .rectangle(0, 0, cam.width, cam.height, veilColor, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1001);
    this.tweens.add({ targets: veil, alpha: 0.82, duration: 900 });
    this.add
      .text(cam.width / 2, cam.height / 2, heading, {
        fontFamily: "monospace",
        fontSize: "40px",
        color,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1002);
    this.add
      .text(cam.width / 2, cam.height / 2 + 42, sub, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#c9b458",
        align: "center",
        wordWrap: { width: cam.width - 80 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1002);
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

  override update(time: number): void {
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

    this.updateAi(time);

    if (this.fpsText) {
      this.fpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
    }
  }
}
