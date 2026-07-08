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
        "Deathmoths are drawn to light more than to the heat itself — keep " +
        "torches low. Hound packs pass through en route to other levels " +
        "rather than nesting here.",
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
        "No confirmed resident hostile entities as of this writing — the " +
        "rare report of something on all fours passing through is " +
        "unverified, and if real, isn't native to these rooms.",
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
    {
      kind: "letter",
      title: "Smeared Page",
      body:
        "Passed something in the smoke that used to be one of us. Torn " +
        "jumpsuit, wrong angles, making a sound like a scream played " +
        "backwards. It didn't see me — its eyes are gone. It heard my " +
        "sleeve brush the wall, though. Ran until the tape changed colour.",
    },
  ],

  // Level 5 — The Terror Hotel
  5: [
    {
      kind: "book",
      title: "M.E.G. Field Guide — Entry: The Terror Hotel",
      body:
        "Designation: Level 5. A pre-war grand hotel of indefinite floor " +
        "count: mahogany panelling, red carpet, brass fittings, perpetual " +
        "night beyond every window. Facelings in period attire staff the " +
        "halls and ignore polite guests. The boiler sections below draw " +
        "Deathmoths. Do not use the elevator. Do not RSVP to anything.",
    },
    {
      kind: "letter",
      title: "Hotel Stationery, Unsigned",
      body:
        "Room 214's door was open and the bed was made and warm. I didn't " +
        "stay. The concierge nodded at me on the way out — no face, but it " +
        "nodded, and I nodded back, and that courtesy is the only reason " +
        "I'm still writing, I think. Mind your manners in here.",
    },
    {
      kind: "letter",
      title: "Party Invitation",
      body:
        "Heavy card stock, gold ink, smells faintly of frosting: YOU ARE " +
        "CORDIALLY INVITED. BALLROOM B. FOREVER O'CLOCK. There's a smiley " +
        "face where the signature should be. The music from below the " +
        "floorboards has not stopped in six days. Do not go to Ballroom B.",
    },
    {
      kind: "letter",
      title: "Bellhop's Note",
      body:
        "Whatever wears yellow down there is not a costume. It hugged " +
        "Marchetti and Marchetti didn't come back up, and the music got one " +
        "voice louder. If you hear balloons squeaking against the ceiling " +
        "of a room with no balloons, leave the floor entirely.",
    },
    {
      kind: "book",
      title: "Torn Guest Ledger",
      body:
        "Names going back decades, all in different hands, all checked in, " +
        "none checked out. The last page is fresher than the rest: my own " +
        "name, in handwriting I almost recognise, dated tomorrow.",
    },
  ],

  // Level 6 — Lights Out
  6: [
    {
      kind: "book",
      title: "M.E.G. Field Guide — Entry: Lights Out",
      body:
        "Designation: Level 6. An unlit industrial complex — steel plate, " +
        "cable trays, catwalks. Portable light sources function at a " +
        "fraction of their rated output and fail entirely for minutes at a " +
        "time. Smiler activity is the highest of any indexed level: if a " +
        "grin hangs in the dark ahead of you, it has been watching for a " +
        "while. Move quietly, touch the wall, and never run toward a light.",
    },
    {
      kind: "letter",
      title: "Note Written Blind",
      body:
        "Writing this without seeing it so forgive the lines. Torch died " +
        "forty steps back and something started matching my footsteps, " +
        "half a beat late, like a bad echo. When I stopped, it took one " +
        "more step. I am going to keep walking now.",
    },
    {
      kind: "letter",
      title: "Grease-Pencil Marks",
      body:
        "Tall grey figure at the end of the cable run, standing where the " +
        "dark is thickest. Doesn't chase. Follows. Every time I rest it is " +
        "the same distance away, and I am so, so tired — which I think is " +
        "the point. Don't sleep on this level. Don't.",
    },
    {
      kind: "letter",
      title: "Final Battery Bar",
      body:
        "Counted three grins tonight, all at different heights. The manual " +
        "says don't look at them and don't run. The manual was written by " +
        "someone with a working torch. The exit seam glows — it's the only " +
        "honest light down here. Head for it and don't stop to make sure.",
    },
  ],
};

/** Falls back to Level 0's document pool for any level index without its own
 *  authored set, so the feature never silently no-ops on a new level. */
export function getLoreForLevel(levelIndex: number): readonly LoreEntry[] {
  return LEVEL_LORE[levelIndex] ?? LEVEL_LORE[0]!;
}
