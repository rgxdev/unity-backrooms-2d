# Task 0 Research: Backrooms-Wiki Canon Check

Research pass for the per-level monster roster feature (see `plan.md` Task 0).
Primary source: `backrooms-wiki.wikidot.com` (the original community wiki, entity
pages `entity-N`, level pages `level-N`). Where the wikidot page didn't cover a
specific claim, a reputable mirror/summary is cited and flagged as such.
Fetched 2026-07-07.

**Important framing note before the per-level detail:** `backrooms-wiki.wikidot.com`
is a living collaborative wiki — its own entity pages and level pages are not
always cross-consistent (e.g. an entity's own bio page lists levels it inhabits,
but a level's page independently lists entities present, and the two lists
don't always agree with each other). Where that happened I've noted the
discrepancy rather than silently picking one.

---

## Level 0 — "The Lobby"

**Wiki canon status:** `level-0` states entities are **unconfirmed** for this
level: *"It is unknown whether or not entities exist in Level 0."* Reported
phenomena (dark figures, scopophobia, whispering) are explicitly called out as
possibly hallucinations, not confirmed entities. Primary danger on Level 0 is
canonically psychological/environmental, not creature-based.

**Smiler (Entity 3):**
- Behavior: attracted to light, will chase any light source it sees; attacks
  are triggered by the target panicking, fleeing, or making loud noise;
  survival method is holding eye contact and backing away slowly. Long
  toothy smile, glowing white eyes.
- Its own entity page's "associated levels" list is "majority of levels"
  plus explicit mentions of Level 2 and Level 3 (dark areas) and its own
  "Smiling Room" — Level 0 is **not** explicitly named on the Smiler's own
  bio page.
- Current wiki status oddity: some current wikidot text describes the Smiler
  as **extinct in-universe** (reports of it combusting after long light
  exposure). Treat this as current in-fiction lore, not a reason to drop it —
  most community coverage and older canon still treats it as an active,
  iconic entity, and it's the most recognizable "jump-scare" entity in the
  whole wiki.
- **Verdict for the game:** the game's existing `lore.ts` framing — "a Smiler
  was logged near a Red Room sub-section, no confirmed kills" — is a
  reasonable, cautiously-worded fit given Level 0's own "entities unconfirmed"
  status. It isn't literally documented as a Level 0 resident, but it doesn't
  contradict anything either, and the "rare, unconfirmed, no kills" framing
  already matches Level 0's actual canon tone. Keep it, keep the "rare
  sighting" framing (don't upgrade it to a resident hazard).
- Source: `backrooms-wiki.wikidot.com/entity-3`, `backrooms-wiki.wikidot.com/level-0`.

---

## Level 1 — "Habitable Zone"

**Wiki canon status:** `level-1` documents a long entity roster (Arms,
Clumps, Crawlers, Dullers, Growlers, Hounds, Nguithr'xurh, Skin-Stealer,
Smilers, Wrangler, Wretches). The three the game already uses are all
genuinely on that list.

**Facelings (Entity 9):**
- Behavior: near-human anatomy but faceless; obsessively mimics human
  routines/culture with limited understanding (cashiers, office workers,
  holidays, prayer) — mostly harmless curiosities, "more than glad to offer
  what assistance they can" toward humans.
- Aggression: poor impulse control, easily angered by disturbances,
  especially if intentionally assaulted or if a child faceling / their group
  is threatened — "will do anything in their power to defend each other."
  Physically weak, "relatively easy to evade" once angry.
- **Verdict:** game's claim ("mimics wanderer behavior, generally harmless
  unless provoked/cornered") is accurate and well-supported. Refinement: the
  provoke-trigger is specifically *assault or threatening the group/young*,
  and even angered they're weak/evadable rather than deadly — good fit for
  the planned "harmless, ambiguous presence" mechanic (Task 6).
- Source: `backrooms-wiki.wikidot.com/entity-9`, `backrooms-wiki.wikidot.com/level-1`.

**Skin-Stealers (Entity 10):**
- Behavior: tall, pale, sunken-eyed humanoids. Two states — docile (wanders
  aimlessly, non-hostile unless provoked) and hunger-state (actively hunts
  isolated humans, kills with bare-hand strength). Disguise: steals and wears
  a victim's skin via sucker-like bumps that keep it looking "alive" for
  ~24h before it's digested and the creature returns to docile wandering.
  Cannot truly speak language — parrots overheard phrases to lure prey.
  Reliable tell: translucent/clear blood vs. red human blood.
- The entity's own bio page does **not** explicitly say "avoid eye contact" —
  that specific instruction appears on the `level-1` page's entity summary
  table ("avoid eye contact, do not engage") rather than the dedicated entity
  page. Treat "avoid eye contact" as the documented in-game *survival advice*
  for this level rather than a biological trait of the creature — functionally
  the same for gameplay purposes, but worth knowing it's advice-canon, not
  anatomy-canon.
- **Verdict:** game's claim is accurate. Keep "avoid eye contact, don't
  engage" as the behavior flag; it matches both the `level-1` survival guidance
  and the broader docile-unless-provoked characterization.
- Source: `backrooms-wiki.wikidot.com/entity-10`, `backrooms-wiki.wikidot.com/level-1`.

**Hounds (Entity 8):**
- Behavior: humanoid, travels/hunts on all fours, dog-like face and claws.
  Becomes hostile the instant it spots a human; can be **intimidated
  (temporarily) by direct, sustained eye contact** — buys time to flee, but
  doesn't work indefinitely. Audible warning: a growl heard before a Hound is
  in sight means stay hidden/out of its line of sight.
- The wikidot entity page itself does **not** explicitly describe pack
  hunting or howling as a group call — that detail (packs communicating via
  growls/barks/howls, coordinated hunting) is documented on the Fandom
  "Backrooms Wiki" mirror (`backrooms.fandom.com/wiki/Entity_8`), which is a
  reputable, widely-used community mirror but a distinct wiki from
  wikidot's. `level-1`'s own summary line ("travel in packs, drawn to
  sustained noise") is closer to the game's existing claim and does appear on
  wikidot itself.
- **Verdict:** "pack hunters drawn to noise" is supported by `level-1`'s own
  wikidot summary; "howl" specifically is Fandom-mirror-sourced, not wikidot
  own-entity-page-sourced — safe to keep (it's a natural read of "growl/bark"
  vocalization and is common-enough community canon) but noted as
  mirror-derived rather than wikidot-primary. The core hazard mechanic to
  keep is: eye contact briefly deters, noise draws them in.
- Source: `backrooms-wiki.wikidot.com/entity-8`, `backrooms-wiki.wikidot.com/level-1`;
  pack/howl detail additionally via `backrooms.fandom.com/wiki/Entity_8` (mirror, not wikidot-primary).

---

## Level 2 — "Pipe Dreams"

**Wiki canon status:** `level-2` lists a large roster including Smilers
(now the *most common* entity there, drawn in by an in-fiction "blackout"),
Deathmoths, Hounds, Facelings, and (formerly) Skin-Stealers, among others.

**Deathmoths (Entity 4):**
- Behavior/biology: not a single organism — four castes (Common ~80% of
  population, Praetorian defenders, larvae, rare Empress colony-founders).
  Males are docile scavengers, females are aggressive hunters; a swarm "can
  desiccate an incapacitated human in one to two hours." Documented
  attractant is specifically **light**, not heat/steam: *"Bright lights can
  attract Deathmoths — if you know Deathmoths are nearby, extinguish or dim
  your lights."*
- Its own bio page's "associated levels" list (14 levels: 0, 24, 77, 79, 80,
  102, 103, 108, 116, 117, 406, plus a few named levels) does **not** include
  Level 2 — but the separate `level-2` page independently lists Deathmoths as
  present, with a specific in-fiction detail that their population shrank and
  individuals got smaller after a level-wide "blackout" reduced food
  availability. This is a real internal wiki inconsistency (own-entity-page
  list vs. level-page list disagree); `level-2` is the more directly relevant
  source for "is this entity in this level" so it's the one to trust here.
- **Verdict:** Deathmoths being present on Level 2 is wiki-documented (via the
  level page), but "cluster near active steam vents" is a game-authored
  embellishment — the actual documented attractant/repellent is light, not
  heat or steam. Recommend either keeping the flavor text but swapping the
  mechanic hook to "avoid bright light near them" (more accurate), or keeping
  "steam vents" purely as environmental flavor text (Level 2 is themed around
  pipes/heat anyway) while making the actual gameplay trigger light-based to
  match canon.
- Source: `backrooms-wiki.wikidot.com/entity-4`, `backrooms-wiki.wikidot.com/level-2`.

**Hounds on Level 2:** `level-2` describes them as "semi-frequent pack
hunters," behaviorally unchanged for centuries, "less noteworthy" since the
in-fiction blackout — reasonably read as passing-through rather than a core
resident threat, consistent with the game's "Hound packs pass through en
route to other levels rather than nesting here" framing. That specific
"passing through, not nesting" phrasing is a fair paraphrase, not a direct
quote, but doesn't contradict anything documented.

Source: `backrooms-wiki.wikidot.com/level-2`.

---

## Level 3 — "Poolrooms" (game) — canon naming mismatch, read carefully

**Critical finding: the game's Level 3 name does not match the wiki's actual
Level 3.** On `backrooms-wiki.wikidot.com`, **Level 3 is "Electrical
Station"** — an old, dangerous electrical facility with M.E.G. Base Gamma,
first discovered in 2008, home to entities like Clumps, Wretches, and others.
It has nothing to do with pools or tile rooms.

**The Poolrooms is documented as Level 37 ("Sublimity")**, not Level 3, across
every mirror checked (wikidot itself is effectively unreachable for that
specific page in this pass, but Fandom's Backrooms Wiki, Escape the Backrooms
Wiki, and multiple secondary summaries all agree on Level 37 for the
tile-and-water Poolrooms). Level 37 is consistently classified **Class 1 —
Safe**, and is explicitly documented as **devoid of entities**: *"no
encounters with entities or other wanderers recorded... unknown if this
results from some isolating property of Level 37, or if the level is so
unimaginably large that one could not possibly come across another living
being."* (A separate, more dangerous sub-level, "37.2 / Dark Poolrooms," does
have entities like Clumps — but that's a distinct sub-level, not the
Poolrooms proper, and out of scope here.)

**This means the game already has a pre-existing, unrelated naming
divergence at Level 3 — same category of issue as Level 4 — and it should be
called out the same way, not fixed silently by this task.** (Renumbering the
game's level order is out of scope for the monster-roster feature; flagging
it is in scope.)

**Recommendation for the roster:**
1. The strongest wiki-accurate choice given the *actual* Poolrooms (L37) canon
   is to keep Level 3 (as depicted in this game — a tile/water level) **at or
   near zero dedicated resident entities**, consistent with its real-world
   canon counterpart's "Class 1 Safe, devoid of entities" status. The
   existing `lore.ts` line ("No confirmed hostile entities as of this
   writing") is, ironically, already the most wiki-accurate text in the whole
   lore file — don't remove it or contradict it with a new named entity.
2. Per the plan's own risk mitigation, if a *rare* spawn is wanted for pacing
   variety, reuse an existing kind as an explicit crossover/anomaly rather
   than inventing a new named entity: a low-weight, rare **Skin-Stealer** (or
   Hound) sighting, framed in-lore as "shouldn't be here, passing through /
   anomalous," not as a documented Poolrooms resident. This matches the
   plan's suggested mitigation exactly and keeps the "no silent invention
   presented as documented fact" requirement intact.
3. Do not invent a new named "Poolrooms entity" and present it as wiki canon.

Source: `backrooms-wiki.wikidot.com/level-3` (confirms Level 3 = Electrical
Station, not Poolrooms); Poolrooms/Level 37 status via `backrooms.fandom.com/wiki/Level_37`,
`escapethebackrooms.fandom.com/wiki/Level_37`, and cross-referencing web
search summaries of wikidot's Level 37 page (wikidot's own Level 37 page
itself returned no direct fetch in this pass; treated as community-mirror-sourced,
not wikidot-primary, for the "devoid of entities" characterization —
though multiple independent mirrors agree, which is why it's treated as
solid enough to act on).

---

## Level 4 — "Run For Your Life" (game) — original content, no canon claim

Confirmed: the wiki's actual Level 4 is **"The Thousand Yard Stare"**, an
unrelated, distinct level. "Run For Your Life" as named/used in this game is
**original content created for this game**, not a 1:1 documented Backrooms-wiki
level. No canon research applies here and none should be claimed — keep it as
an elite/unnamed pursuer with no wiki-sourced lore text, exactly as the plan
already specifies. This note exists so nobody later mistakes "Run For Your
Life" for a documented wiki level when writing lore or marketing copy.

---

## Summary Table

| Level (game) | Entities | Canon status |
|---|---|---|
| 0 The Lobby | Smiler (rare, unconfirmed-tier) | Level itself is "entities unconfirmed" canon; Smiler's own bio page doesn't name Level 0 explicitly, but framing doesn't contradict anything. Keep as rare/no-confirmed-kills. |
| 1 Habitable Zone | Faceling, Skin-Stealer, Hound | All three solidly wiki-documented on `level-1`'s own entity table. Faceling = harmless-unless-provoked (confirmed). Skin-Stealer = avoid eye contact/don't engage (confirmed, though "eye contact" is level-page advice, not entity-bio anatomy). Hound = pack, noise-drawn, eye-contact deters (confirmed on wikidot); "howl" specifically is Fandom-mirror, not wikidot-primary. |
| 2 Pipe Dreams | Deathmoth, Hound (passing through) | Deathmoth presence confirmed via `level-2` page (though entity's own bio page's level list omits Level 2 — internal wiki inconsistency); documented attractant is light, not steam/heat — "steam vent clustering" is game flavor, not wiki fact. Hound "passing through" framing is a fair paraphrase. |
| 3 Poolrooms (game) | Recommend: none, or rare Skin-Stealer/Hound crossover only | **Naming mismatch**: wiki's real Level 3 is Electrical Station; wiki's real Poolrooms is Level 37, documented Class-1-Safe/entity-free. Existing "no confirmed hostile entities" lore text is the most accurate line in the file — keep it, don't add a new named entity. |
| 4 Run For Your Life | None (original content) | Not the wiki's Level 4 ("Thousand Yard Stare"). Explicitly original; no canon claim. |
