import { PLAYER, COLORS } from "@/game/config/constants";
import type { AccessoryKind, PlayerPalette } from "./skinCatalog";

export type Facing = "front" | "back";

/**
 * Minimal pixel-drawing surface the player sprite is painted onto. Two
 * implementations exist: PreloadScene wraps a Phaser `Graphics` (baked into a
 * game texture), and the skin-selector's `SkinPreview` wraps a DOM Canvas2D
 * context — so the in-game sprite and the menu preview can never drift apart.
 */
export interface PaintSurface {
  /** Fill a pixel-aligned rect. */
  px(
    color: number,
    x: number,
    y: number,
    w?: number,
    h?: number,
    alpha?: number,
  ): void;
  /** Corner-clipped rect — the "rounded silhouette" pixel-art trick. */
  rr(
    color: number,
    x: number,
    y: number,
    w: number,
    h: number,
    alpha?: number,
  ): void;
  /** Filled ellipse centred on (cx, cy). */
  ellipse(
    color: number,
    cx: number,
    cy: number,
    w: number,
    h: number,
    alpha?: number,
  ): void;
}

/** Sprite edge length in pixels (the canvas both renderers must provide). */
export const PLAYER_SPRITE_SIZE = PLAYER.size;

/**
 * Top-down character sprite: rounded silhouette, hair, shaded shirt/legs
 * with soft multi-tone shading and a dark keyline — a readable little
 * person with a gentle rounded shape instead of a two-tone square.
 * `facing` swaps the face (front) for a full head of hair and a spine
 * seam (back), so walking away from the camera reads differently to
 * walking toward it. `stride` offsets the legs into a mid-step pose for
 * the second walk-cycle frame.
 */
export function paintPlayerSprite(
  g: PaintSurface,
  facing: Facing,
  stride: boolean,
  palette: PlayerPalette,
  accessory: AccessoryKind,
): void {
  const s = PLAYER_SPRITE_SIZE;

  // Rounded keyline silhouette.
  g.rr(COLORS.playerOutline, 2, 0, s - 4, s, 1);
  g.rr(COLORS.playerOutline, 1, 2, s - 2, s - 3, 1);

  // Soft drop shadow, grounding the sprite on the floor beneath it.
  g.ellipse(COLORS.shadow, s / 2, s - 1, s - 4, 3, 0.28);

  // Hair cap, rounded.
  g.rr(palette.hair, 3, 1, s - 6, 5, 1);
  g.px(palette.hairHi, 4, 1, s - 8, 1, 0.8);

  if (facing === "front") {
    // Face with a shaded right cheek — soft two-tone blend.
    g.rr(palette.skin, 3, 5, s - 6, 4, 1);
    g.px(palette.skinShade, s - 6, 6, 2, 3, 0.8);
    // Eyes.
    g.px(COLORS.playerOutline, 5, 7, 1, 1);
    g.px(COLORS.playerOutline, s - 6, 7, 1, 1);
  } else {
    // Back of the head: hair covers where the face would be, plus a
    // centre parting seam.
    g.rr(palette.hair, 3, 5, s - 6, 4, 1);
    g.px(COLORS.playerOutline, s / 2 - 0.5, 5, 1, 4, 0.5);
  }

  paintAccessory(g, s, facing, palette, accessory);

  // Shirt torso + arms, shaded on the right, highlighted on the left.
  g.rr(palette.shirt, 2, 9, s - 4, 5, 1);
  g.px(palette.shirtHi, 3, 9, 2, 4, 0.6);
  g.px(palette.shirtShade, s - 5, 9, 3, 5, 0.85);
  g.px(palette.skin, 2, 10, 1, 2);
  g.px(palette.skin, s - 3, 10, 1, 2);
  if (facing === "back") {
    // Spine seam down the back of the shirt.
    g.px(palette.shirtShade, s / 2 - 0.5, 9, 1, 5, 0.6);
  }

  // Chest-level accessory details sit on top of the finished shirt.
  paintChestDetail(g, s, facing, palette, accessory);

  // Legs, split left/right so a stride frame can offset them into a
  // mid-step pose (one leg forward/up, one back/down).
  const legW = (s - 6) / 2;
  const shift = stride ? 1 : 0;
  g.rr(palette.pants, 3, 14 - shift, legW, 4, 1);
  g.rr(palette.pants, 3 + legW, 14 + shift, legW, 4, 1);
  g.px(palette.pantsShade, s - 5, 15 + shift, 2, 3, 0.7);
  g.px(COLORS.playerOutline, s / 2 - 0.5, 14, 1, 4, 0.7);
}

/**
 * Skin-specific silhouette add-on drawn over the head/face, in the
 * gear's own shade — so each skin is unmistakably its own texture at a
 * glance, not just a shirt-colour swap on an otherwise identical sprite.
 * Face-level accessories (goggles/mask/bandana/visor) only apply facing
 * the camera; the back of the head has no face for them to sit on.
 */
function paintAccessory(
  g: PaintSurface,
  s: number,
  facing: Facing,
  palette: PlayerPalette,
  accessory: AccessoryKind,
): void {
  switch (accessory) {
    case "none":
    case "cross":
      return;
    case "cap":
      // Flat brim across the forehead, over the hair.
      g.px(palette.shirtShade, 3, 2, s - 6, 1, 1);
      g.px(palette.shirtShade, 2, 3, s - 4, 1, 0.9);
      return;
    case "hood":
      // Fabric framing the hair down both sides and across the top.
      g.px(palette.shirtShade, 2, 1, 1, 6, 0.9);
      g.px(palette.shirtShade, s - 3, 1, 1, 6, 0.9);
      g.px(palette.shirtShade, 3, 0, s - 6, 1, 0.9);
      return;
    case "goggles":
      if (facing !== "front") return;
      g.px(palette.shirtHi, 4, 6, s - 8, 2, 0.9);
      return;
    case "mask":
      if (facing !== "front") return;
      g.px(palette.shirtShade, 4, 7, s - 8, 3, 0.9);
      return;
    case "bandana":
      if (facing !== "front") return;
      g.px(palette.shirtShade, 4, 8, s - 8, 2, 0.95);
      return;
    case "helmet":
      // Full protective dome over the hair with a raised crest ridge —
      // reads from both facings (a firefighter's helmet has a back brim).
      g.rr(palette.shirtHi, 3, 0, s - 6, 5, 1);
      g.px(palette.shirtShade, 2, 4, s - 4, 1, 1);
      g.px(palette.shirtShade, s / 2 - 1, 0, 2, 4, 0.9);
      return;
    case "hardhat":
      // Domed shell with a short front brim, hair visible at the sides.
      g.rr(palette.shirtHi, 4, 0, s - 8, 4, 1);
      g.px(palette.shirtHi, 3, 3, s - 6, 1, 1);
      g.px(palette.shirtShade, s / 2 - 2, 0, 4, 1, 0.8);
      return;
    case "visor":
      // Full-face reflective band — the hazmat hood's sealed window.
      g.px(palette.shirtShade, 2, 1, 1, 7, 0.95);
      g.px(palette.shirtShade, s - 3, 1, 1, 7, 0.95);
      g.px(palette.shirtShade, 3, 0, s - 6, 1, 0.95);
      if (facing === "front") {
        g.px(palette.shirtHi, 4, 5, s - 8, 4, 0.95);
      }
      return;
    case "chefhat":
      // Tall white toque rising above the head, puffed at the crown —
      // painted in the shirt's whites so it always matches the uniform.
      g.rr(palette.shirt, 5, 0, s - 10, 3, 1);
      g.px(palette.shirtHi, 6, 0, 2, 2, 0.8);
      g.px(palette.shirtShade, 5, 3, s - 10, 1, 0.9);
      return;
    case "afro":
      // A huge round cloud of hair swallowing the whole scalp, wider than
      // the head itself — unmistakable even at sprite scale.
      g.ellipse(palette.hair, s / 2, 3, s - 4, 7, 1);
      g.px(palette.hairHi, 5, 1, 3, 1, 0.7);
      g.px(palette.hairHi, s - 8, 2, 2, 1, 0.6);
      // A red rubber nose, dead centre of the face.
      if (facing === "front") g.px(0xd84040, s / 2 - 1, 7, 2, 2, 1);
      return;
    case "partyhat":
      // A jaunty tilted paper cone in the accent highlight, with a pom-pom.
      g.px(palette.shirtHi, s - 8, 2, 3, 2, 1);
      g.px(palette.shirtHi, s - 7, 0, 2, 2, 1);
      g.px(palette.shirtShade, s - 7, 3, 3, 1, 0.8);
      g.px(palette.hairHi, s - 6, 0, 1, 1, 1);
      return;
    case "headset":
      // A radio headset: band over the crown, earcups both sides, and a
      // thin boom mic toward the mouth when facing the camera.
      g.px(palette.shirtShade, 4, 0, s - 8, 1, 0.95);
      g.px(palette.shirtShade, 3, 2, 2, 4, 1);
      g.px(palette.shirtShade, s - 5, 2, 2, 4, 1);
      if (facing === "front") {
        g.px(palette.shirtHi, 5, 6, 3, 1, 0.9);
        g.px(palette.shirtHi, 8, 7, 2, 1, 0.9);
      }
      return;
  }
}

/** Torso-level detailing (drawn after the shirt): currently only the
 *  paramedic's cross patch, kept separate from head accessories because it
 *  must paint over the shirt fill rather than under it. */
function paintChestDetail(
  g: PaintSurface,
  s: number,
  facing: Facing,
  palette: PlayerPalette,
  accessory: AccessoryKind,
): void {
  if (accessory !== "cross" || facing !== "front") return;
  const cx = s / 2 - 0.5;
  g.px(palette.shirtHi, cx, 9, 1, 4, 1);
  g.px(palette.shirtHi, cx - 1.5, 10.5, 4, 1, 1);
}
