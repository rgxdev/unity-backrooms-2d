import Phaser from "phaser";
import {
  COLORS,
  MONSTER,
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
    this.makeCarpet(TEXTURES.floor, 0);
    this.makeCarpet(TEXTURES.floorAlt, 1);
    this.makeWall(TEXTURES.wall);
    this.makePlayer(TEXTURES.player);
    this.makeMonster(TEXTURES.monster);
    this.makeExit(TEXTURES.exit);
    this.makeHole(TEXTURES.hole);
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

  /** Deterministic pseudo-random 0..1 from integer coordinates — cheap dither
   *  noise so tiled textures don't look like a stamped-out repeating block. */
  private noise(x: number, y: number): number {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h ^= h >>> 16;
    return ((h >>> 0) % 1000) / 1000;
  }

  /**
   * Woven-carpet floor tile. A deterministic 2px thread weave (alternating
   * light/dark strands) plus fine speckle dither gives a soft hand-woven
   * texture instead of a flat colour block. `variant` shifts the weave phase
   * so neighbouring tiles read as one continuous rug rather than a repeating
   * stamp.
   */
  private makeCarpet(key: string, variant: number): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const base = variant === 0 ? COLORS.floor : COLORS.floorAlt;
    this.px(g, base, 0, 0, TILE_SIZE, TILE_SIZE);

    const cell = 4;
    for (let y = 0; y < TILE_SIZE; y += cell) {
      for (let x = 0; x < TILE_SIZE; x += cell) {
        const warp = (x / cell + variant) % 2 === 0;
        // Horizontal thread across the top of the cell, vertical down the side.
        this.px(g, warp ? COLORS.floorWeaveHi : COLORS.floorWeaveLo, x, y, cell, 1, 0.55);
        this.px(g, warp ? COLORS.floorWeaveLo : COLORS.floorWeaveHi, x, y, 1, cell, 0.55);
      }
    }

    // Fine speckle dither breaks up the regular weave so it reads as woven
    // fabric rather than a printed grid.
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const n = this.noise(x + variant * 97, y);
        if (n > 0.93) this.px(g, COLORS.floorWeaveHi, x, y, 1, 1, 0.4);
        else if (n < 0.06) this.px(g, COLORS.floorWeaveLo, x, y, 1, 1, 0.35);
      }
    }

    // Faint tile seam so the grid stays legible under the fog.
    this.px(g, COLORS.floorSeam, 0, 0, TILE_SIZE, 1, 0.25);
    this.px(g, COLORS.floorSeam, 0, 0, 1, TILE_SIZE, 0.25);
    g.generateTexture(key, TILE_SIZE, TILE_SIZE);
    g.destroy();
  }

  /**
   * Worn plaster wall block. A soft multi-band bevel (two highlight steps,
   * two shadow steps) reads as a rounded volume rather than a flat stamped
   * square, and speckle dither breaks up the once-uniform wallpaper stripes
   * so it feels hand-painted instead of tiled.
   */
  private makeWall(key: string): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const t = TILE_SIZE;
    this.px(g, COLORS.wall, 0, 0, t, t);

    // Soft vertical wallpaper stripes — thinner and lower contrast than a
    // hard block edge.
    for (let x = 3; x < t; x += 7) {
      this.px(g, COLORS.wallStripe, x, 2, 1, t - 4, 0.35);
    }

    // Speckle dither — irregular plaster grain instead of a flat fill.
    for (let y = 0; y < t; y++) {
      for (let x = 0; x < t; x++) {
        const n = this.noise(x + 401, y + 401);
        if (n > 0.94) this.px(g, COLORS.wallSpeckleHi, x, y, 1, 1, 0.5);
        else if (n < 0.05) this.px(g, COLORS.wallSpeckleLo, x, y, 1, 1, 0.4);
      }
    }

    // Two-step bevel: catch-light along top/left fading into the base tone,
    // shadow along bottom/right fading in from the base — a soft rounded
    // volume rather than one hard highlight/shadow line.
    this.px(g, COLORS.wallHi, 0, 0, t, 1, 0.9);
    this.px(g, COLORS.wallHi2, 0, 1, t, 1, 0.6);
    this.px(g, COLORS.wallHi, 0, 0, 1, t, 0.9);
    this.px(g, COLORS.wallHi2, 1, 0, 1, t, 0.6);
    this.px(g, COLORS.wallShade2, 0, t - 2, t, 1, 0.6);
    this.px(g, COLORS.wallShade, 0, t - 1, t, 1, 0.85);
    this.px(g, COLORS.wallShade2, t - 2, 0, 1, t, 0.6);
    this.px(g, COLORS.wallShade, t - 1, 0, 1, t, 0.85);

    // Dark baseboard grout so stacked walls seam cleanly, corners softened.
    this.rr(g, COLORS.wallDark, 0, t - 3, t, 3, 0.5);
    g.generateTexture(key, t, t);
    g.destroy();
  }

  /**
   * Top-down character sprite: rounded silhouette, hair, shaded face,
   * shirt/legs with soft multi-tone shading and a dark keyline — a readable
   * little person with a gentle rounded shape instead of a two-tone square.
   */
  private makePlayer(key: string): void {
    const s = PLAYER.size;
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Rounded keyline silhouette.
    this.rr(g, COLORS.playerOutline, 2, 0, s - 4, s, 1);
    this.rr(g, COLORS.playerOutline, 1, 2, s - 2, s - 3, 1);

    // Soft drop shadow, grounding the sprite on the floor beneath it.
    g.fillStyle(COLORS.shadow, 0.28);
    g.fillEllipse(s / 2, s - 1, s - 4, 3);

    // Hair cap, rounded.
    this.rr(g, COLORS.playerHair, 3, 1, s - 6, 5, 1);
    this.px(g, COLORS.playerHairHi, 4, 1, s - 8, 1, 0.8);

    // Face with a shaded right cheek — soft two-tone blend.
    this.rr(g, COLORS.playerSkin, 3, 5, s - 6, 4, 1);
    this.px(g, COLORS.playerSkinShade, s - 6, 6, 2, 3, 0.8);
    // Eyes.
    this.px(g, COLORS.playerOutline, 5, 7, 1, 1);
    this.px(g, COLORS.playerOutline, s - 6, 7, 1, 1);

    // Shirt torso + arms, shaded on the right, highlighted on the left.
    this.rr(g, COLORS.playerShirt, 2, 9, s - 4, 5, 1);
    this.px(g, COLORS.playerShirtHi, 3, 9, 2, 4, 0.6);
    this.px(g, COLORS.playerShirtShade, s - 5, 9, 3, 5, 0.85);
    this.px(g, COLORS.playerSkin, 2, 10, 1, 2);
    this.px(g, COLORS.playerSkin, s - 3, 10, 1, 2);

    // Legs, rounded stance with a centre seam.
    this.rr(g, COLORS.playerPants, 3, 14, s - 6, 4, 1);
    this.px(g, COLORS.playerPantsShade, s - 5, 15, 2, 3, 0.7);
    this.px(g, COLORS.playerOutline, s / 2 - 0.5, 14, 1, 4, 0.7);

    g.generateTexture(key, s, s);
    g.destroy();
  }

  /**
   * Lurking monster sprite: a hunched, rounded dark body with glowing eyes
   * and a pale maw — reads as a threat at a glance and keeps a soft organic
   * silhouette instead of a jagged block.
   */
  private makeMonster(key: string): void {
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

    // Spindly limbs poking out the sides.
    this.px(g, COLORS.monsterLimb, 1, s / 2 - 1, 2, 5);
    this.px(g, COLORS.monsterLimb, s - 3, s / 2 - 1, 2, 5);

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

    g.generateTexture(key, s, s);
    g.destroy();
  }

  /**
   * The way out: a flickering seam of light set into the surrounding wall —
   * drawn to match the wallpapered wall block (round bevel, dither) so it
   * hides in plain sight until it flickers. The scene pulses its alpha.
   */
  private makeExit(key: string): void {
    const t = TILE_SIZE;
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Wall face (matches the surrounding wallpaper so it hides in plain sight).
    this.px(g, COLORS.wall, 0, 0, t, t);
    for (let x = 3; x < t; x += 7) {
      this.px(g, COLORS.wallStripe, x, 2, 1, t - 4, 0.35);
    }
    this.px(g, COLORS.wallHi, 0, 0, t, 1, 0.9);
    this.px(g, COLORS.wallShade, 0, t - 1, t, 1, 0.85);

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
