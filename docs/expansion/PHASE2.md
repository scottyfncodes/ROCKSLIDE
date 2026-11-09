# Gameplay expansion, phase 2: avalanches and Koda

Art direction unchanged: the guns, the debris and the hare are built from the kit's simple solids in
the existing roles; Koda's new animations are new states on his existing rig (`huskyMesh.animate`),
so the MeshCraft model and the code-built fallback both get them.

## What is new
- **Avalanche control** (`src/missions/control.ts`, `src/game/ops.ts`): six start zones on the
  Tannberg side, a seeded daily snowpack, the control route board at the bunker, the howitzer and the
  Avalauncher with aim, charge, a live trajectory arc and an impact ring, hand charges from the ridge,
  ski cuts; outcomes none / sluff / full slide; safety rules (runs closed, slide path clear) that cost
  points and rep when broken; natural releases from zones left loaded, worse with the runs open.
- **Slides** (`src/sim/slide.ts`): parcels of snow under gravity and Voellmy friction, drawn as one
  instanced mesh of debris blocks with a powder cloud; the avalanche paths are now treeless.
- **Outrunning**: warning rumble, crack line, camera shake, a beat to cut out; slow motion on a near
  miss; caught: a swim struggle, then a guest burial or you buried and Koda digs you out.
- **Rescue** (`src/missions/rescue.ts`): survival clock, three-stage transceiver search, probe, shovel
  with rhythm, victims at different depths, some with no beacon; scored on time, survival, technique.
- **Koda**: debris search with scent wisps, paw-and-bark alert and digging; runs alongside on skis;
  leaps out of the sled and helicopter; idles (roll, shake, snap at flakes, chase a hare); reacts to big
  tricks and wipeouts; greets you at HQ; a Bark button; a bond meter (`src/actors/bond.ts`) that opens
  four skills; treats from Greta.
- Saves: bond, treats, rescues and today's control state are saved; older saves are migrated (an old
  save's petting counts toward the bond).

## Evidence
- Screenshots, desktop 1280x800 and phone 393x852: `docs/expansion/phase2/` (control route board,
  cannon aim, avalanche chase, transceiver search, Koda digging). No console errors at either width.
- Tests: new `tests/avalanche-control.test.ts` (zones are real slopes, the daily snowpack is seeded,
  trigger outcomes, safety, natural risk, gun reach, slide runs and catches, survival clock, beacon
  distance math and stages, probe and shovel, burial seeding, rescue scoring, bond), plus bond
  migration in `tests/migration.test.ts`. 232 tests pass.
- `scripts/verify.mjs` now also checks the gun sight and the transceiver panel for overlaps: PASS on 5
  phone viewports.
- Phone-tier perf against main (same machine, two runs each, medians, ms): yard 238/257 vs 248/244,
  top station 199/201 vs 197/203, pass road 177/173 vs 172/171, ridge 152/151 vs 151/137: parity. With a
  full slide running in view: 113.9 ms vs 113.3 ms without (140 debris blocks, about 150 particles).
