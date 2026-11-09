# Character Evolution and mobile gameplay polish

*Vince rebuilt as a character, Koda rebuilt to match him, a phone-first camera and HUD, petting that
reaches the dog, contact shadows and a quieter far forest. Gameplay systems, the world and its
interactions are unchanged. This is a visual-quality pass, not a gameplay expansion.*

Evidence: [`before-after.jpg`](before-after.jpg) (phone, the eight review states on identical cameras,
clock and weather), [`turnaround.jpg`](turnaround.jpg) (Vince through the game's own materials),
[`koda.jpg`](koda.jpg), [`poses.jpg`](poses.jpg), [`phones.jpg`](phones.jpg) (iPhone SE, 13 and Pro
Max). Shots taken by [`capture.mjs`](capture.mjs) on two production builds (`main` at `dce2be3` and this
branch); per-shot draw calls and triangles are in [`shots-before.json`](shots-before.json) and
[`shots-after.json`](shots-after.json).

## 0. What was inspected first

| | |
| --- | --- |
| Repositories | **SNOW PATROL** (`scottyfncodes/snow-patrol`, this repo) is the game. **GITCRAFT** is the toolchain installed at `~/.gitcraft` (MeshCraft = Blender via `bpy`); it is not attached to this session and nothing in it was changed. No runtime code is shared |
| Engine | three.js r187, forward rendering, one shadowed sun, ACES, a CSS lens grade, no post-processing (phone fill rate) |
| Characters | Rigged GLBs built by a Blender script (`art/3d/scripts/patrol_people.py`) on a skeleton whose bones are the code's joints; all animation is procedural code (`characterMesh.ts`, `gait.ts`, `huskyMesh.ts`): a two-bone leg solver, damped springs, jiggles |
| Constraint | Bone names, pivots and rest pose are a contract with the code and the tests (`people.test.ts` replays every pose and compares every joint matrix to the code-built figure). Changing proportions through the skeleton would mean retuning the gait. So the redesign changes **geometry and materials on the same skeleton**; the motion stays bit-identical |
| Equipment | Hats, skis, poles, the gear and (new) the hair are separate skinned meshes the game toggles |
| Camera / HUD | `src/game/camera.ts` (follow camera, portrait pull-back), `src/render/rig.ts` (portrait field of view), `src/ui/hud.ts` + `style.css` |
| Deploy | Vercel project `rockslide` from `main` |

## 1. Vince

Built by a new `vince()` in `patrol_people.py` (the villagers keep `patroller(civilian=True)`), from lofted,
tapered cross-sections rather than drums and spheres:

- **Silhouette**: a hip-length parka whose cross-section is a rounded rectangle (not a cylinder), a chest that
  tapers to the waist and square shoulders that roll into the collar; shoulder caps in the yoke colour; full
  insulated trousers tapering to articulated knees; substantial boots. The head is 12 % larger (about the head
  joint, so the skeleton is unchanged): a friendlier, more readable face at phone distance.
- **Face**: large dark oval eyes with two catchlights and a lash line (they blink about their own centres),
  warm brows lifted at the inner end, a small nose, freckles, blush, an open smile.
- **Hair**: Vince's long honey-blonde hair is now part of the model (`pat_hair_long`): wavy locks that turn out
  into a curl at the collar, two framing the face. It replaces the code-built cluster of faceted balls.
- **Uniform**: patrol-red parka with a charcoal yoke and shoulders (they repaint with the wardrobe), stand-up
  collar with a fleece rim, a hood rolled behind it, zip under a storm flap, chest pocket with the patrol cross,
  welt hand pockets, reflective piping and forearm bands, a charcoal hem band; cargo pockets; boots with a heel,
  toe cap, mustard laces and a lugged sole; gloves with gauntlets and a thumb.
- **Helmet** (the Patrol helmet in the wardrobe): a smooth shell low over the back, a red ridge that lies on the
  shell, vents, the cross on each side; the goggles' strap clears every hat, and the goggles ride on its front.
- **Equipment**: a rescue pack with a lid, pocket, cross, a shovel grip and a probe out of the top; padded
  shoulder straps to a sternum strap and buckle; a radio with an aerial and orange knob; a hip belt with a
  mustard buckle, the first-aid pouch and a tool pouch; real ski shapes (waisted, tips turned up) on the pack and
  the boots, bindings with an orange toe piece, poles with grips and baskets. Everything is bound to the joint
  that carries it, so nothing drifts in motion.
- **Palette**: patrol red, warm off-white, charcoal, muted black, mustard and safety-orange accents.

**One material for the fixed colours.** Every colour the game never repaints (boots, gloves, skin, eyes,
straps, pack, metal...) is baked into vertex colours and drawn with one material, graded on load through the
same `grade()` as before (`facetBaked`, `gradeVertexColors` in `kit.ts`). The colours the wardrobe changes
(jacket, trim, hats, lens, skis, hair) keep their own materials. Vince draws **11 calls instead of 29**
(beanie, gear, skis on the pack), which paid for the extra detail.

## 2. Animation

- Every joint moves exactly as before through every pose (`people.test.ts`, gap < 1e-9). The new geometry was
  reviewed in each pose (idle, walk, run, ski straight and carving, carry, ride, work, pet; [`poses.jpg`](poses.jpg)).
- **Petting** was the one verified broken interaction: Koda could be petted from 2.4 m away while Vince knelt
  facing wherever he had been looking, his hand stroking air at knee height. Now Vince turns to face Koda,
  Koda wiggles in to arm's length (`PET_REACH`, new test in `actors.test.ts`), and the stroking hand lands on
  the back of Koda's head (measured: hand 0.98 m high, Koda's crown about 1.0 m), the other on his shoulder.
- Pom-poms keep the model's own pivots on top of the larger hats and only swing.

## 3. Koda

`koda2()`: one smooth lofted barrel (a deep chest that tucks up to the loin) with the husky coat painted per face
(grey crown, saddle and mask; white bib, belly, legs and breeches), a tapered neck with a white throat, tapered
legs and round snowshoe paws, a plume tail of four overlapping links with a white tip, flat cupped ears (the
left still flops). Same skeleton and part meshes, so his behaviour and animation are unchanged. Fixed colours in
one material: **3 draw calls instead of 9**.

## 4. Camera (phone held upright)

The portrait camera kept at least 40 degrees across, which on a 19.5:9 phone opened a 76 degree view top to
bottom and then backed off 30 % further: Vince was about 14 % of the screen tall in a field of foreground snow.
Now 36 degrees across (70 vertical at most), the camera backs off 10 % on foot (14-16 % on skis and the sled)
and aims less far past him. On an iPhone 13 he is about a fifth of the screen tall, head near the middle, feet
about 70 % down, with Koda at his heel and the ground ahead in view (`polish.test.ts` holds the framing). No new
automatic camera motion.

## 5. HUD and controls

- **Top**: one bar edge to edge, one height (44 px): time and temperature, the avalanche danger badge, funds, then
  Map and Pause. The compass fills the line under it with the waypoint's tag flush right.
- **Thumb cluster**: the column of four pills (Map, Koda: stay, Skis on, Pet Koda) is replaced by the act
  button in the corner with the controls that apply right now on an arc round it (Get off, Skis, Koda), each a
  56 px round notebook button with its word under the glyph. They fill the arc in order, so it never leaves a gap.
- **State**: the skis button is one toggle that turns nav-blue while skis are on; Koda's button says the command
  it will give (Stay / Heel / Tracking) and turns blue while Koda is staying or on a scent.
- **Pet Koda** in free play is a small paper act button (Koda is nearly always at your heel); a job, a door or a
  vehicle takes the big one and pops in. The mission step that asks you to pet him keeps the big button.
- Long single words (WORKBENCH) set tighter so they stay inside the circle; act labels are 12 px.
- `scripts/a11y.ts`: **35 of 35 checks pass, 0 axe violations** (every phone control at least 44 x 44 px,
  all HUD text at least 12 px).

## 6. Environment

- **Contact shadows**: a soft, cool pool of shade under Vince, Koda, the sled and the helicopter (fading as it
  lifts off), laid on the slope. One small quad each, one 64 px texture, no extra pass.
- **Far forest**: a touch bluer and lighter, with less speckle, so the foothill timber reads as winter woods
  instead of a muddy smear at phone size.
- No new buildings, no map changes, no post-processing.

## 7. Cost and performance

Same cameras on both builds (`renderer.info`, SwiftShader):

DRAWCALLS_TABLE

Draw calls fall by 40 to 69 per frame in every view (the characters, twice each with shadows); triangles rise 1
to 6 % (the richer figures). The shipped files grow: `rs_patroller.glb` 342 KB to 737 KB (it now carries the
hair, four detailed hats and vertex colours), `rs_koda.glb` 191 KB to 210 KB.

**Not verified on a physical phone.** These runs are SwiftShader (CPU WebGL) in headless Chromium: draw calls,
triangles, layout and colour are exact; frame times are not representative of a phone's GPU, so no frame-rate
claim is made. The change is designed to be cheaper where phones are bound (draw calls).

## 8. Remaining limitations

- Proportions are bounded by the shared skeleton (bone lengths drive the gait's leg solver); a taller or more
  athletic figure would need the gait retuned.
- The villagers still wear the previous figure's construction (same skeleton); they read fine at their
  distances, but are not yet at Vince's level.
- Vehicle mounting has no transition animation (out of scope for a visual pass).
- The camera does not avoid thin obstacles (the windsock mast can pass in front of Vince on the pad).
