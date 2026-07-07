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
   * Woven-carpet floor tile. A deterministic 2px thread weave (alternating
   * light/dark strands) gives the cozy, hand-crafted Stardew texture instead
   * of a flat colour block. `variant` shifts the weave phase so neighbouring
   * tiles read as one continuous rug rather than a repeating stamp.
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
        this.px(g, warp ? COLORS.floorWeaveHi : COLORS.floorWeaveLo, x, y, cell, 1, 0.7);
        this.px(g, warp ? COLORS.floorWeaveLo : COLORS.floorWeaveHi, x, y, 1, cell, 0.7);
      }
    }

    // Faint tile seam so the grid stays legible under the fog.
    this.px(g, COLORS.floorSeam, 0, 0, TILE_SIZE, 1, 0.35);
    this.px(g, COLORS.floorSeam, 0, 0, 1, TILE_SIZE, 0.35);
    g.generateTexture(key, TILE_SIZE, TILE_SIZE);
    g.destroy();
  }

  /**
   * Wallpapered wall block with a chunky pseudo-3D bevel — bright top/left
   * catch-light and a shaded bottom/right face so walls read as solid volumes
   * (the "2D-3D" Stardew look) rather than flat squares.
   */
  private makeWall(key: string): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const t = TILE_SIZE;
    this.px(g, COLORS.wall, 0, 0, t, t);

    // Vertical wallpaper stripes.
    for (let x = 2; x < t; x += 6) {
      this.px(g, COLORS.wallStripe, x, 0, 2, t, 0.55);
    }

    // Bevel: highlight along top + left edges.
    this.px(g, COLORS.wallHi, 0, 0, t, 2);
    this.px(g, COLORS.wallHi, 0, 0, 2, t);
    // Bevel: shadow along bottom + right edges.
    this.px(g, COLORS.wallShade, 0, t - 3, t, 3);
    this.px(g, COLORS.wallShade, t - 3, 0, 3, t);
    // Dark baseboard grout so stacked walls seam cleanly.
    this.px(g, COLORS.wallDark, 0, t - 2, t, 2);
    this.px(g, COLORS.wallTrim, 0, 0, t, 1);
    this.px(g, COLORS.wallTrim, 0, t - 1, t, 1);
    g.generateTexture(key, t, t);
    g.destroy();
  }

  /**
   * Top-down character sprite: hair, shaded face, coloured shirt and legs with
   * a dark keyline — a readable little person instead of a two-dot square.
   */
  private makePlayer(key: string): void {
    const s = PLAYER.size; // 14
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Dark keyline silhouette.
    this.px(g, COLORS.playerOutline, 2, 0, s - 4, s);
    this.px(g, COLORS.playerOutline, 1, 2, s - 2, s - 3);

    // Hair cap.
    this.px(g, COLORS.playerHair, 3, 1, s - 6, 4);
    this.px(g, COLORS.playerHair, 2, 2, s - 4, 3);
    // Face with a shaded right cheek.
    this.px(g, COLORS.playerSkin, 3, 4, s - 6, 3);
    this.px(g, COLORS.playerSkinShade, s - 5, 4, 2, 3);
    // Eyes.
    this.px(g, COLORS.playerOutline, 4, 5, 1, 1);
    this.px(g, COLORS.playerOutline, s - 5, 5, 1, 1);

    // Shirt torso + arms, shaded on the right.
    this.px(g, COLORS.playerShirt, 2, 7, s - 4, 4);
    this.px(g, COLORS.playerShirtShade, s - 4, 7, 2, 4);
    this.px(g, COLORS.playerSkin, 2, 8, 1, 2);
    this.px(g, COLORS.playerSkin, s - 3, 8, 1, 2);

    // Legs.
    this.px(g, COLORS.playerPants, 3, 11, s - 6, 3);
    this.px(g, COLORS.playerOutline, s / 2 - 0.5, 11, 1, 3);

    g.generateTexture(key, s, s);
    g.destroy();
  }

  /**
   * Lurking monster sprite: a hunched dark body with glowing eyes and a pale
   * maw — reads as a threat at a glance and stays legible under the fog.
   */
  private makeMonster(key: string): void {
    const s = MONSTER.size; // 16
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Dark keyline silhouette.
    this.px(g, COLORS.playerOutline, 2, 1, s - 4, s - 1);
    this.px(g, COLORS.playerOutline, 1, 3, s - 2, s - 4);

    // Hunched body, shaded on the right.
    this.px(g, COLORS.monsterBody, 3, 2, s - 6, s - 3);
    this.px(g, COLORS.monsterBodyShade, s - 5, 2, 2, s - 3);
    // Shoulders / brow ridge.
    this.px(g, COLORS.monsterBody, 2, 4, s - 4, 3);

    // Spindly limbs poking out the sides.
    this.px(g, COLORS.monsterLimb, 1, 7, 2, 4);
    this.px(g, COLORS.monsterLimb, s - 3, 7, 2, 4);

    // Glowing eyes.
    this.px(g, COLORS.monsterEye, 4, 5, 2, 2);
    this.px(g, COLORS.monsterEye, s - 6, 5, 2, 2);
    this.px(g, 0xffffff, 4, 5, 1, 1, 0.8);
    this.px(g, 0xffffff, s - 6, 5, 1, 1, 0.8);

    // Jagged pale maw.
    this.px(g, COLORS.monsterMaw, 5, 10, s - 10, 2);
    this.px(g, COLORS.monsterBodyShade, 6, 10, 1, 2);
    this.px(g, COLORS.monsterBodyShade, 8, 10, 1, 2);
    this.px(g, COLORS.monsterBodyShade, 10, 10, 1, 2);

    g.generateTexture(key, s, s);
    g.destroy();
  }

  /** Glowing exit doorway — the escape. Fills a full tile. */
  private makeExit(key: string): void {
    const t = TILE_SIZE;
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Dark frame.
    this.px(g, COLORS.exitFrame, 4, 2, t - 8, t - 2);
    // Glowing portal, brightest at the centre.
    this.px(g, COLORS.exitGlow, 7, 5, t - 14, t - 7);
    this.px(g, COLORS.exitCore, 10, 8, t - 20, t - 12);
    // Frame keyline.
    g.lineStyle(2, 0x000000, 0.4);
    g.strokeRect(4, 2, t - 8, t - 2);

    g.generateTexture(key, t, t);
    g.destroy();
  }
}
