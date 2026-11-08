# PIXELCRAFT audit: rockslide

Target: `/home/user/ROCKSLIDE/gitcraft-out/base-dist` · method pixelcraft-1.0 · 2026-11-05T19:29:04+00:00 · commit `8fc3ac4479`

## 1. Overall PIXELCRAFT score: **83.3** / 100 (good)

Evidence coverage 100% · confidence **low** — axe-core did not run; canvas-rendered screens: the DOM does not describe what is drawn; browser emulation only (no physical-device evidence)

Coverage and confidence are reported separately from quality: an area with no evidence is *not tested*, never zero and never capped.

## 2. Category scores

| Category | Score | Coverage | Not tested |
|---|---|---|---|
| Visual Quality | **90.2** | 100% | — |
| Usability | **81.7** | 100% | — |
| Consistency | **78.1** | 100% | — |

### Visual Quality

| Area | Points | Awarded | Evidence | Weakest metric |
|---|---|---|---|---|
| Spacing and rhythm | 25 | 21.2 | measured ×48 | no unexplained empty bands (65%) |
| Layout and composition | 25 | 22.5 | measured ×90 | controls not covered by other elements (70%) |
| Typography and hierarchy | 20 | 17.4 | measured ×60 | headings stand out from body text (42%) |
| Buttons and controls | 20 | 20 | measured ×66 | touch/click targets at least 44 px (100%) |
| Visual consistency | 10 | 9 | measured ×30 | few font families (81%) |

### Usability

| Area | Points | Awarded | Evidence | Weakest metric |
|---|---|---|---|---|
| Interaction efficiency | 25 | 25 | measured ×18 | journeys complete (100%) |
| Navigation and discoverability | 20 | 6.7 | measured ×19 | navigation stays in the same place on every screen (0%) |
| Mobile ergonomics | 25 | 24.5 | measured ×59 | main actions within thumb reach (82%) |
| Feedback and interaction states | 15 | 11.7 | measured ×19 | feedback within 400 ms (3%) |
| Accessibility | 15 | 13.9 | measured ×6 | controls reachable with Tab (78%) |

### Consistency

| Area | Points | Awarded | Evidence | Weakest metric |
|---|---|---|---|---|
| Cross-screen consistency | 25 | 16.2 | measured ×12 | primary buttons look the same on every screen (50%) |
| Component consistency | 25 | 22 | measured ×6 | few button variants (88%) |
| Responsive consistency | 20 | 14.7 | measured ×6 | the same content at every size (20%) |
| Design system adherence | 20 | 16.6 | measured ×24 | spacing tokens (4-px grid) (63%) |
| State consistency | 10 | 8.7 | measured ×4 | hover treatment applied consistently (60%) |

## 3. Strongest screens

- **title** — 96.5

## 4. Weakest screens

- **map** — 91.8
- **hud** — 92.5

## 5. Critical usability defects

### Dead-end screen — major · Measured (rendered DOM)

Screen 'title' has no link, tab or back/close control: the only way out is the browser.

**Fix:** Give every screen persistent navigation or a visible back/close control.

Seen 12× — screens: hud, title; viewports: desktop, iphone13, iphone17, landscape, narrow, tablet · priority 16.37 (fix now)

- `—` on title @ iphone17: exits=0 — ![evidence](evidence/nav_dead_end_0.jpg)
- `—` on hud @ iphone17: exits=0 — ![evidence](evidence/nav_dead_end_1.jpg)
- `—` on title @ iphone13: exits=0

## 6. Spacing and layout defects

### Spacing does not follow a consistent scale — minor · Measured (rendered DOM)

Paddings, gaps and margins use many unrelated values, so the rhythm between elements looks accidental rather than designed.

**Fix:** Adopt a spacing scale (4/8-px steps: 4, 8, 12, 16, 24, 32) as tokens and replace one-off values with the nearest step.

Seen 7× — screens: map, title; viewports: desktop, iphone13, iphone17, landscape, narrow, tablet · priority 7.55 (next)

- `—` on map @ iphone17: on_scale_share=0.66, distinct_values=13, off_scale_values_px=[6, 10, 14] — ![evidence](evidence/spacing_off_scale_0.jpg)
- `—` on map @ iphone13: on_scale_share=0.66, distinct_values=13, off_scale_values_px=[6, 10, 14] — ![evidence](evidence/spacing_off_scale_1.jpg)
- `—` on map @ desktop: on_scale_share=0.61, distinct_values=11, off_scale_values_px=[6, 10, 14]
### Excessive empty gap between sections — minor · Measured (rendered DOM)

A 719-px band with no content separates sections — more than 40% of the screen height — so users may think the page ended.

**Fix:** Reduce the gap to the section spacing used elsewhere, or fill it intentionally (imagery, a section heading).

Seen 3× — screens: hud, map; viewports: desktop, tablet · priority 6.03 (next)

- `#ui > div.hud > div.stack:nth-of-type(1) > div.radio.housing:nth-of-type(5)` on hud @ desktop: empty_gap_px=719, viewport_height=900 — ![evidence](evidence/spacing_void_0.jpg)
- `#ui > div.hud:nth-of-type(1) > div.stack:nth-of-type(1) > div.radio.housing:nth-of-type(5)` on map @ desktop: empty_gap_px=735, viewport_height=900 — ![evidence](evidence/spacing_void_1.jpg)
- `#ui > div.hud > div.stack:nth-of-type(1) > div.radio.housing:nth-of-type(5)` on hud @ tablet: empty_gap_px=938, viewport_height=1180
### Layout jumps while the screen loads — minor · Measured (rendered DOM)

Cumulative layout shift 0.12 (Chromium's layout-shift entries; 0.1 is the 'good' limit): content moves under the user's thumb as images, fonts or data arrive.

**Fix:** Reserve space for late content (width/height or aspect-ratio on media, skeletons with final sizes, font-display with metric overrides).

Seen 1× — screens: title; viewports: iphone17 · priority 1.51 (polish)

- `—` on title @ iphone17: cls=0.1227, shifts=1 — ![evidence](evidence/layout_shift_0.jpg)

## 7. Button and control defects

### A control is covered by another element — major · Measured (rendered DOM)

Tapping the centre of this control hits a different element (often a fixed bar or floating button), so the control is hard or impossible to use.

**Fix:** Reserve space for fixed/floating elements (padding-bottom on the scroll area equal to their height) or move the floating element.

Seen 6× — screens: map; viewports: desktop, iphone13, iphone17, landscape, narrow, tablet · priority 10.24 (fix now)

- `#ui > div.hud:nth-of-type(1) > div.cond:nth-of-type(2) > button.iconbtn` on map @ iphone17: covered_by="div.panel-wrap.enter:nth-of-type(2) > div.panel.mappanel > header > button.x" — ![evidence](evidence/controls_obscured_0.jpg)
- `div.hud:nth-of-type(1) > div.actions:nth-of-type(3) > div.side:nth-of-type(1) > button.chip:nth-of-type(1)` on map @ iphone17: covered_by="div.panel.mappanel > div.body > div.mapcard > div.mapview:nth-of-type(1)" — ![evidence](evidence/controls_obscured_1.jpg)
- `div.hud:nth-of-type(1) > div.actions:nth-of-type(3) > div.side:nth-of-type(1) > button.chip:nth-of-type(2)` on map @ iphone17: covered_by="div.panel.mappanel > div.body > div.mapcard > div.mapview:nth-of-type(1)"
### No hover state — minor · Measured (rendered DOM)

The pointer over this control changes nothing (colour, shadow, underline), so it does not signal that it is clickable.

**Fix:** Add a hover style (tone shift, underline, elevation) for every interactive component variant.

Seen 1× — screens: hud; viewports: desktop · priority 2.11 (polish)

- `#ui > div.hud > div.actions:nth-of-type(3) > button.act.pop` on hud @ desktop: style_changed_on_hover=false — ![evidence](evidence/states_no_hover_0.jpg)

## 8. Mobile-specific findings

### Main action is at the top of the phone screen — minor · Measured (rendered DOM)

The primary action sits in the top fifth of a tall phone screen, the hardest zone to reach one-handed.

**Fix:** Repeat or move the main action to the lower half (a bottom action bar or floating button).

Seen 8× — screens: hud, map; viewports: iphone13, iphone17, narrow, tablet · priority 8.25 (next)

- `#ui > div.hud > div.cond:nth-of-type(2) > button.iconbtn` on hud @ iphone17: centre_y_share=0.11 — ![evidence](evidence/mobile_reach_0.jpg)
- `#ui > div.hud:nth-of-type(1) > div.cond:nth-of-type(2) > button.iconbtn` on map @ iphone17: centre_y_share=0.11 — ![evidence](evidence/mobile_reach_1.jpg)
- `div.panel-wrap.enter:nth-of-type(2) > div.panel.mappanel > header > button.x` on map @ iphone17: centre_y_share=0.12
### Content disappears at one screen size — minor · Measured (rendered DOM)

At landscape, 'title' shows only 24% of the words other sizes show; hidden content on phones is a common source of 'where did it go?'.

**Fix:** Reflow content instead of hiding it; move secondary content behind a disclosure rather than display: none.

Seen 2× — screens: hud, title; viewports: landscape, narrow · priority 3.17 (polish)

- `—` on title @ landscape: word_share=0.24 — ![evidence](evidence/resp_content_missing_0.jpg)
- `—` on hud @ narrow: word_share=0.44 — ![evidence](evidence/resp_content_missing_1.jpg)
### Layout jumps while the screen loads — minor · Measured (rendered DOM)

Cumulative layout shift 0.12 (Chromium's layout-shift entries; 0.1 is the 'good' limit): content moves under the user's thumb as images, fonts or data arrive.

**Fix:** Reserve space for late content (width/height or aspect-ratio on media, skeletons with final sizes, font-display with metric overrides).

Seen 1× — screens: title; viewports: iphone17 · priority 1.51 (polish)

- `—` on title @ iphone17: cls=0.1227, shifts=1 — ![evidence](evidence/layout_shift_0.jpg)

## 9. Screenshot gallery

Browser emulation (Playwright + Chromium); safe-area insets emulated through CDP. No physical-device evidence.

- title @ iphone17: ![title](gallery/title__iphone17.jpg)
- hud @ iphone17: ![hud](gallery/hud__iphone17.jpg)
- map @ iphone17: ![map](gallery/map__iphone17.jpg)
- title @ iphone13: ![title](gallery/title__iphone13.jpg)
- hud @ iphone13: ![hud](gallery/hud__iphone13.jpg)
- map @ iphone13: ![map](gallery/map__iphone13.jpg)
- title @ desktop: ![title](gallery/title__desktop.jpg)
- hud @ desktop: ![hud](gallery/hud__desktop.jpg)
- map @ desktop: ![map](gallery/map__desktop.jpg)
- title @ narrow: ![title](gallery/title__narrow.jpg)
- hud @ narrow: ![hud](gallery/hud__narrow.jpg)
- map @ narrow: ![map](gallery/map__narrow.jpg)
- title @ tablet: ![title](gallery/title__tablet.jpg)
- hud @ tablet: ![hud](gallery/hud__tablet.jpg)
- map @ tablet: ![map](gallery/map__tablet.jpg)
- title @ landscape: ![title](gallery/title__landscape.jpg)
- hud @ landscape: ![hud](gallery/hud__landscape.jpg)
- map @ landscape: ![map](gallery/map__landscape.jpg)

## 10. Prioritised improvement plan

| # | Tier | Fix | Severity | Seen | Cost | Area |
|---|---|---|---|---|---|---|
| 1 | fix now | **Dead-end screen** — Give every screen persistent navigation or a visible back/close control. | major | 12× | medium | navigation |
| 2 | fix now | **A control is covered by another element** — Reserve space for fixed/floating elements (padding-bottom on the scroll area equal to their height) or move the floating element. | major | 6× | medium | controls |
| 3 | next | **Main action is at the top of the phone screen** — Repeat or move the main action to the lower half (a bottom action bar or floating button). | minor | 8× | medium | mobile |
| 4 | next | **Spacing does not follow a consistent scale** — Adopt a spacing scale (4/8-px steps: 4, 8, 12, 16, 24, 32) as tokens and replace one-off values with the nearest step. | minor | 7× | medium | spacing |
| 5 | next | **Excessive empty gap between sections** — Reduce the gap to the section spacing used elsewhere, or fill it intentionally (imagery, a section heading). | minor | 3× | low | spacing |
| 6 | polish | **Content disappears at one screen size** — Reflow content instead of hiding it; move secondary content behind a disclosure rather than display: none. | minor | 2× | medium | responsive |
| 7 | polish | **No hover state** — Add a hover style (tone shift, underline, elevation) for every interactive component variant. | minor | 1× | low | feedback |
| 8 | polish | **Layout jumps while the screen loads** — Reserve space for late content (width/height or aspect-ratio on media, skeletons with final sizes, font-display with metric overrides). | minor | 1× | medium | layout |

## Journeys

| Journey | Viewport | Result | Taps | Expected | Confirmations | Feedback (ms) |
|---|---|---|---|---|---|---|
| start a patrol | iphone17 | ok | 1 | 1 | 0 | 1141 |
| open and close the map | iphone17 | ok | 3 | 3 | 0 | 1063, 1390, 2834 |
| pause and resume | iphone17 | ok | 3 | 3 | 0 | 1174, 1316, 2234 |
| start a patrol | desktop | ok | 1 | 1 | 0 | 1872 |
| open and close the map | desktop | ok | 3 | 3 | 0 | 1684, 910, 100 |
| pause and resume | desktop | ok | 3 | 3 | 0 | 1626, 1587, 921 |

## Evidence and limits

- Every viewport is browser emulation (Playwright + Chromium 153.0.8010.12); iPhone sizes are CSS pixels and safe-area insets are emulated through CDP (Emulation.setSafeAreaInsetsOverride). Safari-specific rendering (WebKit), the real on-screen keyboard and physical reach are not reproduced.
- Browser chrome: the first screen is re-measured with the viewport shortened by 120 px (Safari's toolbars); dynamic toolbar collapse is not reproduced.
- Keyboard interference: fields that would zoom on focus (font-size < 16 px) are measured; whether the on-screen keyboard covers a field is not testable in emulation.
- Hover/pressed/focus states are sampled once per visual variant of control; focus visibility comes from real Tab presses (desktop).
- Canvas-drawn interfaces (games): the DOM does not describe what is drawn, so DOM-geometry metrics cover only the HTML overlay (HUD, menus); use judgements for the canvas.
- No physical-device evidence: findings are emulation results, not device results.
- 24 request(s) outside the app's origin were blocked (no network): https://fonts.googleapis.com/css2?family=Jost:wght@400..800&family=Courier+Prime:wght@400;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap, https://fonts.googleapis.com/css2?family=Jost:wght@400..800&family=Courier+Prime:wght@400;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap, https://fonts.googleapis.com/css2?family=Jost:wght@400..800&family=Courier+Prime:wght@400;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap
