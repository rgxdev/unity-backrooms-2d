import { COLORS } from "@/game/config/constants";

/** Recolourable parts of the procedural player sprite (see `makePlayer` in
 *  PreloadScene). Outline and shadow stay fixed across skins on purpose —
 *  they're the keyline, not the "gear". */
export interface PlayerPalette {
  skin: number;
  skinShade: number;
  hair: number;
  hairHi: number;
  shirt: number;
  shirtHi: number;
  shirtShade: number;
  pants: number;
  pantsShade: number;
}

export interface SkinDefinition {
  id: string;
  name: string;
  description: string;
  palette: PlayerPalette;
  /** Official level index that must be escaped to unlock this skin.
   *  Undefined for the default skin, which is always available. */
  unlockLevel?: number;
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Lighten/darken a base colour, matching the additive-highlight /
 *  multiplicative-shade style of the hand-tuned default palette. */
function tone(hex: number, factor: number, add: number): number {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return (
    (clamp255(r * factor + add) << 16) |
    (clamp255(g * factor + add) << 8) |
    clamp255(b * factor + add)
  );
}

const hi = (hex: number): number => tone(hex, 1, 30);
const shade = (hex: number): number => tone(hex, 0.72, 0);

/** Build a full palette from a shirt/pants base colour, reusing the default
 *  skin tone and hair so reward skins read as different survival gear, not
 *  a different person. */
function gearPalette(shirt: number, pants: number): PlayerPalette {
  return {
    skin: COLORS.playerSkin,
    skinShade: COLORS.playerSkinShade,
    hair: COLORS.playerHair,
    hairHi: COLORS.playerHairHi,
    shirt,
    shirtHi: hi(shirt),
    shirtShade: shade(shirt),
    pants,
    pantsShade: shade(pants),
  };
}

export const DEFAULT_SKIN_ID = "default";

/** Reward skins line up 1:1 with the official levels — escape a level, keep
 *  its gear. Order matches `OFFICIAL_LEVELS`. */
export const SKINS: readonly SkinDefinition[] = [
  {
    id: DEFAULT_SKIN_ID,
    name: "Wanderer",
    description: "The blue jumpsuit you noclipped in with.",
    palette: {
      skin: COLORS.playerSkin,
      skinShade: COLORS.playerSkinShade,
      hair: COLORS.playerHair,
      hairHi: COLORS.playerHairHi,
      shirt: COLORS.playerShirt,
      shirtHi: COLORS.playerShirtHi,
      shirtShade: COLORS.playerShirtShade,
      pants: COLORS.playerPants,
      pantsShade: COLORS.playerPantsShade,
    },
  },
  {
    id: "lobby-khaki",
    name: "Lobby Veteran",
    description: "Faded khaki fatigues — earned by escaping Level 0.",
    palette: gearPalette(0x8a8a4a, 0x4a462c),
    unlockLevel: 0,
  },
  {
    id: "concrete-grey",
    name: "Habitable Drifter",
    description: "Damp grey overalls — earned by escaping Level 1.",
    palette: gearPalette(0x7a828c, 0x3a3f46),
    unlockLevel: 1,
  },
  {
    id: "pipe-teal",
    name: "Pipe Dreamer",
    description: "Steam-stained teal coveralls — earned by escaping Level 2.",
    palette: gearPalette(0x3f8f78, 0x24443a),
    unlockLevel: 2,
  },
  {
    id: "pool-cyan",
    name: "Poolrooms Wader",
    description: "Chlorine-bleached cyan wetsuit — earned by escaping Level 3.",
    palette: gearPalette(0x4ab0c9, 0x1f5866),
    unlockLevel: 3,
  },
  {
    id: "survivor-red",
    name: "Backrooms Survivor",
    description: "Hazard-red gear for those who outran Level 4.",
    palette: gearPalette(0xc9503f, 0x5c2620),
    unlockLevel: 4,
  },
];

export function getSkin(id: string): SkinDefinition {
  return SKINS.find((s) => s.id === id) ?? SKINS[0]!;
}

/** The skin a run should actually spawn with: the equipped skin if it's
 *  unlocked, otherwise the default (e.g. progress was reset but the
 *  settings' `skinId` wasn't). */
export function resolveEquippedSkinId(
  unlockedSkins: readonly string[],
  skinId: string,
): string {
  return unlockedSkins.includes(skinId) ? skinId : DEFAULT_SKIN_ID;
}
