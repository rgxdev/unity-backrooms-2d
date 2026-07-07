import Phaser from "phaser";
import {
  COLORS,
  FLOOR_VARIANTS,
  LEVEL_STYLES,
  MONSTER,
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
  type PropKind,
  type StyleColorSet,
} from "@/game/config/constants";
import { SKINS, type PlayerPalette } from "@/game/skins/skinCatalog";
import { hash01 } from "@/game/util/hash";

type Facing = "front" | "back";

/** Texture generations processed per frame — paces the loading process into
 *  a visible bar instead of one blocking synchronous burst. */
const BATCH_SIZE = 2;

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
        tasks.push(() => this.makeFloor(TEXTURES.floor(style, variant), c, variant));
      }
      tasks.push(() => this.makeWallCrack(TEXTURES.wallCrack(style), c));
      tasks.push(() => this.makeExit(TEXTURES.exit(style), c));
      for (let mask = 0; mask < WALL_MASK_COUNT; mask++) {
        for (let variant = 0; variant < WALL_VARIANTS; variant++) {
          tasks.push(() =>
            this.makeWallVariant(TEXTURES.wall(style, mask, variant), c, mask, variant),
          );
        }
      }
      for (const kind of STYLE_PROPS[style]) {
        tasks.push(() => this.makeProp(TEXTURES.prop(kind), kind, c));
      }
    }
    tasks.push(() => this.makeAlmondWater(TEXTURES.almondWater));
    for (const skin of SKINS) {
      tasks.push(
        () =>
          this.makePlayer(
            playerTextureKey(skin.id, "front", false),
            "front",
            false,
            skin.palette,
          ),
        () =>
          this.makePlayer(
            playerTextureKey(skin.id, "front", true),
            "front",
            true,
            skin.palette,
          ),
        () =>
          this.makePlayer(
            playerTextureKey(skin.id, "back", false),
            "back",
            false,
            skin.palette,
          ),
        () =>
          this.makePlayer(
            playerTextureKey(skin.id, "back", true),
            "back",
            true,
            skin.palette,
          ),
      );
    }
    tasks.push(
      () => this.makeMonster(TEXTURES.monster, "front", false),
      () => this.makeMonster(TEXTURES.monsterWalk, "front", true),
      () => this.makeMonster(TEXTURES.monsterBack, "back", false),
      () => this.makeMonster(TEXTURES.monsterBackWalk, "back", true),
      () => this.makeHole(TEXTURES.hole),
      () => this.makeRubble(TEXTURES.rubble),
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
            this.px(g, warp ? c.floorWeaveHi : c.floorWeaveLo, x, y, cell, 1, 0.5);
            this.px(g, warp ? c.floorWeaveLo : c.floorWeaveHi, x, y, 1, cell, 0.5);
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
        for (let y = 0; y <= t; y += cell) this.px(g, c.accent, 0, y, t, 1, 0.4);
        for (let x = 0; x <= t; x += cell) this.px(g, c.accent, x, 0, 1, t, 0.4);
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
        // A low hazard-tape band of alternating diagonal-cut stripes.
        this.px(g, c.wallShade, 0, t - 11, t, 7, 0.9);
        for (let x = -6; x < t; x += 6) {
          this.px(g, c.accent, x, t - 11, 3, 7, 0.95);
        }
        break;
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
  }

  /**
   * One deliberately unsettling detail, specific to the wall material —
   * baked into variant 2 of every mask so it's rare (roughly a third of the
   * map's walls) rather than omnipresent.
   */
  private drawWallCreepyDetail(g: Phaser.GameObjects.Graphics, c: StyleColorSet): void {
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
        const crack: Array<[number, number]> = [[6, 4], [9, 9], [7, 14], [11, 19], [9, 25]];
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
      [4, 2], [7, 6], [6, 11], [10, 15], [9, 20], [13, 24], [12, 29],
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
        const pts: Array<[number, number]> = [[6, 8], [10, 13], [8, 18], [14, 23], [12, 28]];
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
   * Top-down character sprite: rounded silhouette, hair, shaded shirt/legs
   * with soft multi-tone shading and a dark keyline — a readable little
   * person with a gentle rounded shape instead of a two-tone square.
   * `facing` swaps the face (front) for a full head of hair and a spine
   * seam (back), so walking away from the camera reads differently to
   * walking toward it. `stride` offsets the legs into a mid-step pose for
   * the second walk-cycle frame.
   */
  private makePlayer(
    key: string,
    facing: Facing,
    stride: boolean,
    palette: PlayerPalette,
  ): void {
    const s = PLAYER.size;
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Rounded keyline silhouette.
    this.rr(g, COLORS.playerOutline, 2, 0, s - 4, s, 1);
    this.rr(g, COLORS.playerOutline, 1, 2, s - 2, s - 3, 1);

    // Soft drop shadow, grounding the sprite on the floor beneath it.
    g.fillStyle(COLORS.shadow, 0.28);
    g.fillEllipse(s / 2, s - 1, s - 4, 3);

    // Hair cap, rounded.
    this.rr(g, palette.hair, 3, 1, s - 6, 5, 1);
    this.px(g, palette.hairHi, 4, 1, s - 8, 1, 0.8);

    if (facing === "front") {
      // Face with a shaded right cheek — soft two-tone blend.
      this.rr(g, palette.skin, 3, 5, s - 6, 4, 1);
      this.px(g, palette.skinShade, s - 6, 6, 2, 3, 0.8);
      // Eyes.
      this.px(g, COLORS.playerOutline, 5, 7, 1, 1);
      this.px(g, COLORS.playerOutline, s - 6, 7, 1, 1);
    } else {
      // Back of the head: hair covers where the face would be, plus a
      // centre parting seam.
      this.rr(g, palette.hair, 3, 5, s - 6, 4, 1);
      this.px(g, COLORS.playerOutline, s / 2 - 0.5, 5, 1, 4, 0.5);
    }

    // Shirt torso + arms, shaded on the right, highlighted on the left.
    this.rr(g, palette.shirt, 2, 9, s - 4, 5, 1);
    this.px(g, palette.shirtHi, 3, 9, 2, 4, 0.6);
    this.px(g, palette.shirtShade, s - 5, 9, 3, 5, 0.85);
    this.px(g, palette.skin, 2, 10, 1, 2);
    this.px(g, palette.skin, s - 3, 10, 1, 2);
    if (facing === "back") {
      // Spine seam down the back of the shirt.
      this.px(g, palette.shirtShade, s / 2 - 0.5, 9, 1, 5, 0.6);
    }

    // Legs, split left/right so a stride frame can offset them into a
    // mid-step pose (one leg forward/up, one back/down).
    const legW = (s - 6) / 2;
    const shift = stride ? 1 : 0;
    this.rr(g, palette.pants, 3, 14 - shift, legW, 4, 1);
    this.rr(g, palette.pants, 3 + legW, 14 + shift, legW, 4, 1);
    this.px(g, palette.pantsShade, s - 5, 15 + shift, 2, 3, 0.7);
    this.px(g, COLORS.playerOutline, s / 2 - 0.5, 14, 1, 4, 0.7);

    g.generateTexture(key, s, s);
    g.destroy();
  }

  /**
   * Lurking monster sprite: a hunched, rounded dark body with glowing eyes
   * and a pale maw — reads as a threat at a glance and keeps a soft organic
   * silhouette instead of a jagged block. `facing` swaps the glowing-eyes
   * face (front) for a ridged, faceless hunch (back) — worse to see chasing
   * away from you than toward you. `stride` offsets its limbs into a
   * lurching mid-step pose for the second walk-cycle frame.
   */
  private makeMonster(key: string, facing: Facing, stride: boolean): void {
    const s = MONSTER.size;
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Rounded keyline silhouette.
    this.rr(g, COLORS.playerOutline, 2, 1, s - 4, s - 1, 1);
    this.rr(g, COLORS.playerOutline, 1, 3, s - 2, s - 4, 1);

    // Contact shadow, grounding it against the floor.
    g.fillStyle(COLORS.shadow, 0.35);
    g.fillEllipse(s / 2, s - 1, s - 5, 3);

    // Hunched body, shaded on the right, softly lit on the left.
    this.rr(g, COLORS.monsterBody, 3, 2, s - 6, s - 3, 1);
    this.px(g, COLORS.monsterBodyHi, 4, 3, 2, s - 7, 0.5);
    this.px(g, COLORS.monsterBodyShade, s - 6, 2, 3, s - 3, 0.8);
    // Shoulders / brow ridge.
    this.rr(g, COLORS.monsterBody, 2, 4, s - 4, 4, 1);

    // Spindly limbs poking out the sides — offset opposite ways for the
    // stride frame so the lurch reads as alternating steps.
    const limbShift = stride ? 1 : 0;
    this.px(g, COLORS.monsterLimb, 1, s / 2 - 1 - limbShift, 2, 5);
    this.px(g, COLORS.monsterLimb, s - 3, s / 2 - 1 + limbShift, 2, 5);

    if (facing === "front") {
      // Glowing eyes with a soft outer bloom.
      this.px(g, COLORS.monsterEyeGlow, 3, 6, 4, 4, 0.35);
      this.px(g, COLORS.monsterEyeGlow, s - 7, 6, 4, 4, 0.35);
      this.px(g, COLORS.monsterEye, 4, 7, 2, 2);
      this.px(g, COLORS.monsterEye, s - 6, 7, 2, 2);
      this.px(g, 0xffffff, 4, 7, 1, 1, 0.85);
      this.px(g, 0xffffff, s - 6, 7, 1, 1, 0.85);

      // Jagged pale maw with a shaded underside.
      this.px(g, COLORS.monsterMawShade, 5, s - 8, s - 10, 3, 0.6);
      this.px(g, COLORS.monsterMaw, 5, s - 9, s - 10, 2);
      for (let i = 0; i < 3; i++) {
        this.px(g, COLORS.monsterBodyShade, 7 + i * 3, s - 9, 1, 2);
      }
    } else {
      // Faceless hunch: a ridge of jagged spine bumps instead of eyes/maw.
      for (let i = 0; i < 3; i++) {
        this.rr(g, COLORS.monsterBodyShade, 5 + i * 4, 4 + i, 3, 3, 0.7);
      }
    }

    g.generateTexture(key, s, s);
    g.destroy();
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
}
