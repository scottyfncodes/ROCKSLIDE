# Art Direction 2.0, Phase A: horizon, snow light, night (A1–A3)

**Field Guide Alpine: cold world, warm people.** Specification: [`../PLAN.md`](../PLAN.md), section 5, Phase A.

Phase A changes the world's light, air and horizon. It does not touch the interface, patrol red, the lodge
interior, the characters or their movement, the gameplay, or the save (`rockslide.patrol.v1`).

## The evidence

The before and after shots use the same cameras, times and weather on two builds:
- **before:** `main` at `bb7a1d9`;
- **after:** this branch.

`capture.mjs` in this folder stages every shot through the game's QA handle. Day 8 is clear in all four periods, so
day, dusk and night differ only by the clock. Day 1's evening is snow. Every sheet shows before on the left and
after on the right.

| Sheet | Shots |
| --- | --- |
| [compare-range.jpg](compare-range.jpg) | Vince with the range behind him; looking north; over the station; Kessel Bowl from the air |
| [compare-day.jpg](compare-day.jpg) | Lodge front 12:00; the yard 09:00; Tannberg top station 11:00 |
| [compare-dusk.jpg](compare-dusk.jpg) | Lodge front 18:50 clear; lodge front 18:40 in snow; top station 18:50 |
| [compare-night.jpg](compare-night.jpg) | Lodge front 21:30; the yard 21:00 (the headlamp) |
| [compare-phone.jpg](compare-phone.jpg) | **Portrait phone, 390 x 844 at 2x:** the yard HUD 09:30; looking north 11:00; the title |
| [compare-phone-night.jpg](compare-phone-night.jpg) | **Portrait phone:** lodge at dusk; lodge at night; Vince at night, close |

The raw numbers for every shot (draw calls and triangles) are in `shots-before.json` and `shots-after.json`.

## What changed

### A1: the horizon (`src/render/terrainView.ts`, `src/render/fieldGuide.ts`)

The old surround was one heightfield ring about 47 m per cell. It drew as a streaked wall with a single value
band, directly behind every close-up. It is replaced by **three ridge bands** in one closed mesh, which is still
one draw call.

| Band | Distance | Silhouette | Value | Haze step |
| --- | --- | --- | --- | --- |
| Foothills | 0.64 km | Rounded hills, irregularly spaced (seeded set, no repeats) | Dark Engelmann timber with snowy glades, speckled with forest | 0 |
| Range | 1.75 km | Serrated: many small teeth on a slow swell | Granite and snow, mid value | 0.16 |
| Peaks | 3.3 km | A skyline of 8 to 30 separate pyramids, highest behind Kessel Bowl | Mostly snow, palest | 0.40 |

How it is shaded and kept clean:
- **Light.** Each band's light falls in three soft steps, the screen-print look. The further the band, the flatter
  its light.
- **Haze.** Each band is lifted toward the haze by its own step, and the haze lies thicker at its foot, before
  the normal distance fog.
- **No streaks.** Erosion detail from the GITCRAFT WorldCraft heightfield is low-passed to what the mesh can
  carry. Detail finer than the rings is what drew the old streaks.

Seen from the station looking south, the tops of the three bands sit at about 7.7°, 11.5° and 15.1°. Each rises
above the one in front, and the sky keeps most of a portrait screen. `tests/field-guide.test.ts` holds this.

### A2: snow light (`src/render/terrainView.ts`, `src/render/rig.ts`)

- **Light.** The terrain shader splits the light on snow by its source:
  - **Sunlight** is multiplied toward cream: `[1.05, 1.00, 0.92]`.
  - **Skylight** is multiplied toward cobalt-violet: `[0.80, 0.90, 1.20] × 0.86`.

  At golden hour these become peach `[1.16, 0.93, 0.80]` over lilac. Under the moon both are cold. Overcast pulls
  both toward grey. The rig sets these every frame from the time of day and the weather.
- **Relief.** Two layers of relief go into the snow's normal, in metres:
  - **Wind drifts**, tens of metres long, laid across the wind.
  - **Sastrugi**, sharp-backed ridges a few metres apart, within 70 m.

  Both are domain-warped so they do not line up into a pattern. Fresh snow softens them.
- **Unchanged.** The surface kinds (packed, powder, crust, ice) and their colours.

### A3: dusk and night (`src/render/rig.ts`, `src/render/kit.ts`, `src/render/lamplight.ts`)

- **Moonlight.** A cold moon (`#9FB4E8`, intensity 0.62) replaces the dim violet night sun, so the snow reads at
  night. The night sky stays near black.
- **Sun to moon.** The sun hands over to the moon through twilight: the light's direction and colour blend,
  with no pop. The sky still draws the sun where it really is.
- **Figures.** People and Koda get a cold fill (`[0.06, 0.075, 0.12]` linear, at night only) and a sky rim. The
  rim is Fresnel on the figure's own material, with no extra pass. Vince keeps his red jacket and hair against
  the snow at 21:30. Before this, he was a black silhouette.
- **Window light.**
  - Every outward-facing lit pane throws a soft trapezoid of warm light (`#FFC488`) onto the snow, with faint
    glazing bars.
  - Panes are found from the scene (the window materials, the outward face of each pane). Panes of station
    buildings not yet built stay dark until they appear.
  - All of them are **one additive draw call** and no real lights.
- **Headlamp.** On foot or on skis after dark, Vince's headlamp lights a pool 1.6 to 7 m ahead of him, with a
  faint beam that shows in falling snow.

## Cost

| | Day | Dusk | Night |
| --- | --- | --- | --- |
| Draw calls | **+0** (every view) | +1 (window light) | +4 (window light; headlamp pool, beam and lamp) |
| Triangles | +19.2 k (the denser range mesh), every view | same | +22 to 23 k |

On a phone this is about **+8 to 12 % triangles** (205–270 k becomes 225–290 k). See `shots-*.json`.

**Shaders.** No full-screen pass was added. The lens grade is still CSS.

- **Snow (terrain) fragment shader:**
  - Up to 6 extra value noises a pixel at your feet: one warp, two drift octaves, one detail, two sastrugi.
  - 4 extra noises from 70 m to 420 m, none beyond, and none on rock.
  - One extra bump-normal evaluation.
  - The light split is about 10 ALU ops.

  The derivative stays outside the distance branch, so the quads are well defined. This is the one real cost:
  the snow covers about half a phone frame.
- **Range fragment shader:** two noises (forest speckle) and a few ops for the banded light and haze.
- **Figures:** a Fresnel term and a fill, a few ops.
- **Lamplight:**
  - Additive overdraw only where the pools are, near lit buildings at dusk and at night.
  - The headlamp grid is 81 vertices updated on the CPU each frame.
  - The pane search runs once at load: a raycast per pane.

**Expected iPhone impact.** The snow shader's extra noise is the item to watch. It is bounded by distance and
gated by rock. The game's dynamic resolution (0.6 to 1.0) already absorbs slow frames. Vertex cost and draw calls
barely move. I expect a small cost, within what dynamic resolution absorbs. **This is an estimate, not a
measurement.**

### What was and was not measured

- **Measured here (exact):** draw calls and triangles per view, from `renderer.info` on both builds.
- **Measured here (not meaningful):** frame times under SwiftShader, CPU WebGL on the build machine
  (`perf.json`, `perf.mjs`). It manages about 20 frames in 6 s per view. Medians are 217 to 300 ms in both builds,
  and the noise is larger than any difference. These numbers are **not** an iPhone measurement and do not show
  the change is free.
- **Not measured: real-device performance or rendering on a physical iPhone.** No device was available. Every
  picture here is iPhone-sized emulation in Chromium: portrait 390 x 844, touch, mobile user agent.
  Safari's WebGL and real GPU timing were not exercised.
- **To check on a device:**
  - Frame rate in the yard at 09:30 and at the lodge at 21:30, with the snow falling, in the pause menu's Full and
    Light graphics.
  - Whether dynamic resolution drops below 1.0 more often than before.

## Checks

- `npm run check` (typecheck, 200 tests in 28 files, build): see the pull request.
- `tests/field-guide.test.ts` (new), which checks:
  - the bible's light tokens match the code;
  - the bands step out, up and into the haze;
  - the silhouettes differ in kind (summit count, teeth count, roughness);
  - from the station each band rises above the one in front, under 22°;
  - snow light is warm in the sun and cool in the shade, and night is cold;
  - window detection keeps only the outward face of a pane.
- `tests/art-direction.test.ts` is unchanged and passes. The interface tokens and `grade()` did not move.
- Art bible edition 2.3: captures re-taken from this build, the light page rewritten, `tokens.json` carries
  `light`.

## Known limits and next

- A pale, flat shelf still shows between the valley's edge and the foothills from some low views. It is the
  ground between them; Phase C can timber it.
- The mission beacon is still the translucent column (Phase C2). The crags still read as scattered blocks (A4).
  Neither was in scope here.
- Window pools are found once at load. A station building bought later lights up when it appears, because its
  panes were found while hidden. A building added at runtime by some other route would not be found.
