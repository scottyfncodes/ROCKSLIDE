# Quality and retention pass: progression, accessibility, polish (2026-11-05)

Baseline: `main` at `f9af323` (what https://rockslide-game.vercel.app/ serves). Branch:
`claude/rockslide-quality-retention-fi8ebt`. Every number below was measured in this session on this machine
(headless Chromium, software WebGL). Nothing was tested on a physical phone.

## Pass 1: progression and replayability

### Why the scores sat at 80-81

Read from the code and the playthrough, not guessed:

| Question | Finding on `main` |
|---|---|
| Is there anything new after the story? | No. After the six story missions the board offers only Tree Down and Stuck in the Drift, each always 90 funds / 70 reputation. |
| Is the signature system replayable? | No. Kessel Bowl's avalanche, the recon scanner, the forecast and the danger level are used by two one-time missions. The bowl's loaded slopes were hard-coded (A and C). |
| Do the forecast and the night matter? | Barely. The README said sleeping loads the slopes up again; the code decayed the fresh snow overnight (`nextDay`: x0.85) and only reset a flag. |
| Do rewards depend on how you play? | No. The debrief measured the release (share down, road hit) but the pay was fixed. |
| Long-term goals? | Rank, buildings, badges and gear exist and are real (the workshop is a building, the engine is measurably faster). But nothing showed the next rank or how far it was, and the last rank (Chief, 1500) was reachable after the story only by 70-reputation callouts. |
| Station ownership? | Good already: buildings appear in the yard and open gear. Left alone. |

### What changed, and why each was needed

| Change | Why |
|---|---|
| **Overnight snow** (`overnightSnow`, `nextDay`): heavy after a snowy evening, a dusting after a clear one, deterministic per day | Makes the forecast matter and makes the README's promise true. About one morning in three loads the bowl past 25 cm after a control the day before. |
| **Kessel Bowl reloads** (`checkBowl`): after the story's release, at 25 cm the avalanche service posts two calls, "Kessel Bowl Has Reloaded" (recon) and "Bring Down the Bowl" (control) | Reuses the game's best system instead of adding content volume. No timer, no new currency: it comes with the weather. |
| **The wind decides which slopes are loaded** (`WIND_LOADS`, nine patterns, one to three slopes) and the snowpack takes them (`Snowpack(loaded)`; the story stays A and C) | The recon flight becomes information gathering, not a formality. Every pattern was simulated: the berm holds in all nine, and a wrong read brings 0% of the loaded snow down. |
| **Choose your charges**: the control job offers all four slopes and the step ends when you fire; recon is optional | A real decision: fly recon first, or read the slopes yourself and risk wasting charges. |
| **Graded pay** (`gradeControl`): 100 funds for the job + up to 140 for the share of loaded snow down, 25 off per charge on a stable slope, 50 (and 30 reputation) for a clean read; the table says "up to 290" | Rewards how well the job was done; the debrief names what was loaded, what you charged and what it paid. Story missions pay exactly what they did. |
| **Next rank on the mission table and in the patrol log** (`nextGoal`): one line and a thin mustard bar | A visible long-term goal without a new menu. Bowl work (up to 170 reputation) makes Chief of patrol reachable by play. |
| **Patrol log counts bowl days and clean reads** | A light record of mastery, no achievement system. |
| Five new avalanche-service lines voiced with AudioCraft (`bm_george`, seed 7, the same radio chain) | Every mission call and sign-off is voiced word for word (enforced by `tests/voice.test.ts`). |

Not done, on purpose: no daily rewards, streaks, energy, timers, new currencies or loot. The callouts were left as
they are. The skill-shot callout PLAYCRAFT suggests ("CHAIN x5") does not fit the game's tone.

A bug found by the new playthrough section and fixed: after the first charge, the disabled "Too close to fire"
took the single action button, so the next slope could not be charged while standing on it. Now the fire button
only appears on the choose-your-charges step once you are clear.

### Save compatibility

New profile fields (`loaded`, `loadWind`, `bowlDays`, `cleanReads`) default when missing; a damaged save drops bowl
calls it cannot back up and a bowl job without its loaded slopes. Tests: an old save without the fields loads and
keeps its progress; a bowl job in progress survives save and reload with its slopes; Continue mid-mission is still
checked in the browser playthrough.

## PLAYCRAFT

| Category | `main` re-baseline | Branch | Change |
|---|---|---|---|
| Core gameplay | 86 | 86 | 0 |
| Game feel | 77 | 80 | +3 |
| Controls and responsiveness | 87 | 86 | -1 |
| Progression and rewards | 77 | 85 | +8 |
| Difficulty and balance | 79 | 79 | 0 |
| Player experience | 71 | 84 | +13 |
| Replayability | 73 | 85 | +12 |
| Technical gameplay quality | 90 | 90 | 0 |
| Presentation and immersion | 83 | 83 | 0 |
| Mobile experience | 95 | 95 | 0 |
| **Overall** | **82** | **85** | **+3** |

How to read this honestly:

- **The re-baseline is 82, not the 85 on record.** The 85 run recorded only "pass" judgements. This baseline adds
  three critical judgements from the analysis above (nothing new after the story, no visible next goal, repeat pay
  fixed), which is why progression, replayability and feel read lower on unchanged code.
- **Progression +8, replayability +12, feel +3** rest on (a) the new browser playthrough section (verified) and
  (b) my own judgements moving from partial to pass after playing it (observed). The judgements are mine; the
  playthrough evidence is what backs them.
- **Player experience +13 is mostly measurement noise.** It comes from "time to play" (7.8 s → 2.3 s): the baseline
  was measured while a playthrough was running on the same 4 cores. This work did not change startup.
- **Controls -1, and the verify's "failed" status.** The first verify flagged ArrowUp (desktop) and a centre tap
  (phone) as "no longer changing the screen"; the final verify, on the final build, flags ArrowUp only (11 of 13 probed
  inputs respond, 10 of 13 on `main`). A direct A/B on both builds (same machine, same steps) shows identical
  behaviour: ArrowUp moves the player 0.3 m in 6 s in both (the start position faces the lodge wall), and the centre
  tap lands on the 3D canvas and changes nothing in either. The probe compares screenshots at under 10 fps and says
  so in its own report. Reported, not waived: see the verify report.

## Pass 2: accessibility

See [`docs/accessibility/REPORT.md`](../accessibility/REPORT.md). axe-core: 143 contrast failures and 194
landmark findings → 0; 21 → 35 of 35 scripted checks; the one remaining axe rule (`meta-viewport`) is kept on purpose.

## Pass 3: interface polish

| Item | Change |
|---|---|
| Round action button hover | Brightens and rises a pixel under a mouse (it has no border to light up); mission rows and shop items join the shared hover, press and focus states |
| `.mrow.sel` hard-coded `#2f3d4b` | `var(--ink)`: the selected call is the darkest card stock with the cream rule |
| Map card spacing and scale | On the 4 px scale (gaps 8 / 16, padding 4 / 8 / 12), the 8 px card radius like every other card, paper zoom buttons and legend on `--paper`, a cream rule instead of a black border; on desktop the map and the calls take equal columns |
| Found in the audit: the mission table ran off the right edge of a 390 px phone | Present on `main` (the grid's `1fr` would not shrink below its content): map zoom buttons, the evening forecast and the reward tags were cut off. Now one column that fits |
| Found: two calls at the same place stacked two pins | Calls at the same place share one pin |
| Found: off-palette inline colours in the panels (`#cfe6f5`, `#f2b33d`, `#a8321f`, `#d6e0e8`, `#7a6a58`) | Token classes (`--cyan`, `--amber`, `--red`, `--muted`, `--slate-2`) |

No new tokens, colours, typefaces or animation.

## PIXELCRAFT

Same probe on both builds (`docs/pixelcraft/quality-pass/`): title, HUD and map at six viewports (iPhone 17,
iPhone 13, desktop, narrow, tablet, landscape) and three journeys (start a patrol, open and close the map, pause and
resume); `pixelcraft_verify` compares only metrics measured in both runs (467).

| Category | `main` | Branch | Change |
|---|---|---|---|
| Visual Quality | 90.2 | 90.7 | +0.5 |
| Usability | 81.7 | 80.8 | -0.9 |
| Consistency | 78.1 | 79.9 | +1.8 |
| **Overall** | **83.3** | **83.8** | **+0.5** |

Resolved: *No hover state* (the round action button). New findings: none.

**Why this is not compared with the 78.3 on record.** That run used four screens (pause included) and an older probe.
Here the pause screen could not be included: PIXELCRAFT crashes in its own evidence-cropping step on that screen
(`report.py` `annotate`: an element entirely outside the screenshot gives an inverted crop box), on `main` as well as
on the branch. I did not patch the tool. Pause is covered by `scripts/a11y.ts` instead. Its axe step was also off, to
match the 78.3 method and because of the same crash; axe ran separately (Pass 2).

**The first verify of this branch failed, and it was right.** It found three regressions I had introduced: the
radio's visually hidden colon read as truncated text, the map zoom buttons' new 8 px radius added a fourth control
radius, and focus returning to the HUD's Map chip after the map closed. All three were fixed
(`verify-comparison-first-build.json` → `verify-comparison.json`).

**The final verify still reports "failed" on two map-screen metrics at desktop**: *controls reachable with Tab*
62% → 12% and *feedback within 400 ms* on the map journey 33% → 0%. The Tab metric clicks the page corner (on the map
screen that is the dimmed edge, which closes the map) and then presses Tab, which in play is the game's map key.
Reproduced by hand on both builds with the same steps: identical (the map closes, and Tab then reaches nothing in
either). Across three runs the metric read 62%, 25% and 12% depending on whether a slow software frame let the game
reopen the map mid-walk. The 400 ms metric is frame time under software WebGL. Neither is waived; both are reported.
The mission table, where most of the polish is, is not a PIXELCRAFT screen (its steps cannot walk to the table);
it is covered by the accessibility audit and the screenshots in this PR.

## Art bible

Edition **2.1** (`art/kessel-art-bible.pdf`, `art/bible/CHANGES.md`). Only what the interface changes made
inaccurate: pages 8 (title and the mission table), 9 (the HUD's action button) and 10 (calls, map and progression)
re-captured and re-described, and the page 15 forecast crop moved. Six captures re-taken
(`ui-board`, `ui-board-station`, `phone-board`, `ui-map`, `ui-wardrobe`, `ui-pause`); the 35 others, the palette,
type, tokens and world colours are unchanged (`tests/art-direction.test.ts` passes: no token drift).

## Tests and checks

| | Result |
|---|---|
| `npm run check` | typecheck clean, 26 test files, 190 tests (22 new in `tests/bowl.test.ts`), build OK |
| Browser playthrough (`scripts/playthrough.ts`, `docs/playcraft/evidence/`) | **102/102** in 718 s on the final build (was 84/84): all six story missions, both callouts, the new Kessel Bowl loop end to end (the night's snow reloaded the bowl on its own: strong west wind, A/C/D), rank, building, buying, the engine measured faster, Continue after a reload mid-mission, sleeping, 0 page or console errors. 72 real key inputs, 37 clicks; long journeys are QA teleports (146, counted) |
| Accessibility (`scripts/a11y.ts`) | 35/35, axe: 1 rule (kept, see above) |
| Desktop and phone layout | Checked by the playthrough (390 x 844 touch), the accessibility audit (390 x 844 and 1440 x 900) and PIXELCRAFT (six viewports) |

## Not tested

- Real-device frame rate, iOS Safari, Android; a screen reader; the OS reduced-motion setting on a device.
- The new bowl loop in a person's hands over several in-game days: the playthrough plays one reload with QA
  teleports for the long journeys. Whether one reload in three days is the right rhythm is a judgement to check by
  playing.
