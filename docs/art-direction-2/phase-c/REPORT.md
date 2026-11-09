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

COST_TABLE

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
