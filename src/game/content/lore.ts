/**
 * Found documents scattered through the Backrooms: torn letters from other
 * wanderers and pages ripped out of M.E.G. (Mostly Encountered Groups) field
 * guides. Content is grounded in the community-documented Backrooms lore for
 * each named area — noclipping, wanderer groups, the Almond Water staple,
 * and the entities/hazards specific to each level — rewritten as in-fiction
 * notes rather than quoted verbatim from any single source.
 */
export type LoreKind = "letter" | "book";

export interface LoreEntry {
  kind: LoreKind;
  title: string;
  body: string;
}

export const LEVEL_LORE: Record<number, readonly LoreEntry[]> = {
  // Level 0 — The Lobby
  0: [
    {
      kind: "letter",
      title: "Torn Notebook Page",
      body:
        "If you're reading this you noclipped in the same way I did — through " +
        "a wall you weren't looking at, in a room you'd stopped paying " +
        "attention to. Stay quiet. Stay off the carpet seams. The buzzing " +
        "never stops and after a while you stop hearing it, which is worse.",
    },
    {
      kind: "letter",
      title: "Water-Stained Note",
      body:
        "Day nine, maybe ten. Started mopping a dry floor this morning and " +
        "didn't notice for an hour. M.E.G. calls it going frycook — the " +
        "monotony eats you before anything else does. Keep a task that " +
        "isn't the walls. Count doorframes. Anything.",
    },
    {
      kind: "book",
      title: "M.E.G. Field Guide — Entry: The Lobby",
      body:
        "Designation: Level 0. Mono-yellow wallpaper, damp Berber carpet, " +
        "fluorescent hum at a constant sixty cycles. Structurally infinite; " +
        "self-similar past a few hundred rooms. Entities are rare here but " +
        "not absent — a Smiler was logged near a Red Room sub-section, no " +
        "confirmed kills. Primary danger is psychological, not physical.",
    },
    {
      kind: "letter",
      title: "Scrawled Warning",
      body:
        "Found a hole in the floor where a room should have been. Didn't " +
        "step near the edge, didn't hear it breathe, didn't wait to find out " +
        "what the drop looked like from up close. If the carpet just stops, " +
        "you turn around.",
    },
    {
      kind: "letter",
      title: "Folded Page",
      body:
        "There's a room past the pillars where the light goes warm instead " +
        "of sick-yellow. Manila-colored walls, quiet. First safe-feeling " +
        "room I've found. Slept two hours. Didn't dream, which almost never " +
        "happens anymore.",
    },
  ],

  // Level 1 — Habitable Zone
  1: [
    {
      kind: "book",
      title: "M.E.G. Field Guide — Entry: Habitable Zone",
      body:
        "Designation: Level 1. Warehouse-scale open sections, bare concrete, " +
        "exposed rebar, dim sodium lighting. One of the more survivable " +
        "levels — several wanderer groups maintain semi-permanent camps near " +
        "the pillar clusters. Noise carries far; keep it below a shout.",
    },
    {
      kind: "letter",
      title: "Charcoal-Written Note",
      body:
        "Set up near the third pillar row, close enough to the old camp " +
        "markings that I know others made it this far. Heard something " +
        "large moving two, three rooms over last night. Didn't come closer. " +
        "Didn't sleep either.",
    },
    {
      kind: "letter",
      title: "Supply Crate Tag",
      body:
        "Left six bottles of Almond Water under the loose rebar section, " +
        "east side. If you find this camp before I get back, take what you " +
        "need and leave a mark on the crate so I know someone made it " +
        "through.",
    },
    {
      kind: "book",
      title: "M.E.G. Field Guide — Entities of the Upper Levels",
      body:
        "Facelings: mimic wanderer behaviour, generally harmless if not " +
        "provoked or cornered. Skin-Stealers: avoid direct eye contact, do " +
        "not engage. Hounds: travel in packs, drawn to sustained noise — if " +
        "you hear distant howling, it is already tracking something.",
    },
    {
      kind: "letter",
      title: "Shaking Handwriting",
      body:
        "First howl I've heard since coming through. Long, low, and it " +
        "didn't answer when I stopped moving to listen for a second one. " +
        "Worse than the noise was how close it sounded and how far I " +
        "still had to go before the next pillar row. Kept my footsteps " +
        "small the rest of the way.",
    },
  ],

  // Level 2 — Pipe Dreams
  2: [
    {
      kind: "letter",
      title: "Heat-Warped Page",
      body:
        "Pitch dark past the first junction, and hot enough that the paper " +
        "I'm writing on is already curling. Learned to tap the pipes twice " +
        "and listen — if something taps back that isn't an echo, you back " +
        "out the way you came.",
    },
    {
      kind: "book",
      title: "M.E.G. Field Guide — Entry: Pipe Dreams",
      body:
        "Designation: Level 2. A maintenance-tunnel maze of rusted pipework, " +
        "near-total darkness, and ambient heat well above comfortable. " +
        "Deathmoths cluster near active steam vents; Hound packs pass " +
        "through en route to other levels rather than nesting here.",
    },
    {
      kind: "letter",
      title: "Scorched Note",
      body:
        "Valve blew without warning two rooms back. Lost most of the " +
        "hearing in my left ear from the pressure. If you hear a hiss build " +
        "up in pitch, that's your ten-second warning — move now, ask " +
        "questions never.",
    },
    {
      kind: "letter",
      title: "Mould-Spotted Page",
      body:
        "The smell stops registering after a while, same as the noise did " +
        "back in the Lobby. That's the pattern with every level, I think — " +
        "it wants you comfortable right up until it doesn't.",
    },
    {
      kind: "letter",
      title: "Shaky Follow-Up",
      body:
        "The howling from the Habitable Zone followed me down here, or " +
        "one just like it did. Pipes carry sound strangely — couldn't tell " +
        "which junction it came from, which meant I couldn't tell which " +
        "junction to avoid. Went the way it sounded quietest. Still here, " +
        "so that much worked.",
    },
  ],

  // Level 3 — Poolrooms
  3: [
    {
      kind: "letter",
      title: "Water-Warped Page",
      body:
        "Every room is the same white tile, the same warm waist-deep water, " +
        "for as long as I've been wading. No entities so far, which almost " +
        "makes it worse — nothing to run from, nothing to tell you you're " +
        "making progress.",
    },
    {
      kind: "book",
      title: "M.E.G. Field Guide — Entry: Poolrooms",
      body:
        "Designation: Level 3. Seamless ceramic tile, standing water at a " +
        "stable temperature, faint chlorine-adjacent smell. Wanderers use " +
        "these rooms to wash off residue from Pipe Dreams before continuing. " +
        "No confirmed hostile entities as of this writing.",
    },
    {
      kind: "letter",
      title: "Dripping Note",
      body:
        "Counted the same drain cover four times before I admitted I was " +
        "going in circles. Started tearing a thread from my sleeve at every " +
        "turn. It's slow, but it works better than trusting the tile to " +
        "look different eventually.",
    },
  ],

  // Level 4 — Run For Your Life
  4: [
    {
      kind: "letter",
      title: "Frantic Scrawl",
      body:
        "DO NOT STOP. Whatever you do, don't stop to read the rest of this " +
        "when you hear it behind you. Scorched concrete, hazard tape, one " +
        "hallway of lead on a good day. Keep moving.",
    },
    {
      kind: "book",
      title: "Torn Field Guide Fragment",
      body:
        "...if you hear it closing behind you, do not look back. There is " +
        "no outrunning it by speed alone, only by distance already banked " +
        "before it noticed you. Every second spent confirming it's there is " +
        "a second it isn't spending catching up.",
    },
    {
      kind: "letter",
      title: "Last Entry",
      body:
        "Made it further than I thought I would. Hazard markings switch " +
        "direction up ahead, no way to tell which way is actually out. " +
        "Going to try left. If anyone finds th—",
    },
  ],
};

/** Falls back to Level 0's document pool for any level index without its own
 *  authored set, so the feature never silently no-ops on a new level. */
export function getLoreForLevel(levelIndex: number): readonly LoreEntry[] {
  return LEVEL_LORE[levelIndex] ?? LEVEL_LORE[0]!;
}
