# Art Direction 2.0, Phase C: every building gets the garage treatment

Phase B ([`../phase-b/REPORT.md`](../phase-b/REPORT.md)) rebuilt the garage as a real working building. This phase
applies the same construction logic to every building that had not had it, and fixes the lighting problem the
valley shots exposed.

## The rule (now art bible edition 2.5, pages 13 and 15)
A building in the snow is built the way it would be: **a footing** that keeps the walls out of the snow,
**framed openings** (frame, mullions, a sill with snow on it), **trim** at corners and eaves, **an overhang** on
visible rafter tails or a fascia, **icicles**, and **one or two signs that people use it** (a woodpile, a lamp, a
shovel, a canoe). The station wears one livery: barn red, ochre timber or cream steel, cream trim, red doors and
flashing, charcoal roofs.

## What changed

### The station yard (`art/3d/scripts/valley_buildings.py`, `src/render/stationView.ts`)
| Building | Before | After |
| --- | --- | --- |
| **Hangar 1** | A dark slate box under a dark arch | Cream corrugated cladding on a 0.9 m concrete stem wall. Red corner flashing and eave band. A clerestory of eight framed lites (lit at dusk). A red portal frame across the open bay, with the sliding doors parked open and their track over it. Filled gable ends and an overhanging arched roof with fascias. A crew door with awning and lamp, the roof vent, icicles |
| **Equipment room** | A brown box | Ochre board and batten on a concrete stem wall, with cream corner boards and frieze. Framed windows with sills, plus one on the east end, and a red crew door. A steeper roof on rafter tails with a fascia, a vent pipe, icicles, and a snow shovel by the door |
| **Koda's kennel** | Plank walls and a roof | Sleeper beams, cream corner boards, a framed arched doorway with straw at the sill, a fascia and icicles |
| **Radio mast hut** | A grey box | A concrete plinth, cream-trimmed board walls, a framed door with a lamp, a vent, an overhanging roof under snow, a cable tray, icicles. The mast stands on a concrete base |

The HANGAR 1 and EQUIPMENT signs now use the GARAGE sign's burgundy and cream. They were purple and mint. The
yard models bake their many paint roles to vertex colour, as the lodge and garage already did, so the extra parts
do not add draw calls.

### The valley
- **Chalets (Hollin, all three models):** icicles along both eaves, the winter's wood stacked under the east
  eave, a bench by the door.
- **Chapel:** icicles down the nave.
- **Fernhut cabin and the Tannberg top-station hut** (the same model): shutters, a woodpile against the west
  wall, a chopping block with its axe, a stone step, icicles.
- **Mirror Lake boathouse:** stone piers, cream corner boards, frieze and fascia, a framed window in each long
  wall, a lantern over the lake doors, rafter tails, icicles, and the patrol's red canoe upturned on trestles.
  It ships with `--sunk`: its jetty piles stand in the lake, as before.
- **Pass barrier hut:** a concrete plinth, a red and white control band, a framed window with its sill, a
  framed door with a lamp, a fascia, icicles.
- **Not changed:** the lodge and its wing (already the best-built object in the game). The mine cabin is a
  deliberate ruin; its broken state is the storytelling.

### Snow bounce (`src/render/kit.ts` `snowBounce`, `src/render/rig.ts`)
The valley shots showed every wall in shade dropping to a near-black block against bright snow, the chapel
worst of all. The terrain and the figures had their own light terms; buildings had nothing. Every plain kit
material, including the vertex-coloured baked buildings, now adds light thrown back up from the snow:
- The colour is the hemisphere's ground light × its intensity × 0.5, set by the rig each frame, and is off
  indoors.
- It is weighted by how much a face looks sideways or down: walls, soffits and eaves, not roofs.
- It costs a few ALU ops in the fragment shader, with no new pass and no new light.

### The grey wall under the foothills (`src/render/terrainView.ts` `buildBackdrop`)
Reported from a phone, riding a sled south across the valley floor: a flat grey curtain filled the frame under
the foothills.
- **Cause.** Phase A's range bands are joined by a smooth maximum, and erosion is added on the flanks. Together
  they lifted the first rings about **100 m within 60 m** of the valley's edge (75 m → 177 m at the south edge).
  From the valley floor that near-vertical step reads as a blank wall.
- **Fix.** The surface now leaves the valley at the valley's own grade and steepens over its first 360 m:
  75 → 89 → 107 → 137 → 187 → 250 m. Denser rings there carry the curve. The strip now reads as a snowy,
  timbered slope running up into the foothills, as in [compare-range-foot.jpg](compare-range-foot.jpg)
  (before left, after right; the same camera, south across the valley at 08:49).
- `tests/field-guide.test.ts` still passes. From the station, the bands' crests stand where they did.

### The HUD: less plum, more field notes (`src/ui/style.css`, block "the field notebook HUD")
In play, every HUD card is now a page from a pocket field notebook:
- **Paper and ink.** Cream paper with a faint blue graph rule, a kraft board edge, graphite text.
- **Pencils.** Red pencil for the patrol and emergencies (DISPATCH, north). The blue nav pencil for the
  waypoint and its distance.
- **Buttons.** Paper pills for the chips, and a paper act disc on a kraft lip.
- **Tokens.** New `:root` tokens: `--kraft`, `--graphite`, `--nav-ink`.
- **Unchanged.** The panels (map board, pause, wardrobe) keep the storybook card stock, and every control and
  44 px touch target stays. See [compare-hud-field-notes.jpg](compare-hud-field-notes.jpg): the plum glass
  left, the field notebook at 09:30 and 18:50.

## Evidence
Captured on both builds with the same cameras, clock and weather ([`capture.mjs`](capture.mjs)). Before is `main`
at `6b00f9a`. The phone shots are portrait 390 × 844 at 2x; the desktop shots are 1440 × 900. The yard upgrades
are all switched on for both builds.

| Sheet | Shots |
| --- | --- |
| [compare-yard.jpg](compare-yard.jpg) | Hangar, equipment room, kennel, mast |
| [compare-yard-dusk.jpg](compare-yard-dusk.jpg) | The yard at 18:50 |
| [compare-valley.jpg](compare-valley.jpg) | Hollin, chapel, a house, Fernhut cabin |
| [compare-valley-2.jpg](compare-valley-2.jpg) | Top-station hut, boathouse, barrier hut |
| [compare-desktop.jpg](compare-desktop.jpg) | The whole yard; Hollin from the edge of the village |

## Cost (renderer.info, the same views)

| Shot | Draw calls before → after | Triangles before → after |
| --- | --- | --- |
| p-hangar | 384 → 336 (-48) | 303,594 → 318,262 (+4.8 %) |
| p-equipment | 329 → 290 (-39) | 293,302 → 305,926 (+4.3 %) |
| p-kennel | 378 → 335 (-43) | 282,751 → 294,587 (+4.2 %) |
| p-mast | 317 → 290 (-27) | 257,657 → 269,129 (+4.5 %) |
| p-yard-dusk | 363 → 321 (-42) | 296,128 → 306,696 (+3.6 %) |
| p-hollin | 288 → 295 (+7) | 351,987 → 375,535 (+6.7 %) |
| p-chapel | 358 → 362 (+4) | 388,426 → 414,940 (+6.8 %) |
| p-house | 423 → 394 (-29) | 342,401 → 364,257 (+6.4 %) |
| p-cabin | 179 → 194 (+15) | 218,755 → 232,875 (+6.5 %) |
| p-topstation | 159 → 165 (+6) | 172,271 → 182,503 (+5.9 %) |
| p-boathouse | 122 → 130 (+8) | 172,836 → 179,388 (+3.8 %) |
| p-barrier | 156 → 156 (+0) | 197,534 → 202,838 (+2.7 %) |
| p-minecabin | 110 → 110 (+0) | 155,546 → 160,026 (+2.9 %) |
| d-yard | 449 → 416 (-33) | 553,106 → 569,778 (+3.0 %) |
| d-hollin | 472 → 470 (-2) | 629,411 → 660,205 (+4.9 %) |

**Not measured:** frame time on a real phone. Captures run in SwiftShader.

## Checks
- `npm run check`: typecheck, 200 tests, build.
- `tests/models.test.ts`: model triangle budgets raised on purpose, each with its old value noted.
- `tests/yard.test.ts`: the equipment room may read 2.4 m taller. The test samples vertices inside a square
  round the centre; the new roof has its ridge, vent and rafters inside it, while the code-built roof had
  vertices only at its corners, outside it.
- MeshCraft validate passes on all eleven models. The engine check passes on all of them; the boathouse is
  checked with `--sunk`.
- `art/MANIFEST.json` hashes updated. Art bible edition 2.5 re-captured.

## Still open
- The yard floor: worn paths, plough berms, sled ruts (plan item C1).
- The mission beacon: still a light column (plan C2).
- The lodge wing was not reworked. It shares the lodge's log construction, which already follows the rule.
