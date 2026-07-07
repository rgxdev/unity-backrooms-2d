import Phaser from "phaser";
import {
  ANOMALY,
  BLACKOUT_MIN_ALPHA,
  DIFFICULTY_CONFIG,
  DREAD,
  EXIT_DREAD,
  JUMPSCARE,
  MONSTER_TINT,
  SCENES,
  TEXTURES,
  TILE_SIZE,
  VISIBILITY,
  ZONE_TINT,
} from "@/game/config/constants";
import type { Difficulty } from "@/lib/schemas/settings";
import { TileKind, type LevelData, type Zone } from "@/lib/schemas/level";
import {
  generateLevel,
  generateLevel0,
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
import { type AnomalyType, ProcessDirector } from "@/game/ai/ProcessDirector";
import { DEFAULT_MONSTER_TUNING } from "@/game/ai/types";
import type { Vec2 } from "@/game/ai/steering";
import { getSettings } from "@/lib/settings-store";
import { completeLevel, getProgress } from "@/lib/progress-store";
import {
  DEFAULT_SKIN_ID,
  resolveEquippedSkinId,
  SKINS,
} from "@/game/skins/skinCatalog";
import {
  recordDeath,
  recordEscape,
  recordFall,
  recordRunStart,
} from "@/lib/stats-store";

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
  private anomalyOverlay!: Phaser.GameObjects.Rectangle;
  private lastCueAt = -Infinity;

  /** Background ambience process — flickers/whispers/thuds, cosmetic only. */
  private readonly process = new ProcessDirector(ANOMALY);

  private theme!: LevelTheme;
  private difficulty: Difficulty = "easy";
  private levelIndex = 0;
  private skinId: string = DEFAULT_SKIN_ID;
  private lethal = false;
  private pursuitSpeed = DIFFICULTY_CONFIG.easy.pursuitSpeed;
  /** True once the level has resolved (escaped or died); freezes gameplay. */
  private ended = false;
  private restarted = false;
  private runStartedAt = 0;

  private fogTiles: Phaser.GameObjects.Rectangle[] = [];
  private fogState: Int8Array = new Int8Array(0);
  private hiddenZoneByTile: Int16Array = new Int16Array(0);
  private discoveredZones = new Set<number>();
  /** Per-tile floor tint from thematic zones (red / manila); -1 = base tint. */
  private floorTintByTile: Int32Array = new Int32Array(0);
  /** 1 where a Blackout Zone keeps residual fog even when "visible". */
  private blackoutByTile: Uint8Array = new Uint8Array(0);

  private lastTileX = -1;
  private lastTileY = -1;
  private fpsText: Phaser.GameObjects.Text | null = null;

  /** A transient "flash into view for a few seconds" encounter, distinct
   *  from the persistent patrol/pursuer monsters. */
  private jumpscareMonster: Monster | null = null;
  private jumpscareNextAt = -1;
  private jumpscareDespawnAt = 0;
  private jumpscareAttacked = false;

  constructor() {
    super(SCENES.main);
  }

  create(): void {
    // Scene.restart re-runs create() on the same instance — reset run state.
    this.resetRunState();
    this.runStartedAt = this.time.now;
    recordRunStart();

    const settings = getSettings();
    const progress = getProgress();
    this.levelIndex = progress.currentLevel;
    this.skinId = resolveEquippedSkinId(progress.unlockedSkins, settings.skinId);
    this.difficulty = settings.difficulty;
    const cfg = DIFFICULTY_CONFIG[this.difficulty];
    this.lethal = cfg.lethal;
    this.pursuitSpeed = cfg.pursuitSpeed;

    const official = getOfficialLevel(this.levelIndex);
    this.theme = official.theme;
    // Fresh random layout each play (deterministic per seed for testing).
    const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    const genInput = {
      levelId: official.id,
      levelName: official.name,
      difficulty: this.difficulty,
      levelIndex: this.levelIndex,
      seed,
    };
    // Level 0 is hand-authored into the documented Backrooms sub-sections;
    // every deeper level uses the generic room generator.
    this.level =
      this.levelIndex === 0
        ? generateLevel0(genInput)
        : generateLevel(genInput);
    const level = this.level;

    const worldW = level.width * TILE_SIZE;
    const worldH = level.height * TILE_SIZE;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBackgroundColor(this.theme.fog);
    this.cameras.main.setZoom(2);
    this.cameras.main.roundPixels = true;

    this.buildZoneThemeMasks();
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
    this.audio.startHum();

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
    this.process.reset();
    this.phase = GamePhase.Ambient;
    this.monsters = [];
    this.lastCueAt = -Infinity;
    this.ended = false;
    this.restarted = false;
    this.lastTileX = -1;
    this.lastTileY = -1;
    this.discoveredZones.clear();
    this.fpsText = null;
    this.jumpscareMonster = null;
    this.jumpscareNextAt = -1;
    this.jumpscareDespawnAt = 0;
    this.jumpscareAttacked = false;
    this.runStartedAt = 0;
  }

  private isWallTile(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.level.width || y >= this.level.height) {
      return true;
    }
    return this.level.tiles[y * this.level.width + x] === TileKind.Wall;
  }

  /**
   * Build the tint / blackout lookup tables from the level's thematic zones so
   * the documented Level 0 sub-sections read distinctly. Runs before
   * buildTiles so floor tiles can be tinted as they are created.
   */
  private buildZoneThemeMasks(): void {
    const { width, height, zones } = this.level;
    this.floorTintByTile = new Int32Array(width * height).fill(-1);
    this.blackoutByTile = new Uint8Array(width * height);
    for (const zone of zones) {
      if (!zone.kind) continue;
      const tint = ZONE_TINT[zone.kind];
      for (let y = zone.y; y < zone.y + zone.height; y++) {
        for (let x = zone.x; x < zone.x + zone.width; x++) {
          if (x >= width || y >= height) continue;
          const i = y * width + x;
          if (zone.kind === "blackout") this.blackoutByTile[i] = 1;
          else if (tint !== undefined) this.floorTintByTile[i] = tint;
        }
      }
    }
  }

  private buildTiles(): void {
    this.walls = this.physics.add.staticGroup();
    const { width, height, tiles } = this.level;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;
        const kind = tiles[y * width + x];
        if (kind === TileKind.Wall) {
          (this.walls.create(px, py, TEXTURES.wall) as Phaser.GameObjects.Image)
            .setTint(this.theme.tint);
        } else if (kind === TileKind.Hole) {
          // Bottomless pit — no collider, but lethal to step on (see update()).
          this.add.image(px, py, TEXTURES.hole).setDepth(-9);
        } else {
          const alt = (x + y) % 2 === 0;
          const zoneTint = this.floorTintByTile[y * width + x] ?? -1;
          this.add
            .image(px, py, alt ? TEXTURES.floor : TEXTURES.floorAlt)
            .setTint(zoneTint >= 0 ? zoneTint : this.theme.tint)
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
      this.skinId,
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

  /** Pursuer reads hottest (it's the one that ends the level); everything
   *  else patrols as the neutral default. */
  private monsterTint(id: string): number {
    return id === "pursuer" ? MONSTER_TINT.pursuer : MONSTER_TINT.lurker;
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
        this.monsterTint(spawn.id),
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
    // Restless flicker — the seam of light guttering like a dying tube.
    this.tweens.add({
      targets: door,
      alpha: { from: 0.5, to: 1 },
      duration: 150,
      yoyo: true,
      repeat: -1,
      repeatDelay: 90,
      ease: "Sine.InOut",
    });
    this.dressExitNiche(exit);
  }

  /** Crack overlays on the real wall tiles around the breach, and a little
   *  rubble on the room-side floor tile it broke into — so the exit reads
   *  as actual damage to the wall, not a differently-coloured tile. */
  private dressExitNiche(exit: { x: number; y: number }): void {
    const deltas: Vec2[] = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    for (const d of deltas) {
      const nx = exit.x + d.x;
      const ny = exit.y + d.y;
      if (nx < 0 || ny < 0 || nx >= this.level.width || ny >= this.level.height) {
        continue;
      }
      const nc = this.centreOf(nx, ny);
      if (this.isWallTile(nx, ny)) {
        this.add
          .image(nc.x, nc.y, TEXTURES.wallCrack)
          .setTint(this.theme.tint)
          .setDepth(1);
      } else {
        this.add.image(nc.x, nc.y, TEXTURES.rubble).setDepth(-8);
      }
    }
  }

  private readonly handleResize = (): void => {
    const cam = this.cameras.main;
    if (this.presenceOverlay?.active) {
      this.presenceOverlay.setSize(cam.width, cam.height);
    }
    if (this.anomalyOverlay?.active) {
      this.anomalyOverlay.setSize(cam.width, cam.height);
    }
  };

  /** Full-screen dark pulse used to sell the monster's unseen presence, plus
   *  a separate pale overlay for cosmetic environmental anomalies (flicker)
   *  so the two cues never fight over one rectangle's colour. */
  private buildPresenceOverlay(): void {
    const cam = this.cameras.main;
    this.presenceOverlay = this.add
      .rectangle(0, 0, cam.width, cam.height, 0x120018, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(900);
    this.anomalyOverlay = this.add
      .rectangle(0, 0, cam.width, cam.height, 0xffffff, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(901);
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
      this.jumpscareMonster?.freeze();
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
      case GamePhase.Ambient: {
        // Monster activity ramps up the closer the player gets to the exit.
        const proximity = this.exitProximity(tile.x, tile.y);
        const speedBoost = 1 + proximity * EXIT_DREAD.maxSpeedBoost;
        for (const m of this.monsters) m.tickAmbient(speedBoost);
        this.presenceCue(time, playerPos, proximity);
        this.updateJumpscare(time, playerPos, proximity);
        break;
      }
      case GamePhase.Pursuit: {
        this.despawnJumpscare();
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
        this.jumpscareMonster?.freeze();
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

  /** Milliseconds elapsed in the current run, for stats accumulation. */
  private elapsedRunMs(): number {
    return Math.max(0, this.time.now - this.runStartedAt);
  }

  private onEscape(): void {
    if (this.ended) return;
    this.ended = true;
    recordEscape(this.elapsedRunMs());
    // Unlock and advance to the next official level.
    const wasLast = this.levelIndex >= LAST_LEVEL_INDEX;
    const previouslyUnlockedSkins = getProgress().unlockedSkins;
    completeLevel(this.levelIndex);
    const rewardSkin = SKINS.find(
      (skin) =>
        skin.unlockLevel === this.levelIndex &&
        !previouslyUnlockedSkins.includes(skin.id),
    );
    const next = getOfficialLevel(this.levelIndex + 1);
    const heading = wasLast ? "BACKROOMS BEZWUNGEN" : "ENTKOMMEN";
    let sub = wasLast
      ? "Du hast alle Level überlebt."
      : `Du bist gerade so entkommen — weiter zu ${next.name}.`;
    if (rewardSkin) {
      sub += `\nNeuer Skin freigeschaltet: ${rewardSkin.name}!`;
      this.audio.chime();
    }
    this.showBanner(heading, sub, "#9dffc0", 0x02040a);
    this.scheduleRestart(2800);
  }

  private isHoleTile(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.level.width || y >= this.level.height) {
      return false;
    }
    return this.level.tiles[y * this.level.width + x] === TileKind.Hole;
  }

  /** Fell into a bottomless pit — always fatal, on every difficulty. */
  private onFall(): void {
    if (this.ended) return;
    this.ended = true;
    recordFall(this.elapsedRunMs());
    this.player.setVelocity(0, 0);
    this.cameras.main.shake(400, 0.01);
    this.cameras.main.fade(600, 0, 0, 0);
    this.showBanner(
      "GEFALLEN",
      "Du bist in ein bodenloses Loch gestürzt. Leertaste: erneut versuchen.",
      "#8ab4ff",
      0x02030a,
    );
    this.scheduleRestart(2800);
  }

  private onDeath(): void {
    if (this.ended) return;
    this.ended = true;
    recordDeath(this.elapsedRunMs());
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

  /** Occasional "you can hear it" beat while the monster lurks nearby — fires
   *  more often the closer the player gets to the exit. */
  private presenceCue(time: number, playerPos: Vec2, exitProximity: number): void {
    const cooldown = DREAD.cueCooldownMs * (1 - exitProximity * (1 - EXIT_DREAD.minIntervalScale));
    if (time - this.lastCueAt < cooldown) return;
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

  /** 0 (far away) to 1 (standing on it) — how close the player is to the exit. */
  private exitProximity(tileX: number, tileY: number): number {
    const exit = this.level.exit;
    if (!exit) return 0;
    const dx = tileX - exit.x;
    const dy = tileY - exit.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return Phaser.Math.Clamp(1 - dist / EXIT_DREAD.radiusTiles, 0, 1);
  }

  /**
   * A monster flashes into view near the player for a few seconds, then
   * vanishes — a jump-scare distinct from the persistent patrol/pursuer
   * monsters. Above easy, getting too close during the window triggers an
   * attack. Frequency ramps up near the exit.
   */
  private updateJumpscare(
    time: number,
    playerPos: Vec2,
    exitProximity: number,
  ): void {
    if (this.jumpscareNextAt < 0) {
      // First roll after level load — don't scare the player immediately.
      this.jumpscareNextAt =
        time + Phaser.Math.Between(JUMPSCARE.minIntervalMs, JUMPSCARE.maxIntervalMs);
      return;
    }

    if (this.jumpscareMonster) {
      const dist = this.jumpscareMonster.distanceTo(playerPos);
      if (
        !this.jumpscareAttacked &&
        this.difficulty !== "easy" &&
        dist <= JUMPSCARE.attackRadius
      ) {
        this.jumpscareAttacked = true;
        this.audio.snarl();
        this.cameras.main.flash(220, 120, 0, 0);
        this.jumpscareMonster.pursue(playerPos, this.pursuitSpeed * 1.4);
        if (this.lethal) this.onDeath();
        // Despawn shortly after the attack regardless of outcome.
        this.jumpscareDespawnAt = Math.min(this.jumpscareDespawnAt, time + 500);
      }
      if (time >= this.jumpscareDespawnAt) this.despawnJumpscare();
      return;
    }

    if (time < this.jumpscareNextAt) return;
    this.trySpawnJumpscare(time, exitProximity);
    const scale = 1 - exitProximity * (1 - EXIT_DREAD.minIntervalScale);
    const interval =
      Phaser.Math.Between(JUMPSCARE.minIntervalMs, JUMPSCARE.maxIntervalMs) * scale;
    this.jumpscareNextAt = time + interval;
  }

  /** Try a handful of candidate tiles in view range and spawn on the first
   *  one that's walkable and actually visible to the player. */
  private trySpawnJumpscare(time: number, exitProximity: number): void {
    const origin = this.playerTile();
    const isWall = (x: number, y: number) => this.isWallTile(x, y);
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.FloatBetween(
        JUMPSCARE.spawnMinRadiusTiles,
        JUMPSCARE.spawnMaxRadiusTiles,
      );
      const tx = Math.round(origin.x + Math.cos(angle) * dist);
      const ty = Math.round(origin.y + Math.sin(angle) * dist);
      if (tx < 0 || ty < 0 || tx >= this.level.width || ty >= this.level.height) {
        continue;
      }
      if (this.isWallTile(tx, ty) || this.isHoleTile(tx, ty)) continue;
      if (!this.visibility.hasLineOfSight(origin.x, origin.y, tx, ty, isWall)) {
        continue;
      }

      const c = this.centreOf(tx, ty);
      const monster = new Monster(
        this,
        c.x,
        c.y,
        [],
        DEFAULT_MONSTER_TUNING,
        MONSTER_TINT.jumpscare,
      );
      monster.setDepth(90);
      monster.setAlpha(0);
      this.physics.add.collider(monster, this.walls);
      this.tweens.add({ targets: monster, alpha: 1, duration: 220, ease: "Sine.Out" });

      this.jumpscareMonster = monster;
      this.jumpscareAttacked = false;
      const visibleMs = Phaser.Math.Between(
        JUMPSCARE.minVisibleMs,
        JUMPSCARE.maxVisibleMs,
      );
      this.jumpscareDespawnAt = time + visibleMs;
      this.audio.shriek(0.3 + exitProximity * 0.3);
      return;
    }
  }

  private despawnJumpscare(): void {
    const monster = this.jumpscareMonster;
    if (!monster) return;
    this.jumpscareMonster = null;
    this.tweens.add({
      targets: monster,
      alpha: 0,
      duration: 250,
      onComplete: () => monster.destroy(),
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

  /**
   * Soft vignette at the rim of the sight radius: tiles within the last
   * `edgeFalloffTiles` of the reveal radius fade in gradually instead of
   * popping fully clear, so the field of view reads as a gentle glow rather
   * than a hard-edged disc.
   */
  private edgeFalloff(tileX: number, tileY: number): number {
    const dx = tileX - this.lastTileX;
    const dy = tileY - this.lastTileY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const radius = VISIBILITY.revealRadiusTiles;
    const band = VISIBILITY.edgeFalloffTiles;
    const t = (dist - (radius - band)) / band;
    return Phaser.Math.Clamp(t, 0, 1);
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
      let alpha = FOG_ALPHA[vis] ?? 1;
      if (vis === TileVisibility.Visible) {
        const falloff = this.edgeFalloff(i % width, Math.floor(i / width));
        alpha = falloff * VISIBILITY.dimAlpha;
      }
      // Blackout Zones never fully light — keep a residual gloom.
      if (this.blackoutByTile[i] && alpha < BLACKOUT_MIN_ALPHA) {
        alpha = BLACKOUT_MIN_ALPHA;
      }
      const tile = this.fogTiles[i];
      if (!tile) continue;
      this.tweens.killTweensOf(tile);
      this.tweens.add({
        targets: tile,
        alpha,
        duration: VISIBILITY.fadeMs,
        ease: "Sine.Out",
      });
    }
  }

  override update(time: number, delta: number): void {
    this.controller.update(delta);

    const tileX = Math.floor(this.player.x / TILE_SIZE);
    const tileY = Math.floor(this.player.y / TILE_SIZE);
    if (tileX !== this.lastTileX || tileY !== this.lastTileY) {
      this.lastTileX = tileX;
      this.lastTileY = tileY;
      this.markZoneDiscovery(tileX, tileY);
      this.visibility.update(tileX, tileY, (x, y) => this.isWallTile(x, y));
      this.refreshFog();
    }

    // One wrong step in the Hole Variation and you fall — no monster needed.
    if (!this.ended && this.isHoleTile(tileX, tileY)) this.onFall();

    this.updateAi(time);

    if (!this.ended) {
      const anomaly = this.process.update(time);
      if (anomaly) this.triggerAnomaly(anomaly);
    }

    if (this.fpsText) {
      this.fpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
    }
  }

  /** Fire the cosmetic feedback for a background ambience event — no
   *  gameplay effect, purely atmosphere. */
  private triggerAnomaly(type: AnomalyType): void {
    switch (type) {
      case "flicker":
        this.audio.flicker();
        this.tweens.add({
          targets: this.anomalyOverlay,
          alpha: { from: 0, to: 0.22 },
          duration: 55,
          yoyo: true,
          repeat: 4,
        });
        break;
      case "whisper":
        this.audio.whisper();
        break;
      case "thud":
        this.audio.thud();
        this.cameras.main.shake(140, 0.003);
        break;
    }
  }
}
