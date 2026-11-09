# Art Direction 2.0, Phase B: one cast, a working building, a lighter HUD

**Field Guide Alpine: cold world, warm people.** Plan: [`../PLAN.md`](../PLAN.md) (B1, B2, C1 in part, and the HUD).
Phase A ([`../phase-a/REPORT.md`](../phase-a/REPORT.md)) made the mountain, the snow and the night. This phase
brings the things standing *on* that mountain up to it.

## 1. Diagnosis (before any change)

Captured from `main` at `506802a` with [`capture.mjs`](capture.mjs) (phone: portrait 390 x 844 at 2x, touch,
mobile UA; desktop 1440 x 900). The environment was already strong. Everything a player looks at *on* it was
built in a different language:

| Where | What the frame showed | Root cause in the code |
| --- | --- | --- |
| Vince | A stack of cut gems: boxy torso, faceted face, seven-sided limbs | `facet()` in `src/render/kit.ts` rendered every figure part with `flatShading: true`, on 20- and 80-face icosahedra and 7- to 9-sided drums (`art/3d/scripts/patrol_people.py`). The terrain, snow and buildings are smooth shaded, so the cast could never sit in the same light |
| Vince from behind (the default camera) | Two skis standing up from the pack to above the hat: antennae that hide the hair, his identity detail | `pat_skis_back`: two 1.3 m boards A-framed almost vertical |
| Koda | "A stone wolf": four-sided cone ears, three-sided cheek spikes, faceted barrel | Same flat material; `cone(..., 3/4 sides)`; six-sided legs |
| The garage | A dark green box: one flat board colour, two little windows, a thin roof | `garage()` in `valley_buildings.py`: boards, battens, a header; mint `#8FBFA8` that `grade()` and shade turned to near-black green. No footing, trim, overhang, door, or any sign of use |
| HUD (phone) | Three 50 px slabs (Map, Koda, Skis) stacked in the lower middle of the frame, beside the act button; opaque cards | `.actions` laid the chip column *left* of the act button, pushing it toward the centre; `.housing` at 90 % opacity with a heavy double rule |

What was kept, on purpose: the terrain, the three-band horizon, snow light and night (Phase A); the
patrol-red/cream-cross identity; the storybook interface tokens (`:root`), the type and every control; the
skeletons, joints and procedural animation of the figures (the gait, springs and jiggles are untouched); the
garage's footprint, colliders, node split and cut-away.

## 2. The unified style (the rules this phase enforces)

| | Rule |
| --- | --- |
| **Geometry** | Figures are *soft carved toys*: a few big rounded masses (icospheres, soft capsules), drums of 11+ sides; detail only where it reads at 40 px. Buildings are *built*: footing, frame, cladding, trim, roof overhang; every opening has a frame and a sill. No featureless boxes, no cut-gem facets |
| **Shading** | One light model for everything: smooth Lambert normals, hard edges only where faces meet at more than 55° (gear, straps, goggles, box trim). No flat shading on figures, no outlines, no gloss |
| **Materials** | Matte everywhere (Lambert / roughness ≥ 0.9; ice is the only gloss). Colour by palette role, graded by `grade()` |
| **Colour** | Cold world, warm people: saturation only on things people made. Patrol red on the cast; barn red, cream trim and spruce-green doors on working buildings; charcoal roofs under snow |
| **Light** | Phase A's light applies unchanged to every object: cream sun, cobalt-violet shade, the moon, the people's night fill and rim. Lit windows are the same glowing material on every building, so they all pool light on the snow at dusk |
| **Atmosphere** | Phase A's aerial perspective, unchanged; near and far objects share it |
| **Interface** | Storybook card stock thinned to glass over the world (74 % over a blur, one cream hairline). On a phone, controls live at the edges: instruments across the top, move stick on the left, chips as pills down the right edge above the act button. 44 px targets everywhere |

These rules are now in the art bible, edition 2.4 (`art/bible/CHANGES.md`): pages 3, 5, 7, 9, 11, 12, 13, 19.

## 3. What changed

### Figures: Vince, the villagers, Koda (`art/3d/scripts/patrol_people.py`, `src/render/kit.ts`)
- **Smooth shading.** `facet()` no longer sets `flatShading`; the models are exported with smooth normals,
  split only at edges sharper than 55°. Figures now take the same sun, sky and snow light as the terrain.
- **Rounder forms.** Gems are subdivided by size (heads and barrels 320 faces, mid forms 80, eyes and glints 20),
  limbs are 10-sided seven-ring capsules, drums have 35 % more sides.
- **Vince's skis** ride diagonally across the pack (tails at his left hip, tips past his right shoulder, below
  the hat) with a strap. From behind, the hair, the pack and the cross read again. The code-built fallback figure
  carries them the same way.
- **Koda**: soft leaf ears with ten segments, cheek ruffs instead of three-sided spikes, a white bib that seats
  the head into the body, a fuller tail. The grey-and-white mask, blue eyes, the flop ear, collar and tail
  curl, his identity marks, are unchanged.
- Skeletons, bone names, pivots and every animated joint are identical: `tests/people.test.ts` still checks
  joint matrices frame by frame against the code-built figures (gap < 1e-9).

### The garage (`art/3d/scripts/valley_buildings.py` `garage()`, `src/render/stationView.ts`)
A working mountain operations building on the same 12 x 10 m footprint and nodes:
- a 0.55 m concrete stem wall, barn-red board and batten above it, cream corner boards, water table and frieze;
- three-light windows with frames, mullions and snowy sills (two per long wall, one east), lit at dusk like the lodge's;
- the crew door: spruce-green, a small window, a concrete step, a shed-roof awning on brackets, a lamp, the fire cabinet;
- the west bay: heavy timber posts, a header on knee braces, the sectional door rolled up with its row of lites,
  floodlights, the red and white bump stops;
- a steeper roof (2.4 m pitch) for the snow load, 0.8 m overhangs on exposed rafter tails, fascia, a ridge vent,
  a louvred gable vent, a stovepipe (the workshop is heated) and icicles;
- the stove's woodpile under its own lean-to on the east wall.

### The HUD (`src/ui/style.css`, appended block "the field instrument HUD")
- Cards, chips and the pause button are burgundy glass: 74 % opacity over a 6 px blur, one cream hairline, a
  smaller shadow (was 90 % with a double inset rule).
- On a phone (≤ 520 px) the chips (Map, Koda, Skis on / Get off, and the helicopter's Climb / Descend) are 44 px
  pills stacked down the right edge **above** the act button, instead of a column of 50 px slabs to its left.
  The act button is 78 px (was 86). The middle of the screen, where Vince and Koda stand, is clear.
- No control, label, binding or behaviour changed. `:root` tokens are unchanged (`tests/art-direction.test.ts`).

## 4. Evidence

Same cameras, clock and weather on both builds (`capture.mjs`); before = `main` at `506802a`, after = this branch.

| Sheet | Shots |
| --- | --- |
| [compare-phone-hud.jpg](compare-phone-hud.jpg) | Phone HUD in the yard 09:30; behind Vince with Koda 10:30 |
| [compare-phone-cast.jpg](compare-phone-cast.jpg) | Phone: Vince and Koda front three-quarter, 11:00 and 21:30 |
| [compare-phone-garage.jpg](compare-phone-garage.jpg) | Phone: the garage from the yard, 11:00 and 18:50 |
| [compare-desktop.jpg](compare-desktop.jpg) | Desktop: the cast; the garage; the HUD |

Per-shot draw calls and triangles are in [`shots-before.json`](shots-before.json) and [`shots-after.json`](shots-after.json).

## Cost (renderer.info, the same views)

| Shot | Draw calls before → after | Triangles before → after |
| --- | --- | --- |
| p-title | 269 → 256 (-13) | 229,927 → 241,499 (+5.0 %) |
| p-yard-hud | 318 → 290 (-28) | 269,992 → 282,204 (+4.5 %) |
| p-back-hud | 278 → 265 (-13) | 270,846 → 282,418 (+4.3 %) |
| p-garage | 296 → 269 (-27) | 260,014 → 272,238 (+4.7 %) |
| p-garage-dusk | 308 → 280 (-28) | 268,054 → 279,458 (+4.3 %) |
| p-cast | 272 → 259 (-13) | 212,645 → 224,217 (+5.4 %) |
| p-cast-night | 276 → 263 (-13) | 216,337 → 227,933 (+5.4 %) |
| d-garage | 339 → 320 (-19) | 462,200 → 495,134 (+7.1 %) |
| d-cast | 303 → 290 (-13) | 392,865 → 404,437 (+2.9 %) |
| d-yard-hud | 364 → 336 (-28) | 465,188 → 477,400 (+2.6 %) |

Draw calls **fall** in every view (13 to 28 fewer): the garage's many paint roles are baked to vertex colour
per cut-away node (the lodge's existing path, `bakeInPlace(..., byColor)`), so it draws in fewer calls than the
old four-role garage, in the shadow pass too. Triangles rise 3 to 7 %: the rounder figures and the garage.

### What was and was not measured
- **Measured here:** draw calls and triangles per view (`renderer.info`) on both builds; model triangle counts
  (`tests/models.test.ts`, `tests/people.test.ts`); file sizes.
- **Not measured: frame time on a real phone.** Captures run in SwiftShader (CPU WebGL), where frame time is not
  meaningful. Smooth shading costs nothing over flat shading (it removes the derivative normals), and the
  added triangles are a few percent of a phone frame. Expect no visible change; confirm on a device.
- The four GLBs grow from 0.50 MB to 1.07 MB in total (served compressed by Vercel), loaded once at start.

## 5. Checks
- `npm run check`: typecheck, 200 tests, build.
- Budgets updated on purpose, each with its reason in the test: `tests/models.test.ts` (patroller 5600,
  villager 5000, Koda 4400, garage 4400), `tests/people.test.ts` (drawn triangles at fixed phone budgets),
  `tests/yard.test.ts` (the garage may stand 1.6 m taller: the steeper roof and stovepipe).
- MeshCraft validate: pass on all four models. MeshCraft engine check: the garage passes; the three skinned
  figures report one `fail`, which the shipped `main` models report too (rebuilt from the `main` script to
  confirm), so it predates this change.
- `art/MANIFEST.json` hashes updated for the four models.
- Art bible edition 2.4: captures re-taken from this build, the shape, people, places and HUD rules rewritten.

## 6. Constraints and what is next
- **Gear on figures is still boxy** (straps, radio, goggles) by rule: hard edges on gear. If it reads too
  mechanical at close range, bevel it in the script; it is a pure model change.
- **The lodge, hangar and equipment room** were not rebuilt. The lodge was already the best object in the game;
  the hangar and equipment room should get the garage's treatment (footing, trim, overhangs, signs of use) next.
- **The yard floor** (worn paths, plough berms, sled ruts: plan item C1) and **the beacon** (C2) remain.
