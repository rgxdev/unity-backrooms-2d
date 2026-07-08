import Phaser from "phaser";
import {
  COLORS,
  FLOOR_VARIANTS,
  LEVEL_STYLES,
  MONSTER,
  MONSTER_ARTS,
  monsterTextureKey,
  PLAYER,
  playerTextureKey,
  SCENES,
  STYLE_COLORS,
  STYLE_PROPS,
  TEXTURES,
  TILE_SIZE,
  WALL_MASK,
  WALL_MASK_COUNT,
  WALL_VARIANTS,
  type MonsterArt,
  type PropKind,
  type StyleColorSet,
} from "@/game/config/constants";
import {
  SKINS,
  type AccessoryKind,
  type PlayerPalette,
} from "@/game/skins/skinCatalog";
import {
  paintPlayerSprite,
  type PaintSurface,
} from "@/game/skins/spritePainter";
import { hash01 } from "@/game/util/hash";

type Facing = "front" | "back";

/** Palette for the per-art monster sprites that don't reuse the gaunt
 *  lurker's body colours — kept local: nothing outside texture baking needs
 *  them (runtime identity colouring stays MONSTER_TINT's job). */
const MART = {
  smilerGrin: 0xf6f2e4,
  smilerEye: 0xe8e2c8,
  facelingSuit: 0x3a3f4a,
  facelingSuitHi: 0x4c5260,
  stitch: 0x6b4034,
  fleshSeam: 0xb08472,
  mothWing: 0xb8ac88,
  mothWingSpot: 0x4a4232,
  mothBody: 0x776b4e,
  wretchBlood: 0x5c1a12,
  wretchRag: 0x6b6152,
  partyBody: 0xf2e28a,
  partyBodyHi: 0xfcf2b0,
  partyShade: 0xc2ae5a,
  partyMouth: 0x2a1c10,
  partyHat: 0xd06a9a,
  watcherCoat: 0x2e3440,
  watcherCoatHi: 0x3e4654,
  watcherEye: 0xf2f6ff,
  clumpFlesh: 0xb08a7a,
  clumpFleshHi: 0xc9a08e,
  clumpFleshShade: 0x7e5c4e,
  clumpSinew: 0x5c3a30,
  beastBody: 0x241c2c,
  beastBodyHi: 0x3a2e46,
  beastHorn: 0xcabfa8,
  beastEye: 0xe86a3a,
} as const;

/** Texture generations processed per frame — paces the loading process into
 *  a visible bar instead of one blocking synchronous burst. Raised again as
 *  the queue grew (9 level styles × 4 wall variants, 21 skins, 12 monster
 *  art sets ≈ 780 tasks) so the total load stays around a second at 60fps. */
const BATCH_SIZE = 12;

export class PreloadScene extends Phaser.Scene {
  private queue: Array<() => void> = [];
  private totalTasks = 0;
  private progressBarBg!: Phaser.GameObjects.Rectangle;
  private progressBarFill!: Phaser.GameObjects.Rectangle;
  private progressLabel!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.preload);
  }

  create(): void {
    this.buildProgressUi();
    this.queue = this.buildTextureQueue();
    this.totalTasks = this.queue.length;
  }

  /**
   * Drains a few texture-generation tasks per frame instead of running the
   * whole batch synchronously in `create()`, so the loading screen shows
   * real, incremental progress. Advances to MainScene once the queue drains.
   */
  override update(): void {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, BATCH_SIZE);
    for (const task of batch) task();
    this.updateProgressUi();
    if (this.queue.length === 0) this.scene.start(SCENES.main);
  }

  private buildProgressUi(): void {
    const { width, height } = this.scale;
    const barWidth = Math.min(240, width * 0.6);
    const barHeight = 6;
    const barX = width / 2 - barWidth / 2;
    const barY = height / 2 + 16;

    this.progressLabel = this.add
      .text(width / 2, height / 2 - 8, "LOADING 0%", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#c9b458",
      })
      .setOrigin(0.5);

    this.progressBarBg = this.add
      .rectangle(barX, barY, barWidth, barHeight, 0x2a2818)
      .setOrigin(0, 0.5);
    this.progressBarFill = this.add
      .rectangle(barX, barY, 0, barHeight, 0xe4c94a)
      .setOrigin(0, 0.5);
  }

  private updateProgressUi(): void {
    const done = this.totalTasks - this.queue.length;
    const ratio = this.totalTasks === 0 ? 1 : done / this.totalTasks;
    this.progressBarFill.width = this.progressBarBg.width * ratio;
    this.progressLabel.setText(`LOADING ${Math.round(ratio * 100)}%`);
  }

  /** The full set of procedural texture-generation steps, as a queue of
   *  deferred tasks rather than one synchronous call. */
  private buildTextureQueue(): Array<() => void> {
    const tasks: Array<() => void> = [];
    for (const style of LEVEL_STYLES) {
      const c = STYLE_COLORS[style];
      for (let variant = 0; variant < FLOOR_VARIANTS; variant++) {
        tasks.push(() =>
          this.makeFloor(TEXTURES.floor(style, variant), c, variant),
        );
      }
      tasks.push(() => this.makeWallCrack(TEXTURES.wallCrack(style), c));
      tasks.push(() => this.makeExit(TEXTURES.exit(style), c));
      for (let mask = 0; mask < WALL_MASK_COUNT; mask++) {
        for (let variant = 0; variant < WALL_VARIANTS; variant++) {
          tasks.push(() =>
            this.makeWallVariant(
              TEXTURES.wall(style, mask, variant),
              c,
              mask,
              variant,
            ),
          );
        }
      }
      for (const kind of STYLE_PROPS[style]) {
        tasks.push(() => this.makeProp(TEXTURES.prop(kind), kind, c));
      }
    }
    tasks.push(() => this.makeAlmondWater(TEXTURES.almondWater));
    tasks.push(() => this.makeFlashlight(TEXTURES.flashlight));
    tasks.push(() => this.makeLoreLetter(TEXTURES.loreLetter));
    tasks.push(() => this.makeLoreBook(TEXTURES.loreBook));
    for (const skin of SKINS) {
      tasks.push(
        () =>
          this.makePlayer(
            playerTextureKey(skin.id, "front", false),
            "front",
            false,
            skin.palette,
            skin.accessory,
          ),
        () =>
          this.makePlayer(
            playerTextureKey(skin.id, "front", true),
            "front",
            true,
            skin.palette,
            skin.accessory,
          ),
        () =>
          this.makePlayer(
            playerTextureKey(skin.id, "back", false),
            "back",
            false,
            skin.palette,
            skin.accessory,
          ),
        () =>
          this.makePlayer(
            playerTextureKey(skin.id, "back", true),
            "back",
            true,
            skin.palette,
            skin.accessory,
          ),
      );
    }
    for (const art of MONSTER_ARTS) {
      tasks.push(
        () =>
          this.makeMonsterArt(
            monsterTextureKey(art, "front", false),
            art,
            "front",
            false,
          ),
        () =>
          this.makeMonsterArt(
            monsterTextureKey(art, "front", true),
            art,
            "front",
            true,
          ),
        () =>
          this.makeMonsterArt(
            monsterTextureKey(art, "back", false),
            art,
            "back",
            false,
          ),
        () =>
          this.makeMonsterArt(
            monsterTextureKey(art, "back", true),
            art,
            "back",
            true,
          ),
      );
    }
    tasks.push(
      () => this.makeHole(TEXTURES.hole),
      () => this.makeRubble(TEXTURES.rubble),
      () => this.makeScanlines(TEXTURES.scanlines),
      () => this.makeGrain(TEXTURES.grain),
    );
    return tasks;
  }

  /** Fill a single "pixel" cell. Keeps sprite work readable. */
  private px(
    g: Phaser.GameObjects.Graphics,
    color: number,
    x: number,
    y: number,
    w = 1,
    h = 1,
    alpha = 1,
  ): void {
    g.fillStyle(color, alpha);
    g.fillRect(x, y, w, h);
  }

  /**
   * Corner-clipped rect — shaves the 4 corner pixels off a filled block so
   * silhouettes read as gently rounded volumes instead of hard squares. The
   * classic pixel-art trick for "not blocky" shapes at small resolutions.
   */
  private rr(
    g: Phaser.GameObjects.Graphics,
    color: number,
    x: number,
    y: number,
    w: number,
    h: number,
    alpha = 1,
  ): void {
    g.fillStyle(color, alpha);
    g.fillRect(x + 1, y, w - 2, h);
    g.fillRect(x, y + 1, w, h - 2);
  }

  /** Cheap dither noise so tiled textures don't look like a stamped-out
   *  repeating block — see {@link hash01}. */
  private noise(x: number, y: number): number {
    return hash01(x, y);
  }

  /**
   * Seamless floor tile — a single continuous surface (per the wiki: Level
   * 0's carpet is "one continuous piece", and a warehouse slab pours the
   * same way). No colour-alternated checker stamp; the weave/mottle pattern
   * is periodic within the tile so edges line up perfectly from one stamp to
   * the next, and the only variation is fine speckle dither — small grain,
   * not a grid of blocks.
   *
   * `variant` scatters three baked looks across the level (picked per-tile
   * by {@link MainScene}, not random per frame): 0 is the clean baseline, 1
   * layers in heavier wear, and 2 adds one deliberately unsettling stain —
   * so a floor doesn't read as one texture endlessly stamped.
   */
  private makeFloor(key: string, c: StyleColorSet, variant: number): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const t = TILE_SIZE;
    this.px(g, c.floor, 0, 0, t, t);

    switch (c.floorPattern) {
      case "weave": {
        // Berber-carpet thread weave — cell size divides the tile evenly so
        // the weave phase is continuous across tile boundaries.
        const cell = 4;
        for (let y = 0; y < t; y += cell) {
          for (let x = 0; x < t; x += cell) {
            const warp = (x / cell) % 2 === 0;
            this.px(
              g,
              warp ? c.floorWeaveHi : c.floorWeaveLo,
              x,
              y,
              cell,
              1,
              0.5,
            );
            this.px(
              g,
              warp ? c.floorWeaveLo : c.floorWeaveHi,
              x,
              y,
              1,
              cell,
              0.5,
            );
          }
        }
        break;
      }
      case "concrete": {
        // Broad, blotchy poured-concrete mottling instead of a fine weave.
        const cell = 8;
        for (let y = 0; y < t; y += cell) {
          for (let x = 0; x < t; x += cell) {
            if (this.noise(x + c.seed, y + c.seed) > 0.55) {
              this.px(g, c.floorWeaveLo, x, y, cell, cell, 0.14);
            }
          }
        }
        break;
      }
      case "tile": {
        // Pristine ceramic sub-tiles with thin grout lines — a real seamed
        // material, not a jarring two-colour checker.
        const cell = 16;
        for (let y = 0; y <= t; y += cell)
          this.px(g, c.accent, 0, y, t, 1, 0.4);
        for (let x = 0; x <= t; x += cell)
          this.px(g, c.accent, x, 0, 1, t, 0.4);
        break;
      }
    }

    // Fine speckle dither — small grain, breaks up the pattern into
    // something that reads as "pixels", not a flat stamped block. Variant 1+
    // widens the thresholds for a noticeably grimier floor.
    const speckleHi = variant >= 1 ? 0.88 : 0.93;
    const speckleLo = variant >= 1 ? 0.09 : 0.05;
    for (let y = 0; y < t; y++) {
      for (let x = 0; x < t; x++) {
        const n = this.noise(x, y + c.seed);
        if (n > speckleHi) this.px(g, c.floorWeaveHi, x, y, 1, 1, 0.35);
        else if (n < speckleLo) this.px(g, c.floorStain, x, y, 1, 1, 0.3);
      }
    }

    if (variant === 2) {
      // One deliberately wrong-looking spill — a spreading stain trailing
      // toward an edge, unrelated to the tile's real wear pattern.
      g.fillStyle(c.floorStain, 0.55);
      g.fillEllipse(18, 17, 15, 11);
      g.fillStyle(c.floorStain, 0.4);
      g.fillEllipse(23, 22, 9, 7);
      g.fillStyle(c.floorStain, 0.28);
      g.fillEllipse(26, 26, 5, 4);
    }

    g.generateTexture(key, t, t);
    g.destroy();
  }

  /**
   * The decorative surface layer shared by every wall variant of a style
   * (base fill, pattern detail, speckle grain) — factored out so the 16
   * autotile masks and the dressed exit-niche crack tile stay pixel-for-pixel
   * consistent with each other.
   *
   * `variant` scatters extra wear across the level the same way
   * {@link makeFloor} does: 0 is the clean baseline, 1 is grimier, and 2 adds
   * one unsettling detail specific to the material (a mildew bloom, exposed
   * rebar, a pipe leak, a hairline crack, a scorch mark).
   */
  private drawWallSurface(
    g: Phaser.GameObjects.Graphics,
    c: StyleColorSet,
    variant = 0,
  ): void {
    const t = TILE_SIZE;
    this.px(g, c.wall, 0, 0, t, t);

    switch (c.wallPattern) {
      case "wallpaper":
      case "concrete":
        for (let x = 3; x < t; x += c.wallStripeGap) {
          this.px(g, c.wallStripe, x, 2, 1, t - 4, 0.35);
        }
        break;
      case "pipes":
        // A pair of rusted pipes running the length of the tunnel, with a
        // cylindrical highlight/shadow band for volume.
        for (const py of [8, 20]) {
          this.px(g, c.accent2, 0, py - 1, t, 5, 0.9);
          this.px(g, c.accent, 0, py, t, 3, 1);
          this.px(g, c.wallSpeckleHi, 0, py, t, 1, 0.5);
          this.px(g, c.accent2, 0, py + 3, t, 1, 0.7);
        }
        break;
      case "tile":
        // Small ceramic sub-tiles with grout lines.
        for (let y = 0; y <= t; y += 8) this.px(g, c.accent, 0, y, t, 1, 0.5);
        for (let x = 0; x <= t; x += 8) this.px(g, c.accent, x, 0, 1, t, 0.5);
        break;
      case "hazard":
        // Two hazard-tape bands (top + bottom) of alternating diagonal-cut
        // stripes — matches the full-face coverage every other style's
        // pattern has, so scorched wall mass between the bands still reads
        // as a solid, patterned surface instead of a near-black void with
        // one thin stripe floating in it.
        for (const by of [4, t - 11]) {
          this.px(g, c.wallShade, 0, by, t, 7, 0.9);
          for (let x = -6; x < t; x += 6) {
            this.px(g, c.accent, x, by, 3, 7, 0.95);
          }
        }
        break;
      case "panels":
        // Hotel wainscoting: tall mahogany panels with routed borders, a
        // brass picture rail near the top and a dark baseboard band.
        this.px(g, c.accent, 0, 3, t, 1, 0.5);
        for (let x = 0; x <= t; x += 16) {
          this.px(g, c.wallDark, x, 5, 1, t - 10, 0.6);
          this.px(g, c.wallHi2, x + 1, 5, 1, t - 10, 0.4);
        }
        for (let x = 3; x < t; x += 16) {
          this.px(g, c.wallShade, x, 8, 11, 1, 0.5);
          this.px(g, c.wallShade, x, t - 9, 11, 1, 0.5);
          this.px(g, c.wallShade, x, 8, 1, t - 17, 0.5);
          this.px(g, c.wallShade, x + 10, 8, 1, t - 17, 0.5);
        }
        this.px(g, c.wallDark, 0, t - 4, t, 4, 0.55);
        break;
      case "steel":
        // Riveted steel plate: broad panels seamed with rivet lines, and a
        // cable tray running across the upper section.
        for (const sy of [0, 16]) {
          this.px(g, c.wallDark, 0, sy, t, 1, 0.7);
          for (let x = 2; x < t; x += 6) {
            this.px(g, c.wallHi, x, sy + 2, 1, 1, 0.7);
            this.px(g, c.wallDark, x, sy + 13, 1, 1, 0.5);
          }
        }
        // Cable tray band with two sagging cable runs.
        this.px(g, c.wallDark, 0, 6, t, 4, 0.8);
        this.px(g, c.accent, 0, 7, t, 1, 0.8);
        this.px(g, c.accent2, 0, 9, t, 1, 0.9);
        break;
      case "brick": {
        // Running-bond house brick: mortar lines every 8px, headers offset
        // by half a brick on alternate courses, plus a pale window sill band.
        for (let y = 0; y <= t; y += 8) {
          this.px(g, c.wallDark, 0, y, t, 1, 0.55);
          const offset = (y / 8) % 2 === 0 ? 0 : 8;
          for (let x = offset; x < t; x += 16) {
            this.px(g, c.wallDark, x, y, 1, 8, 0.45);
          }
        }
        // A dark, curtained window with a pale frame — every house is lit
        // exactly like this: not at all.
        this.px(g, c.accent, 19, 9, 10, 1, 0.85);
        this.px(g, c.accent, 19, 9, 1, 9, 0.85);
        this.px(g, c.accent, 28, 9, 1, 9, 0.85);
        this.px(g, c.accent, 19, 17, 10, 1, 0.85);
        this.px(g, c.accent2, 20, 10, 8, 7, 0.95);
        break;
      }
      case "party": {
        // Streamer swags scalloping across the top, taped confetti dots
        // everywhere below — festive at a glance, filthy up close.
        for (let x = 0; x < t; x += 8) {
          const streamer = (x / 8) % 2 === 0 ? c.accent : c.accent2;
          this.px(g, streamer, x, 2, 4, 2, 0.9);
          this.px(g, streamer, x + 4, 4, 4, 2, 0.9);
        }
        const dots: Array<[number, number, number]> = [
          [6, 12, 0],
          [14, 18, 1],
          [24, 11, 1],
          [27, 22, 0],
          [10, 26, 1],
          [19, 28, 0],
          [4, 20, 0],
        ];
        for (const [dx, dy, which] of dots) {
          this.px(g, which === 0 ? c.accent : c.accent2, dx, dy, 2, 2, 0.75);
        }
        break;
      }
    }

    // Speckle grain — variant 1+ is noticeably filthier.
    const speckleHi = variant >= 1 ? 0.89 : 0.94;
    const speckleLo = variant >= 1 ? 0.09 : 0.05;
    for (let y = 0; y < t; y++) {
      for (let x = 0; x < t; x++) {
        const n = this.noise(x + c.seed, y + c.seed);
        if (n > speckleHi) this.px(g, c.wallSpeckleHi, x, y, 1, 1, 0.5);
        else if (n < speckleLo) this.px(g, c.wallSpeckleLo, x, y, 1, 1, 0.4);
      }
    }

    if (variant === 2) this.drawWallCreepyDetail(g, c);
    if (variant === 3) this.drawWallCreepyDetail2(g, c);
  }

  /**
   * One deliberately unsettling detail, specific to the wall material —
   * baked into variant 2 of every mask so it's rare (roughly a third of the
   * map's walls) rather than omnipresent.
   */
  private drawWallCreepyDetail(
    g: Phaser.GameObjects.Graphics,
    c: StyleColorSet,
  ): void {
    const t = TILE_SIZE;
    switch (c.wallPattern) {
      case "wallpaper": {
        // A dark bloom of mildew, with a faint five-point handprint smudge
        // beside it — something touched this wall.
        g.fillStyle(c.wallSpeckleLo, 0.5);
        g.fillEllipse(9, 12, 10, 8);
        g.fillEllipse(12, 17, 6, 5);
        const hx = 22;
        const hy = 20;
        this.px(g, c.wallDark, hx, hy, 2, 5, 0.3);
        this.px(g, c.wallDark, hx + 3, hy - 1, 2, 6, 0.3);
        this.px(g, c.wallDark, hx + 6, hy, 2, 5, 0.3);
        this.px(g, c.wallDark, hx - 2, hy + 4, 5, 3, 0.28);
        break;
      }
      case "concrete": {
        // A crumbled chip exposing a stub of rusted rebar.
        this.rr(g, c.wallDark, 12, 10, 8, 6, 0.85);
        this.px(g, COLORS.rebarRust, 14, 8, 1, 11, 0.9);
        this.px(g, COLORS.rebarRust, 17, 9, 1, 10, 0.85);
        this.px(g, c.wallShade, 13, 15, 6, 2, 0.5);
        break;
      }
      case "pipes": {
        // A dark leak stain dripping from the lower pipe down the wall.
        this.px(g, c.accent2, 14, 23, 3, 9, 0.55);
        g.fillStyle(c.accent2, 0.4);
        g.fillEllipse(15, 30, 6, 3);
        this.px(g, c.wallDark, 15, 26, 1, 5, 0.5);
        break;
      }
      case "tile": {
        // A hairline crack, and a faint algae smear near the grout.
        const crack: Array<[number, number]> = [
          [6, 4],
          [9, 9],
          [7, 14],
          [11, 19],
          [9, 25],
        ];
        for (let i = 0; i < crack.length - 1; i++) {
          const [x0, y0] = crack[i]!;
          const [x1, y1] = crack[i + 1]!;
          const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
          for (let s = 0; s <= steps; s++) {
            const x = Math.round(x0 + ((x1 - x0) * s) / steps);
            const y = Math.round(y0 + ((y1 - y0) * s) / steps);
            this.px(g, c.wallDark, x, y, 1, 1, 0.6);
          }
        }
        g.fillStyle(c.accent2, 0.22);
        g.fillEllipse(22, 20, 8, 12);
        break;
      }
      case "hazard": {
        // A scorch smudge licking up from the tape band.
        g.fillStyle(c.wallDark, 0.5);
        g.fillEllipse(t / 2, t - 14, 14, 10);
        g.fillStyle(c.accent2, 0.4);
        g.fillEllipse(t / 2, t - 10, 9, 7);
        break;
      }
      case "panels": {
        // Four parallel gouges raked down through the varnish — something
        // with claws wanted out of this hallway.
        for (let i = 0; i < 4; i++) {
          const x = 10 + i * 4;
          this.px(g, c.wallDark, x, 8, 1, 14, 0.75);
          this.px(g, c.wallHi2, x + 1, 8, 1, 14, 0.3);
        }
        // A pale rectangle where a portrait hung until recently.
        this.px(g, c.wallHi, 20, 10, 8, 10, 0.25);
        this.px(g, c.wallDark, 20, 10, 8, 1, 0.4);
        break;
      }
      case "steel": {
        // A dented plate bulging outward, paint cracked around the impact —
        // struck hard, from the other side.
        g.fillStyle(c.wallHi, 0.3);
        g.fillEllipse(16, 22, 12, 9);
        g.fillStyle(c.wallDark, 0.6);
        g.fillEllipse(16, 22, 7, 5);
        this.px(g, c.wallDark, 10, 18, 3, 1, 0.6);
        this.px(g, c.wallDark, 20, 26, 4, 1, 0.6);
        this.px(g, c.wallDark, 22, 18, 2, 1, 0.5);
        break;
      }
      case "brick": {
        // One brick missing entirely — and the dark behind it is a room's
        // worth of dark, not a brick's worth.
        this.px(g, c.accent2, 8, 16, 8, 8, 1);
        this.px(g, c.wallDark, 7, 15, 10, 1, 0.7);
        this.px(g, c.wallDark, 7, 24, 10, 1, 0.7);
        // Crumbled mortar dusting the course below.
        this.px(g, c.wallSpeckleHi, 9, 25, 2, 1, 0.5);
        this.px(g, c.wallSpeckleHi, 13, 26, 2, 1, 0.4);
        break;
      }
      case "party": {
        // A long dark stain running down from behind the streamers, and one
        // balloon gone slack and wrinkled against the wall.
        this.px(g, c.wallSpeckleLo, 14, 6, 3, 20, 0.45);
        g.fillStyle(c.wallSpeckleLo, 0.35);
        g.fillEllipse(15, 27, 8, 4);
        g.fillStyle(c.accent, 0.55);
        g.fillEllipse(25, 20, 6, 8);
        this.px(g, c.wallDark, 24, 24, 1, 4, 0.6);
        break;
      }
    }
  }

  /**
   * The rarer second unsettling detail, baked into variant 3 (see
   * {@link WALL_VARIANTS}) — where variant 2's mark is material damage,
   * variant 3's is evidence: something wrote, dragged, scratched, or counted
   * on this wall, recently.
   */
  private drawWallCreepyDetail2(
    g: Phaser.GameObjects.Graphics,
    c: StyleColorSet,
  ): void {
    const t = TILE_SIZE;
    switch (c.wallPattern) {
      case "wallpaper": {
        // Tally marks scratched through the wallpaper — four strokes and a
        // diagonal, then three more. Someone was counting days. It stops.
        for (let i = 0; i < 4; i++) {
          this.px(g, c.wallDark, 7 + i * 3, 8, 1, 8, 0.75);
        }
        this.px(g, c.wallDark, 6, 11, 12, 1, 0.7); // the diagonal slash
        for (let i = 0; i < 3; i++) {
          this.px(g, c.wallDark, 21 + i * 3, 8, 1, 8, 0.7);
        }
        break;
      }
      case "concrete": {
        // A long drag smear descending toward the floor, ending in a
        // smudged five-finger print. It was pulled, and it held on.
        this.px(g, c.wallSpeckleLo, 12, 4, 3, 22, 0.4);
        this.px(g, c.wallSpeckleLo, 14, 10, 2, 18, 0.3);
        for (let i = 0; i < 4; i++) {
          this.px(g, c.wallDark, 10 + i * 3, 26, 1, 4, 0.45);
        }
        break;
      }
      case "pipes": {
        // Three claw rakes gouged straight through both pipe runs — metal
        // and all. Whatever did it wasn't trying to be quiet.
        for (let i = 0; i < 3; i++) {
          const x = 12 + i * 4;
          this.px(g, c.wallDark, x, 4, 1, 24, 0.8);
          this.px(g, c.wallSpeckleHi, x + 1, 4, 1, 24, 0.25);
        }
        break;
      }
      case "tile": {
        // A dark wet handprint at child height, half-slid down the glaze.
        const hx = 18;
        const hy = 18;
        this.px(g, c.wallDark, hx, hy, 2, 5, 0.4);
        this.px(g, c.wallDark, hx + 3, hy - 1, 2, 6, 0.4);
        this.px(g, c.wallDark, hx + 6, hy, 2, 5, 0.38);
        this.px(g, c.wallDark, hx - 1, hy + 4, 8, 4, 0.35);
        this.px(g, c.wallDark, hx + 1, hy + 8, 5, 6, 0.22); // the slide down
        break;
      }
      case "hazard": {
        // A cluster of deep pockmarks stitched across the wall between the
        // tape bands — something tested it, methodically, point by point.
        const marks: Array<[number, number]> = [
          [8, 14],
          [13, 16],
          [18, 13],
          [23, 17],
          [15, 20],
          [20, 21],
        ];
        for (const [mx, my] of marks) {
          this.px(g, c.wallDark, mx, my, 2, 2, 0.85);
          this.px(g, c.wallSpeckleHi, mx, my - 1, 2, 1, 0.3);
        }
        break;
      }
      case "panels": {
        // "NO VACANCY" energy without words: every panel's routed border
        // scratched through on one side, low down — marked from below.
        for (let x = 3; x < t; x += 16) {
          this.px(g, c.wallDark, x, t - 12, 11, 1, 0.8);
          this.px(g, c.wallDark, x + 2, t - 10, 8, 1, 0.6);
        }
        g.fillStyle(c.wallDark, 0.35);
        g.fillEllipse(16, t - 6, 16, 4);
        break;
      }
      case "steel": {
        // A patch of plate scoured to bare bright metal in a tight circular
        // grind — like something turned in place here, for a long time.
        g.fillStyle(c.wallHi, 0.45);
        g.fillEllipse(20, 14, 11, 10);
        g.fillStyle(c.wall, 1);
        g.fillEllipse(20, 14, 6, 5);
        this.px(g, c.wallDark, 19, 13, 2, 2, 0.7);
        break;
      }
      case "brick": {
        // A chalk eye scrawled at shoulder height — the Neighborhood Watch's
        // mark. The pupil is drawn looking to the side. Your side.
        g.fillStyle(c.accent, 0.6);
        g.fillEllipse(16, 15, 14, 8);
        g.fillStyle(c.wall, 1);
        g.fillEllipse(16, 15, 10, 5);
        this.px(g, c.accent2, 19, 14, 3, 3, 0.9);
        break;
      }
      case "party": {
        // A banner scrap still taped up, both ends torn — and under it,
        // dozens of tiny tally dots. Days? Guests? Both?
        this.px(g, c.wallSpeckleHi, 6, 10, 20, 4, 0.8);
        this.px(g, c.wallDark, 6, 10, 1, 4, 0.5);
        this.px(g, c.wallDark, 25, 10, 1, 4, 0.5);
        for (let i = 0; i < 8; i++) {
          this.px(g, c.wallDark, 7 + i * 2.5, 18 + (i % 3), 1, 1, 0.6);
        }
        break;
      }
    }
  }

  /**
   * One baked wall slab for a given 4-bit neighbour mask (see
   * {@link WALL_MASK}). The base fill/stripe/speckle is identical for every
   * mask so a solid run of wall tiles blends into one continuous surface;
   * the bevel/trim is only drawn on sides whose bit is set — i.e. only where
   * that face is actually exposed to a room — so interior wall mass never
   * shows a per-tile outline. A fully-open mask (a lone pillar) gets trim on
   * all four sides and reads as a distinct column, exactly as it should.
   */
  private makeWallVariant(
    key: string,
    c: StyleColorSet,
    mask: number,
    variant: number,
  ): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const t = TILE_SIZE;
    const north = (mask & WALL_MASK.NORTH) !== 0;
    const east = (mask & WALL_MASK.EAST) !== 0;
    const south = (mask & WALL_MASK.SOUTH) !== 0;
    const west = (mask & WALL_MASK.WEST) !== 0;

    this.drawWallSurface(g, c, variant);

    // Two-step bevel, drawn only on faces that actually border a room —
    // this is what makes a bank of walls read as one connected mass instead
    // of a checkerboard of outlined blocks.
    if (north) {
      this.px(g, c.wallHi, 0, 0, t, 1, 0.9);
      this.px(g, c.wallHi2, 0, 1, t, 1, 0.6);
    }
    if (west) {
      this.px(g, c.wallHi, 0, 0, 1, t, 0.9);
      this.px(g, c.wallHi2, 1, 0, 1, t, 0.6);
    }
    if (south) {
      this.px(g, c.wallShade2, 0, t - 2, t, 1, 0.6);
      this.px(g, c.wallShade, 0, t - 1, t, 1, 0.85);
      // Dark baseboard grout where the wall actually meets a floor.
      this.rr(g, c.wallDark, 0, t - 3, t, 3, 0.5);
    }
    if (east) {
      this.px(g, c.wallShade2, t - 2, 0, 1, t, 0.6);
      this.px(g, c.wallShade, t - 1, 0, 1, t, 0.85);
    }

    g.generateTexture(key, t, t);
    g.destroy();
  }

  /**
   * A wall tile fractured by whatever broke through nearby — same base as
   * {@link makeWallVariant}, plus dark jagged crack lines and a chip of
   * missing surface. Dressed around the exit niche so the breach reads as
   * real damage, not just a differently-coloured tile.
   */
  private makeWallCrack(key: string, c: StyleColorSet): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const t = TILE_SIZE;
    this.drawWallSurface(g, c);
    this.px(g, c.wallHi, 0, 0, t, 1, 0.9);
    this.px(g, c.wallShade, 0, t - 1, t, 1, 0.85);

    // Jagged crack lines, forking from one corner toward the centre.
    const crack: Array<[number, number]> = [
      [4, 2],
      [7, 6],
      [6, 11],
      [10, 15],
      [9, 20],
      [13, 24],
      [12, 29],
    ];
    for (let i = 0; i < crack.length - 1; i++) {
      const [x0, y0] = crack[i]!;
      const [x1, y1] = crack[i + 1]!;
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let s = 0; s <= steps; s++) {
        const x = Math.round(x0 + ((x1 - x0) * s) / steps);
        const y = Math.round(y0 + ((y1 - y0) * s) / steps);
        this.px(g, c.wallDark, x, y, 1, 1, 0.8);
      }
    }
    // A small chip of missing surface near the fork.
    this.rr(g, c.wallShade, 16, 8, 5, 4, 0.9);
    this.px(g, c.wallDark, 17, 9, 3, 2, 0.6);

    g.generateTexture(key, t, t);
    g.destroy();
  }

  /**
   * Small debris pile on a mostly-transparent background — scattered on the
   * floor tiles beside the exit niche so the breach reads as something that
   * broke recently, not a clean cut-out.
   */
  private makeRubble(key: string): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const t = TILE_SIZE;
    const chunks: Array<[number, number, number, number]> = [
      [10, 20, 4, 3],
      [16, 23, 3, 2],
      [8, 25, 3, 2],
      [20, 18, 3, 3],
    ];
    for (const [x, y, w, h] of chunks) {
      g.fillStyle(COLORS.shadow, 0.25);
      g.fillEllipse(x + w / 2, y + h, w, 2);
      this.rr(g, COLORS.rubbleShade, x, y, w, h, 0.95);
      this.px(g, COLORS.rubbleDark, x, y + h - 1, w, 1, 0.6);
    }
    g.generateTexture(key, t, t);
    g.destroy();
  }

  /** Props that sit flush with the floor (decals) skip the drop shadow every
   *  other prop gets to read as a raised object. */
  private static readonly FLUSH_PROPS: ReadonlySet<PropKind> = new Set([
    "drain",
    "crack",
    "cable",
  ]);

  /**
   * Small scattered set-dressing prop — pure decoration (no collider),
   * two per style (see {@link STYLE_PROPS}), scattered sparsely across floor
   * tiles by MainScene. Gives each level a bit of "someone/something was
   * here" texture beyond the walls and floor.
   */
  private makeProp(key: string, kind: PropKind, c: StyleColorSet): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const t = TILE_SIZE;

    if (!PreloadScene.FLUSH_PROPS.has(kind)) {
      g.fillStyle(COLORS.shadow, 0.25);
      g.fillEllipse(t / 2, t - 8, 16, 4);
    }

    switch (kind) {
      case "chair":
        // An overturned chair — seat on its side, legs splayed.
        this.rr(g, COLORS.propWood, 8, 13, 15, 6, 1);
        this.rr(g, COLORS.propWoodDark, 20, 7, 5, 14, 1);
        this.px(g, COLORS.propWoodDark, 6, 12, 1, 8, 0.8);
        this.px(g, COLORS.propWoodDark, 22, 20, 1, 7, 0.8);
        this.px(g, COLORS.propWoodDark, 12, 20, 1, 6, 0.8);
        break;
      case "boxes":
        // A small stack of taped cardboard boxes.
        this.rr(g, COLORS.propCardboard, 7, 9, 13, 11, 1);
        this.px(g, COLORS.propCardboardDark, 7, 13, 13, 1, 0.7);
        this.px(g, COLORS.propCardboardDark, 12, 9, 1, 11, 0.5);
        this.rr(g, COLORS.propCardboard, 17, 16, 9, 8, 1);
        this.px(g, COLORS.propCardboardDark, 17, 19, 9, 1, 0.7);
        break;
      case "crate":
        // A wooden crate, top-down, cross-planked lid.
        this.rr(g, COLORS.propWood, 8, 8, 17, 17, 1);
        this.px(g, COLORS.propWoodDark, 8, 8, 17, 2, 0.6);
        this.px(g, COLORS.propWoodDark, 8, 23, 17, 2, 0.6);
        this.px(g, COLORS.propWoodDark, 9, 9, 2, 15, 0.5);
        this.px(g, COLORS.propWoodDark, 22, 9, 2, 15, 0.5);
        break;
      case "barrel": {
        // A metal drum, top-down: rings and a rusted band.
        g.fillStyle(COLORS.propMetal, 1);
        g.fillEllipse(16, 17, 16, 15);
        g.fillStyle(COLORS.propMetalDark, 1);
        g.fillEllipse(16, 17, 10, 9);
        g.lineStyle(2, c.accent, 0.8);
        g.strokeEllipse(16, 17, 14, 13);
        break;
      }
      case "valve": {
        // A pipe valve wheel bolted to the floor — spokes around a rusted hub.
        g.fillStyle(COLORS.propMetal, 1);
        g.fillEllipse(16, 17, 15, 14);
        g.lineStyle(2, COLORS.propMetalDark, 0.9);
        g.strokeEllipse(16, 17, 15, 14);
        const spokes: Array<[number, number]> = [
          [0, -6],
          [0, 6],
          [-6, 0],
          [6, 0],
        ];
        for (const [dx, dy] of spokes) {
          this.px(g, COLORS.propMetalDark, 16 + dx - 1, 17 + dy - 1, 2, 2, 0.8);
        }
        g.fillStyle(c.accent, 1);
        g.fillEllipse(16, 17, 5, 5);
        break;
      }
      case "pipecart": {
        // A low handcart loaded with spare pipe segments.
        this.rr(g, COLORS.propMetalDark, 7, 18, 18, 6, 1);
        this.px(g, COLORS.propMetal, 9, 25, 3, 3, 1);
        this.px(g, COLORS.propMetal, 20, 25, 3, 3, 1);
        for (const px of [9, 15, 21]) {
          this.px(g, c.accent, px, 9, 5, 9, 1);
          this.px(g, c.accent2, px, 9, 5, 2, 0.6);
        }
        break;
      }
      case "drain": {
        // A flush floor drain grate.
        g.fillStyle(c.accent2, 0.5);
        g.fillEllipse(16, 16, 15, 15);
        g.fillStyle(COLORS.propMetalDark, 1);
        g.fillEllipse(16, 16, 12, 12);
        for (let i = 0; i < 4; i++) {
          this.px(g, COLORS.propMetal, 11, 12 + i * 3, 10, 1, 0.7);
        }
        break;
      }
      case "crack": {
        // A flush hairline floor crack with a faint algae tinge.
        const pts: Array<[number, number]> = [
          [6, 8],
          [10, 13],
          [8, 18],
          [14, 23],
          [12, 28],
        ];
        for (let i = 0; i < pts.length - 1; i++) {
          const [x0, y0] = pts[i]!;
          const [x1, y1] = pts[i + 1]!;
          const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
          for (let s = 0; s <= steps; s++) {
            const x = Math.round(x0 + ((x1 - x0) * s) / steps);
            const y = Math.round(y0 + ((y1 - y0) * s) / steps);
            this.px(g, c.wallDark, x, y, 1, 1, 0.55);
          }
        }
        g.fillStyle(c.accent, 0.18);
        g.fillEllipse(18, 20, 10, 14);
        break;
      }
      case "sign": {
        // A yellow hazard sign leaning against a support pole.
        this.px(g, COLORS.propMetalDark, 15, 10, 2, 18, 1);
        g.fillStyle(COLORS.propSignBg, 1);
        g.fillTriangle(16, 6, 8, 20, 24, 20);
        g.fillStyle(COLORS.propSignDark, 1);
        this.px(g, COLORS.propSignDark, 15, 11, 2, 6, 1);
        this.px(g, COLORS.propSignDark, 15, 18, 2, 2, 1);
        break;
      }
      case "scorchpile": {
        // A charred, blackened debris pile with a few glowing embers.
        this.rr(g, COLORS.propSignDark, 8, 17, 16, 8, 0.95);
        this.rr(g, c.wallDark, 11, 13, 11, 7, 0.9);
        this.px(g, c.accent, 14, 18, 1, 1, 0.9);
        this.px(g, c.accent, 18, 20, 1, 1, 0.8);
        this.px(g, c.accent, 12, 22, 1, 1, 0.7);
        break;
      }
      case "luggage": {
        // An abandoned steamer trunk, straps still buckled — its owner
        // checked in and never out.
        this.rr(g, COLORS.propWood, 7, 12, 18, 13, 1);
        this.px(g, COLORS.propWoodDark, 7, 17, 18, 1, 0.8);
        this.px(g, c.accent, 11, 12, 2, 13, 0.9);
        this.px(g, c.accent, 19, 12, 2, 13, 0.9);
        this.px(g, c.accent, 15, 16, 3, 3, 1);
        this.px(g, COLORS.propWoodDark, 7, 12, 18, 1, 0.6);
        break;
      }
      case "lamp": {
        // A toppled floor lamp, shade down, bulb long dead.
        this.px(g, COLORS.propMetalDark, 8, 20, 14, 2, 1);
        g.fillStyle(COLORS.propMetalDark, 1);
        g.fillEllipse(9, 21, 4, 4);
        g.fillStyle(c.accent, 0.9);
        g.fillTriangle(21, 15, 28, 19, 22, 26);
        this.px(g, COLORS.propSignDark, 23, 19, 3, 2, 0.6);
        break;
      }
      case "fusebox": {
        // A floor-mounted breaker cabinet, door ajar, one dead indicator.
        this.rr(g, COLORS.propMetal, 9, 8, 14, 18, 1);
        this.px(g, COLORS.propMetalDark, 9, 8, 14, 2, 0.8);
        this.px(g, COLORS.propMetalDark, 15, 10, 1, 16, 0.7);
        for (let i = 0; i < 4; i++) {
          this.px(g, COLORS.propMetalDark, 17, 11 + i * 3, 4, 2, 0.9);
        }
        this.px(g, c.accent, 11, 11, 2, 2, 0.8);
        this.px(g, COLORS.propSignDark, 11, 15, 2, 2, 0.9);
        break;
      }
      case "cable": {
        // A flush spill of severed cable runs snaking across the plate floor.
        const runs: Array<[number, number, number, number]> = [
          [4, 12, 26, 3],
          [8, 18, 22, -2],
          [6, 24, 24, 4],
        ];
        for (const [x0, y0, len, drift] of runs) {
          for (let i = 0; i < len; i++) {
            const y = Math.round(y0 + (drift * i) / len);
            this.px(g, COLORS.propMetalDark, x0 + i, y, 1, 2, 0.9);
          }
        }
        this.px(g, c.accent, 28, 14, 2, 2, 0.8);
        this.px(g, c.accent, 4, 27, 2, 2, 0.7);
        break;
      }
      case "mailbox": {
        // A kerbside mailbox on a wooden post, flag up. Nobody delivers
        // here, but somehow it's never empty.
        this.px(g, COLORS.propWoodDark, 15, 14, 2, 14, 1);
        this.rr(g, COLORS.propMetal, 9, 8, 14, 8, 1);
        this.px(g, COLORS.propMetalDark, 9, 8, 14, 2, 0.6);
        this.px(g, COLORS.propMetalDark, 21, 10, 2, 4, 0.8);
        // The little red flag, raised.
        this.px(g, 0xc0392e, 7, 6, 2, 6, 1);
        this.px(g, 0xc0392e, 7, 6, 4, 2, 1);
        break;
      }
      case "hedge": {
        // A squat trimmed hedge block — suburban topiary, kept neat by no
        // one. The clippings underneath are always fresh.
        this.rr(g, 0x2e4428, 6, 10, 20, 14, 1);
        this.px(g, 0x3e5a34, 8, 11, 6, 3, 0.8);
        this.px(g, 0x3e5a34, 18, 13, 5, 2, 0.7);
        this.px(g, 0x1c2c18, 7, 20, 18, 3, 0.7);
        this.px(g, 0x3e5a34, 12, 24, 3, 1, 0.5);
        this.px(g, 0x3e5a34, 20, 25, 3, 1, 0.5);
        break;
      }
      case "balloon": {
        // A cluster of three balloons tied to a weight — still buoyant, the
        // ribbon still taut. They've been "fresh" for a very long time.
        this.px(g, COLORS.propMetalDark, 15, 24, 3, 3, 1);
        this.px(g, COLORS.propWoodDark, 16, 12, 1, 12, 0.6);
        this.px(g, COLORS.propWoodDark, 12, 14, 1, 10, 0.5);
        this.px(g, COLORS.propWoodDark, 20, 14, 1, 10, 0.5);
        g.fillStyle(0xd0568e, 1);
        g.fillEllipse(11, 9, 8, 10);
        g.fillStyle(0x4a8ec4, 1);
        g.fillEllipse(21, 8, 8, 10);
        g.fillStyle(0xe4c94a, 1);
        g.fillEllipse(16, 5, 7, 9);
        this.px(g, 0xffffff, 9, 6, 2, 2, 0.5);
        this.px(g, 0xffffff, 19, 5, 2, 2, 0.5);
        break;
      }
      case "cake": {
        // A pristine slice of sheet cake on a paper plate, one candle lit.
        // It is always fresh. That is the problem.
        g.fillStyle(0xe8e4dc, 1);
        g.fillEllipse(16, 22, 20, 8);
        this.rr(g, 0xe8b0c8, 9, 12, 14, 9, 1);
        this.px(g, 0xc94a72, 9, 15, 14, 2, 0.9);
        this.px(g, 0xfff2f6, 9, 12, 14, 2, 0.9);
        this.px(g, 0xf2e28a, 15, 6, 2, 6, 1);
        this.px(g, 0xffc23a, 15, 4, 2, 2, 1);
        this.px(g, 0xfff6cf, 15.5, 3, 1, 1, 0.9);
        break;
      }
    }

    g.generateTexture(key, t, t);
    g.destroy();
  }

  /**
   * The Almond Water pickup — a small glowing bottle, the Backrooms survival
   * staple. Deliberately bright against every level's palette so it always
   * reads as "notice me", with a soft pulsing halo baked in at low alpha
   * (the scene layers a live tween on top for the actual pulse).
   */
  private makeAlmondWater(key: string): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const t = TILE_SIZE;

    g.fillStyle(COLORS.almondGlow, 0.25);
    g.fillEllipse(t / 2, t / 2 + 2, 20, 20);
    g.fillStyle(COLORS.shadow, 0.3);
    g.fillEllipse(t / 2, t - 7, 10, 3);

    // Bottle body, neck, and a splash of liquid visible through the glass.
    this.rr(g, COLORS.almondGlass, 12, 12, 8, 14, 1);
    this.px(g, COLORS.almondGlassHi, 13, 13, 2, 12, 0.6);
    this.px(g, COLORS.almondGlass, 14, 6, 4, 7, 1);
    this.px(g, COLORS.almondLabel, 12, 18, 8, 4, 0.9);
    this.px(g, COLORS.almondLiquid, 13, 20, 6, 5, 0.85);
    this.px(g, COLORS.propMetalDark, 13, 5, 6, 2, 1);

    g.generateTexture(key, t, t);
    g.destroy();
  }

  /**
   * The Flashlight pickup — a small handheld torch, its lens glowing bright
   * against every level's palette so the single spawn always reads as
   * "notice me" (same "rare pickup" language as {@link makeAlmondWater}).
   * Reused at hotbar scale once equipped, so world icon and UI icon always
   * match exactly.
   */
  private makeFlashlight(key: string): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const t = TILE_SIZE;

    g.fillStyle(COLORS.almondGlow, 0.22);
    g.fillEllipse(t / 2, t / 2, 22, 22);
    g.fillStyle(COLORS.shadow, 0.3);
    g.fillEllipse(t / 2, t - 7, 10, 3);

    // Barrel, grip toward the bottom.
    this.rr(g, COLORS.propMetal, 11, 9, 9, 17, 1);
    this.px(g, COLORS.propMetalDark, 11, 9, 9, 2, 0.7);
    this.px(g, COLORS.propMetalDark, 11, 22, 9, 2, 0.6);
    this.px(g, COLORS.propMetal, 12, 12, 2, 10, 0.5);
    this.px(g, COLORS.propMetalDark, 13, 15, 5, 5, 0.3);

    // Lens, bright with a soft outer bloom.
    g.fillStyle(0xffe27a, 0.55);
    g.fillEllipse(15.5, 8, 12, 9);
    g.fillStyle(0xfff6cf, 1);
    g.fillEllipse(15.5, 8, 8, 6);

    g.generateTexture(key, t, t);
    g.destroy();
  }

  /** A found letter — a folded, slightly curled sheet of paper, pale against
   *  every level's palette so it reads as "not part of the room" at a glance
   *  (same "notice me" language as {@link makeAlmondWater}). */
  private makeLoreLetter(key: string): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const t = TILE_SIZE;

    g.fillStyle(COLORS.almondGlow, 0.16);
    g.fillEllipse(t / 2, t / 2 + 2, 20, 20);
    g.fillStyle(COLORS.shadow, 0.28);
    g.fillEllipse(t / 2, t - 7, 9, 3);

    // Folded paper sheet, dog-eared corner, a few scrawled lines.
    this.rr(g, COLORS.almondLabel, 9, 8, 15, 18, 1);
    g.fillStyle(COLORS.propCardboardDark, 0.5);
    g.fillTriangle(20, 8, 24, 8, 24, 12);
    this.px(g, COLORS.propWoodDark, 12, 13, 9, 1, 0.6);
    this.px(g, COLORS.propWoodDark, 12, 16, 9, 1, 0.6);
    this.px(g, COLORS.propWoodDark, 12, 19, 6, 1, 0.6);

    g.generateTexture(key, t, t);
    g.destroy();
  }

  /** A found book / torn field-guide page — thicker than a letter, with a
   *  visible spine, so it reads as distinct from the single-sheet letter. */
  private makeLoreBook(key: string): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const t = TILE_SIZE;

    g.fillStyle(COLORS.almondGlow, 0.16);
    g.fillEllipse(t / 2, t / 2 + 2, 20, 20);
    g.fillStyle(COLORS.shadow, 0.3);
    g.fillEllipse(t / 2, t - 7, 10, 3);

    // Closed book: dark cover, pale page edges, a bound spine down the middle.
    this.rr(g, COLORS.propWoodDark, 8, 8, 17, 18, 1);
    this.px(g, COLORS.almondLabel, 10, 9, 4, 16, 0.9);
    this.px(g, COLORS.almondLabel, 20, 9, 3, 16, 0.9);
    this.px(g, COLORS.propWood, 15, 8, 3, 18, 1);
    this.px(g, COLORS.propWoodDark, 15, 8, 1, 18, 0.7);

    g.generateTexture(key, t, t);
    g.destroy();
  }

  /** Adapts a Phaser Graphics into the engine-agnostic {@link PaintSurface}
   *  the shared player sprite painter draws onto — the same painter the
   *  skin-selector's DOM-canvas preview uses, so they can never drift. */
  private paintSurfaceFor(g: Phaser.GameObjects.Graphics): PaintSurface {
    return {
      px: (color, x, y, w = 1, h = 1, alpha = 1) =>
        this.px(g, color, x, y, w, h, alpha),
      rr: (color, x, y, w, h, alpha = 1) =>
        this.rr(g, color, x, y, w, h, alpha),
      ellipse: (color, cx, cy, w, h, alpha = 1) => {
        g.fillStyle(color, alpha);
        g.fillEllipse(cx, cy, w, h);
      },
    };
  }

  /** Bakes one player-skin frame from the shared sprite painter (see
   *  `game/skins/spritePainter.ts` for the actual drawing). */
  private makePlayer(
    key: string,
    facing: Facing,
    stride: boolean,
    palette: PlayerPalette,
    accessory: AccessoryKind,
  ): void {
    const s = PLAYER.size;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    paintPlayerSprite(
      this.paintSurfaceFor(g),
      facing,
      stride,
      palette,
      accessory,
    );
    g.generateTexture(key, s, s);
    g.destroy();
  }

  /**
   * One baked frame of a monster art set (see {@link MonsterArt}): every
   * distinct entity gets its own hand-drawn silhouette instead of one shared
   * sprite recoloured per kind. `facing`/`stride` mirror the player's
   * front/back × idle/walk frame scheme.
   */
  private makeMonsterArt(
    key: string,
    art: MonsterArt,
    facing: Facing,
    stride: boolean,
  ): void {
    const s = MONSTER.size;
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Contact shadow, grounding it against the floor — shared by every art.
    g.fillStyle(COLORS.shadow, 0.35);
    g.fillEllipse(s / 2, s - 1, s - 10, 4);

    switch (art) {
      case "gaunt":
        this.drawGaunt(g, s, facing, stride);
        break;
      case "hound":
        this.drawHound(g, s, facing, stride);
        break;
      case "smiler":
        this.drawSmiler(g, s, facing, stride);
        break;
      case "faceling":
        this.drawFaceling(g, s, facing, stride);
        break;
      case "skinstealer":
        this.drawSkinStealer(g, s, facing, stride);
        break;
      case "deathmoth":
        this.drawDeathmoth(g, s, facing, stride);
        break;
      case "duller":
        this.drawDuller(g, s, facing, stride);
        break;
      case "wretch":
        this.drawWretch(g, s, facing, stride);
        break;
      case "partygoer":
        this.drawPartygoer(g, s, facing, stride);
        break;
      case "watcher":
        this.drawWatcher(g, s, facing, stride);
        break;
      case "clump":
        this.drawClump(g, s, facing, stride);
        break;
      case "beast":
        this.drawBeast(g, s, facing, stride);
        break;
    }

    g.generateTexture(key, s, s);
    g.destroy();
  }

  /**
   * The gaunt lurker (also worn by the pursuer, hotter-tinted): a pale thing
   * with an oversized bald skull, huge black eye-sockets and a wide jagged
   * grin, on a scrawny ribbed torso with long spindly arms hanging past its
   * knees. `facing` swaps the face (front) for a faceless bald dome with a
   * spine ridge (back); `stride` offsets its arms/legs into a lurching
   * mid-step pose.
   */
  private drawGaunt(
    g: Phaser.GameObjects.Graphics,
    s: number,
    facing: Facing,
    stride: boolean,
  ): void {
    // Long, two-jointed arms hanging well past the knees, bent outward at
    // the elbow — offset opposite ways for the stride frame so the lurch
    // reads as alternating steps. Drawn before the torso so the shoulders
    // overlap them.
    const limbShift = stride ? 1 : 0;
    this.px(g, COLORS.monsterLimb, 7, 15 - limbShift, 3, 10); // left upper arm
    this.px(g, COLORS.monsterLimb, 4, 24 - limbShift, 3, 11); // left forearm
    this.px(g, COLORS.monsterLimb, s - 10, 15 + limbShift, 3, 10); // right upper arm
    this.px(g, COLORS.monsterLimb, s - 7, 24 + limbShift, 3, 11); // right forearm
    // Long-fingered clawed hands at the end of each arm.
    this.px(g, COLORS.monsterBodyShade, 2, 34 - limbShift, 5, 3, 0.9);
    this.px(g, COLORS.monsterBodyShade, s - 7, 34 + limbShift, 5, 3, 0.9);
    for (let i = 0; i < 3; i++) {
      this.px(g, COLORS.monsterEyeGlow, 2 + i * 2, 37 - limbShift, 1, 2, 0.7);
      this.px(
        g,
        COLORS.monsterEyeGlow,
        s - 7 + i * 2,
        37 + limbShift,
        1,
        2,
        0.7,
      );
    }

    // Bald, oversized skull.
    this.rr(g, COLORS.playerOutline, 8, 0, 24, 16, 1);
    this.rr(g, COLORS.monsterBody, 9, 1, 22, 14, 1);
    this.px(g, COLORS.monsterBodyHi, 10, 1, 3, 10, 0.45);
    this.px(g, COLORS.monsterBodyShade, 27, 1, 3, 14, 0.7);

    if (facing === "front") {
      // Huge black eye-sockets, sunk into the skull with a soft dark rim.
      this.px(g, COLORS.monsterEyeGlow, 11, 3, 9, 11, 0.35);
      this.px(g, COLORS.monsterEyeGlow, 20, 3, 9, 11, 0.35);
      this.rr(g, COLORS.monsterEye, 12, 4, 7, 10, 1);
      this.rr(g, COLORS.monsterEye, 21, 4, 7, 10, 1);

      // Wide jagged grin, interlocking teeth top and bottom.
      this.px(g, COLORS.monsterMawShade, 11, 13, 18, 5, 1);
      for (let i = 0; i < 5; i++) {
        this.px(g, COLORS.monsterMaw, 11 + i * 4, 13, 2, 2);
      }
      for (let i = 0; i < 4; i++) {
        this.px(g, COLORS.monsterMaw, 13 + i * 4, 16, 2, 2);
      }
    } else {
      // Faceless bald dome: a ridge of jagged bumps down the back instead.
      for (let i = 0; i < 3; i++) {
        this.rr(g, COLORS.monsterBodyShade, 14 + i * 5, 3 + i, 4, 4, 0.7);
      }
    }

    // Neck, bridging the skull down into the torso.
    this.px(g, COLORS.monsterBodyShade, 17, 15, 6, 3, 0.5);

    // Gaunt ribbed torso — narrower than the skull to sell the scrawny frame.
    this.rr(g, COLORS.playerOutline, 13, 15, 14, 15, 1);
    this.rr(g, COLORS.monsterBody, 14, 16, 12, 12, 1);
    this.px(g, COLORS.monsterBodyHi, 14, 16, 2, 12, 0.35);
    for (let i = 0; i < 4; i++) {
      this.px(g, COLORS.monsterBodyShade, 15, 18 + i * 2, 9, 1, 0.4);
    }

    if (facing === "back") {
      // Spine ridge continuing down from the skull bumps.
      for (let i = 0; i < 3; i++) {
        this.rr(g, COLORS.monsterBodyShade, 17, 18 + i * 3, 6, 2, 0.5);
      }
    }

    // Thin, slightly bent legs, split so the stride frame can offset them
    // into a mid-step.
    this.rr(g, COLORS.playerOutline, 13, 27, 14, 13, 1);
    this.rr(g, COLORS.monsterBody, 15, 28 - limbShift, 4, 10, 1);
    this.rr(g, COLORS.monsterBody, 21, 28 + limbShift, 4, 10, 1);
    this.px(g, COLORS.monsterBodyShade, 24, 29 + limbShift, 1, 9, 0.5);
    // Small feet.
    this.px(g, COLORS.monsterBodyShade, 14, 37 - limbShift, 6, 2, 0.6);
    this.px(g, COLORS.monsterBodyShade, 20, 37 + limbShift, 6, 2, 0.6);
  }

  /**
   * The Hound: a head-on hunting quadruped — broad low skull between hunched
   * shoulder blades, glowing eyes, bared teeth, four legs planted wide. Back
   * view swaps the face for haunches and a whip of tail.
   */
  private drawHound(
    g: Phaser.GameObjects.Graphics,
    _s: number,
    facing: Facing,
    stride: boolean,
  ): void {
    const shift = stride ? 1 : 0;

    // Shoulder mass — hunched higher than the skull, wolf-like.
    this.rr(g, COLORS.playerOutline, 5, 10, 30, 18, 1);
    this.rr(g, COLORS.monsterLimb, 6, 11, 28, 16, 1);
    this.px(g, COLORS.monsterBodyHi, 8, 11, 4, 3, 0.4);
    this.px(g, COLORS.monsterBodyShade, 7, 22, 26, 4, 0.5);

    if (facing === "front") {
      // Low-slung skull pushed forward beneath the shoulder line.
      this.rr(g, COLORS.playerOutline, 11, 14, 18, 13, 1);
      this.rr(g, COLORS.monsterBody, 12, 15, 16, 11, 1);
      // Pinned-back ears.
      g.fillStyle(COLORS.monsterBody, 1);
      g.fillTriangle(10, 15, 14, 10, 16, 15);
      g.fillTriangle(24, 15, 26, 10, 30, 15);
      // Glowing narrowed eyes.
      this.px(g, COLORS.monsterMaw, 14, 18, 3, 2, 0.95);
      this.px(g, COLORS.monsterMaw, 23, 18, 3, 2, 0.95);
      this.px(g, COLORS.monsterEye, 15, 18, 1, 2, 1);
      this.px(g, COLORS.monsterEye, 24, 18, 1, 2, 1);
      // Muzzle and bared interlocking teeth.
      this.px(g, COLORS.monsterBodyShade, 16, 21, 8, 5, 1);
      this.px(g, COLORS.monsterMawShade, 15, 23, 10, 3, 1);
      for (let i = 0; i < 4; i++) {
        this.px(g, COLORS.monsterMaw, 15 + i * 3, 23, 1, 2);
      }
    } else {
      // Rear view: haunches, spine ridge, and a low whip of tail.
      this.px(g, COLORS.monsterBodyShade, 19, 11, 2, 16, 0.7);
      for (let i = 0; i < 4; i++) {
        this.px(g, COLORS.monsterBodyShade, 18, 12 + i * 4, 4, 2, 0.6);
      }
      this.px(g, COLORS.monsterLimb, 18 + shift * 2, 26, 2, 8, 1);
      this.px(g, COLORS.monsterLimb, 19 + shift * 2, 33, 4, 2, 0.9);
    }

    // Four planted legs, opposite pairs offset for the stride frame.
    this.px(g, COLORS.monsterLimb, 7, 27 - shift, 4, 11, 1);
    this.px(g, COLORS.monsterLimb, 29, 27 + shift, 4, 11, 1);
    this.px(g, COLORS.monsterLimb, 13, 29 + shift, 4, 9, 1);
    this.px(g, COLORS.monsterLimb, 23, 29 - shift, 4, 9, 1);
    // Claws.
    this.px(g, COLORS.monsterBodyShade, 7, 37 - shift, 4, 2, 0.8);
    this.px(g, COLORS.monsterBodyShade, 29, 37 + shift, 4, 2, 0.8);
  }

  /**
   * The Smiler: barely a body at all — a smear of dark that the fog reads as
   * shadow, under two glowing eyes and the huge luminous grin that IS the
   * entity. The back view is almost nothing: the grin's glow faintly leaking
   * around a black silhouette, which is exactly why you check twice.
   */
  private drawSmiler(
    g: Phaser.GameObjects.Graphics,
    s: number,
    facing: Facing,
    stride: boolean,
  ): void {
    const sway = stride ? 1 : 0;

    // The dark mass — layered soft blobs, no hard silhouette.
    g.fillStyle(COLORS.monsterEye, 0.55);
    g.fillEllipse(s / 2, 22, 24, 30);
    g.fillStyle(COLORS.monsterEye, 0.75);
    g.fillEllipse(s / 2, 18 + sway, 18, 22);

    if (facing === "front") {
      // Wide upturned crescent grin — rows of too-many teeth.
      this.px(g, MART.smilerGrin, 9, 20 + sway, 22, 3, 0.95);
      this.px(g, MART.smilerGrin, 7, 18 + sway, 3, 3, 0.85);
      this.px(g, MART.smilerGrin, 30, 18 + sway, 3, 3, 0.85);
      // Tooth separations.
      for (let i = 0; i < 7; i++) {
        this.px(g, COLORS.monsterEye, 10 + i * 3, 20 + sway, 1, 3, 0.8);
      }
      // Glowing lidless eyes, set wide and high.
      g.fillStyle(MART.smilerEye, 0.95);
      g.fillEllipse(13, 10 + sway, 6, 5);
      g.fillEllipse(27, 10 + sway, 6, 5);
      g.fillStyle(COLORS.monsterEye, 1);
      g.fillEllipse(13, 10 + sway, 2, 2);
      g.fillEllipse(27, 10 + sway, 2, 2);
    } else {
      // From behind: only the grin-glow bleeding around the dark.
      this.px(g, MART.smilerGrin, 8, 19 + sway, 2, 2, 0.35);
      this.px(g, MART.smilerGrin, 30, 19 + sway, 2, 2, 0.35);
      this.px(g, MART.smilerEye, 10, 9 + sway, 2, 2, 0.3);
      this.px(g, MART.smilerEye, 28, 9 + sway, 2, 2, 0.3);
    }
  }

  /**
   * The Faceling: the most person-shaped thing in here — neat dark suit,
   * upright posture, hands folded at its sides — with a smooth featureless
   * blank where a face should be. The wrongness is the politeness.
   */
  private drawFaceling(
    g: Phaser.GameObjects.Graphics,
    s: number,
    facing: Facing,
    stride: boolean,
  ): void {
    const shift = stride ? 1 : 0;

    // Head: a smooth pale oval, outlined.
    g.fillStyle(COLORS.playerOutline, 1);
    g.fillEllipse(s / 2, 9, 16, 15);
    g.fillStyle(COLORS.monsterBody, 1);
    g.fillEllipse(s / 2, 9, 14, 13);
    this.px(g, COLORS.monsterBodyHi, 15, 4, 4, 3, 0.4);
    if (facing === "front") {
      // No features at all — just a faint shading where eyes would sit.
      this.px(g, COLORS.monsterBodyShade, 14, 8, 12, 1, 0.25);
    } else {
      // The back of the head is identical to the front. That's the point.
      this.px(g, COLORS.monsterBodyShade, 14, 9, 12, 1, 0.18);
    }

    // Suit torso: narrow shoulders, straight lines, a shirt-collar V.
    this.rr(g, COLORS.playerOutline, 11, 15, 18, 15, 1);
    this.rr(g, MART.facelingSuit, 12, 16, 16, 13, 1);
    this.px(g, MART.facelingSuitHi, 13, 16, 2, 12, 0.5);
    if (facing === "front") {
      g.fillStyle(COLORS.monsterBody, 1);
      g.fillTriangle(18, 16, 22, 16, 20, 21);
      this.px(g, MART.facelingSuit, 19.5, 17, 1, 4, 1);
    } else {
      this.px(g, COLORS.playerOutline, 19.5, 16, 1, 13, 0.5);
    }
    // Arms held unnaturally straight at the sides, pale hands.
    this.px(g, MART.facelingSuit, 9, 17, 3, 12 - shift, 1);
    this.px(g, MART.facelingSuit, 28, 17, 3, 12 + shift, 1);
    this.px(g, COLORS.monsterBody, 9, 28 - shift, 3, 3, 1);
    this.px(g, COLORS.monsterBody, 28, 28 + shift, 3, 3, 1);

    // Pressed suit trousers, small neat steps.
    this.rr(g, COLORS.playerOutline, 13, 29, 14, 11, 1);
    this.rr(g, MART.facelingSuit, 14, 30 - shift, 5, 9, 1);
    this.rr(g, MART.facelingSuit, 21, 30 + shift, 5, 9, 1);
    this.px(g, COLORS.playerOutline, 14, 38 - shift, 5, 2, 0.8);
    this.px(g, COLORS.playerOutline, 21, 38 + shift, 5, 2, 0.8);
  }

  /**
   * The Skin-Stealer: wearing a person that doesn't fit — fleshy hide
   * crossed by dark stitch seams, a too-long neck, and small sunken eyes
   * that sit at the wrong depth. Back view: one long seam down the spine,
   * laced shut.
   */
  private drawSkinStealer(
    g: Phaser.GameObjects.Graphics,
    s: number,
    facing: Facing,
    stride: boolean,
  ): void {
    const shift = stride ? 1 : 0;

    // Too-long neck first, so the head overlaps it.
    this.px(g, COLORS.monsterBody, 17, 12, 6, 7, 1);
    this.px(g, MART.fleshSeam, 18, 13, 1, 5, 0.6);

    // Head: slightly deflated oval — a mask more than a skull.
    g.fillStyle(COLORS.playerOutline, 1);
    g.fillEllipse(s / 2, 8, 17, 14);
    g.fillStyle(COLORS.monsterBody, 1);
    g.fillEllipse(s / 2, 8, 15, 12);
    if (facing === "front") {
      // Sunken pinprick eyes, set too close; a stitched-flat mouth.
      this.px(g, COLORS.monsterEye, 16, 7, 2, 2, 1);
      this.px(g, COLORS.monsterEye, 22, 7, 2, 2, 1);
      this.px(g, COLORS.monsterBodyShade, 15, 6, 4, 1, 0.5);
      this.px(g, COLORS.monsterBodyShade, 21, 6, 4, 1, 0.5);
      this.px(g, MART.stitch, 15, 11, 10, 1, 0.9);
      for (let i = 0; i < 5; i++) {
        this.px(g, MART.stitch, 15 + i * 2, 10, 1, 3, 0.5);
      }
      // A seam across the brow where the face was pulled on.
      this.px(g, MART.fleshSeam, 13, 4, 14, 1, 0.7);
    } else {
      // Laced spine seam from crown to collar.
      this.px(g, MART.stitch, 19.5, 3, 1, 11, 0.9);
      for (let i = 0; i < 4; i++) {
        this.px(g, MART.stitch, 18, 4 + i * 3, 4, 1, 0.6);
      }
    }

    // Torso: loose hide with visible seams, slightly baggy at the waist.
    this.rr(g, COLORS.playerOutline, 12, 17, 16, 14, 1);
    this.rr(g, COLORS.monsterBody, 13, 18, 14, 12, 1);
    this.px(g, COLORS.monsterBodyHi, 13, 18, 2, 12, 0.35);
    if (facing === "front") {
      this.px(g, MART.fleshSeam, 16, 19, 1, 10, 0.7);
      this.px(g, MART.fleshSeam, 24, 20, 1, 9, 0.6);
      this.px(g, MART.stitch, 15, 23, 10, 1, 0.7);
    } else {
      this.px(g, MART.stitch, 19.5, 18, 1, 12, 0.9);
      for (let i = 0; i < 4; i++) {
        this.px(g, MART.stitch, 18, 19 + i * 3, 4, 1, 0.6);
      }
    }
    // Arms — a little too long, wrists past the hips.
    this.px(g, COLORS.monsterLimb, 9, 18 - shift, 3, 14, 1);
    this.px(g, COLORS.monsterLimb, 28, 18 + shift, 3, 14, 1);
    this.px(g, COLORS.monsterBodyShade, 9, 31 - shift, 3, 3, 0.9);
    this.px(g, COLORS.monsterBodyShade, 28, 31 + shift, 3, 3, 0.9);

    // Legs, hide sagging over the knees.
    this.rr(g, COLORS.playerOutline, 13, 30, 14, 10, 1);
    this.rr(g, COLORS.monsterBody, 14, 31 - shift, 5, 8, 1);
    this.rr(g, COLORS.monsterBody, 21, 31 + shift, 5, 8, 1);
    this.px(g, MART.fleshSeam, 16, 33 - shift, 1, 5, 0.5);
    this.px(g, MART.fleshSeam, 23, 33 + shift, 1, 5, 0.5);
  }

  /**
   * The Deathmoth: a fat furred thorax between two broad patterned wings —
   * drawn wings-spread from above, since it flutters rather than walks. The
   * stride frame beats the wings inward for a cheap two-frame flap.
   */
  private drawDeathmoth(
    g: Phaser.GameObjects.Graphics,
    s: number,
    facing: Facing,
    stride: boolean,
  ): void {
    // Wing beat: idle = fully spread, stride = pulled in and up.
    const spread = stride ? 3 : 0;

    // Wings — big soft triangles with dark eye-spots.
    g.fillStyle(MART.mothWing, 0.95);
    g.fillTriangle(2 + spread, 10, 18, 16, 8 + spread, 30);
    g.fillTriangle(38 - spread, 10, 22, 16, 32 - spread, 30);
    g.fillStyle(MART.mothWingSpot, 0.8);
    g.fillEllipse(10 + spread, 17, 5, 4);
    g.fillEllipse(30 - spread, 17, 5, 4);
    g.fillStyle(MART.mothWing, 0.6);
    g.fillTriangle(6 + spread, 26, 18, 22, 12 + spread, 36);
    g.fillTriangle(34 - spread, 26, 22, 22, 28 - spread, 36);

    // Furred thorax/abdomen down the middle.
    g.fillStyle(COLORS.playerOutline, 1);
    g.fillEllipse(s / 2, 22, 10, 22);
    g.fillStyle(MART.mothBody, 1);
    g.fillEllipse(s / 2, 22, 8, 20);
    for (let i = 0; i < 5; i++) {
      this.px(g, MART.mothWingSpot, 17, 14 + i * 4, 6, 1, 0.5);
    }

    if (facing === "front") {
      // Big dark compound eyes + feathered antennae.
      this.px(g, COLORS.monsterEye, 16, 9, 3, 3, 1);
      this.px(g, COLORS.monsterEye, 21, 9, 3, 3, 1);
      this.px(g, MART.mothBody, 15, 4, 1, 5, 0.9);
      this.px(g, MART.mothBody, 24, 4, 1, 5, 0.9);
      this.px(g, MART.mothBody, 13, 3, 3, 1, 0.7);
      this.px(g, MART.mothBody, 24, 3, 3, 1, 0.7);
    } else {
      // Rear: just the abdomen tip and duller wing spots.
      this.px(g, MART.mothWingSpot, 18, 32, 4, 3, 0.7);
    }
  }

  /**
   * The Duller: too tall and too empty — an elongated featureless head on a
   * drawn-out neck and a narrow drape of a body, arms hanging straight to
   * the knees. It glides (no walk cycle), so the stride frame only sways.
   */
  private drawDuller(
    g: Phaser.GameObjects.Graphics,
    s: number,
    facing: Facing,
    stride: boolean,
  ): void {
    const sway = stride ? 1 : 0;

    // Elongated head, taller than wide.
    g.fillStyle(COLORS.playerOutline, 1);
    g.fillEllipse(s / 2 + sway, 8, 12, 16);
    g.fillStyle(COLORS.monsterBody, 1);
    g.fillEllipse(s / 2 + sway, 8, 10, 14);
    if (facing === "front") {
      // Not eyes — two faint depressions where light stops.
      this.px(g, COLORS.monsterBodyShade, 17 + sway, 7, 2, 3, 0.5);
      this.px(g, COLORS.monsterBodyShade, 21 + sway, 7, 2, 3, 0.5);
    }

    // Drawn-out neck.
    this.px(g, COLORS.monsterBody, 18 + sway, 15, 4, 5, 1);
    this.px(g, COLORS.monsterBodyShade, 20 + sway, 15, 1, 5, 0.5);

    // Narrow draped body, straight-sided, all the way down.
    this.rr(g, COLORS.playerOutline, 13, 19, 14, 21, 1);
    this.rr(g, COLORS.monsterBody, 14, 20, 12, 19, 1);
    this.px(g, COLORS.monsterBodyHi, 14, 20, 2, 18, 0.3);
    this.px(g, COLORS.monsterBodyShade, 24, 20, 2, 19, 0.5);
    if (facing === "back") {
      this.px(g, COLORS.monsterBodyShade, 19.5, 20, 1, 19, 0.6);
    }

    // Stick arms hanging dead straight past the body's edge.
    this.px(g, COLORS.monsterLimb, 11, 20 + sway, 2, 16, 1);
    this.px(g, COLORS.monsterLimb, 27, 20 - sway, 2, 16, 1);
    this.px(g, COLORS.monsterBodyShade, 11, 35 + sway, 2, 3, 0.8);
    this.px(g, COLORS.monsterBodyShade, 27, 35 - sway, 2, 3, 0.8);
  }

  /**
   * The Wretch: what's left of a wanderer — hunched almost horizontal, a
   * high humped spine with the ribs showing through, ruined dark eye-pits,
   * old bloodstains, rags. Back view is the hump and the knuckles of spine.
   */
  private drawWretch(
    g: Phaser.GameObjects.Graphics,
    _s: number,
    facing: Facing,
    stride: boolean,
  ): void {
    const shift = stride ? 1 : 0;

    // The hump: body mass pitched forward, higher than the head.
    g.fillStyle(COLORS.playerOutline, 1);
    g.fillEllipse(22, 16, 24, 20);
    g.fillStyle(COLORS.monsterBody, 1);
    g.fillEllipse(22, 16, 22, 18);
    // Spine knuckles cresting the hump.
    for (let i = 0; i < 4; i++) {
      this.rr(
        g,
        COLORS.monsterBodyShade,
        15 + i * 5,
        6 + Math.abs(i - 1),
        4,
        3,
        0.8,
      );
    }
    // Exposed rib shadows raking the flank.
    for (let i = 0; i < 4; i++) {
      this.px(g, COLORS.monsterBodyShade, 14, 14 + i * 3, 14, 1, 0.55);
    }
    // Old stains, soaked in and dried dark.
    g.fillStyle(MART.wretchBlood, 0.5);
    g.fillEllipse(27, 21, 8, 6);
    g.fillEllipse(16, 24, 5, 4);
    // Rag remnants across the hindquarters.
    this.px(g, MART.wretchRag, 25, 12, 8, 4, 0.8);
    this.px(g, MART.wretchRag, 28, 16, 5, 3, 0.6);

    if (facing === "front") {
      // Head hung low in front of the body, looking up at you.
      g.fillStyle(COLORS.playerOutline, 1);
      g.fillEllipse(12, 25, 15, 13);
      g.fillStyle(COLORS.monsterBody, 1);
      g.fillEllipse(12, 25, 13, 11);
      // Ruined eye-pits — dark, wet, wrong.
      this.px(g, COLORS.monsterEye, 8, 23, 3, 4, 1);
      this.px(g, COLORS.monsterEye, 14, 23, 3, 4, 1);
      this.px(g, MART.wretchBlood, 9, 27, 1, 3, 0.8);
      this.px(g, MART.wretchBlood, 15, 27, 1, 3, 0.8);
      // A slack open jaw.
      this.px(g, COLORS.monsterMawShade, 9, 29, 7, 2, 1);
    } else {
      // From behind, the head is hidden by the hump — only knuckles of
      // spine descending, and the stains.
      for (let i = 0; i < 3; i++) {
        this.rr(g, COLORS.monsterBodyShade, 12 - i * 2, 20 + i * 4, 4, 3, 0.7);
      }
    }

    // Knuckle-walking arms and crouched legs, offset alternately.
    this.px(g, COLORS.monsterLimb, 7, 30 - shift, 3, 8, 1);
    this.px(g, COLORS.monsterLimb, 15, 31 + shift, 3, 7, 1);
    this.px(g, COLORS.monsterLimb, 24, 29 + shift, 4, 9, 1);
    this.px(g, COLORS.monsterLimb, 31, 29 - shift, 4, 9, 1);
    this.px(g, COLORS.monsterBodyShade, 6, 37 - shift, 5, 2, 0.8);
    this.px(g, COLORS.monsterBodyShade, 30, 37 - shift, 6, 2, 0.8);
  }

  /**
   * The Partygoer: bright, soft, and permanently delighted — a big round
   * balloon-smooth head with a painted-on smiley, a cone party hat, stubby
   * arms open for the hug. The one thing in here that's glad to see you.
   */
  private drawPartygoer(
    g: Phaser.GameObjects.Graphics,
    s: number,
    facing: Facing,
    stride: boolean,
  ): void {
    const shift = stride ? 1 : 0;

    // Round soft body.
    g.fillStyle(COLORS.playerOutline, 1);
    g.fillEllipse(s / 2, 27, 22, 20);
    g.fillStyle(MART.partyBody, 1);
    g.fillEllipse(s / 2, 27, 20, 18);
    this.px(g, MART.partyBodyHi, 13, 21, 4, 6, 0.5);
    this.px(g, MART.partyShade, 25, 24, 3, 9, 0.5);

    // Balloon head.
    g.fillStyle(COLORS.playerOutline, 1);
    g.fillEllipse(s / 2, 10, 19, 17);
    g.fillStyle(MART.partyBody, 1);
    g.fillEllipse(s / 2, 10, 17, 15);
    this.px(g, MART.partyBodyHi, 14, 5, 5, 4, 0.6);

    // Cone party hat, tilted jauntily.
    g.fillStyle(MART.partyHat, 1);
    g.fillTriangle(23, 3, 30, -1, 29, 7);
    this.px(g, MART.partyBodyHi, 28, -1, 2, 2, 0.9);

    if (facing === "front") {
      // The painted smiley: dot eyes and a wide, wide curve.
      this.px(g, COLORS.monsterEye, 15, 8, 2, 3, 1);
      this.px(g, COLORS.monsterEye, 23, 8, 2, 3, 1);
      this.px(g, MART.partyMouth, 13, 13, 2, 1, 1);
      this.px(g, MART.partyMouth, 14, 14, 2, 1, 1);
      this.px(g, MART.partyMouth, 15, 15, 10, 1, 1);
      this.px(g, MART.partyMouth, 24, 14, 2, 1, 1);
      this.px(g, MART.partyMouth, 25, 13, 2, 1, 1);
    } else {
      // Featureless from behind — the smile is only ever for you.
      this.px(g, MART.partyShade, 19, 4, 2, 12, 0.3);
    }

    // Stubby arms, spread open in permanent welcome.
    this.px(g, MART.partyBody, 6, 22 - shift, 5, 3, 1);
    this.px(g, MART.partyBody, 29, 22 + shift, 5, 3, 1);
    this.px(g, MART.partyShade, 6, 24 - shift, 5, 1, 0.6);
    this.px(g, MART.partyShade, 29, 24 + shift, 5, 1, 0.6);

    // Little feet peeking out under the body.
    this.px(g, MART.partyShade, 14, 36 - shift, 5, 3, 1);
    this.px(g, MART.partyShade, 21, 36 + shift, 5, 3, 1);
  }

  /**
   * The Watcher (the Neighborhood Watch, wiki level-9): a too-tall figure in
   * a buttoned dark coat, hands folded, with two enormous lidless white eyes
   * that take up half the face — the porch silhouette that was already
   * looking at you. Back view: the coat, the collar, and no eyes at all,
   * which somehow doesn't mean it can't see you.
   */
  private drawWatcher(
    g: Phaser.GameObjects.Graphics,
    s: number,
    facing: Facing,
    stride: boolean,
  ): void {
    const shift = stride ? 1 : 0;

    // Long straight coat body first — narrow, floor-length, buttoned.
    this.rr(g, COLORS.playerOutline, 12, 14, 16, 24, 1);
    this.rr(g, MART.watcherCoat, 13, 15, 14, 22, 1);
    this.px(g, MART.watcherCoatHi, 14, 15, 2, 21, 0.4);
    if (facing === "front") {
      // Button line down the coat's front seam.
      for (let i = 0; i < 5; i++) {
        this.px(g, MART.watcherCoatHi, 19.5, 17 + i * 4, 1, 1, 0.8);
      }
    } else {
      // A single back vent seam.
      this.px(g, COLORS.playerOutline, 19.5, 20, 1, 17, 0.5);
    }

    // Arms held dead straight, gloved hands folded in front at the waist.
    this.px(g, MART.watcherCoat, 10, 16 + shift, 3, 13, 1);
    this.px(g, MART.watcherCoat, 27, 16 - shift, 3, 13, 1);
    if (facing === "front") {
      this.px(g, COLORS.monsterEye, 16, 27, 8, 3, 0.9);
    }

    // Head: a long pale oval on a high collar.
    this.px(g, MART.watcherCoat, 16, 12, 8, 3, 1);
    g.fillStyle(COLORS.playerOutline, 1);
    g.fillEllipse(s / 2, 7, 15, 14);
    g.fillStyle(COLORS.monsterBody, 1);
    g.fillEllipse(s / 2, 7, 13, 12);

    if (facing === "front") {
      // The eyes. Far too big, perfectly round, never blinking — with
      // pinprick pupils fixed dead ahead.
      g.fillStyle(COLORS.playerOutline, 1);
      g.fillEllipse(15.5, 7, 8, 9);
      g.fillEllipse(24.5, 7, 8, 9);
      g.fillStyle(MART.watcherEye, 1);
      g.fillEllipse(15.5, 7, 6.5, 7.5);
      g.fillEllipse(24.5, 7, 6.5, 7.5);
      this.px(g, COLORS.monsterEye, 15, 7, 2, 2, 1);
      this.px(g, COLORS.monsterEye, 24, 7, 2, 2, 1);
      // No mouth. Nothing else. Just the eyes.
    } else {
      // Featureless from behind, bar a faint scalp seam.
      this.px(g, COLORS.monsterBodyShade, 19.5, 2, 1, 9, 0.4);
    }
  }

  /**
   * The Clump (wiki entity-5): not a body — a floating knot of fused limbs
   * and torsos, arms jutting at angles that don't share one owner, bound by
   * dark sinew. It drifts (no walk cycle); the stride frame just rotates
   * which limbs hang lowest.
   */
  private drawClump(
    g: Phaser.GameObjects.Graphics,
    s: number,
    facing: Facing,
    stride: boolean,
  ): void {
    const roll = stride ? 2 : 0;

    // The core mass: overlapping flesh lobes, deliberately lumpy.
    g.fillStyle(COLORS.playerOutline, 1);
    g.fillEllipse(s / 2, 18, 26, 22);
    g.fillStyle(MART.clumpFlesh, 1);
    g.fillEllipse(s / 2 - 3, 16, 16, 14);
    g.fillEllipse(s / 2 + 5, 20 + roll * 0.5, 14, 13);
    g.fillStyle(MART.clumpFleshHi, 0.8);
    g.fillEllipse(s / 2 - 5, 13, 8, 7);
    g.fillStyle(MART.clumpFleshShade, 0.8);
    g.fillEllipse(s / 2 + 6, 24, 10, 8);

    // Sinew bands cinching the lobes together.
    this.px(g, MART.clumpSinew, 8, 17, 24, 2, 0.8);
    this.px(g, MART.clumpSinew, 14, 9, 2, 20, 0.7);
    this.px(g, MART.clumpSinew, 24, 12, 2, 16, 0.6);

    // Limbs jutting out of the mass — arms where arms shouldn't start,
    // one leg that ends mid-air. Alternate pair hangs lower on the stride.
    this.px(g, COLORS.monsterLimb, 3, 12 - roll, 6, 3, 1); // arm, left out
    this.px(g, COLORS.monsterBodyShade, 1, 11 - roll, 3, 2, 0.9); // its hand
    this.px(g, COLORS.monsterLimb, 31, 16 + roll, 7, 3, 1); // arm, right out
    this.px(g, COLORS.monsterBodyShade, 36, 15 + roll, 3, 2, 0.9);
    this.px(g, COLORS.monsterLimb, 12, 28 + roll, 3, 9, 1); // hanging leg
    this.px(g, COLORS.monsterLimb, 22, 29 - roll, 3, 8, 1); // second leg
    this.px(g, COLORS.monsterLimb, 26, 4 - roll, 3, 7, 1); // arm reaching UP

    if (facing === "front") {
      // One face surfaced in the mass, eyes shut, mouth slack — asleep, or
      // worse, at peace.
      g.fillStyle(COLORS.monsterBody, 1);
      g.fillEllipse(15, 20, 9, 8);
      this.px(g, COLORS.monsterBodyShade, 12, 19, 3, 1, 0.9);
      this.px(g, COLORS.monsterBodyShade, 17, 19, 3, 1, 0.9);
      this.px(g, COLORS.monsterMawShade, 13, 23, 5, 1, 0.8);
    } else {
      // From behind: just more limbs. There is no back. That's the point.
      this.px(g, COLORS.monsterLimb, 17, 6 - roll, 3, 6, 1);
      this.px(g, COLORS.monsterBodyShade, 17, 4 - roll, 3, 2, 0.9);
    }
  }

  /**
   * The Beast of Level 5 (wiki entity-21): a tall horned silhouette that is
   * mostly negative space — long curved horns, a smear of near-black body,
   * two ember eyes, and far too much arm. Back view is the horns and the
   * dark, and that's already too much information.
   */
  private drawBeast(
    g: Phaser.GameObjects.Graphics,
    s: number,
    facing: Facing,
    stride: boolean,
  ): void {
    const shift = stride ? 1 : 0;

    // Long clawed arms first, hanging to the floor, so the body overlaps.
    this.px(g, MART.beastBody, 6, 16 - shift, 3, 16, 1);
    this.px(g, MART.beastBody, 31, 16 + shift, 3, 16, 1);
    for (let i = 0; i < 3; i++) {
      this.px(g, MART.beastHorn, 5 + i * 2, 32 - shift, 1, 3, 0.8);
      this.px(g, MART.beastHorn, 30 + i * 2, 32 + shift, 1, 3, 0.8);
    }

    // Smoked, tapering body mass — soft edges, like it isn't fully here.
    g.fillStyle(MART.beastBody, 0.6);
    g.fillEllipse(s / 2, 24, 22, 26);
    g.fillStyle(MART.beastBody, 0.95);
    g.fillEllipse(s / 2, 22, 16, 22);
    this.px(g, MART.beastBodyHi, 14, 14, 3, 12, 0.35);

    // Narrow skull between the shoulders.
    g.fillStyle(MART.beastBody, 1);
    g.fillEllipse(s / 2, 10, 13, 11);

    // The horns — long, swept, pale against everything else in the game.
    g.fillStyle(MART.beastHorn, 1);
    g.fillTriangle(13, 8, 6, -2, 16, 5);
    g.fillTriangle(27, 8, 34, -2, 24, 5);
    this.px(g, MART.beastBodyHi, 8, 0, 2, 3, 0.5);

    if (facing === "front") {
      // Ember eyes, slightly uneven heights — nothing symmetrical lives here.
      this.px(g, MART.beastEye, 16, 9, 3, 2, 1);
      this.px(g, MART.beastEye, 23, 10, 3, 2, 1);
      this.px(g, 0xfff0c0, 17, 9, 1, 1, 0.9);
      this.px(g, 0xfff0c0, 24, 10, 1, 1, 0.9);
      // A thin under-lit jaw line.
      this.px(g, MART.beastBodyHi, 17, 14, 6, 1, 0.4);
    } else {
      // From behind: the faint spine ridge and the horn backs.
      for (let i = 0; i < 4; i++) {
        this.px(g, MART.beastBodyHi, 19, 14 + i * 5, 2, 2, 0.35);
      }
    }

    // Digitigrade legs, barely resolved out of the body smoke.
    this.px(g, MART.beastBody, 15, 33 - shift, 4, 6, 1);
    this.px(g, MART.beastBody, 22, 33 + shift, 4, 6, 1);
  }

  /**
   * The way out: a flickering seam of light set into the surrounding wall —
   * drawn to match the wallpapered wall block (round bevel, dither) so it
   * hides in plain sight until it flickers. The scene pulses its alpha.
   */
  private makeExit(key: string, c: StyleColorSet): void {
    const t = TILE_SIZE;
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Wall face (matches the surrounding wall material so it hides in plain
    // sight until it flickers).
    this.drawWallSurface(g, c);
    this.px(g, c.wallHi, 0, 0, t, 1, 0.9);
    this.px(g, c.wallShade, 0, t - 1, t, 1, 0.85);

    // Bright vertical crack of light down the middle — the seam to the next
    // level, with a soft glow bleeding off both sides.
    const cx = t / 2 - 2;
    this.px(g, COLORS.exitGlow, cx - 3, 3, 8, t - 6, 0.25);
    this.px(g, COLORS.exitGlow, cx, 2, 4, t - 4, 0.85);
    this.px(g, COLORS.exitCore, cx + 1, 3, 2, t - 6);

    g.generateTexture(key, t, t);
    g.destroy();
  }

  /** Bottomless pit tile — a dark hole with a soft, rounded carpet rim. */
  private makeHole(key: string): void {
    const t = TILE_SIZE;
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Carpet-coloured rim so the pit sits inside the yellow floor.
    this.px(g, COLORS.holeRim, 0, 0, t, t);
    // Recessed dark ring, corners softened so it reads as a round pit.
    this.rr(g, COLORS.holeEdge, 3, 3, t - 6, t - 6);
    // The void.
    g.fillStyle(COLORS.holePit, 1);
    g.fillEllipse(t / 2, t / 2, t - 14, t - 14);

    g.generateTexture(key, t, t);
    g.destroy();
  }

  /** Retro CRT scanline tile — one dark row every 4px. Tiled full-screen by
   *  MainScene at a low alpha for permanent oldschool monitor texture. */
  private makeScanlines(key: string): void {
    const size = 4;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 0.55);
    g.fillRect(0, 0, size, 1);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  /** Film-grain noise tile — true per-pixel randomness (not drawn shapes) so
   *  it reads as static rather than a repeating pattern once tiled and
   *  jittered by MainScene. */
  private makeGrain(key: string): void {
    const size = 64;
    const canvas = this.textures.createCanvas(key, size, size);
    if (!canvas) return;
    const ctx = canvas.getContext();
    const image = ctx.createImageData(size, size);
    for (let i = 0; i < image.data.length; i += 4) {
      const v = Math.random() * 255;
      image.data[i] = v;
      image.data[i + 1] = v;
      image.data[i + 2] = v;
      image.data[i + 3] = 60 + Math.random() * 140;
    }
    ctx.putImageData(image, 0, 0);
    canvas.refresh();
  }
}
