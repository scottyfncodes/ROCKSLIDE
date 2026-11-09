# Gameplay expansion, phase 3: missions, progression, the Daily Storm

## What is new
- **The patrol day** (`src/missions/patrolDay.ts`): briefing, control route, open runs, radio calls
  one at a time (a call waits while you are busy), the end-of-day report (stars, XP, reputation, the
  resort safety rating). No blocking timers: calls can be passed on, control skipped, the day ended at
  any time.
- **Ten call types** (`src/missions/calls.ts`), generated from a seed and saved by id, so a call in
  progress survives a reload. New step kinds in the runner: the toboggan tow, the heli hover-hoist, the
  rescue (waits for the burial to clear).
- **Progression**: ranks Rookie → Patroller → Senior Patroller → Avalanche Tech → Snow Safety Director
  with unlocks (the howitzer, the heavy charge, the airbag, the hoist and later calls, the backcountry
  gate, Weisskopf Bowl by helicopter); a rescue kit group (transceiver, shovel, airbag) that changes the
  rescue; the resort safety rating; XP.
- **The Daily Storm**: one seeded day per UTC calendar date, the same for everyone; the share text
  with emoji stars and Copy result; the streak (yesterday continues it, a gap restarts it, each day
  counts once).
- **Weather days**: powder, wind slab, bluebird, whiteout (Koda leads you; the view closes in to under
  100 m; the helicopter is grounded), night ops.
- Save: XP, safety, streak, the day in progress, a call in progress; older saves migrate and are not
  wiped.
- Two HUD fixes found by the extended release check: the compass now re-measures when the task card
  goes back to free patrol and when the instruments widen (funds gaining a digit).
- The font preload is now a FontFace load: the same early fetch without the "unused preload" console
  warning a cached reload produced on the live site.

## Evidence
- Screenshots (desktop 1280x800, phone 393x852): `docs/expansion/phase3/` (morning briefing, toboggan
  call, whiteout with Koda leading, end-of-day Daily Storm report and share card). No console errors.
- Tests: `tests/patrol-day.test.ts` (the daily seed gives the same day for the same date, rank does
  not change the storm, streaks, the report and share text, call pacing, every call builds and rebuilds
  from its id, the hoist and tow and rescue steps, stars, ranks, safety bounds, weather days, save
  migration of a call in progress). 245 tests pass.
- `scripts/verify.mjs` now also plays the Daily Storm through its buttons (mission table, briefing,
  open the runs, report, share card, streak): PASS on 5 phone viewports.
- Phone-tier perf against main (alternating runs, medians, ms): yard 232/238 vs 235/232, top station
  196/197 vs 197/175, pass road 172/154 vs 168/151, ridge 149/140 vs 147/134: parity within run noise.
