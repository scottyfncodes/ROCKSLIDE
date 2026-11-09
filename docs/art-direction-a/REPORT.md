# Art Direction A: Stylized Alpine 3D, milestone 1

*The patroller, the patrol lodge, the snowmobile and the ground round the lodge, moved toward the target
concept (a stylized alpine 3D world: chunky timber and stone, a real snow load, warm windows, a detailed
but toy-like rescue sled). Gameplay, camera, controls, physics, missions and the HUD are unchanged.*

Evidence: [desktop](compare-desktop.jpg), [phone](compare-phone.jpg), [phone cast](compare-phone-cast.jpg),
[dusk](compare-dusk.jpg). Shots taken by [`capture.mjs`](capture.mjs) on two production builds with the same
cameras, clock and weather (`main` at `6b00f9a` and this branch); per-shot draw calls and triangles are in
[`shots-before.json`](shots-before.json) and [`shots-after.json`](shots-after.json).

## 1. The two repositories, and which one is the game

| | SNOW PATROL (this repo) | GITCRAFT (`scottyfncodes/GITCRAFT`, installed at `~/.gitcraft`) |
| --- | --- | --- |
| Job | **The game.** Everything that ships, at https://rockslide-game.vercel.app/ | The production toolchain: MCP servers (MeshCraft = Blender 5.2 via `bpy`, DesignCraft, …) and QA departments |
| Relationship | Owns the Blender *scripts* (`art/3d/scripts/*.py`) and the shipped GLBs (`public/models/`), hashed in `art/MANIFEST.json` | Runs those scripts (`art/pipeline/8_build_models.py` → MeshCraft `run_script`, `export_asset`, `validate_asset`, `engine_check`) |

No runtime code is shared. Asset work happens in this repo's scripts and is built with GITCRAFT's tools.

## 2. What the engine and pipeline can realistically do (assessed before coding)

**Renderer.** three.js r187, forward rendering, one shadowed sun with a shadow box round the player, a
hemisphere sky light, a custom sky and aerial-perspective chunk injected into every shader, ACES tone
mapping, a CSS lens grade over the canvas, dynamic resolution 0.6 to 1.0. Materials are mostly
`MeshLambertMaterial` whose colour passes through `grade()` (`src/render/kit.ts`). **There is no
post-processing pass, by design**: iPhone Safari fill rate is the constraint (`docs/art-direction-2/PLAN.md`).

**Asset pipeline.** Each model is a Python Blender script. Parts are painted by palette *role*, not by a
texture; the game re-dresses each role with its own material (so paint jobs, the night window glow and
`grade()` work). Node names, pivots and the 25-bone patroller skeleton are contracts with the code and the
tests (`tests/models.test.ts`, `tests/people.test.ts`). Static buildings are merged per cut-away node into a
couple of vertex-coloured draw calls (`bakeInPlace(..., byColor)`).

**So, realistically achievable now, cheaply:** richer *shape* (silhouette, layering, wear, working detail),
softer snow forms, smooth shading where forms are soft, more colour roles per building (free after the
vertex-colour bake), and light that already exists (Phase A: warm windows, lamps, a cream sun with
cobalt shade, the night fill). **Not without a bigger, separate change:** textures or PBR maps (no texture
pipeline for models; adds memory and draw calls on phones); ambient-occlusion or soft-shadow passes (a
post pass); new character proportions (the skeleton's bone lengths drive the gait's leg solver, so a
taller, more human figure means retuning `gait.ts` and its tests); facial animation beyond blinks.

**Choices made for this milestone.**
- Shape and role colour only. No textures, normal maps, extra lights or passes.
- Everything new goes through one shared, reusable module, the **Alpine kit**
  (`art/3d/scripts/alpine_kit.py`, conventions in [`CONVENTIONS.md`](CONVENTIONS.md)), so the next buildings
  and props are a few lines each.
- Keep every contract: nodes, pivots, bones, footprints, colliders, bounds (the tests check them).
- Hold draw calls flat; let triangles rise only where the camera spends its time (the station yard).

## 3. What changed

### The patrol lodge (`rs_lodge`; `valley_buildings.py` `lodge()`)
- **Fieldstone socle**: 0.7 m of coursed stone in three tones over a mortar bed round the outside of every
  wall, under the sills, open where the porch deck covers the east wall. It lives in each wall's node, so the
  dollhouse cut-away still lifts it with the wall.
- **A real snow load**: a soft blanket on each roof plane that bulges, rolls over the eaves in a bull-nose and
  sags over the fascia, rounds off past the gables, a crest roll on the ridge, fascia boards and uneven
  icicles along both eaves. The porch lean-to gets the same treatment. Smooth-shaded at 40°, so the snow is
  soft while boards, stones and seven-sided logs keep their edges.
- **Built detail**: purlin ends and a bargeboard under each gable overhang.
- **Who lives here** (the yard-facing south wall): the patrol plaque (red, cream cross, timber frame) between
  the windows with a gooseneck lamp over it that glows with the windows at dusk; split wood stacked under the
  eaves (with a new collider in `src/world/station.ts`, so you cannot walk through it); two pairs of skis and
  poles leaning by the corner.
- **Drifts**: soft, uneven mounds banked against the plinth instead of tilted slabs.

### The snowmobile (`rs_sled`; `patrol_models.py` `sled()`)
- A smooth, sculpted cowl with side louvres, a raised hood, a cream cross on the nose, twin headlight bezels
  round the code's lamp and a bumper loop.
- A tinted screen in a dark frame; hand guards, a gauge, a two-tone seat with a passenger hump.
- Running boards with grip studs and a lip; a lugged track you can see on a bogie rail with five wheels a
  side, a hubbed drive sprocket and idler.
- Coil-over front suspension on A-arms; skis with tips curled in three steps and a handle.
- Dry bags strapped (amber straps) beside Koda's rack, a rear grab bar, a taillight housing and a mud flap.
- Same bounds, pivots, nodes and paint roles as before: paint jobs, steering, Koda's seat, the crate, lamps
  and headlight are untouched (`tests/models.test.ts` checks the size against the code-built sled).

### The patroller (`rs_patroller`; `patrol_people.py`)
- **Layered winter clothing**: the shell is insulated (two quilted baffles), with a storm flap over the zip, a
  fleece edge on the collar, and mitten gauntlets over the cuffs.
- **Distinctive patrol kit**: a sternum strap with a whistle, a hip belt and buckle, a red first-aid pouch with
  the cream cross on the right hip, the patrol cross on the left sleeve.
- **A more expressive face**: lash lines flicked up at the outer corners (bound to the eye bones, so they
  close with the blink) and a dusting of freckles.
- Skeleton, bone names, pivots and every animated joint are identical (`tests/people.test.ts` compares joint
  matrices frame by frame with the code-built figure: gap < 1e-9; bounds within 6 cm in every pose).
- The villagers share the script, so they get the lash lines too (`rs_villager` rebuilt).

### Draw-call discipline
The first build added 8 to 10 draw calls per view. Cause: every paint role on a skinned or dressed mesh is its
own draw call (twice, with the shadow pass), and the new parts had brought new roles (red ski handles; red,
steel and amber bits on the patroller). They were moved onto roles each mesh already had. Result: **draw
calls are identical to `main` in every captured view.**

## 4. Cost

### Per view (`renderer.info`, the same cameras on both builds)

| Shot | Draw calls before → after | Triangles before → after |
| --- | --- | --- |
| p-lodge (phone) | 287 → 287 | 249,473 → 261,741 (+4.9 %) |
| p-lodge-dusk | 290 → 290 | 259,353 → 271,621 (+4.7 %) |
| p-cast | 264 → 263 | 228,881 → 240,293 (+5.0 %) |
| p-back-hud | 263 → 263 | 249,635 → 261,903 (+4.9 %) |
| p-sled | 315 → 315 | 267,861 → 281,989 (+5.3 %) |
| d-lodge (desktop) | 318 → 318 | 408,949 → 421,217 (+3.0 %) |
| d-sled | 349 → 348 | 493,246 → 504,174 (+2.2 %) |
| d-cast | 315 → 315 | 436,863 → 450,175 (+3.0 %) |
| d-lodge-dusk | 344 → 344 | 425,949 → 440,077 (+3.3 %) |

### Phone tier, the repo's own perf run (`scripts/perf.mjs <url> low`, 844 x 390 touch)
Two runs each, alternating builds. SwiftShader is CPU WebGL, so absolute frame times are not a phone's; the
comparison between builds on the same machine is what counts.

| View | Calls | Triangles | Median frame, before (two runs) | after (two runs) |
| --- | --- | --- | --- | --- |
| Station yard | 346 → 346/347 | 340,722 → 352,586 (+3.5 %) | 279.6, 279.5 ms | 281.2, 278.5 ms |
| Tannberg top station | 180 → 180 | 202,603 → 203,667 | 224.6, 227.9 ms | 224.7, 220.7 ms |
| Pass road | 128/119/119 → 128 | 179,701 → 184,493 | 183.4, 183.0 ms | 160.7, 166.9 ms |
| Ridge | 117 → 117 | 163,210 → 164,274 | 163.4, 169.1 ms | 152.4, 151.7 ms |

No frame-time cost measurable in the yard, where all of the new geometry is. (The pass-road view's call count
moves between runs on both builds: a mission object streaming in, not this change.)

### Models

| Model | Triangles before → after | GLB before → after |
| --- | --- | --- |
| rs_lodge | 6,868 → 11,540 | 478 → 834 kB |
| rs_sled | 1,964 → 3,824 | 148 → 269 kB |
| rs_patroller | 5,402 → 5,934 | 298 → 342 kB |
| rs_villager | (lash lines) → 4,978 | 272 → 277 kB |

+0.53 MB of GLB in total, loaded once at start and served compressed. Budgets raised on purpose, each with
its reason, in `tests/models.test.ts` (sled 4,000, lodge 12,000, patroller 6,200). The people tests' phone
budgets for drawn triangles were not changed and still pass.

### What was and was not measured
- **Measured here**: draw calls and triangles per view on both builds; perf.mjs on the phone tier, twice each;
  model triangles and file sizes; `npm run check` (typecheck, 200 tests, build); a real-input play run
  (`scripts/play.mjs`, portrait touch) with no page errors.
- **Not measured: frame time on a physical phone.** Expect no visible change: no new draw calls, materials,
  lights or passes; +3 to 5 % triangles in the yard.

## 5. Checks
- `npm run check`: typecheck, 200 tests, build.
- MeshCraft `validate_asset`: pass on all four models. `engine_check`: the lodge passes with `--sunk` (its stone
  plinth sits below the ground on purpose, as before); the two skinned figures report the same single
  `engine_base_on_ground` fail as `main` (poles below y = 0 at rest), recorded in Phase B.
- `art/MANIFEST.json`: hashes, sizes and triangle counts updated for the four models.
- Art bible rebuilt as edition 2.6 (`art/bible/CHANGES.md`), per CLAUDE.md.

## 6. Not in this milestone (next steps)
1. **Roll the Alpine kit out**: the garage, the lodge wing (it still has the old slab roof; it appears only
   after the "wing" upgrade), Hollin's chalets and the Tannberg huts. Each is a few calls to `AK.snow_roof`,
   `AK.fieldstone`, `AK.woodpile`.
2. **Figure proportions**: a taller, more human patroller needs new bone lengths and a retuned gait leg solver.
   Worth doing as its own milestone with the gait tests as the guard.
3. **Koda and the helicopter** in the same detail language as the sled.
4. **The beacon column** over the lodge (the yellow beam in the captures) is still the placeholder the Phase A
   plan flagged (C2).
