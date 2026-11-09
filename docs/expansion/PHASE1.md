# Gameplay expansion, phase 1: town layout and movement feel

The art direction is locked: no model, palette or shader changed. Everything new is built from the
existing kit (`chalet()`, `sign()`, `cyl()/box()` in the kit colours, MeshCraft buildings with their
code-built fallbacks, the terrain's own snow material for the kickers).

## Where things stood (the codebase before this phase)

- **Town:** three far-apart places. The patrol station on its own pad at (0, 250), Hollin village
  400 m away at (330, 470), the Tannberg lift base on a shelf 540 m east at (540, 170), joined by the
  Tannberg road. No district signage beyond building signs; the map labelled pads.
- **Controls:** a floating left-thumb stick, right-side look drag, one contextual action button, chips
  (Map, Koda, Skis, Get off), Climb/Descend in the helicopter. Keyboard WASD/E/Q/X/G/R/C/M.
- **Vehicles:** one snow model for the sled and the skis (`actors/glide.ts`: grip, drag, gravity along the
  slope, a sprung heavy sled that only leaves the ground where the snow falls away), an arcade
  helicopter (`actors/heli.ts`) with optional hover/landing assist.
- **Missions:** data-driven steps (`missions/catalog.ts`, `runner.ts`): eight story/community jobs plus
  radio callouts and the repeat Kessel Bowl recon/control pair (Voronoi slab avalanche sim).
- **Koda:** follows, sits, lies down, tracks scent trails with paw prints, finds hidden badges, rides the
  sled rack and the helicopter, sleeps by the fire (`actors/husky.ts`).
- **Save:** one JSON profile in `localStorage` (`rockslide.patrol.v1`), saved every 12 s and on exit,
  `migrate()` repairs damaged or older saves with defaults.

## What changed

### Tannberg Village, a planned base area
- **Main Street** (`ROUTES.main`) runs north from the parking lot on the Tannberg road up to the
  **Lift Base Plaza**; light poles every 24 m down both sides (with a cream band at eye height for a
  whiteout), signposts at four corners with arms pointing at the districts.
- **Patrol HQ + vehicle yard** on the west side: the whole station moved as one piece
  (`HQ_SHIFT`, every spot keeps its layout), plus the **avalanche control bunker** with the cannon under
  a tarp, and the **fuel island**; the helipad sits right next to the lodge.
- **Hollin guest village** on the east side: the Kettle, clinic, **gear shop, rentals, après bar**,
  four condos, a house and the chapel.
- **Lift Base Plaza:** the base lodge, the chairlift's bottom station (now rideable), the lit spruce, the
  trail map, the bottom of the Tannberg run, and off it the **terrain park** (three kickers, a rope tow).
- The map tints and names each district; the Map chip is now a **minimap** that names the district you
  are in. Spawn points, the sled, the helicopter, Greta, the clinic, the van callout and Pepper's sill
  all moved with the town; all mission triggers still work (tests).
- Old saves (version 1) parked at the old station move into the town; nothing is wiped
  (`tests/migration.test.ts`).

### Skiing
- Speed lines, FOV push, carve spray, a louder grittier carve sound, camera shake on rough snow.
- **TRICK** (T, or the big on-screen button on skis, which takes the action button's slot): tap = grab,
  hold = spin (finishes the turn on release), forward/back + trick = flips; combos in one jump.
- Landings graded: clean (points + speed boost), stumble (short wobble), wipeout (about a second).
- **Style meter** under the speedo; full = 8 s of double points and a little extra glide.
- Jumps: three kickers in the park, four rollers and a cornice on the run.

### Snowmobile
Body roll on its springs into turns, landing squash, nose follows the arc in the air, a rooster tail
when the track digs in on a climb, leaning into the hill holds a sidehill line, a clean landing gives a
burst of speed. Koda rides the rack (as before).

### Helicopter
More momentum, bank into turns, a wider rotor-wash ring of snow when low, a **landing light** on the
readout (marked LZ / flat / too steep, plus whether you are slow and gentle enough), easy settling on
flat snow and marked LZs (orange wands and windsocks at Kessel Ridge, Top Station, Grauhorn, Fernhut).
Koda rides along (as before).

### Mobile
New actions have touch controls (TRICK, the chairlift/tow on the action button, the minimap chip); no
overlaps at 5 phone viewports (`scripts/verify.mjs` now also checks the skis HUD). Haptics on trick
starts, clean landings, stumbles and wipeouts.

## Evidence
- Screenshots (desktop 1280x800 and phone 393x852): `docs/expansion/phase1/` (town, street, plaza,
  mid-air trick, heli landing light); before: `docs/expansion/before/`. No console errors at either width.
- Tests: `npm run check` passes, 217 tests (new: `tricks.test.ts`, `migration.test.ts`).
- `scripts/verify.mjs`: PASS on 5 phone viewports, locally and on the live site.
- Phone-tier perf (`scripts/perf.mjs … low`, SwiftShader, same machine, medians of repeated runs; main
  itself varies ±15 ms run to run):

| view | main ms | phase 1 ms | main tris | phase 1 tris | main calls | phase 1 calls |
| --- | --- | --- | --- | --- | --- | --- |
| town / yard | 232 | 246 | 358k | 458k | 341 | 434 |
| top station | 182 | 197 | 214k | 209k | 186 | 190 |
| pass road | 154 | 163 | 189k | 184k | 128 | 119–130 |
| ridge | 141 | 144 | 169k | 168k | 117 | 121 |

The yard view now looks over the whole town (two dozen more buildings in frame) for about 6% more
frame time; away from town it is within run-to-run noise, with fewer triangles than main at the top
station. Heap is unchanged (54 MB).
