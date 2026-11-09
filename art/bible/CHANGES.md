# Captures re-taken for the gameplay expansion, phase 3 (2026-11-09)

The backcountry gate behind the top station (posts, rope and a sign in the existing signal red), a
small heli ledge in the Weisskopf's bowl, and the ranks' new names on the HUD and boards. No palette,
type, token, model or shader changed; `tokens.json` is unchanged. Every capture re-taken.

# Captures re-taken for the gameplay expansion, phase 2 (2026-11-09)

Avalanche control and rescue on the Tannberg side: the howitzer by the Patrol HQ bunker and the
Avalauncher on the top station (kit solids in the existing olive, yellow and slate roles), slide debris
in the snow's own colour, and the Tannberg avalanche paths left open (treeless, as Kessel Bowl's is). No
palette, type, token, model or shader changed; `tokens.json` is unchanged. Every capture re-taken.

# Captures re-taken for the gameplay expansion, phase 1 (2026-11-09)

The base area became one planned town (Tannberg Village: Main Street, Patrol HQ and the vehicle yard,
Hollin guest village, the lift base plaza and terrain park). No palette, type, token, model or shader
changed: the new buildings, signposts, light poles, bunker, fuel island and kickers are built from the
existing kit in its existing roles. Every capture of edition 2.7 was re-taken from the new build
(`capture.mjs`; the station views moved with the station by (385, 50)); `tokens.json` is unchanged.

# Art bible edition 2.7: Character Evolution (2026-11-09)

Character Evolution (`docs/character-evolution/REPORT.md`): Vince and Koda rebuilt as characters on their existing
skeletons, a phone-first camera and HUD, contact shadows. Palette roles, type, `grade()` and the `:root` tokens are
unchanged.

| Page | What changed in the game | In the bible |
| --- | --- | --- |
| Every page with a world capture | Vince: lofted parka, boots, gloves, a larger face, his hair as a model, the rescue pack; Koda: one lofted barrel with the husky coat, plume tail; contact shadows; a frosted far forest; the phone camera closer | All captures re-taken from the new build (`capture.mjs`) |
| 7 Shapes | People and Koda are lofted, tapered forms; on a phone the chips are round buttons on an arc | Captions |
| 9 Interface | One top bar (instruments, Map, Pause); the thumb cluster; Pet Koda as a small paper button | The rules of the HUD |
| 11 Vince | The new figure | The spec |
| 12 Koda | The new Koda | Coat and tail |
| Running header | Edition | SNOW PATROL · KESSEL ART BIBLE · EDITION 2.7 |

# Art bible edition 2.6: Art Direction A, Stylized Alpine 3D, milestone 1 (2026-11-09)

Art Direction A (`docs/art-direction-a/REPORT.md`): the patroller, the lodge and the snowmobile, with the ground
around the lodge, carried toward a stylized alpine 3D look through the new shared Alpine kit
(`art/3d/scripts/alpine_kit.py`). Palette roles, type, `grade()` and the `:root` tokens are unchanged.

| Page | What changed in the game | In the bible |
| --- | --- | --- |
| Every page with a world capture | The lodge stands on a fieldstone socle under a soft snow load with icicles, with the patrol plaque, a lamp, a woodpile and skis on its yard wall; the snowmobile has a smooth cowl, suspension, bogie wheels and strapped bags; Vince's shell is layered (baffles, storm flap, fleece collar, gauntlets) with a belt, first-aid pouch and sleeve cross | All captures re-taken from the new build (`capture.mjs`) |
| 13 Places | The lodge | Captions |
| 11 Vince | Gear in existing roles | Caption |
| 17 Machines | The snowmobile | Caption |
| 19 Rules | Buildings stand on a stone socle; snow is a soft load, never a slab | The shape check |
| Running header | Edition | SNOW PATROL · KESSEL ART BIBLE · EDITION 2.6 |

# Art bible edition 2.5: Field Guide Alpine, Phase C (2026-11-09)

Art Direction 2.0, Phase C (`docs/art-direction-2/phase-c/REPORT.md`): every building gets the garage's
construction logic, and walls in shade take light bounced from the snow. Palette roles, type, `grade()` and the
`:root` tokens are unchanged.

| Page | What changed in the game | In the bible |
| --- | --- | --- |
| Every page with a world capture | Hangar, equipment room, kennel and mast hut rebuilt; chalets, chapel, cabin, boathouse and barrier hut detailed; shaded walls lifted by the snow bounce | All captures re-taken from the new build (`capture.mjs`) |
| Every page with a world capture | The range eases up out of the valley instead of a 100 m step (no grey wall under the foothills) | Re-captured |
| 13 Places | The yard livery and construction rule | Caption |
| 15 Light | The snow bounce | A rule beside the sky ramp |
| 4 Colour tokens, 7 Shapes, 9 Interface | The in-play HUD is a field notebook (new tokens `--kraft`, `--graphite`, `--nav-ink`); panels keep the storybook card stock | Tokens, captions, HUD captures |
| Running header | Edition | SNOW PATROL · KESSEL ART BIBLE · EDITION 2.5 |

# Art bible edition 2.4: Field Guide Alpine, Phase B (2026-11-09)

Art Direction 2.0, Phase B (`docs/art-direction-2/phase-b/REPORT.md`): one modelling language for the cast, a
working garage, and a lighter HUD. Palette roles, type, `grade()` and the `:root` tokens are unchanged.

| Page | What changed in the game | In the bible |
| --- | --- | --- |
| Every page with a world capture | Vince, the villagers and Koda are soft carved figures, smooth shaded (no flat facets); Vince carries his skis diagonally across the pack; the garage is barn-red board and batten on a concrete stem wall with a timber-framed bay | All captures re-taken from the new build (`capture.mjs`) |
| 3 Direction, 7 Shapes, 19 Rules | Figures: rounded masses, smooth shading, hard edges only on gear | Shape rules rewritten; "never a smooth figure" retired, "never skis carried upright" added |
| 7 Shapes, 9 Interface | HUD cards are burgundy glass (74 % over a blur); on a phone the chips are pills down the right edge above a 78 px act button | Shape and HUD captions |
| 5 Colour | The garage is repainted from mint to barn red | The repaint rule |
| 11, 12 People; 13 Places | Build, carry, the villagers; the yard | Captions |
| Running header | Edition | SNOW PATROL · KESSEL ART BIBLE · EDITION 2.4 |

# Art bible edition 2.3: Field Guide Alpine, Phase A (2026-11-09)

Art Direction 2.0 (`docs/art-direction-2/PLAN.md`), Phase A: the world's light, air and horizon. The interface,
type, palette roles and `grade()` are unchanged. The new world-light values live in `src/render/fieldGuide.ts`
and are quoted in `tokens.json` under `light`; `tests/field-guide.test.ts` holds them to the game.

| Page | What changed in the game | In the bible |
| --- | --- | --- |
| Every page with a world capture | The surround is three ridge bands (timbered foothills, a serrated granite range, separate summits), each a step further into the haze; snow is lit cream and shaded cobalt-violet, with wind drifts and sastrugi; the night has a cold moon, a fill and rim on the people, window light on the snow and Vince's headlamp | All captures re-taken from the new build (`capture.mjs`) |
| 15 Light | The rules above | Captions and the rules beside the sky ramp; the sky ramp's night sun is now the moon (`#9FB4E8`) |
| Running header | Edition | SNOW PATROL · KESSEL ART BIBLE · EDITION 2.3 |

# Art bible edition 2.2: the game is now SNOW PATROL (2026-11-08)

A naming edition. The game was renamed from ROCKSLIDE to SNOW PATROL; the art direction is unchanged (no new
tokens, palette, type or world colours).

| Page | What changed in the game | In the bible |
| --- | --- | --- |
| 1 Cover | The name | SNOW PATROL in Jost SemiBold (72 pt, so the two words clear the lodge), KESSEL VALLEY beneath |
| Running header | The name | SNOW PATROL · KESSEL ART BIBLE · EDITION 2.2 |
| 6 Typography | The wordmark reads SNOW PATROL; the sub-brand under it is KESSEL VALLEY; the wordmark stays on one line (`white-space: nowrap`) and is sized `clamp(28px, 8.6vw, 60px)` so it fits a 320 px phone and the desktop title card | `ui-title` re-captured; the wordmark crop widened to the longer name; the wordmark text |
| 8 Title and the mission table | The title screen shows the new name | `phone-title` re-captured; the title text |
| 18 Identity | The share card carries the new name | `share-card` from the new `public/og-image.jpg`; the share card text |

# Art bible edition 2.1: synchronised with the quality and retention pass (2026-11-05)

A point edition: the interface changed in small ways, so the pages that show it were brought back in step. Nothing
else was re-captured or re-laid; the palette, type, tokens and world colours are unchanged (no new tokens).

| Page | What changed in the game | In the bible |
| --- | --- | --- |
| 8 Title and the mission table | The next rank above the forecast; locked calls as dashed open cards (were faded to 45%, which failed contrast); one column on a phone that fits 390 px; tabs 44 px; hover, press and focus on every card button | `ui-board`, `ui-board-station`, `phone-board` re-captured; the "What makes it" text |
| 9 The HUD | The round action button brightens and rises a pixel under a mouse | Text |
| 10 Calls, the map and progression | Kessel Bowl's repeat calls (one shared pin, "up to" rewards); map card on the 4 px grid with the 8 px card radius and paper controls; locked shop items as dashed cards | `ui-map`, `ui-wardrobe`, `ui-pause` re-captured; the progression text |
| 15 Weather | The forecast moved down on the board | `ui-forecast` crop moved |

`capture.mjs` now waits 2.6 s for a panel to finish rising before it shoots (the 1.4 s it had caught the board
mid fade-in under software WebGL).

# Art bible edition 2: what changed

Edition 2 (`art/kessel-art-bible.pdf`, 20 pages) replaces edition 1 (3 pages: an emblem, a palette
and a ten-piece kit contact sheet on dark slate). It was rebuilt from the game as it ships, not edited
from edition 1.

## Retired references

| Edition 1 said or showed | Today | Where it is now stated |
| --- | --- | --- |
| Slate ink pages and "slate instrument housings" (#141C24, #1D2731), muted #9FB0BF, paper #F1ECE1 | Aubergine and burgundy card stock, cream paper (`src/ui/style.css :root`) | Pages 4, 7, 19 |
| Inter Display, Inter, JetBrains Mono | Jost, Courier Prime, IBM Plex Mono (Archivo and Inter belonged to earlier versions of the game) | Page 6, 19 |
| "Flat palette colour, lit like a clear winter morning" | A hard warm sun, a cold blue skylight, aerial perspective, the lens grade | Pages 3, 15, 16 |
| A palette of 26 storybook roles as the colours | Those roles are the paints; `grade()` turns them into the rendered colours | Page 5 |
| Pole orange #FF7A1A as an interface accent | Survives only as the snow-pole tip's picked colour (renders #D38851) | Pages 5, 17, 19 |
| The kit sheet as the direction | The kit is in the game; the direction is the two layers | Pages 3, 19 |

Also out of date and corrected in this change: `art/README.md`'s "storybook valley" section
(a raspberry lodge, a pastel Hollin, the plum print), the header comment in `src/ui/style.css`
("slate instrument housings") and `public/manifest.webmanifest`, which still gave the installed app
#141C24 as its theme and splash colour (now `--slate` #4A2330 and the page background #2A1C26).

## New standards

- **Two layers**: a storybook interface over a Colorado high-country world; never mixed (page 3).
- **Colour from code**: interface values are the CSS tokens; world values are `grade()` outputs;
  light (sky, sun, beacon) is ungraded. `tokens.json` is generated, never typed (pages 4, 5).
- **Three faces, three jobs** with sizes and tracking from the stylesheet; 12 px minimum on phones,
  44 px touch targets (page 6).
- **Card treatments**: 8 radius panels with a 1 px cream rule and a soft deep shadow, 44 px chips,
  paper, red and ghost buttons, the double-ruled chapter frame, the lens grade (page 7).
- **Character continuity**: Vince's honey-blonde curls, red shell, green scarf; Koda's flopped left
  ear; one strong jacket colour per villager; the shared skeletons (pages 11, 12).
- **Lighting reference**: one camera at 06:40, 12:00, 18:40, 21:30 and in four weathers (15, 16).
- **Picture tags**: in-game capture, staged in engine, illustrative, generated, shipped asset,
  retired (page 2).
- **Checklist and review procedure** for any new asset, screen or document (page 19).

## Guards

`tests/art-direction.test.ts` runs in `npm test` and CI:

- the stylesheet's `:root` must equal the bible's interface tokens;
- every kit colour's `grade()` output must equal the bible's world colours;
- the bible, its layout, captures, fonts list and QA record must be in the repository;
- nothing that ships (`src/`, `index.html`, the web manifest) may use #141C24, #1D2731, #F1ECE1,
  #9FB0BF, Inter, Inter Display, JetBrains Mono or Archivo;
- `index.html` loads exactly Jost, Courier Prime and IBM Plex Mono; the theme colour is `--slate`.

`CLAUDE.md` at the repository root points future Claude Code sessions at the bible.
