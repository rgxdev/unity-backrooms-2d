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

/** Small silhouette add-on drawn on top of the base sprite (see `makePlayer`
 *  in PreloadScene) — gives every skin a distinguishing shape, not just a
 *  different shirt/pants hue, so they read as clearly different textures
 *  even at the sprite's small on-screen size. */
export type AccessoryKind =
  | "none"
  | "cap"
  | "hood"
  | "goggles"
  | "mask"
  | "bandana"
  | "helmet"
  | "hardhat"
  | "visor"
  | "cross";

export interface SkinDefinition {
  id: string;
  name: string;
  description: string;
  palette: PlayerPalette;
  accessory: AccessoryKind;
  /** Official level index that must be escaped to unlock this skin.
   *  Undefined means the skin is always available — the default skin and
   *  the wardrobe (profession) set. */
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

/** Build a full palette from a shirt/pants/hair base colour, reusing the
 *  default skin tone so reward skins still read as the same person in
 *  different gear — but with their own hair colour and accessory (see
 *  `AccessoryKind`) so each skin is unmistakably its own texture rather
 *  than a near-identical recolour. */
function gearPalette(shirt: number, pants: number, hair: number): PlayerPalette {
  return {
    skin: COLORS.playerSkin,
    skinShade: COLORS.playerSkinShade,
    hair,
    hairHi: hi(hair),
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
    accessory: "none",
  },
  {
    id: "lobby-khaki",
    name: "Lobby Veteran",
    description: "Faded khaki fatigues — earned by escaping Level 0.",
    palette: gearPalette(0x8a8a4a, 0x4a462c, 0x4a4028),
    accessory: "cap",
    unlockLevel: 0,
  },
  {
    id: "concrete-grey",
    name: "Habitable Drifter",
    description: "Damp grey overalls — earned by escaping Level 1.",
    palette: gearPalette(0x7a828c, 0x3a3f46, 0x2e3136),
    accessory: "hood",
    unlockLevel: 1,
  },
  {
    id: "pipe-teal",
    name: "Pipe Dreamer",
    description: "Steam-stained teal coveralls — earned by escaping Level 2.",
    palette: gearPalette(0x3f8f78, 0x24443a, 0x1f3d34),
    accessory: "goggles",
    unlockLevel: 2,
  },
  {
    id: "pool-cyan",
    name: "Poolrooms Wader",
    description: "Chlorine-bleached cyan wetsuit — earned by escaping Level 3.",
    palette: gearPalette(0x4ab0c9, 0x1f5866, 0x18404a),
    accessory: "mask",
    unlockLevel: 3,
  },
  {
    id: "survivor-red",
    name: "Backrooms Survivor",
    description: "Hazard-red gear for those who outran Level 4.",
    palette: gearPalette(0xc9503f, 0x5c2620, 0x3a1f1a),
    accessory: "bandana",
    unlockLevel: 4,
  },
  {
    id: "hotel-crimson",
    name: "Hotel Bellhop",
    description: "Wine-red livery with brass trim — earned by escaping Level 5.",
    palette: gearPalette(0x8c2432, 0x3a1218, 0x1f1210),
    accessory: "cap",
    unlockLevel: 5,
  },
  {
    id: "blackout-grey",
    name: "Blackout Runner",
    description: "Light-swallowing matte gear — earned by escaping Level 6.",
    palette: gearPalette(0x3a3f48, 0x1c1f24, 0x14161a),
    accessory: "hood",
    unlockLevel: 6,
  },

  // ——— Wardrobe set: who you were before you noclipped. Always available
  // (no unlockLevel) — pure flavour, not progression rewards.
  {
    id: "police",
    name: "Police Officer",
    description: "Navy uniform and duty cap — you were mid-patrol when the floor gave way.",
    palette: gearPalette(0x2c4a78, 0x1c2a44, 0x2a2018),
    accessory: "cap",
  },
  {
    id: "firefighter",
    name: "Firefighter",
    description: "Turnout gear with reflective trim — the alarm was real, the building wasn't.",
    palette: {
      ...gearPalette(0xb03a28, 0x4c1e16, 0x3a2a1a),
      shirtHi: 0xe8c33a,
      hairHi: 0xe8c33a,
    },
    accessory: "helmet",
  },
  {
    id: "paramedic",
    name: "Paramedic",
    description: "White response uniform, red cross — someone here still needs help.",
    palette: {
      ...gearPalette(0xe4e6ea, 0x3a3f48, 0x4a3a26),
      shirtHi: 0xd84040,
      shirtShade: 0xb0b4bc,
    },
    accessory: "cross",
  },
  {
    id: "construction",
    name: "Construction Worker",
    description: "Hi-vis orange and a hard hat — you know load-bearing walls. These aren't.",
    palette: {
      ...gearPalette(0xd87c2a, 0x3f3a34, 0x2e2418),
      shirtHi: 0xf2d43a,
    },
    accessory: "hardhat",
  },
  {
    id: "hazmat",
    name: "Hazmat Specialist",
    description: "Sealed yellow suit — whatever leaked in here, it wasn't on your checklist.",
    palette: {
      ...gearPalette(0xd4c032, 0xb0a028, 0x2a2a2a),
      hair: 0xd4c032,
      hairHi: 0xe8d858,
      shirtHi: 0xbfe6ea,
    },
    accessory: "visor",
  },
  {
    id: "security",
    name: "Security Guard",
    description: "Black shift uniform — you watched the monitors. Something watched back.",
    palette: gearPalette(0x2c2c34, 0x1a1a20, 0x1e1a16),
    accessory: "cap",
  },
];

export function getSkin(id: string): SkinDefinition {
  return SKINS.find((s) => s.id === id) ?? SKINS[0]!;
}

/** Whether a skin is wearable: reward skins need their level escaped (tracked
 *  in progress), everything without an `unlockLevel` is always available. */
export function isSkinUnlocked(
  skin: SkinDefinition,
  unlockedSkins: readonly string[],
): boolean {
  return skin.unlockLevel === undefined || unlockedSkins.includes(skin.id);
}

/** The skin a run should actually spawn with: the equipped skin if it's
 *  unlocked, otherwise the default (e.g. progress was reset but the
 *  settings' `skinId` wasn't). */
export function resolveEquippedSkinId(
  unlockedSkins: readonly string[],
  skinId: string,
): string {
  const skin = SKINS.find((s) => s.id === skinId);
  return skin && isSkinUnlocked(skin, unlockedSkins) ? skinId : DEFAULT_SKIN_ID;
}
