# PLAYCRAFT pass report

Game: **ROCKSLIDE: Mountain Patrol** · baseline 2026-11-05T17:50:47+00:00 · now 2026-11-05T20:09:34+00:00

Changed: 72 files changed, 7944 insertions(+), 4215 deletions(-)

## Before and after

| Category | Before | After | Change |
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

Measured on the running game (same probe, same machine):

- FPS (desktop, software rendering): 1.1 → 3.5
- FPS (phone, software rendering): 3.3 → 6.3
- fastest visible response (ms): 702 → 350
- touch response (ms): 493 → 156
- dead time during play: None → 0.0
- time to play (ms): 7832 → 2910
- page errors: 0 → 0
- missing files: 0 → 0
- input errors: 0 → 0
- probed inputs with a visible response: 10/13 → 11/13
- intermittent controls (responded in some trials only, not used for regressions): click centre (desktop), hold centre (phone), tap right third (phone) → 

**Fixed since the baseline:**

- Playable quickly (load + start ≤ 3 s) (observed → now passing)
- No visible next goal; the last rank is a callout grind (observed → now passing)
- Nothing new after the six story missions (observed → now passing)

A confirmation run replayed the build: 1 of 1 first-run regressions reproduced.

**Regressions:**

- ❌ inputs that no longer change the screen: key ArrowUp (desktop)

**What changed and why:**

- **Kessel Bowl reloads after the story** — The signature avalanche system and the forecast were used once; the post-story board had only two fixed callouts (`src/progress/profile.ts`, `src/missions/catalog.ts`, `src/missions/runner.ts`, `src/missions/avalanche.ts`, `src/world/weather.ts`, `src/game/game.ts`)
- **Graded control pay and next-rank goal** — Repeat work paid the same however it went; no visible long-term goal (`src/progress/profile.ts`, `src/ui/panels.ts`)
- **Accessibility and interface polish** — axe-core contrast failures, missing dialog/tab/live-region semantics, phone overflow on the mission table (`src/ui/panels.ts`, `src/ui/style.css`, `src/ui/hud.ts`, `index.html`)

**Guardrails on the diff:**

- ✅ no source files deleted (features kept): none
- ✅ deployment settings unchanged: none
- ✅ no secret files or secrets added: none
- ✅ no production data touched: none
- ✅ work is on a branch, not the default branch: claude/rockslide-quality-retention-fi8ebt

**Still open (top):**

- Skill shots are recognised (design, inferred)

