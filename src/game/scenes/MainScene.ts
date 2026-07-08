import Phaser from "phaser";
import {
  AMBIENT_DARKEN,
  ANOMALY,
  BLACKOUT_EVENT,
  BLACKOUT_MIN_ALPHA,
  COLORS,
  DEATHMOTH,
  DECORATION,
  DIFFICULTY_CONFIG,
  DREAD,
  EXIT_DREAD,
  FEAR,
  FLASHLIGHT,
  FLOOR_VARIANTS,
  JUMPSCARE,
  LORE_PICKUP,
  MONSTER_ART,
  MONSTER_KIND_CONFIG,
  type MonsterKindConfig,
  MONSTER_STEALTH,
  MONSTER_TINT,
  monsterTextureKey,
  OLDSCHOOL_FX,
  PATHFIND,
  PURSUIT_CATCH,
  SCENES,
  SKINSTEALER,
  STALKER,
  STYLE_COLORS,
  STYLE_PROPS,
  TEXTURES,
  TILE_SIZE,
  VISIBILITY,
  WALL_MASK,
  WALL_VARIANTS,
  ZONE_TINT,
} from "@/game/config/constants";
import { getLoreForLevel, type LoreEntry } from "@/game/content/lore";
import type { Difficulty } from "@/lib/schemas/settings";
import { TileKind, type LevelData, type Zone } from "@/lib/schemas/level";
import {
  generateLevel,
  generateLevel0,
  getOfficialLevel,
  LAST_LEVEL_INDEX,
  type LevelTheme,
} from "@/game/levels";
import { pickMonsterKind } from "@/game/levels/roster";
import { addSoftVignette, SoftVignetteController } from "@/game/fx/SoftVignette";
import { Player } from "@/game/entities/Player";
import { Monster } from "@/game/entities/Monster";
import { PlayerController } from "@/game/systems/PlayerController";
import { AudioManager } from "@/game/systems/AudioManager";
import {
  TileVisibility,
  VisibilitySystem,
} from "@/game/visibility/VisibilitySystem";
import { GamePhase, MonsterDirector } from "@/game/ai/MonsterDirector";
import {
  ANOMALY_TYPES,
  type AnomalyType,
  ProcessDirector,
} from "@/game/ai/ProcessDirector";
import { DEFAULT_MONSTER_TUNING } from "@/game/ai/types";
import type { MonsterKind } from "@/game/ai/types";
import { StalkerAI, StalkerState } from "@/game/ai/StalkerAI";
import { SkinStealerAI, SkinStealerState } from "@/game/ai/SkinStealerAI";
import type { Vec2 } from "@/game/ai/steering";
import { findPath } from "@/game/ai/pathfinding";
import { getSettings } from "@/lib/settings-store";
import { completeLevel, getProgress } from "@/lib/progress-store";
import { addItem, hasItem } from "@/lib/inventory-store";
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
import { hash01 } from "@/game/util/hash";

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
  /** Holds every fixed-position HUD element (FPS counter, hotbar, stamina
   *  bar). Camera zoom scales scrollFactor(0) objects around the viewport
   *  centre same as any other object — only scroll is cancelled, not zoom
   *  (see {@link updateHudTransform}) — so this container's own transform is
   *  kept at the inverse of the current zoom, letting every child use plain,
   *  unscaled screen-pixel coordinates regardless of zoom. */
  private hudContainer!: Phaser.GameObjects.Container;
  private lastCueAt = -Infinity;

  /** Background ambience process — flickers/whispers/thuds, cosmetic only. */
  private readonly process = new ProcessDirector(ANOMALY);

  private theme!: LevelTheme;
  private difficulty: Difficulty = "easy";
  private levelIndex = 0;
  private skinId: string = DEFAULT_SKIN_ID;
  private lethal = false;
  private pursuitSpeed = DIFFICULTY_CONFIG.easy.pursuitSpeed;
  /** Gates {@link onPursuitCatch} so a non-lethal catch reacts once, then
   *  gives the shove some time to open a gap before it can fire again. */
  private pursuitCatchCooldownUntil = 0;
  /** Non-lethal catches this run — capped at PURSUIT_CATCH.maxCatches so the
   *  chase eventually lets up instead of looping forever. */
  private pursuitCatchCount = 0;
  /** Per-monster: while stunned after a non-lethal catch it holds still
   *  instead of immediately re-closing the gap and re-triggering the catch. */
  private readonly pursuitStunnedUntil = new WeakMap<Monster, number>();
  /** Monsters that hit the non-lethal catch cap — they stop pursuing for the
   *  rest of the run instead of endlessly re-engaging. */
  private readonly pursuitDisengaged = new WeakSet<Monster>();
  /** Per-monster: next time it's allowed to recompute its maze route to the
   *  player (see ai/pathfinding.ts). */
  private readonly pursuitPathRecalcAt = new WeakMap<Monster, number>();
  /** Which `MonsterKind` a live `Monster` instance was spawned as (see
   *  constants.ts's `MONSTER_KIND_CONFIG`) — drives per-kind chase-speed,
   *  audio cue, and (later) behavior lookups generically instead of a
   *  Hound-only special case. */
  private readonly monsterKinds = new WeakMap<Monster, MonsterKind>();
  /** Per-instance "avoid eye contact" brain for every live roster Skin-Stealer
   *  (see SkinStealerAI) — a level can have more than one, unlike the single
   *  persistent Stalker. */
  private readonly skinStealerAI = new WeakMap<Monster, SkinStealerAI>();
  /** Per-instance cooldown gate for the Deathmoth's contact "swarm graze"
   *  beat, so brushing past one can't spam the cue every frame. */
  private readonly deathmothGrazeCooldownUntil = new WeakMap<Monster, number>();
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
  /** True when the current encounter is a silent "peek" — it never attacks,
   *  it just proves something was watching. */
  private jumpscareIsPeek = false;
  /** Which `MonsterKind` the current jump-scare encounter rolled as (see
   *  {@link trySpawnJumpscare}) — its tint/scale come from
   *  `MONSTER_KIND_CONFIG`, and a `harmless` roll (Faceling/Deathmoth) must
   *  never attack regardless of difficulty, same as a roster spawn. */
  private jumpscareKind: MonsterKind = "lurker";

  /** The Stalker: a "don't look away" horror mechanic — see StalkerAI. */
  private readonly stalkerAI = new StalkerAI();
  private stalkerMonster: Monster | null = null;

  /** Random ambient power-flicker beat — pure atmosphere. */
  private nextBlackoutAt = -1;

  /** Camera post-processing (WebGL only — no-ops gracefully otherwise). */
  private vignetteFilter: SoftVignetteController | null = null;
  private barrelFilter: Phaser.Filters.Barrel | null = null;
  /** Base camera zoom — tight POV so the visible play area stays small and
   *  claustrophobic instead of showing off half the maze at once. */
  private readonly baseZoom = 2.2;
  /** Smoothed camera zoom driving the fear-based claustrophobic creep on
   *  top of {@link baseZoom}. */
  private camZoom = this.baseZoom;

  /** Permanent oldschool CRT dressing — scanlines + jittered film grain. */
  private scanlineOverlay: Phaser.GameObjects.TileSprite | null = null;
  private grainOverlay: Phaser.GameObjects.TileSprite | null = null;
  private nextGrainJitterAt = 0;
  /** Permanent flat screen-wide dim — see {@link AMBIENT_DARKEN}. */
  private ambientDarkenOverlay: Phaser.GameObjects.Rectangle | null = null;

  /** Scattered Almond Water pickups still on the floor. */
  private almondBottles: Phaser.GameObjects.Image[] = [];
  private visionBoosted = false;
  private visionBoostUntil = 0;

  /**
   * The Flashlight (see FLASHLIGHT constants): a single rare pickup, only
   * ever spawned in the first level, kept forever once found (persisted in
   * the inventory store, see @/lib/inventory-store, so it survives
   * scene.restart() and page reloads alike). Equip/use it from hotbar slot 1;
   * aims a beam at the cursor that widens the fog-of-war reveal in that
   * direction.
   */
  private hasFlashlight = false;
  private flashlightOn = false;
  private flashlightPickup: Phaser.GameObjects.Image | null = null;
  private flashlightPrompt: Phaser.GameObjects.Text | null = null;
  private flashlightGraphics!: Phaser.GameObjects.Graphics;
  private flashlightNextRecalcAt = 0;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private flashlightToggleKey!: Phaser.Input.Keyboard.Key;
  /** Bottom-left hotbar slot showing the equipped flashlight. */
  private hotbarBg!: Phaser.GameObjects.Rectangle;
  private hotbarIcon!: Phaser.GameObjects.Image;
  private hotbarLabel!: Phaser.GameObjects.Text;
  /** Top-left sprint stamina meter fill — background track needs no
   *  reference after creation since it never changes. */
  private staminaBarFill!: Phaser.GameObjects.Rectangle;

  /**
   * Found documents (letters/book pages) scattered per level — see
   * game/content/lore.ts for the text and LORE_PICKUP (constants.ts) for
   * placement tuning. Reuses the Flashlight's [F] interact key.
   */
  private lorePickups: Array<{
    image: Phaser.GameObjects.Image;
    prompt: Phaser.GameObjects.Text;
    entry: LoreEntry;
  }> = [];
  /** Set while a document is open on screen — gates movement-independent
   *  input so [F] closes the reader instead of re-triggering a pickup. */
  private loreReading: LoreEntry | null = null;
  /** Zoom-compensated container parenting every reader element below — see
   *  {@link buildLoreReader}. */
  private loreUi!: Phaser.GameObjects.Container;
  private loreVeil!: Phaser.GameObjects.Rectangle;
  private lorePanel!: Phaser.GameObjects.Graphics;
  private loreTitleText!: Phaser.GameObjects.Text;
  private loreBodyText!: Phaser.GameObjects.Text;
  private lorePromptText!: Phaser.GameObjects.Text;

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
    this.skinId = resolveEquippedSkinId(
      progress.unlockedSkins,
      settings.skinId,
    );
    this.difficulty = settings.difficulty;
    const cfg = DIFFICULTY_CONFIG[this.difficulty];
    this.lethal = cfg.lethal;
    this.pursuitSpeed = cfg.pursuitSpeed;

    // Once found, the Flashlight stays in the persisted inventory (localStorage)
    // — it survives scene.restart(), death/fall retries, and page reloads.
    this.hasFlashlight = hasItem("flashlight");
    this.flashlightOn =
      this.hasFlashlight && this.registry.get("flashlightOn") === true;

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
    this.cameras.main.setZoom(this.baseZoom);
    this.cameras.main.roundPixels = true;

    this.buildZoneThemeMasks();
    this.buildTiles();
    this.buildDecorations();
    this.buildFlashlightPickup();
    this.buildLorePickups();
    this.buildLoreReader();
    this.buildHiddenZoneMask();
    this.buildFog();
    this.spawnPlayer();

    this.visibility = new VisibilitySystem(
      level.width,
      level.height,
      VISIBILITY.revealRadiusTiles,
    );
    this.spawnMonsters();
    this.spawnStalker();
    this.buildExit();
    this.buildPresenceOverlay();
    this.buildOldschoolOverlay();
    this.buildHudContainer();
    this.buildFlashlightSystems();
    this.setupFilters();
    this.audio = new AudioManager(this.sound);
    this.audio.startHum();

    if (getSettings().showFps) {
      this.fpsText = this.add.text(6, 6, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#e4c94a",
      });
      this.hudContainer.add(this.fpsText);
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
    this.pursuitCatchCooldownUntil = 0;
    this.pursuitCatchCount = 0;
    this.lastTileX = -1;
    this.lastTileY = -1;
    this.discoveredZones.clear();
    this.fpsText = null;
    this.jumpscareMonster = null;
    this.jumpscareNextAt = -1;
    this.jumpscareDespawnAt = 0;
    this.jumpscareAttacked = false;
    this.jumpscareIsPeek = false;
    this.jumpscareKind = "lurker";
    this.stalkerAI.reset();
    this.stalkerMonster = null;
    this.nextBlackoutAt = -1;
    this.vignetteFilter = null;
    this.barrelFilter = null;
    this.camZoom = this.baseZoom;
    this.scanlineOverlay = null;
    this.grainOverlay = null;
    this.nextGrainJitterAt = 0;
    this.ambientDarkenOverlay = null;
    this.runStartedAt = 0;
    this.almondBottles = [];
    this.visionBoosted = false;
    this.visionBoostUntil = 0;
    this.flashlightPickup = null;
    this.flashlightPrompt = null;
    this.flashlightNextRecalcAt = 0;
    this.lorePickups = [];
    this.loreReading = null;
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

  /** 4-bit autotile mask for a wall tile: a bit is set when that cardinal
   *  neighbour is NOT a wall, i.e. this face is exposed to a room and should
   *  get a bevel/trim. Walls deep inside a solid mass (mask 0) render as a
   *  flat, seamless slab instead of an individually outlined block. */
  private wallMask(x: number, y: number): number {
    let mask = 0;
    if (!this.isWallTile(x, y - 1)) mask |= WALL_MASK.NORTH;
    if (!this.isWallTile(x + 1, y)) mask |= WALL_MASK.EAST;
    if (!this.isWallTile(x, y + 1)) mask |= WALL_MASK.SOUTH;
    if (!this.isWallTile(x - 1, y)) mask |= WALL_MASK.WEST;
    return mask;
  }

  /**
   * Pick a baked variant (0..count-1) for a tile, weighted so the clean
   * baseline dominates, moderate wear is common, and the rare "creepy
   * detail" variant (see PreloadScene) stays rare — deterministic per tile
   * coordinate, so it's stable across re-renders without storing state.
   */
  private pickVariant(
    x: number,
    y: number,
    seed: number,
    count: number,
  ): number {
    const n = hash01(x, y, seed);
    if (count === 3) {
      if (n < 0.55) return 0;
      if (n < 0.85) return 1;
      return 2;
    }
    return Math.min(count - 1, Math.floor(n * count));
  }

  private buildTiles(): void {
    this.walls = this.physics.add.staticGroup();
    const { width, height, tiles } = this.level;
    const style = this.theme.style;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;
        const kind = tiles[y * width + x];
        if (kind === TileKind.Wall) {
          const mask = this.wallMask(x, y);
          const variant = this.pickVariant(x, y, 11, WALL_VARIANTS);
          const key = TEXTURES.wall(style, mask, variant);
          (this.walls.create(px, py, key) as Phaser.GameObjects.Image).setTint(
            this.theme.tint,
          );
        } else if (kind === TileKind.Hole) {
          // Bottomless pit — no collider, but lethal to step on (see update()).
          this.add.image(px, py, TEXTURES.hole).setDepth(-9);
        } else {
          const zoneTint = this.floorTintByTile[y * width + x] ?? -1;
          const variant = this.pickVariant(x, y, 23, FLOOR_VARIANTS);
          this.add
            .image(px, py, TEXTURES.floor(style, variant))
            .setTint(zoneTint >= 0 ? zoneTint : this.theme.tint)
            .setDepth(-10);
        }
      }
    }
  }

  /**
   * Scatter ambient set-dressing props and Almond Water pickups across
   * floor tiles — deterministic per tile coordinate (same hash approach as
   * {@link pickVariant}) so the level doesn't need extra RNG plumbing, but
   * different enough per tile that no two rooms feel identically dressed.
   */
  private buildDecorations(): void {
    const { width, height, tiles, spawn, exit } = this.level;
    const props = STYLE_PROPS[this.theme.style];
    let almondCount = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (tiles[y * width + x] !== TileKind.Floor) continue;
        if (x === spawn.x && y === spawn.y) continue;
        if (exit && x === exit.x && y === exit.y) continue;

        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;

        if (
          almondCount < DECORATION.almondMaxPerLevel &&
          hash01(x, y, 41) < DECORATION.almondChance
        ) {
          this.spawnAlmondWater(px, py);
          almondCount++;
          continue;
        }

        if (hash01(x, y, 59) < DECORATION.propChance) {
          const kind = props[hash01(x, y, 67) < 0.5 ? 0 : 1];
          this.add.image(px, py, TEXTURES.prop(kind)).setDepth(-7);
        }
      }
    }
  }

  /** A gently bobbing, glowing bottle of Almond Water — grants a brief vision
   *  boost on pickup (see {@link collectAlmondWater}). */
  private spawnAlmondWater(px: number, py: number): void {
    const bottle = this.add.image(px, py, TEXTURES.almondWater).setDepth(-6);
    this.tweens.add({
      targets: bottle,
      y: py - 3,
      duration: 900 + Math.round(hash01(px, py, 71) * 300),
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
    this.tweens.add({
      targets: bottle,
      alpha: { from: 0.7, to: 1 },
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
    this.almondBottles.push(bottle);
  }

  /** Widens the fog-of-war reveal radius for a few seconds and pops the
   *  bottle — a small, immediate reward for exploring off the beaten path. */
  private collectAlmondWater(index: number, time: number): void {
    const bottle = this.almondBottles[index];
    if (!bottle) return;
    this.almondBottles.splice(index, 1);
    addItem("almondWater", 1);
    this.tweens.add({
      targets: bottle,
      alpha: 0,
      scale: 1.4,
      duration: 220,
      onComplete: () => bottle.destroy(),
    });
    this.audio.chime();
    this.cameras.main.flash(200, 200, 255, 190);

    this.visionBoosted = true;
    this.visionBoostUntil = time + DECORATION.almondVisionBoostMs;
    this.visibility.setRadius(
      VISIBILITY.revealRadiusTiles + DECORATION.almondVisionBoostTiles,
    );
    const tile = this.playerTile();
    this.visibility.update(tile.x, tile.y, (x, y) => this.isWallTile(x, y));
    this.refreshFog();
  }

  /** Every-frame check for a nearby Almond Water bottle, and the boost
   *  reverting once its timer runs out. */
  private updateAlmondWater(time: number): void {
    for (let i = this.almondBottles.length - 1; i >= 0; i--) {
      const bottle = this.almondBottles[i]!;
      const dx = bottle.x - this.player.x;
      const dy = bottle.y - this.player.y;
      if (dx * dx + dy * dy <= DECORATION.almondPickupRadius ** 2) {
        this.collectAlmondWater(i, time);
      }
    }

    if (this.visionBoosted && time >= this.visionBoostUntil) {
      this.visionBoosted = false;
      this.visibility.setRadius(VISIBILITY.revealRadiusTiles);
      const tile = this.playerTile();
      this.visibility.update(tile.x, tile.y, (x, y) => this.isWallTile(x, y));
      this.refreshFog();
    }
  }

  /**
   * Places the single Flashlight pickup at a random walkable floor tile,
   * tucked away from the spawn — but only in the first level, and only if
   * it hasn't already been found in a prior session (see {@link hasFlashlight}).
   */
  private buildFlashlightPickup(): void {
    if (this.levelIndex !== 0 || this.hasFlashlight) return;
    const { width, height, tiles, spawn, exit } = this.level;
    const candidates: Vec2[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (tiles[y * width + x] !== TileKind.Floor) continue;
        if (x === spawn.x && y === spawn.y) continue;
        if (exit && x === exit.x && y === exit.y) continue;
        const dx = x - spawn.x;
        const dy = y - spawn.y;
        if (dx * dx + dy * dy < 16) continue; // tucked away from the spawn
        candidates.push({ x, y });
      }
    }
    if (candidates.length === 0) return;
    const tile = candidates[Phaser.Math.Between(0, candidates.length - 1)]!;
    const c = this.centreOf(tile.x, tile.y);

    const item = this.add.image(c.x, c.y, TEXTURES.flashlight).setDepth(-6);
    this.tweens.add({
      targets: item,
      y: c.y - 3,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
    this.flashlightPickup = item;

    this.flashlightPrompt = this.add
      .text(c.x, c.y - 20, "[F]", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#e4c94a",
      })
      .setOrigin(0.5)
      .setDepth(120)
      .setVisible(false);
  }

  /** Interact/hotbar input, the beam graphic, and the bottom-left hotbar UI. */
  private buildFlashlightSystems(): void {
    const keyboard = this.input.keyboard!;
    this.interactKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.flashlightToggleKey = keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ONE,
    );

    // Depth must stay under the fog tiles (depth 500, see buildFog) — the
    // glow needs to render *underneath* the fog overlay so unrevealed tiles
    // still hide it completely; only where the fog has actually cleared does
    // the warm light show through, exactly matching the real reveal instead
    // of an additive haze bleeding into tiles the player can't actually see.
    this.flashlightGraphics = this.add.graphics().setDepth(495);
    this.flashlightGraphics.setBlendMode(Phaser.BlendModes.ADD);

    this.buildHotbar();
    this.buildStaminaBar();
    if (this.hasFlashlight) {
      this.hotbarBg.setVisible(true);
      this.hotbarIcon.setVisible(true);
      this.hotbarLabel.setVisible(true);
      this.applyFlashlightVisual(this.flashlightOn);
    }
  }

  /** Bottom-left hotbar slot 1 — hidden until the Flashlight is found. */
  private buildHotbar(): void {
    const cam = this.cameras.main;
    const x = 14;
    const y = cam.height - 40;
    this.hotbarBg = this.add
      .rectangle(x, y, 34, 34, 0x0a0a12, 0.78)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x4a4530, 0.9)
      .setVisible(false);
    this.hotbarIcon = this.add
      .image(x + 17, y + 15, TEXTURES.flashlight)
      .setScale(0.85)
      .setAlpha(0.5)
      .setVisible(false);
    this.hotbarLabel = this.add
      .text(x + 3, y + 22, "1", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#c9b458",
      })
      .setVisible(false);
    this.hudContainer.add([this.hotbarBg, this.hotbarIcon, this.hotbarLabel]);
  }

  /** Top-left sprint stamina meter — always visible, since sprint is gated
   *  by it from the first step of every run. */
  private buildStaminaBar(): void {
    const x = 14;
    const y = 26;
    const w = 90;
    const h = 8;
    const bg = this.add
      .rectangle(x, y, w, h, 0x0a0a12, 0.78)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x4a4530, 0.9);
    this.staminaBarFill = this.add
      .rectangle(x + 1, y + 1, w - 2, h - 2, 0xe4c94a, 0.9)
      .setOrigin(0, 0);
    this.hudContainer.add([bg, this.staminaBarFill]);
  }

  /** Syncs the stamina bar's width/colour to the controller each frame —
   *  amber while healthy, red and flashing once sprint locks out empty. */
  private updateStaminaBar(): void {
    if (!this.staminaBarFill?.active) return;
    const frac = this.controller.staminaFraction;
    const maxWidth = 88;
    this.staminaBarFill.width = Math.max(0, maxWidth * frac);
    const exhausted = this.controller.sprintExhausted;
    this.staminaBarFill.fillColor = exhausted
      ? 0xd8402a
      : frac < 0.3
        ? 0xd8842a
        : 0xe4c94a;
  }

  /** Icon brightness / border glow reflecting whether the beam is on. */
  private applyFlashlightVisual(on: boolean): void {
    this.hotbarIcon.setAlpha(on ? 1 : 0.5);
    this.hotbarBg.setStrokeStyle(1, on ? 0xe4c94a : 0x4a4530, on ? 1 : 0.9);
  }

  private setFlashlightOn(on: boolean): void {
    this.flashlightOn = on;
    this.registry.set("flashlightOn", on);
    this.applyFlashlightVisual(on);
    if (!on) {
      this.flashlightGraphics.clear();
      this.visibility.clearCone();
      this.refreshFog();
    }
  }

  /** Picks up the Flashlight — persisted to the inventory store, permanent
   *  across sessions. */
  private collectFlashlight(): void {
    this.hasFlashlight = true;
    addItem("flashlight", 1);
    this.flashlightPickup?.destroy();
    this.flashlightPickup = null;
    this.flashlightPrompt?.destroy();
    this.flashlightPrompt = null;

    this.audio.chime();
    this.cameras.main.flash(180, 255, 235, 180);

    this.hotbarBg.setVisible(true);
    this.hotbarIcon.setVisible(true);
    this.hotbarLabel.setVisible(true);
    this.applyFlashlightVisual(this.flashlightOn);
  }

  /** The general-purpose "F" interact prompt — currently only the Flashlight
   *  pickup uses it, but it's keyed off proximity + JustDown like any future
   *  interactable would be. */
  private updateFlashlightPickup(): void {
    const pickup = this.flashlightPickup;
    if (!pickup) return;
    const dx = pickup.x - this.player.x;
    const dy = pickup.y - this.player.y;
    const inRange = dx * dx + dy * dy <= FLASHLIGHT.pickupRadius ** 2;
    this.flashlightPrompt?.setVisible(inRange);
    if (inRange && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.collectFlashlight();
    }
  }

  /**
   * Scatters a handful of unique found documents (letters/book pages) across
   * random floor tiles, each carrying one entry from this level's authored
   * lore pool (see game/content/lore.ts) — no two documents on the same
   * level repeat text. Candidate-list + explicit pick, same shape as
   * {@link buildFlashlightPickup}, since (unlike the hash-scattered props)
   * each spawn needs its own distinct content rather than a uniform roll.
   */
  private buildLorePickups(): void {
    const { width, height, tiles, spawn, exit } = this.level;
    const candidates: Vec2[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (tiles[y * width + x] !== TileKind.Floor) continue;
        if (x === spawn.x && y === spawn.y) continue;
        if (exit && x === exit.x && y === exit.y) continue;
        const dx = x - spawn.x;
        const dy = y - spawn.y;
        if (dx * dx + dy * dy < LORE_PICKUP.minSpawnDistSqTiles) continue;
        candidates.push({ x, y });
      }
    }
    if (candidates.length === 0) return;

    const pool = getLoreForLevel(this.levelIndex);
    const shuffledEntries = Phaser.Utils.Array.Shuffle(pool.slice());
    const count = Math.min(
      candidates.length,
      shuffledEntries.length,
      Phaser.Math.Between(LORE_PICKUP.minPerLevel, LORE_PICKUP.maxPerLevel),
    );

    const shuffledTiles = Phaser.Utils.Array.Shuffle(candidates);
    for (let i = 0; i < count; i++) {
      const tile = shuffledTiles[i]!;
      const entry = shuffledEntries[i]!;
      const c = this.centreOf(tile.x, tile.y);
      const key =
        entry.kind === "book" ? TEXTURES.loreBook : TEXTURES.loreLetter;
      const image = this.add.image(c.x, c.y, key).setDepth(-6);
      this.tweens.add({
        targets: image,
        y: c.y - 3,
        duration: 950 + Math.round(hash01(tile.x, tile.y, 83) * 300),
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
      const prompt = this.add
        .text(c.x, c.y - 20, "[F] Read", {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#e4c94a",
        })
        .setOrigin(0.5)
        .setDepth(120)
        .setVisible(false);
      this.lorePickups.push({ image, prompt, entry });
    }
  }

  /**
   * Full-screen document reader — a parchment panel over a dimming veil,
   * hidden until a pickup is opened. Built once per level.
   *
   * The camera runs at a fixed zoom (see `create()`), and Phaser's camera
   * transform scales *everything* it renders — including scrollFactor(0)
   * HUD objects — around the camera's centre point; only camera *scroll* is
   * cancelled by scrollFactor(0), not zoom. Left alone, this panel would
   * render at `zoom`x the intended size and spill off-screen. Parenting
   * every reader element to a container pre-scaled by `1/zoom` and
   * positioned so the camera's zoom-about-centre transform maps it back to
   * an identity transform lets every child below use plain, un-scaled
   * screen-pixel coordinates.
   */
  private buildLoreReader(): void {
    const cam = this.cameras.main;
    const zoom = cam.zoom;
    const cx = cam.width / 2;
    const cy = cam.height / 2;

    const ui = this.add.container(cx * (1 - 1 / zoom), cy * (1 - 1 / zoom));
    ui.setScrollFactor(0).setDepth(800).setScale(1 / zoom).setVisible(false);

    this.loreVeil = this.add
      .rectangle(0, 0, cam.width, cam.height, 0x03030a, 0)
      .setOrigin(0, 0);
    ui.add(this.loreVeil);

    // A plain rounded card — border rect behind a slightly-inset cream fill
    // rect — instead of a stretched NineSlice, which tiled the tiny source
    // texture's border across the whole panel and read as ruled notebook
    // lines rather than a clean parchment sheet.
    const panelWidth = Math.min(460, cam.width - 40);
    const panelHeight = Math.min(300, cam.height - 60);
    const panelX = cx - panelWidth / 2;
    const panelY = cy - panelHeight / 2;
    const inset = 7;
    this.lorePanel = this.add.graphics();
    this.lorePanel.fillStyle(COLORS.propWoodDark, 1);
    this.lorePanel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 14);
    this.lorePanel.fillStyle(COLORS.almondLabel, 1);
    this.lorePanel.fillRoundedRect(
      panelX + inset,
      panelY + inset,
      panelWidth - inset * 2,
      panelHeight - inset * 2,
      10,
    );
    ui.add(this.lorePanel);

    // Dark, ink-like text — the panel behind it is a pale parchment fill,
    // not the dark veil the earlier flat-text version assumed.
    this.loreTitleText = this.add
      .text(cx, cy - panelHeight / 2 + 30, "", {
        fontFamily: "monospace",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#4a3d24",
        align: "center",
        wordWrap: { width: panelWidth - 80 },
      })
      .setOrigin(0.5);
    ui.add(this.loreTitleText);

    this.loreBodyText = this.add
      .text(cx, cy + 8, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#5c4a2a",
        align: "center",
        lineSpacing: 6,
        wordWrap: { width: panelWidth - 90 },
      })
      .setOrigin(0.5);
    ui.add(this.loreBodyText);

    this.lorePromptText = this.add
      .text(cx, cy + panelHeight / 2 - 20, "[F] Close", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#8a7248",
      })
      .setOrigin(0.5);
    ui.add(this.lorePromptText);

    this.loreUi = ui;
  }

  /** Opens the full-screen reader for a found document and removes it from
   *  the world — read once, gone, same as the Flashlight pickup. */
  private openLore(index: number): void {
    const found = this.lorePickups[index];
    if (!found) return;
    this.lorePickups.splice(index, 1);
    found.image.destroy();
    found.prompt.destroy();

    this.loreReading = found.entry;
    this.audio.chime();
    this.loreTitleText.setText(found.entry.title);
    this.loreBodyText.setText(found.entry.body);
    this.loreVeil.setAlpha(0.7);
    this.loreUi.setVisible(true);
  }

  private closeLore(): void {
    this.loreReading = null;
    this.loreUi.setVisible(false);
  }

  /** Every-frame check for a nearby document, and the [F] key that either
   *  opens the nearest in-range pickup or closes an open reader — mirrors
   *  {@link updateFlashlightPickup}'s proximity + JustDown shape. */
  private updateLorePickups(): void {
    if (this.loreReading) {
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) this.closeLore();
      return;
    }

    let nearestIndex = -1;
    let nearestDistSq = Infinity;
    for (let i = 0; i < this.lorePickups.length; i++) {
      const found = this.lorePickups[i]!;
      const dx = found.image.x - this.player.x;
      const dy = found.image.y - this.player.y;
      const distSq = dx * dx + dy * dy;
      found.prompt.setVisible(distSq <= LORE_PICKUP.pickupRadius ** 2);
      if (distSq <= LORE_PICKUP.pickupRadius ** 2 && distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearestIndex = i;
      }
    }
    if (
      nearestIndex >= 0 &&
      Phaser.Input.Keyboard.JustDown(this.interactKey)
    ) {
      this.openLore(nearestIndex);
    }
  }

  private updateFlashlightToggle(): void {
    if (!this.hasFlashlight) return;
    if (Phaser.Input.Keyboard.JustDown(this.flashlightToggleKey)) {
      this.setFlashlightOn(!this.flashlightOn);
    }
  }

  /** Aims the beam at the cursor. The cosmetic glow redraws every frame so
   *  it tracks the cursor smoothly; the fog-of-war reveal (VisibilitySystem
   *  .updateCone) is throttled — see FLASHLIGHT.recalcMs — since it's a
   *  full grid pass and doesn't need to keep up with mouse-move framerate. */
  private updateFlashlightBeam(time: number): void {
    if (!this.flashlightOn) return;

    const pointer = this.input.activePointer;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const angle = Math.atan2(world.y - this.player.y, world.x - this.player.x);

    const radius = FLASHLIGHT.coneRadiusTiles * TILE_SIZE;
    const g = this.flashlightGraphics;
    g.clear();
    g.fillStyle(0xfff0c0, 0.26);
    g.beginPath();
    g.moveTo(this.player.x, this.player.y);
    g.arc(
      this.player.x,
      this.player.y,
      radius,
      angle - FLASHLIGHT.coneHalfAngleRad,
      angle + FLASHLIGHT.coneHalfAngleRad,
      false,
    );
    g.closePath();
    g.fillPath();

    if (time < this.flashlightNextRecalcAt) return;
    this.flashlightNextRecalcAt = time + FLASHLIGHT.recalcMs;

    const tile = this.playerTile();
    this.visibility.updateCone(
      tile.x,
      tile.y,
      angle,
      FLASHLIGHT.coneHalfAngleRad,
      FLASHLIGHT.coneRadiusTiles,
      (x, y) => this.isWallTile(x, y),
    );
    this.refreshFog();
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

  /** Component-wise lerp between two hex colours — used to fold a level's
   *  mood colour subtly into a monster's role tint, so the same silhouette
   *  reads as faintly "of the place" it lurks in on every level. */
  private blendTint(base: number, mood: number, amount: number): number {
    const br = (base >> 16) & 0xff;
    const bg = (base >> 8) & 0xff;
    const bb = base & 0xff;
    const mr = (mood >> 16) & 0xff;
    const mg = (mood >> 8) & 0xff;
    const mb = mood & 0xff;
    const r = Math.round(br + (mr - br) * amount);
    const g = Math.round(bg + (mg - bg) * amount);
    const b = Math.round(bb + (mb - bb) * amount);
    return (r << 16) | (g << 8) | b;
  }

  /** Blend a role's base tint toward this level's mood colour. */
  private roleTint(base: number): number {
    return this.blendTint(
      base,
      STYLE_COLORS[this.theme.style].monsterMood,
      0.3,
    );
  }

  private spawnMonsters(): void {
    this.monsters = this.level.monsters.map((spawn) => {
      const origin = this.centreOf(spawn.x, spawn.y);
      const waypoints = spawn.patrol.map((p) => this.centreOf(p.x, p.y));
      // `spawn.kind` comes straight from the generator's roster roll (see
      // levels/roster.ts) — every kind's tuning/tint/scale is looked up
      // generically from the single source of truth instead of a
      // Hound-only special case.
      const kindConfig = MONSTER_KIND_CONFIG[spawn.kind];
      const monster = new Monster(
        this,
        origin.x,
        origin.y,
        waypoints,
        kindConfig.tuning,
        this.roleTint(kindConfig.tint),
        this.monsterOptsFor(spawn.kind, kindConfig),
      );
      monster.setDepth(90);
      this.monsterKinds.set(monster, spawn.kind);
      this.physics.add.collider(monster, this.walls);
      return monster;
    });
  }

  /** Builds the `Monster` constructor's visual-tweak bag from a kind's
   *  config, shared by every spawn path (ambient roster spawns, jump-scares)
   *  so they can't drift apart. `noWalkCycleOverride` lets a caller force the
   *  glide behaviour regardless of the kind's own default (jump-scares always
   *  glide in — they shouldn't look like they walked into place). */
  private monsterOptsFor(
    kind: MonsterKind,
    kindConfig: MonsterKindConfig,
    noWalkCycleOverride?: boolean,
  ): {
    noWalkCycle?: boolean;
    scaleX?: number;
    scaleY?: number;
    kind: MonsterKind;
  } {
    const noWalkCycle = noWalkCycleOverride ?? kindConfig.noWalkCycle;
    return {
      kind,
      // exactOptionalPropertyTypes forbids assigning `undefined` to an
      // optional key directly — the key must be omitted, not set to
      // undefined — hence the conditional spreads rather than a plain object.
      ...(noWalkCycle !== undefined && { noWalkCycle }),
      ...(kindConfig.scale && {
        scaleX: kindConfig.scale.x,
        scaleY: kindConfig.scale.y,
      }),
    };
  }

  /** A walkable, in-bounds tile at a random angle within `[minRadiusTiles,
   *  maxRadiusTiles]` of `origin` — used to place/relocate the Stalker and
   *  jump-scare encounters off-stage from the player. */
  private randomFloorTileAround(
    origin: Vec2,
    minRadiusTiles: number,
    maxRadiusTiles: number,
    attempts = 20,
  ): Vec2 | null {
    for (let i = 0; i < attempts; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.FloatBetween(minRadiusTiles, maxRadiusTiles);
      const tx = Math.round(origin.x + Math.cos(angle) * dist);
      const ty = Math.round(origin.y + Math.sin(angle) * dist);
      if (
        tx < 0 ||
        ty < 0 ||
        tx >= this.level.width ||
        ty >= this.level.height
      ) {
        continue;
      }
      if (this.isWallTile(tx, ty) || this.isHoleTile(tx, ty)) continue;
      return { x: tx, y: ty };
    }
    return null;
  }

  /** Spawns the Stalker — a single persistent "don't look away" horror
   *  (see StalkerAI) — well off-stage from the player's start. */
  private spawnStalker(): void {
    const origin = this.playerTile();
    const tile =
      this.randomFloorTileAround(
        origin,
        STALKER.respawnMinRadiusTiles,
        STALKER.respawnMaxRadiusTiles,
      ) ?? this.level.spawn;
    const c = this.centreOf(tile.x, tile.y);
    const monster = new Monster(
      this,
      c.x,
      c.y,
      [],
      DEFAULT_MONSTER_TUNING,
      this.roleTint(MONSTER_TINT.stalker),
      { noWalkCycle: true },
    );
    monster.setDepth(91);
    this.physics.add.collider(monster, this.walls);
    this.stalkerMonster = monster;
  }

  /** Teleports the Stalker somewhere fresh and out of sight — used after a
   *  lunge retreats it off-stage. */
  private relocateStalker(): void {
    const monster = this.stalkerMonster;
    if (!monster) return;
    const tile = this.randomFloorTileAround(
      this.playerTile(),
      STALKER.respawnMinRadiusTiles,
      STALKER.respawnMaxRadiusTiles,
    );
    if (!tile) return;
    const c = this.centreOf(tile.x, tile.y);
    monster.setPosition(c.x, c.y);
  }

  /**
   * Adds the vignette/barrel camera filters that sell dynamic fear (see
   * {@link updateFear} / {@link pulseBarrel}). Filters are WebGL-only in
   * Phaser 4 — this no-ops gracefully under the Canvas fallback.
   */
  private setupFilters(): void {
    if (this.game.renderer.type !== Phaser.WEBGL) return;
    try {
      const cam = this.cameras.main;
      this.vignetteFilter = addSoftVignette(
        cam,
        0.5,
        0.5,
        FEAR.vignetteMaxRadius,
        FEAR.vignetteFeather,
        FEAR.vignetteMinStrength,
        0x000000,
      );
      this.barrelFilter = cam.filters.internal.addBarrel(1);
    } catch {
      this.vignetteFilter = null;
      this.barrelFilter = null;
    }
  }

  private buildExit(): void {
    const exit = this.level.exit;
    if (!exit) return;
    const c = this.centreOf(exit.x, exit.y);
    const door = this.add
      .image(c.x, c.y, TEXTURES.exit(this.theme.style))
      .setDepth(-5);
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
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= this.level.width ||
        ny >= this.level.height
      ) {
        continue;
      }
      const nc = this.centreOf(nx, ny);
      if (this.isWallTile(nx, ny)) {
        this.add
          .image(nc.x, nc.y, TEXTURES.wallCrack(this.theme.style))
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
    if (this.ambientDarkenOverlay?.active) {
      this.ambientDarkenOverlay.setSize(cam.width, cam.height);
    }
    if (this.scanlineOverlay?.active) {
      this.scanlineOverlay.setSize(cam.width, cam.height);
    }
    if (this.grainOverlay?.active) {
      this.grainOverlay.setSize(cam.width, cam.height);
    }
    if (this.hotbarBg?.active) {
      const x = 14;
      const y = cam.height - 40;
      this.hotbarBg.setPosition(x, y);
      this.hotbarIcon.setPosition(x + 17, y + 15);
      this.hotbarLabel.setPosition(x + 3, y + 22);
    }
    this.updateHudTransform();
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

  /** Container for every fixed-position HUD element — see the field comment
   *  on {@link hudContainer} for why this needs its own zoom compensation
   *  instead of plain `setScrollFactor(0)`. */
  private buildHudContainer(): void {
    this.hudContainer = this.add
      .container(0, 0)
      .setScrollFactor(0)
      .setDepth(1000);
    this.updateHudTransform();
  }

  /** Keeps {@link hudContainer}'s transform at the inverse of the camera's
   *  current zoom so its children can use plain, unscaled screen-pixel
   *  coordinates — called on resize and every frame the zoom changes (the
   *  fear-driven creep in {@link updateFear} means that's continuous, not
   *  just once at level load). */
  private updateHudTransform(): void {
    if (!this.hudContainer?.active) return;
    const cam = this.cameras.main;
    const zoom = cam.zoom;
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    this.hudContainer.setPosition(cx * (1 - 1 / zoom), cy * (1 - 1 / zoom));
    this.hudContainer.setScale(1 / zoom);
  }

  /** Permanent oldschool CRT dressing — screen-space scanlines + a jittered
   *  grain layer, above the game world and monsters but under the fear
   *  overlays / blackout veil / HUD so it never fights their readability. */
  private buildOldschoolOverlay(): void {
    const cam = this.cameras.main;
    this.ambientDarkenOverlay = this.add
      .rectangle(0, 0, cam.width, cam.height, 0x000000, AMBIENT_DARKEN.alpha)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(840);
    this.scanlineOverlay = this.add
      .tileSprite(0, 0, cam.width, cam.height, TEXTURES.scanlines)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setAlpha(OLDSCHOOL_FX.scanlineAlpha)
      .setDepth(850);
    this.grainOverlay = this.add
      .tileSprite(0, 0, cam.width, cam.height, TEXTURES.grain)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setAlpha(OLDSCHOOL_FX.grainAlpha)
      .setBlendMode(Phaser.BlendModes.SCREEN)
      .setDepth(851);
  }

  /** Resamples the grain noise offset on an interval — a cheap way to make
   *  the film-grain crawl without redrawing anything every frame. */
  private updateOldschoolGrain(time: number): void {
    if (!this.grainOverlay || time < this.nextGrainJitterAt) return;
    this.nextGrainJitterAt = time + OLDSCHOOL_FX.grainJitterMs;
    this.grainOverlay.tilePositionX = Math.random() * 64;
    this.grainOverlay.tilePositionY = Math.random() * 64;
  }

  /** Retro "static" glitch — a few rapid overlay strobes plus a tiny camera
   *  jolt, selling a signal-loss stutter distinct from {@link triggerBlackout}'s
   *  full dropout or the flicker's slow gutter. */
  private triggerGlitch(): void {
    this.cameras.main.shake(OLDSCHOOL_FX.glitchMs, 0.004);
    this.tweens.add({
      targets: this.anomalyOverlay,
      alpha: { from: 0, to: 0.4 },
      duration: 35,
      yoyo: true,
      repeat: 6,
    });
  }

  private playerTile(): Vec2 {
    return {
      x: Math.floor(this.player.x / TILE_SIZE),
      y: Math.floor(this.player.y / TILE_SIZE),
    };
  }

  /** Recomputes (throttled) and follows a maze route to the player, instead
   *  of beelining straight at them and getting stuck against walls whenever
   *  the corridor bends. */
  private driveMonsterAlongPath(
    monster: Monster,
    playerPos: Vec2,
    time: number,
  ): void {
    const recalcAt = this.pursuitPathRecalcAt.get(monster) ?? 0;
    if (time >= recalcAt) {
      this.pursuitPathRecalcAt.set(monster, time + PATHFIND.recalcMs);
      const from = {
        x: Math.floor(monster.x / TILE_SIZE),
        y: Math.floor(monster.y / TILE_SIZE),
      };
      const to = this.playerTile();
      const tilePath = findPath(
        from,
        to,
        this.level.width,
        this.level.height,
        (x, y) => this.isWallTile(x, y),
      );
      monster.setChasePath(
        tilePath?.map((t) => ({
          x: t.x * TILE_SIZE + TILE_SIZE / 2,
          y: t.y * TILE_SIZE + TILE_SIZE / 2,
        })) ?? [],
      );
    }
    const kind = this.monsterKinds.get(monster) ?? "lurker";
    const speed =
      this.pursuitSpeed * (MONSTER_KIND_CONFIG[kind].chaseSpeedMultiplier ?? 1);
    monster.followChasePath(speed, playerPos);
  }

  /** True for kinds that can never harm/kill the player, whatever the
   *  difficulty or phase (Faceling, Deathmoth — see
   *  `MONSTER_KIND_CONFIG[kind].harmless`). Every place a roster monster can
   *  actually catch/attack the player must check this first. */
  private isHarmlessKind(kind: MonsterKind): boolean {
    return MONSTER_KIND_CONFIG[kind].harmless ?? false;
  }

  private isHarmlessMonster(monster: Monster): boolean {
    return this.isHarmlessKind(this.monsterKinds.get(monster) ?? "lurker");
  }

  private inRect(
    px: number,
    py: number,
    r: LevelData["pursuitTrigger"],
  ): boolean {
    if (!r) return false;
    return px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height;
  }

  /** Advance the dread director and drive the monsters for the current phase. */
  private updateAi(time: number, deltaMs: number): void {
    if (this.ended) {
      for (const m of this.monsters) m.freeze();
      this.jumpscareMonster?.freeze();
      this.stalkerMonster?.freeze();
      return;
    }

    const tile = this.playerTile();
    const playerPos: Vec2 = { x: this.player.x, y: this.player.y };
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

    switch (this.phase) {
      case GamePhase.Ambient: {
        // Monster activity ramps up the closer the player gets to the exit.
        const proximity = this.exitProximity(tile.x, tile.y);
        const speedBoost = 1 + proximity * EXIT_DREAD.maxSpeedBoost;
        for (const m of this.monsters) m.tickAmbient(speedBoost);
        this.updateMonsterFogVisibility(playerPos);
        this.presenceCue(time, playerPos, proximity);
        this.updateJumpscare(time, playerPos, proximity);
        this.updateStalker(deltaMs, playerPos);
        this.updateSkinStealers(deltaMs, playerPos);
        this.updateDeathmoths(time, playerPos);
        this.updateBlackout(time);
        break;
      }
      case GamePhase.Pursuit: {
        this.despawnJumpscare();
        this.hideStalker();
        let nearest = Infinity;
        let closest: Monster | null = null;
        for (const m of this.monsters) {
          if (this.pursuitDisengaged.has(m)) {
            m.freeze();
            continue;
          }
          const stunnedUntil = this.pursuitStunnedUntil.get(m) ?? 0;
          if (time < stunnedUntil) {
            m.freeze();
          } else {
            this.driveMonsterAlongPath(m, playerPos, time);
          }
          // Harmless kinds (Faceling, Deathmoth) still close in during
          // Pursuit — still a scare, still ambiguous — but must never be
          // eligible to actually catch/kill the player, per wiki canon.
          if (this.isHarmlessMonster(m)) continue;
          const d = m.distanceTo(playerPos);
          if (d < nearest) {
            nearest = d;
            closest = m;
          }
        }
        if (nearest <= DREAD.killRadius) {
          // On middle/hard the chase is lethal — it can catch and kill you.
          if (this.lethal) this.onDeath();
          // Easy never kills, but the monster still needs to visibly react
          // and back off — otherwise it just glues to the player forever
          // (worst case, pinning them in a dead end with nothing to do).
          else if (closest) this.onPursuitCatch(closest, playerPos);
        }
        break;
      }
      case GamePhase.Escaped:
        for (const m of this.monsters) m.freeze();
        this.jumpscareMonster?.freeze();
        this.hideStalker();
        break;
    }

    this.updateFear(this.computeFear(playerPos), time);
  }

  private onPhaseChange(phase: GamePhase): void {
    if (phase === GamePhase.Pursuit) {
      // The end is near — the monster wakes with a roar and a jolt. The
      // ambient stealth dimming/hiding is over — every pursuer is in the
      // open now, no more fog-of-war glimpses.
      for (const m of this.monsters) {
        m.setVisible(true);
        m.setAlpha(1);
      }
      this.audio.roar();
      this.cameras.main.flash(320, 90, 0, 0);
      this.cameras.main.shake(400, 0.006);
    } else if (phase === GamePhase.Escaped) {
      this.onEscape();
    }
  }

  /**
   * 0..1 dread level derived from the nearest threat this frame — drives the
   * heartbeat cue and the screen vignette so tension reads physically. Takes
   * the single scariest signal in play rather than summing them.
   */
  private computeFear(playerPos: Vec2): number {
    let fear = 0;
    if (this.phase === GamePhase.Pursuit) fear = Math.max(fear, 0.85);
    for (const m of this.monsters) {
      // Harmless kinds (Faceling, Deathmoth) still register as a threat
      // glimpse — the intended scare is "was that the safe one?" ambiguity —
      // but weighted down since they canonically can't actually hurt the
      // player, so they never alone drive fear as hard as a real threat.
      const weight = this.isHarmlessMonster(m) ? 0.65 : 1;
      const closeness =
        (1 - m.distanceTo(playerPos) / DREAD.presenceRadius) * weight;
      fear = Math.max(fear, closeness);
    }
    if (this.jumpscareMonster) {
      fear = Math.max(fear, this.jumpscareIsPeek ? 0.55 : 0.85);
    }
    if (this.stalkerMonster) {
      const state = this.stalkerAI.current;
      if (state === StalkerState.Frozen) {
        fear = Math.max(fear, 0.8);
      } else if (state === StalkerState.Creeping) {
        const d = this.stalkerMonster.distanceTo(playerPos);
        fear = Math.max(
          fear,
          1 - Phaser.Math.Clamp(d / STALKER.triggerRadius, 0, 1),
        );
      } else if (state === StalkerState.Lunging) {
        fear = 1;
      }
    }
    return Phaser.Math.Clamp(fear, 0, 1);
  }

  /** Applies the current fear level to the heartbeat cue and camera vignette. */
  private updateFear(fear: number, time: number): void {
    this.audio.updateHeartbeat(fear, time);

    // Claustrophobic creep: the camera slowly tightens in as danger nears,
    // easing back out once it passes — smoothed so a monster popping in/out
    // of range doesn't snap the zoom, just nudges it.
    const targetZoom = this.baseZoom + fear * 0.13;
    this.camZoom = Phaser.Math.Linear(this.camZoom, targetZoom, 0.06);
    this.cameras.main.setZoom(this.camZoom);
    this.updateHudTransform();

    const v = this.vignetteFilter;
    if (v) {
      // The vignette's x/y are normalized to the camera's *own* viewport, not
      // the world — a bounded camera can't always keep the player dead
      // center (it clamps at maze edges), so a fixed 0.5/0.5 drifts off the
      // player and crops the wrong side of the screen. Recenter every frame
      // on the player's actual on-screen position instead.
      const view = this.cameras.main.worldView;
      const p = this.player;
      v.x = Phaser.Math.Clamp((p.x - view.x) / view.width, 0, 1);
      v.y = Phaser.Math.Clamp((p.y - view.y) / view.height, 0, 1);

      // The vignette is a camera-wide post filter — it darkens the flashlight
      // beam right along with everything else, so at high fear (a monster
      // close by) it was crushing the beam dark exactly when you'd want it
      // most. Damp the fear-driven darkening while the flashlight is on.
      const vignetteFear = this.flashlightOn ? fear * 0.12 : fear;
      v.strength =
        FEAR.vignetteMinStrength +
        vignetteFear * (FEAR.vignetteMaxStrength - FEAR.vignetteMinStrength);
      v.radius =
        FEAR.vignetteMaxRadius -
        vignetteFear * (FEAR.vignetteMaxRadius - FEAR.vignetteMinRadius);
    }
  }

  /** A brief distortion punch on the barrel filter — sells a lunge/attack as
   *  a physical jolt, not just a sound and a flash. No-ops without WebGL. */
  private pulseBarrel(peak: number, durationMs: number): void {
    const filter = this.barrelFilter;
    if (!filter) return;
    this.tweens.add({
      targets: filter,
      amount: 1 + peak,
      duration: durationMs * 0.3,
      yoyo: true,
      hold: durationMs * 0.15,
      ease: "Sine.InOut",
      onComplete: () => {
        filter.amount = 1;
      },
    });
  }

  /**
   * The Stalker (see StalkerAI): freezes solid whenever the player has line
   * of sight on it, creeps closer the instant they look away, and lunges if
   * it closes to grab range while unseen. Only active during Ambient.
   */
  private updateStalker(deltaMs: number, playerPos: Vec2): void {
    const monster = this.stalkerMonster;
    if (!monster) return;

    const playerTile = this.playerTile();
    const stalkerTile = {
      x: Math.floor(monster.x / TILE_SIZE),
      y: Math.floor(monster.y / TILE_SIZE),
    };
    const tileDist = Phaser.Math.Distance.Between(
      playerTile.x,
      playerTile.y,
      stalkerTile.x,
      stalkerTile.y,
    );
    const withinVisRange =
      tileDist <= VISIBILITY.revealRadiusTiles + STALKER.visRadiusBonusTiles;
    const seen =
      withinVisRange &&
      this.visibility.hasLineOfSight(
        playerTile.x,
        playerTile.y,
        stalkerTile.x,
        stalkerTile.y,
        (x, y) => this.isWallTile(x, y),
      );

    const prevState = this.stalkerAI.current;
    const state = this.stalkerAI.update(deltaMs / 1000, {
      seen,
      distanceToPlayer: monster.distanceTo(playerPos),
    });

    switch (state) {
      case StalkerState.Lurking:
        monster.setVisible(true);
        monster.resumeIdle();
        monster.freeze();
        break;
      case StalkerState.Creeping:
        monster.setVisible(true);
        monster.resumeIdle();
        monster.pursue(playerPos, STALKER.creepSpeed);
        break;
      case StalkerState.Frozen:
        monster.setVisible(true);
        monster.freezeStill();
        break;
      case StalkerState.Lunging:
        monster.setVisible(true);
        if (prevState !== StalkerState.Lunging)
          this.onStalkerLunge(monster, playerPos);
        monster.freeze();
        break;
      case StalkerState.Retreating:
        if (prevState !== StalkerState.Retreating)
          this.onStalkerRetreat(monster);
        monster.freeze();
        break;
    }
  }

  /** The scare beat: it snaps into the player's face, screams, and either
   *  kills (lethal difficulties) or just leaves the player rattled. */
  private onStalkerLunge(monster: Monster, playerPos: Vec2): void {
    const angle = Math.random() * Math.PI * 2;
    monster.setPosition(
      playerPos.x + Math.cos(angle) * STALKER.lungeOffset,
      playerPos.y + Math.sin(angle) * STALKER.lungeOffset,
    );
    monster.resumeIdle();

    const pan = Phaser.Math.Clamp((monster.x - this.player.x) / 200, -1, 1);
    this.audio.scream(0.85, pan);
    this.cameras.main.flash(260, 160, 0, 0);
    this.cameras.main.shake(420, 0.018);
    this.pulseBarrel(0.9, 320);
    this.tweens.add({
      targets: this.cameras.main,
      rotation: { from: (Math.random() < 0.5 ? -1 : 1) * 0.035, to: 0 },
      duration: 380,
      ease: "Sine.Out",
    });

    if (this.lethal) this.onDeath();
  }

  /** Non-lethal difficulties never kill on catch — but without a reaction
   *  the pursuer would just sit glued on the player forever (a dead-end
   *  corridor makes that a permanent stuck state). Scare beat, then shove
   *  the monster back out past kill range so the chase re-opens. After
   *  PURSUIT_CATCH.maxCatches it gives up for good instead of looping
   *  forever — the chase should read as scary, not as an endless ordeal. */
  private onPursuitCatch(monster: Monster, playerPos: Vec2): void {
    const now = this.time.now;
    if (now < this.pursuitCatchCooldownUntil) return;
    this.pursuitCatchCooldownUntil = now + PURSUIT_CATCH.cooldownMs;
    this.pursuitCatchCount += 1;
    const givingUp = this.pursuitCatchCount >= PURSUIT_CATCH.maxCatches;

    this.audio.roar();
    this.cameras.main.flash(300, 120, 0, 0);
    this.cameras.main.shake(350, 0.01);
    this.pulseBarrel(0.7, 260);

    const dx = monster.x - playerPos.x;
    const dy = monster.y - playerPos.y;
    const dist = Math.hypot(dx, dy) || 1;
    monster.setPosition(
      playerPos.x + (dx / dist) * PURSUIT_CATCH.knockbackDistance,
      playerPos.y + (dy / dist) * PURSUIT_CATCH.knockbackDistance,
    );

    if (givingUp) {
      this.pursuitDisengaged.add(monster);
      monster.freeze();
    } else {
      // Hold still after the shove — otherwise it just beelines back in and
      // re-triggers this same beat on a loop the instant the cooldown clears.
      this.pursuitStunnedUntil.set(monster, now + PURSUIT_CATCH.stunMs);
    }
  }

  /** Fades the Stalker out, relocates it off-stage, and fades it back in —
   *  it should never look like it walked away. */
  private onStalkerRetreat(monster: Monster): void {
    this.tweens.add({
      targets: monster,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.relocateStalker();
        this.tweens.add({ targets: monster, alpha: 1, duration: 300 });
      },
    });
  }

  /** Hides and stops the Stalker outside the Ambient phase (the Pursuit
   *  finale is the one threat that should own the screen). */
  private hideStalker(): void {
    const monster = this.stalkerMonster;
    if (!monster) return;
    monster.freeze();
    monster.setVisible(false);
  }

  /**
   * The Skin-Stealer's "avoid eye contact" mechanic (see SkinStealerAI) —
   * opposite trigger direction from the Stalker: sustained direct gaze
   * provokes it instead of looking away. Every live roster Skin-Stealer gets
   * its own brain (a level can have more than one). Outside the trigger it's
   * just an ambient patrol monster — {@link Monster.tickAmbient}, already
   * called this frame for every monster, is left alone.
   */
  private updateSkinStealers(deltaMs: number, playerPos: Vec2): void {
    const playerTile = this.playerTile();
    for (const m of this.monsters) {
      const kind = this.monsterKinds.get(m);
      if (!kind || !MONSTER_KIND_CONFIG[kind].avoidGaze) continue;
      let ai = this.skinStealerAI.get(m);
      if (!ai) {
        ai = new SkinStealerAI();
        this.skinStealerAI.set(m, ai);
      }

      const monsterTile = {
        x: Math.floor(m.x / TILE_SIZE),
        y: Math.floor(m.y / TILE_SIZE),
      };
      const tileDist = Phaser.Math.Distance.Between(
        playerTile.x,
        playerTile.y,
        monsterTile.x,
        monsterTile.y,
      );
      // Same "seen" definition the Stalker uses (LOS + within the fog reveal
      // radius, plus its small bonus band) so both gaze mechanics agree on
      // what "the player can see it" means.
      const gazed =
        tileDist <= VISIBILITY.revealRadiusTiles + STALKER.visRadiusBonusTiles &&
        this.visibility.hasLineOfSight(
          playerTile.x,
          playerTile.y,
          monsterTile.x,
          monsterTile.y,
          (x, y) => this.isWallTile(x, y),
        );

      const prevState = ai.current;
      const state = ai.update(deltaMs / 1000, { gazed });

      switch (state) {
        case SkinStealerState.Lunging:
          if (prevState !== SkinStealerState.Lunging) {
            this.onSkinStealerNotice(m, playerPos);
          }
          // Held in place for the lunge's duration — it already snapped into
          // the player's face on the transition above.
          m.freeze();
          break;
        case SkinStealerState.Retreating:
          m.freeze();
          break;
        // Docile: leave tickAmbient's patrol drive (already applied this
        // frame) exactly as-is.
      }
    }
  }

  /** The Skin-Stealer's scare beat: closes distance fast right into the
   *  player's face, its own hiss cue and camera pulse — deliberately
   *  distinct from the Stalker's scream/flash so it reads as a different
   *  threat, not a recolor of the same grab. */
  private onSkinStealerNotice(monster: Monster, playerPos: Vec2): void {
    const angle = Math.random() * Math.PI * 2;
    monster.setPosition(
      playerPos.x + Math.cos(angle) * SKINSTEALER.lungeOffset,
      playerPos.y + Math.sin(angle) * SKINSTEALER.lungeOffset,
    );

    const pan = Phaser.Math.Clamp((monster.x - this.player.x) / 200, -1, 1);
    this.audio.hiss(0.75, pan);
    this.cameras.main.flash(220, 90, 130, 40);
    this.cameras.main.shake(320, 0.013);
    this.pulseBarrel(0.65, 260);

    // Below lethal difficulties this only ever scares, matching how every
    // other non-pursuer threat (Stalker, jump-scares) is gated.
    if (this.lethal) this.onDeath();
  }

  /**
   * Deathmoth (Level 2, wiki entity-4) contact "swarm graze": a brief,
   * startling-but-harmless beat on a per-moth cooldown so brushing past one
   * can't spam it every frame. Always harmless — see
   * {@link MONSTER_KIND_CONFIG}'s `deathmoth.harmless` flag, audited across
   * every kill/attack path in {@link updateAi}/{@link updateJumpscare}.
   */
  private updateDeathmoths(time: number, playerPos: Vec2): void {
    for (const m of this.monsters) {
      if (this.monsterKinds.get(m) !== "deathmoth") continue;
      if (m.distanceTo(playerPos) > DEATHMOTH.grazeRadius) continue;
      const cooldownUntil = this.deathmothGrazeCooldownUntil.get(m) ?? 0;
      if (time < cooldownUntil) continue;
      this.deathmothGrazeCooldownUntil.set(
        m,
        time + DEATHMOTH.grazeCooldownMs,
      );
      this.onDeathmothGraze(m);
    }
  }

  /** The swarm graze beat itself: its own wing-buzz cue plus the lightest
   *  existing screen-flutter tools (a quick flash/shake), reused rather than
   *  new FX — never lethal, never anything more than a startle. */
  private onDeathmothGraze(monster: Monster): void {
    const pan = Phaser.Math.Clamp((monster.x - this.player.x) / 200, -1, 1);
    this.audio.wingBuzz(0.5, pan);
    this.cameras.main.flash(140, 200, 200, 160);
    this.cameras.main.shake(90, 0.003);
  }

  /** Random ambient power-flicker beat — the lights gutter and the room goes
   *  briefly dark, no monster required. Pure atmosphere. */
  private updateBlackout(time: number): void {
    if (this.nextBlackoutAt < 0) {
      this.nextBlackoutAt =
        time +
        Phaser.Math.Between(
          BLACKOUT_EVENT.minIntervalMs,
          BLACKOUT_EVENT.maxIntervalMs,
        );
      return;
    }
    if (time < this.nextBlackoutAt) return;
    this.nextBlackoutAt =
      time +
      Phaser.Math.Between(
        BLACKOUT_EVENT.minIntervalMs,
        BLACKOUT_EVENT.maxIntervalMs,
      );
    this.triggerBlackout();
  }

  private triggerBlackout(): void {
    this.audio.staticBurst(0.32);
    if (Math.random() < BLACKOUT_EVENT.breathChance) {
      this.audio.breath(0.24, Math.random() * 0.6 - 0.3);
    }
    const cam = this.cameras.main;
    const veil = this.add
      .rectangle(0, 0, cam.width, cam.height, 0x000000, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1500);
    this.tweens.add({
      targets: veil,
      alpha: { from: 0, to: 0.94 },
      duration: BLACKOUT_EVENT.durationMs * 0.4,
      yoyo: true,
      hold: BLACKOUT_EVENT.durationMs * 0.2,
      onComplete: () => veil.destroy(),
    });
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

  /** Drops the heartbeat and eases the vignette back to its calm baseline —
   *  called the instant a run ends so the outcome banner is never fighting
   *  a screen still darkened from the moment before it. */
  private relaxFear(): void {
    this.audio.updateHeartbeat(0, 0);
    const v = this.vignetteFilter;
    if (!v) return;
    this.tweens.add({
      targets: v,
      strength: FEAR.vignetteMinStrength,
      radius: FEAR.vignetteMaxRadius,
      duration: 500,
      ease: "Sine.Out",
    });
  }

  /** Milliseconds elapsed in the current run, for stats accumulation. */
  private elapsedRunMs(): number {
    return Math.max(0, this.time.now - this.runStartedAt);
  }

  private onEscape(): void {
    if (this.ended) return;
    this.ended = true;
    this.relaxFear();
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
      this.audio.skinUnlockChime();
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
    this.relaxFear();
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
    this.relaxFear();
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
  private presenceCue(
    time: number,
    playerPos: Vec2,
    exitProximity: number,
  ): void {
    const cooldown =
      DREAD.cueCooldownMs *
      (1 - exitProximity * (1 - EXIT_DREAD.minIntervalScale));
    if (time - this.lastCueAt < cooldown) return;
    let nearest = Infinity;
    let nearestMonster: Monster | null = null;
    for (const m of this.monsters) {
      const d = m.distanceTo(playerPos);
      if (d < nearest) {
        nearest = d;
        nearestMonster = m;
      }
    }
    if (nearest > DREAD.presenceRadius) return;

    this.lastCueAt = time;
    // Louder the closer it is.
    const closeness = 1 - nearest / DREAD.presenceRadius;
    const nearestKind = nearestMonster
      ? this.monsterKinds.get(nearestMonster) ?? "lurker"
      : "lurker";
    if (MONSTER_KIND_CONFIG[nearestKind].presenceCue === "bark") {
      this.audio.bark(0.3 + closeness * 0.45);
    } else {
      this.audio.growl(0.25 + closeness * 0.4);
    }
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
        time +
        Phaser.Math.Between(JUMPSCARE.minIntervalMs, JUMPSCARE.maxIntervalMs);
      return;
    }

    if (this.jumpscareMonster) {
      const dist = this.jumpscareMonster.distanceTo(playerPos);
      if (
        !this.jumpscareAttacked &&
        !this.jumpscareIsPeek &&
        !this.isHarmlessKind(this.jumpscareKind) &&
        this.difficulty !== "easy" &&
        dist <= JUMPSCARE.attackRadius
      ) {
        this.jumpscareAttacked = true;
        this.audio.snarl();
        this.cameras.main.flash(220, 120, 0, 0);
        this.pulseBarrel(0.5, 240);
        this.tweens.add({
          targets: this.cameras.main,
          rotation: { from: (Math.random() < 0.5 ? -1 : 1) * 0.025, to: 0 },
          duration: 300,
          ease: "Sine.Out",
        });
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
      Phaser.Math.Between(JUMPSCARE.minIntervalMs, JUMPSCARE.maxIntervalMs) *
      scale;
    this.jumpscareNextAt = time + interval;
  }

  /** Try a handful of candidate tiles in view range and spawn on the first
   *  one that's walkable and actually visible to the player. A fraction of
   *  encounters are a silent "peek" — a silhouette that never approaches or
   *  attacks and vanishes fast, unsettling precisely because nothing happens.
   *  The encounter's kind is rolled from the current level's own roster
   *  (excluding `pursuer`, which never appears in a roster) so Level 0's
   *  jump-scares mostly read as Smiler-tinted and every other level gets its
   *  own kind mix instead of one hardcoded generic look. */
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
      if (
        tx < 0 ||
        ty < 0 ||
        tx >= this.level.width ||
        ty >= this.level.height
      ) {
        continue;
      }
      if (this.isWallTile(tx, ty) || this.isHoleTile(tx, ty)) continue;
      if (!this.visibility.hasLineOfSight(origin.x, origin.y, tx, ty, isWall)) {
        continue;
      }

      const kind = pickMonsterKind(Math.random, this.levelIndex);
      const kindConfig = MONSTER_KIND_CONFIG[kind];
      const c = this.centreOf(tx, ty);
      const monster = new Monster(
        this,
        c.x,
        c.y,
        [],
        DEFAULT_MONSTER_TUNING,
        this.roleTint(kindConfig.tint),
        this.monsterOptsFor(kind, kindConfig, true),
      );
      monster.setDepth(90);
      monster.setAlpha(0);
      this.physics.add.collider(monster, this.walls);
      this.tweens.add({
        targets: monster,
        alpha: 1,
        duration: 220,
        ease: "Sine.Out",
      });

      this.jumpscareMonster = monster;
      this.jumpscareKind = kind;
      this.jumpscareAttacked = false;
      this.jumpscareIsPeek = Math.random() < JUMPSCARE.peekChance;
      const visibleMs = this.jumpscareIsPeek
        ? JUMPSCARE.peekVisibleMs
        : Phaser.Math.Between(JUMPSCARE.minVisibleMs, JUMPSCARE.maxVisibleMs);
      this.jumpscareDespawnAt = time + visibleMs;
      if (this.jumpscareIsPeek) {
        this.audio.murmur(0.22 + exitProximity * 0.2);
      } else {
        this.audio.shriek(0.3 + exitProximity * 0.3);
        this.cameras.main.shake(120, 0.0025);
      }
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
    // The flashlight reveals tiles well past the ambient radius — without
    // this, every tile beyond the ambient falloff band capped out at the
    // same dim alpha as the rim of ordinary vision, so the beam looked much
    // brighter than it actually made things visible.
    const radius = this.flashlightOn
      ? Math.max(VISIBILITY.revealRadiusTiles, FLASHLIGHT.coneRadiusTiles)
      : VISIBILITY.revealRadiusTiles;
    const band = VISIBILITY.edgeFalloffTiles;
    const t = (dist - (radius - band)) / band;
    return Phaser.Math.Clamp(t, 0, 1);
  }

  /**
   * Ambient patrol monsters (see {@link MONSTER_STEALTH}) should read as
   * glimpses in the dark, not a crowd standing in the open — on every level,
   * not just the ones with hand-spaced spawns. A monster is only ever drawn
   * while its own tile is currently within line-of-sight (mirroring the
   * fog's Visible state, faded the same way toward the rim so it's hard to
   * make out in the shadows), and even then only the single nearest one to
   * the player is shown — any others sharing the sightline stay hidden
   * until they become the nearest.
   */
  private updateMonsterFogVisibility(playerPos: Vec2): void {
    let nearest: Monster | null = null;
    let nearestDist = Infinity;
    let nearestAlpha = 0;
    for (const m of this.monsters) {
      const tx = Math.floor(m.x / TILE_SIZE);
      const ty = Math.floor(m.y / TILE_SIZE);
      if (this.visibility.getState(tx, ty) !== TileVisibility.Visible) {
        m.setVisible(false);
        continue;
      }
      const d = m.distanceTo(playerPos);
      if (d >= nearestDist) {
        m.setVisible(false);
        continue;
      }
      if (nearest) nearest.setVisible(false);
      nearest = m;
      nearestDist = d;
      const falloff = this.edgeFalloff(tx, ty);
      nearestAlpha =
        MONSTER_STEALTH.minAlpha +
        (MONSTER_STEALTH.maxAlpha - MONSTER_STEALTH.minAlpha) * (1 - falloff);
    }
    if (nearest) {
      nearest.setVisible(true);
      nearest.setAlpha(nearestAlpha);
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
      // Visible tiles have a distance-based alpha (edgeFalloff) that keeps
      // changing as the player moves closer, even though the discrete state
      // stays "Visible" — so they must keep recomputing every refresh.
      if (this.fogState[i] === vis && vis !== TileVisibility.Visible) continue;
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
    // Reading a document holds the player in place — the reader overlay
    // covers most of the screen, so blind movement underneath it would be
    // an unfair way to wander into a hole or a monster.
    if (this.loreReading) this.player.setVelocity(0, 0);
    else this.controller.update(delta);
    this.updateStaminaBar();

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

    if (!this.ended) this.updateAlmondWater(time);
    if (!this.ended) this.updateFlashlightPickup();
    if (!this.ended) this.updateLorePickups();
    if (!this.ended) this.updateFlashlightToggle();
    if (!this.ended) this.updateFlashlightBeam(time);

    this.updateAi(time, delta);
    this.updateOldschoolGrain(time);

    if (!this.ended) {
      const anomaly = this.process.update(time);
      if (anomaly) {
        this.triggerAnomaly(anomaly);
        // Rare chaos combo — two things going wrong at once reads as far
        // more unsettling than either alone, and never happens on a
        // predictable beat since it rides the already-random anomaly roll.
        if (Math.random() < 0.15) {
          const bonus =
            ANOMALY_TYPES[Math.floor(Math.random() * ANOMALY_TYPES.length)]!;
          if (bonus !== anomaly) {
            this.time.delayedCall(120 + Math.random() * 260, () => {
              if (!this.ended) this.triggerAnomaly(bonus);
            });
          }
        }
      }
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
      case "scream": {
        const pan = Math.random() * 2 - 1;
        this.audio.distantScream(pan);
        this.tweens.add({
          targets: this.presenceOverlay,
          alpha: { from: 0, to: 0.35 },
          duration: 220,
          yoyo: true,
          ease: "Sine.InOut",
        });
        break;
      }
      case "static":
        this.audio.staticFuzz();
        this.triggerGlitch();
        break;
      case "footsteps": {
        const pan = Math.random() * 2 - 1;
        this.audio.footsteps(pan);
        break;
      }
      case "laugh": {
        const pan = Math.random() * 2 - 1;
        this.audio.laugh(0.3, pan);
        this.tweens.add({
          targets: this.presenceOverlay,
          alpha: { from: 0, to: 0.18 },
          duration: 90,
          yoyo: true,
          repeat: 2,
        });
        break;
      }
      case "moan": {
        const pan = Math.random() * 2 - 1;
        this.audio.moan(0.4, pan);
        this.tweens.add({
          targets: this.presenceOverlay,
          alpha: { from: 0, to: 0.3 },
          duration: 500,
          yoyo: true,
          ease: "Sine.InOut",
        });
        break;
      }
      case "bang": {
        const pan = Math.random() * 2 - 1;
        this.audio.bang(0.5, pan);
        this.cameras.main.shake(180, 0.006);
        this.tweens.add({
          targets: this.anomalyOverlay,
          alpha: { from: 0, to: 0.5 },
          duration: 30,
          yoyo: true,
        });
        break;
      }
      case "flash":
        this.triggerSubliminalFlash();
        break;
      case "howl": {
        const pan = Math.random() * 2 - 1;
        this.audio.howl(pan);
        this.tweens.add({
          targets: this.presenceOverlay,
          alpha: { from: 0, to: 0.22 },
          duration: 600,
          yoyo: true,
          ease: "Sine.InOut",
        });
        break;
      }
      case "knock": {
        // Three deliberate raps from inside a wall — patient, not accidental.
        const pan = Math.random() * 2 - 1;
        this.audio.knock(pan);
        this.cameras.main.shake(90, 0.0015);
        break;
      }
      case "breath": {
        // An exhale right at the ear, and the walls lean in for a moment.
        const pan = Math.random() < 0.5 ? -0.7 : 0.7;
        this.audio.breath(0.32, pan);
        this.pulseBarrel(0.3, 340);
        break;
      }
      case "shadow":
        this.triggerShadowDart();
        break;
      case "lightsout":
        this.triggerLightsOut();
        break;
    }
  }

  /**
   * A silhouette darts across the edge of what you can see and is gone —
   * drawn from this level's own roster, tinted to near-black so it reads as
   * a shape, not an encounter. Spawns on a visible floor tile a few tiles
   * out and crosses perpendicular to your line of sight.
   */
  private triggerShadowDart(): void {
    const origin = this.playerTile();
    const isWall = (x: number, y: number) => this.isWallTile(x, y);
    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.FloatBetween(3, 5.5);
      const tx = Math.round(origin.x + Math.cos(angle) * dist);
      const ty = Math.round(origin.y + Math.sin(angle) * dist);
      if (tx < 0 || ty < 0 || tx >= this.level.width || ty >= this.level.height) continue;
      if (this.isWallTile(tx, ty) || this.isHoleTile(tx, ty)) continue;
      if (!this.visibility.hasLineOfSight(origin.x, origin.y, tx, ty, isWall)) continue;

      const kind = pickMonsterKind(Math.random, this.levelIndex);
      const c = this.centreOf(tx, ty);
      const sprite = this.add
        .image(c.x, c.y, monsterTextureKey(MONSTER_ART[kind], "front", false))
        .setDepth(89)
        .setAlpha(0)
        .setTint(0x0a0a0c);
      const perp = angle + (Math.PI / 2) * (Math.random() < 0.5 ? -1 : 1);
      const run = TILE_SIZE * 3.5;
      sprite.setFlipX(Math.cos(perp) < 0);
      this.audio.murmur(0.18);
      this.tweens.add({
        targets: sprite,
        x: c.x + Math.cos(perp) * run,
        y: c.y + Math.sin(perp) * run,
        duration: 620,
        ease: "Sine.In",
        onComplete: () => sprite.destroy(),
      });
      this.tweens.add({
        targets: sprite,
        alpha: { from: 0, to: 0.55 },
        duration: 310,
        yoyo: true,
      });
      return;
    }
  }

  /**
   * The big sibling of the routine power-flicker: the lights die entirely
   * for a couple of seconds, and something crosses the room while they're
   * out — footsteps first at one side, then closer, then a breath. Nothing
   * is actually there when the light comes back. Probably.
   */
  private triggerLightsOut(): void {
    this.audio.staticBurst(0.4);
    const cam = this.cameras.main;
    const veil = this.add
      .rectangle(0, 0, cam.width, cam.height, 0x000000, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1500);
    this.tweens.add({
      targets: veil,
      alpha: { from: 0, to: 0.97 },
      duration: 320,
      yoyo: true,
      hold: 1900,
      onComplete: () => veil.destroy(),
    });
    const pan = Math.random() < 0.5 ? -0.8 : 0.8;
    this.time.delayedCall(650, () => this.audio.footsteps(pan));
    this.time.delayedCall(1450, () => this.audio.footsteps(pan * 0.35));
    this.time.delayedCall(2050, () => this.audio.breath(0.3, 0));
  }

  /** A single-frame monster face slammed onto the screen and gone almost
   *  before it registers — the "did I just see that?" subliminal jolt.
   *  Deliberately faster than any readable jumpscare; the fear is in the
   *  doubt, not the reveal. */
  private triggerSubliminalFlash(): void {
    const cam = this.cameras.main;
    // Flash a face from this level's own roster — the thing you might
    // actually meet here, not a generic one.
    const flashKind = pickMonsterKind(Math.random, this.levelIndex);
    const face = this.add
      .image(
        cam.width * (0.3 + Math.random() * 0.4),
        cam.height * (0.3 + Math.random() * 0.4),
        monsterTextureKey(MONSTER_ART[flashKind], "front", false),
      )
      .setScrollFactor(0)
      .setDepth(970)
      .setAlpha(0)
      .setTint(0x1a0000)
      .setScale(6 + Math.random() * 2);
    this.audio.shriek(0.18, Math.random() * 2 - 1);
    this.tweens.add({
      targets: face,
      alpha: { from: 0, to: 0.85 },
      duration: 45,
      yoyo: true,
      onComplete: () => face.destroy(),
    });
  }
}
