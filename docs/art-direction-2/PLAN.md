# SNOW PATROL: Art Direction 2.0, first deliverable

*Inspection, assessment and plan. Nothing in the game changes in this pull request.*

North star: **The lodge feels like home. The mountain feels alive.**

Evidence: four contact sheets in this folder, cut from today's in-game captures of the current build
(`art/bible/captures/`, staged through `window.patrol`, the interface hidden for the `env` shots):
[world](evidence-world.jpg), [characters](evidence-characters.jpg), [light](evidence-light.jpg),
[phone](evidence-phone.jpg). The live build at https://rockslide-game.vercel.app/ already serves the
SNOW PATROL title.

---

## 1. The two repositories

| | SNOW PATROL (this repo, was ROCKSLIDE) | GITCRAFT (`scottyfncodes/gitcraft`) |
| --- | --- | --- |
| Job | The game: what ships | The toolchain that makes assets for it: MCP servers plus the QA departments |
| Stack | TypeScript, Vite, three.js r187, Rapier (deterministic); no backend; Vercel static | Python MCP servers around Blender 5.2 (MeshCraft/ForgeCraft), FFmpeg, Kokoro, Playwright; 2D ArtCraft apps |
| Rendering | Forward renderer, ACES tone mapping, one sun with a shadow box around the player, a hemisphere light, a custom sky shader. Fog is replaced in every shader by an aerial-perspective chunk (`atmosphere.ts`). The lens grade (vignette, split tone, grain) is **CSS over the canvas, with no render pass**. Dynamic resolution runs 0.6 to 1.0 | `game-toon` engine check: MeshToonMaterial with 4 bands |
| Assets | 40+ GLBs in `public/models/` (vertex colour `COLOR_0`, one shared material per kind). Characters, Koda, sled and helicopter are **built in code** (`characterMesh.ts` 1,144 lines, `huskyMesh.ts`, `sledMesh.ts`, `heliMesh.ts`). One packed Poly Haven rock texture. FXCraft particle atlas; AudioCraft audio | Profiles `three-web-toon` (COLOR_0, LOD50/25, collision hull, 8k tris) and `web-pbr` (1 k bakes, no normal map). Kit helpers `log_wall`, `mound`, `beam` were written for ROCKSLIDE |
| World | 2 km valley heightfield (`terrain.ts`), 64 culled chunks. Surround range = WorldCraft heightfield **area-averaged to 129 x 129 over 6 km (about 47 m per cell)** (`frontRange.ts`). Instanced forest in 25 cells. Weather: clear / overcast / snow / storm through a 06:00 to 22:00 day | WorldCraft terrain (with erosion), sky (Nishita, cubemap), HDRI, scatter on any 16-bit heightmap. MaterialCraft snow/ice/wood/stone + toon ramps. FXCraft flipbooks/emitters |
| Animation | Procedural: a two-bone leg IK gait with spring joints (`gait.ts`), measured foot slip under 1 cm. Koda: behaviour in `husky.ts`, procedural pose | AnimCraft autorig (humanoid, a basic 13-bone quadruped), clips idle/walk/run only for quadrupeds, mocap to BVH, retarget |
| QA | `npm run check`; `tests/art-direction.test.ts` locks the CSS tokens and rendered kit colours to the bible | PLAYCRAFT (play), PIXELCRAFT (HTML UI only; it does not judge the 3D frame), TestCraft `perf` / `visual_diff` |

**How they relate:** GITCRAFT produces files; SNOW PATROL owns and ships them (`art/pipeline/*.py` drives
the servers, `art/MANIFEST.json` hashes every output). No runtime code is shared, and none should be.

**What GITCRAFT does not have** that this upgrade needs: no three.js shader or material library (outline,
rim light, snow), no character or quadruped template, no expressive dog clips (sit, sniff, ear flop), no
normal maps or KTX2 output, no art-consistency metric. **No GPU** here, so Cycles bakes run on the CPU,
and UniRig and photogrammetry are blocked. The plan therefore puts runtime look work in this repo, and
uses GITCRAFT for terrain, sky, materials and the measurement loop.

## 2. Current visual quality: an honest read

The game is well past prototype. Its **interface** has a real identity. Its **world** is technically
careful but visually generic in exactly the places a player looks most.

### Worth preserving

1. **The lodge at night from inside** (`env-lodge-inside`): fire, rug, map table, the roof lifted away.
   This is already "the lodge feels like home". It is the best frame in the game.
2. **Patrol red with a cream cross** on the jacket, sled and helicopter. It reads at 30 m on white
   snow and gives the cast one silhouette colour.
3. **The storybook interface**: aubergine card stock, the Jost cut wordmark, and the topo mission table
   (`phone-board`). That last one is the best-designed screen and the clearest "field guide" object we own.
4. **Mid-distance forest and aerial perspective**: the Tannberg aerial (`env-air-tannberg`) shows
   timber, shadow and haze working together.
5. **Movement engineering**: a measured gait and a sprung sled. The problem is what is moved, not how.

### Holding it back (in order of how often a player sees it)

1. **The far range is a crumpled paper curtain.** At 47 m per cell, sampled on rings, it renders as a
   wall of vertical streaks with no peaks, couloirs or depth layers. It sits **directly behind Vince in
   every close-up** (`env-vince-front`, `env-cast`, `ui-hud-mission`). Haze is applied but the range
   has one value band, so it never recedes. This is the single biggest "generic 3D game" tell.
2. **Snow has no value structure.** By day the ground is a flat lilac-grey from the boots to the
   horizon. Shade and light differ only where a cast shadow falls. There is no warm-lit/blue-shade split
   on form, and drifts and sastrugi do not read. On a phone held upright, **about half of the frame is
   this empty plane** (`phone-hud`).
3. **Night swallows the cast.** At 21:30 Vince and the lodge walls go to near-black silhouettes
   (`env-lodge-night`), against the bible's own "no pure black" rule. Lit windows cast nothing onto the
   snow. Dusk and night are 4 of the 16 in-game hours, and they are when "home" should feel strongest.
4. **Scattered crags read as grey dice.** The `rs_crag` / `rs_boulder` scatter, seen from the station
   and the title (`env-title`, `env-lodge-dusk`), shows as small cubes sprinkled over the slopes. Some
   look detached from the surface at distance. They make the mountain look like debris, not granite.
5. **Three modelling languages on one cast.** People use capsules with boxy torsos. Koda uses 4-sided
   cones and flat facets, so Koda reads as a stone wolf beside soft people. The helicopter is a toy.
   The GLB buildings are carefully detailed. Nothing tells you these belong to one world.
6. **Vince from behind is two planks.** The default camera sees his back, and the carried skis run from
   above his head to his knees. They read as antennae and hide the hair, his one identity detail
   (`env-yard`, `ui-hud-mission`).
7. **The mission beacon is an unlit translucent rectangle** (yellow or cyan column, `env-lodge-dusk`).
   It is the most placeholder-looking object in the game, and it is always on screen during a call.
8. **The station yard is a car park.** Flat white between buildings. Nothing records that people live
   and work here: no paths worn between doors, no plough berms, no woodpile, no sled ruts.

### Mobile constraints (measured, not guessed)

- Phones run the low tier: DPR capped at 1.5, a 1024 shadow map, 55 % tree density, dynamic resolution
  down to 0.6.
- 110 to 400 draw calls and 150 k to 320 k triangles per view (`docs/modernization/REPORT.md`).
- JS bundle 1.08 MB (333 kB gzip).
- **No post-processing pass exists, and none should be added.** iPhone Safari fill rate is the
  constraint. Every look change below goes into shaders the game already compiles: the atmosphere chunk,
  the terrain shader, `grade()`, kit materials. Or it goes into geometry and vertex colour, or the CSS
  lens.

## 3. The five highest-impact improvements

| # | Change | Why it ranks here |
| --- | --- | --- |
| 1 | **A layered horizon**: rebuild the surround as three silhouette bands that step lighter and bluer with distance | It is in nearly every frame and is the biggest quality tell |
| 2 | **Snow that has light in it**: warm on lit faces, blue-violet in form shade, wind texture in the mid-ground, and a value plan for the empty foreground | Half the phone frame is snow |
| 3 | **Night and dusk as the signature**: window light pooling on the snow, a lantern and headlamp on Vince, and a floor so figures never drop to black | It delivers "the lodge feels like home" for the cost of a few quads and a uniform |
| 4 | **One figure language**: Koda rebuilt in the people's soft, carved-wood grammar; skis carried diagonally; a sky rim on figures | The characters are the heart of the game; Koda is the brand |
| 5 | **Diegetic wayfinding and a lived-in station**: replace the light column with a patrol marker; wear paths and berms into the yard | It removes the last placeholder and gives the place a story |

Details for each are in section 5.

## 4. Recommended direction: "Field Guide Alpine"

A working Colorado mountain drawn like a plate from a 1960s national-park field guide or a WPA
screen-print poster, peopled like a storybook.

- **Cold world, warm people.** The landscape lives in a narrow, cool, value-planned palette. Saturation
  and warmth are reserved for human things: patrol red, lamplight, firelight, the Kettle's barn red.
  If something is warm, someone made it.
- **Plan in values, not in detail.** Every view stacks 4 to 5 readable planes: sky, far peaks
  (palest), the near range, the valley floor, the figure. Atmosphere separates them, not texture.
  This is the field-guide-plate look, and it is cheap on a phone.
- **Snow is never white.** Lit snow is cream (it shares the interface's paper tone, which ties the two
  layers together without mixing them). Snow in shade is cobalt-violet. Snow at dusk is peach and
  lilac. Pure #FFF only appears in specular glints.
- **Soft carved figures.** People and Koda share one grammar: rounded wood-toy forms with a few big
  planes, no faceted cones, and silhouettes legible at 40 px tall on an iPhone.
- **The mountain moves.** Spindrift off the ridges, cloud shadows crossing the bowl, smoke from the
  lodge chimney, and the snow filling your tracks. This motion already exists; it should be staged
  where the camera looks.

**Relation to the references.** From Firewatch: layered silhouette depth and colour by time of day.
From The Long Dark: snow carries the mood and weather is a character. From Alba: chunky, friendly
forms in a real place. Kept from the existing bible: two layers, the type, patrol red. **Not taken:**
painterly textures, an outline pass, photoreal snow.

**This extends edition 2.2; it does not replace it.** The bible's interface rules stand. The world
pages (colour, light, weather, people) are rewritten in edition 3, captured from the game as always.

## 5. The plan, item by item

Complexity: S (under a day), M (a few days), L (a week or more). Ownership: **SP** is this repo, **GC** is GITCRAFT.

### Phase A: visual foundation (light, air, snow, horizon)

| | A1 Layered horizon | A2 Snow light | A3 Night and dusk | A4 Crags that belong to the ground |
| --- | --- | --- | --- | --- |
| Problem | The range is a 47 m/cell streaked curtain with one value band | Flat lilac-grey; no form shading | Figures and walls go black; no light spill | Grey dice on the slopes |
| Change | Three bands. (1) The existing near range, re-sampled at 257² on the Kessel side only. (2) A mid ridge ring of low-poly silhouettes. (3) Far peaks as 2 to 3 layered silhouettes drawn in the sky shader, each lifted toward the haze colour. Add step haze per band to `atmosphere.ts` | Terrain shader: warm/cool split on N·L (cream lit, cobalt-violet shade); a mid-distance wind-ripple normal; foreground macro variation (sastrugi bands, drift lips); a glint mask | A minimum figure luminance in `grade()` / character materials; a moon fill; window-light pools as additive ground quads, one draw call; Vince's headlamp after 19:00 as an emissive cone plus a ground pool, with no dynamic light | Seat crags on the surface (sink them, align to the normal), scale up, and cluster into rock bands on the 30°+ slopes the terrain shader already marks. Cull lone pieces |
| Impact | Very high: every frame | Very high | High: it is the emotional peak | Medium |
| Files | `world/frontRange.ts`, `render/rig.ts` (sky), `render/atmosphere.ts`, `art/world/build_range.py` | `render/terrainView.ts`, `render/rig.ts` | `render/rig.ts`, `render/kit.ts` `grade()`, `render/characterMesh.ts`, `render/fx.ts` | `world/scatter.ts`, `render/kitView.ts` |
| Repo | SP; GC WorldCraft re-run at a higher resolution | SP; GC MaterialCraft snow normal (512, seamless) | SP | SP |
| Complexity | M | M | S–M | S |
| Mobile cost | Neutral or a gain: sky-shader silhouettes replace far triangles | Roughly 4 ALU ops plus one texture fetch in the terrain shader | +1 draw call, no lights | Fewer instances |
| Risk | The art-direction test pins sky/haze colours; update it with the bible | Snow surfaces (packed/powder/ice) must still read for gameplay | The night readability of markers | Scatter determinism tests |

### Phase B: characters and animation

| | B1 Koda in the people's language | B2 Vince's silhouette | B3 Figure separation |
| --- | --- | --- | --- |
| Problem | Faceted cones beside soft people | Skis hide the back view and the hair | Figures merge into bright snow |
| Change | Rebuild `huskyMesh.ts` with rounded lathe/capsule forms; keep the grey-and-white mask, the one floppy ear and the tail curl as identity anchors; add sit/sniff/ear-flop poses procedurally | Carry the skis diagonally across the pack, below head height. Hair volume visible from behind. Keep the proportions | A sky-coloured rim term in the character material (Fresnel × hemi colour), no extra pass |
| Files | `render/huskyMesh.ts`, `actors/husky.ts` | `render/characterMesh.ts` | `render/characterMesh.ts`, `render/materials.ts` |
| Repo | SP (AnimCraft's quadruped rig is too basic; keep procedural) | SP | SP |
| Complexity | M | S | S |
| Risk | Koda's poses are tied to behaviour states; `tests/` cover the husky | The gait IK is unaffected; check the sled and heli seats | Night readability, together with A3 |

### Phase C: environment refinement

- **C1 The lived-in station** (SP, M): worn paths between the doors, plough berms, a woodpile, sled
  ruts and a flagpole. Mostly existing kit pieces plus a vertex-colour ground decal mesh. Files:
  `world/station.ts`, `render/stationView.ts`. Merge the meshes so the draw calls do not grow.
- **C2 A diegetic beacon** (SP, S): replace the light column with a patrol marker (an orange-tipped pole
  with a flag and a soft ground ring) plus a thin column only beyond 150 m. File: `render/markers.ts`.
  Keep amber for a call waiting and cyan for the active objective.
- **C3 Place identity** (SP, M): one signature silhouette per location, readable from the air: Hollin's
  onion dome lit at dusk, the Tannberg lift line, the Kessel cornice, the Mirror Lake boathouse light.
- **C4 Moving weather** (SP, S–M): cloud shadows crossing the terrain (a scrolling term in the terrain
  shader), and spindrift staged on the ridges in camera view.

### Phase D: interface and branding

The rebrand already shipped (#43, #44). What remains:

| Item | Action | Risk |
| --- | --- | --- |
| `art/bible/qa-contact-sheet.jpg` still shows the ROCKSLIDE wordmark (dated 5 Nov) | Rebuild it with the bible | None |
| `package.json` `"name": "rockslide"` | Safe to rename: the package is private and nothing resolves it | None |
| Source comments ("from ROCKSLIDE's forests") | Keep: they are history | n/a |
| Title on a phone: the lodge is a small object in the top half | Recompose the title view (closer push, horizon at the upper third) once A1 lands | Bible pages 8–9 are recaptured |
| GITCRAFT: game title "ROCKSLIDE: Mountain Patrol" in `history/playcraft/games/scottyfncodes--rockslide/game.json`, `studio/departments/playcraft/manifest.json`, docs | **Separate GITCRAFT PR**: change display titles only. Keep the `scottyfncodes--rockslide` slug, which keys run history and is hard-coded in `tests/test_report.py`; add an alias for `scottyfncodes/snow-patrol` instead | Changing the slug orphans the quality history |
| Domain `rockslide-game.vercel.app` | Keep it. Optionally add a second alias on the same Vercel project later and switch `og:url` after it resolves; never remove the old one | Breaks shared links if removed |

**Name risk.** *Snow Patrol* is the name of an established Northern Irish rock band. It is active and very
likely holds marks in music and merchandise classes (not verified here). A video game sits in other classes, but
confusion, app-store rejection and search discoverability are real risks: the band dominates every
results page. It is fine for internal development. Before any commercial or store release, get a
trademark clearance search (classes 9, 28 and 41) and consider a distinguishing form such as
"SNOW PATROL: Kessel Valley" (already the browser title) or a fallback name.

### Phase E: polish and verification

- Bible edition 3: `capture.mjs`, `tokens.ts`, `build_bible.py`, in the same PR as each look change
  (this is a CLAUDE.md rule).
- TestCraft `perf` on the low tier before and after each phase. The budget is no new draw calls in
  Phase A, and p95 frame time not worse.
- TestCraft `visual_diff` against today's captures, used as the regression baseline.
- PIXELCRAFT re-run for the title recomposition and the beacon (HTML UI is unchanged otherwise).
- Live verification on rockslide-game.vercel.app after each merge.

## 6. Risks and constraints

- **No GPU in the build environment.** Every frame we judge comes from SwiftShader. Colour and
  composition are trustworthy, but frame times are not. A real-iPhone check is needed for each phase
  (the person's device).
- **`tests/art-direction.test.ts` pins colours.** Look changes must update the bible tokens in the
  same PR, by design.
- **Save compatibility:** none of this touches `rockslide.patrol.v1`.
- **Gameplay readability:** surfaces (packed, powder, crust, ice), the route line, markers and avalanche
  danger cues must stay legible. Check each against the weather states.
- **GITCRAFT is pirate-themed at template level:** expect to build alpine content as project scripts
  (as `art/3d/scripts/kessel_kit.py` already does), not from templates.

## 7. Recommended first phase: A1 + A2 + A3

**Do the horizon, the snow light and the night first, as one PR.**

1. **They fix what is on screen most.** The range and the snow fill about 70 % of a typical phone frame.
   No character or UI work can look professional in front of the current backdrop.
2. **They are the cheapest per pixel.** These are shader and data changes in files that already exist:
   no new assets, no new dependencies, no post pass. They are neutral or better for mobile performance.
3. **They set the value plan everything else is judged against.** Koda's new form, the beacon and the
   title composition all depend on how the snow and the sky read. Doing characters first means
   re-tuning them later.
4. **They deliver both halves of the north star at once:** the layered, breathing mountain by day, and
   the lit lodge on blue snow by night.

Phase B (Koda, Vince's silhouette, the rim light) follows. A4 and C2 are small enough to ride along
with A or B.
