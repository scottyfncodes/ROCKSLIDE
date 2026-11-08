# PLAYCRAFT assessment: ROCKSLIDE: Mountain Patrol

> You are Vince, twenty, long blonde hair with a bit of a curl, the newest hand on the Kessel Patrol. You run the mountain patrol for the Kessel valley: its slopes, its roads, its village and the people who get lost on it. You have a log station, a snowmobile, a helicopter, a pair of old skis, and Koda, a grey-and-white husky with one ear that never stands up.

**Genres:** Exploration / adventure (100%), Simulation (95%), Physics puzzle / destruction (45%)
**Engine:** three.js, Rapier (deterministic)  ·  **Mobile:** yes  ·  **Played:** yes, desktop, phone

## Overall: 82/100 · confidence medium · coverage 100% · strong evidence 41%

| Category | Score | Confidence | Evidence (verified/observed/inferred/not tested) |
|---|---|---|---|
| Core gameplay | 86 `█████████░` | medium | 3/0/4/0 |
| Game feel | 77 `████████░░` | medium | 1/2/10/0 |
| Controls and responsiveness | 87 `█████████░` | medium | 2/0/4/0 |
| Progression and rewards | 77 `████████░░` | medium | 1/2/5/0 |
| Difficulty and balance | 79 `████████░░` | low | 1/0/6/0 |
| Player experience | 71 `███████░░░` | low | 2/1/7/1 |
| Replayability | 73 `███████░░░` | medium | 1/1/5/0 |
| Technical gameplay quality | 90 `█████████░` | medium | 4/0/4/1 |
| Presentation and immersion | 83 `████████░░` | medium | 1/1/4/0 |
| Mobile experience | 95 `██████████` | high | 6/0/3/1 |

Evidence levels: **verified** = measured on the running game by an automated check; **observed** = seen in the running game (approximate, or recorded by the player); **inferred** = from source/docs only; **not tested** = no evidence, not scored.

## What matters for this game

- **Exploration / adventure**: traversal that feels good on its own; landmarks and curiosity; discoveries that are logged and rewarded; a world that reacts; secrets
- **Simulation**: systems the player can read (gauges, feedback); vehicle/handling feel; consistent rules; time controls; a reason to master the simulation
- **Physics puzzle / destruction**: physics consistency (same shot, same result); satisfying destruction; emergent chain reactions; skill shots that read as skill; impact feedback scaled to the size of the event; fast retry

## Highest-impact opportunities (4 total)

1. **Playable quickly (load + start ≤ 3 s)** — design, player experience, observed · impact 4/5 · effort 3/5 · risk 1/3
   - Evidence: 7832 ms from navigation to playing (load 602 ms + start 7230 ms; served locally)
   - Do: Cut time to first play: show the start screen immediately, load heavy assets in the background.
2. **No visible next goal; the last rank is a callout grind** — design, progression, observed · impact 4/5 · effort 2/5 · risk 1/3
   - Evidence: The playthrough ends at Lead patroller with 1225 rep; Chief of patrol needs 1500, reachable only by 70-rep callouts or 15-rep badges. Nothing on the mission table says what the next goal is or how far away it is.
   - Do: Show the next rank and progress on the mission table; give repeat work a reason to exist
3. **Nothing new after the six story missions** — design, replayability, observed · impact 5/5 · effort 3/5 · risk 1/3
   - Evidence: After the story the board only offers the two fixed callouts (Tree Down, Stuck in the Drift), each 90 funds / 70 rep. The bowl reloads every day (fresh snow, danger level on the mission table) but Controlled Release and the recon flight are…
   - Do: Let the avalanche service call out recon and control work again when the bowl reloads, with the loaded slopes varying
4. **Skill shots are recognised** — design, game feel, inferred · impact 1/5 · effort 2/5 · risk 1/3
   - Evidence: not found in source: genre patterns
   - Do: Name the skill when it happens (BANK SHOT, CHAIN x5) with a short, readable callout; recognition is what turns physics accidents into mastery.

## Implementation plan

**2. High-impact, low-effort feel and flow** — biggest player-visible gain for the least risk; each is reversible

- [playcraft] No visible next goal; the last rank is a callout grind → Show the next rank and progress on the mission table; give repeat work a reason to exist

**3. Deeper design work** — bigger changes: prototype behind a flag or in a branch and re-run PLAYCRAFT verify

- [playcraft] Playable quickly (load + start ≤ 3 s) → Cut time to first play: show the start screen immediately, load heavy assets in the background.
- [playcraft] Nothing new after the six story missions → Let the avalanche service call out recon and control work again when the bowl reloads, with the loaded slopes varying

## Disciplines

### Game Design Architect

- ✅ The intended experience is stated (pitch / how it plays) — _inferred_: You are Vince, twenty, long blonde hair with a bit of a curl, the newest hand on the Kessel Patrol. You run the mountain patrol for the Kessel valley: its slopes, its roads, its village and the people who get lost on it. You have a log stat…
- ✅ Clear player objectives — _inferred_: found levels, game_over, highscore, stars
- ✅ Meaningful decisions (choices with trade-offs) — _inferred_: found upgrades, input_drag, currency, unlocks
- ✅ Emergent chain reactions — _inferred_: found chain_reaction
- ✅ Every mission completes end to end in the browser (84/84) — _verified_: /home/user/ROCKSLIDE/docs/playcraft/evidence/playthrough.md

Questions to answer by playing:
- What is the core concept in one sentence, and is it this game's own?
- What is the primary loop, and what secondary loops feed it?
- Where does the player make a meaningful decision, and how often?
- Is the depth earned, or is complexity standing in for depth?
- Does the game have a compelling reason to exist next to its genre's best?
- Which part of the simulation does the player act on, and can they see it respond?
- Is there a clear target and a readable way to cause the outcome, or does the player just spam until things fall?
- Do multiple solutions exist, and does the game recognise the clever one?

### Game Feel Engineer

- ✅ Actions are acknowledged on screen within ~100 ms — _observed_: fastest visible response 702 ms after the input (median 2188 ms; one frame here is 833.3 ms, so ≤ 1667 ms passes)
- ✅ Camera/screen shake for big impacts — _inferred_: found screen_shake
- ✅ Hit-stop / slow motion on key moments — _inferred_: found hitstop
- ✅ Particles on interactions — _inferred_: found particles
- ✅ Motion is eased (tweens, lerps, springs), not linear — _inferred_: found easing
- ✅ Anticipation, recoil, squash and stretch — _inferred_: found squash
- ✅ Sound effects on actions — _inferred_: found audio
- ✅ Rewards are announced where they happen — _inferred_: found popups
- ✅ Effects can be calmed (reduced motion / shake setting) — _inferred_: found reduced_motion
- ✅ Haptics on key moments (where supported) — _inferred_: found haptics
- ✅ Destruction reads physically (debris, dust, pieces) — _inferred_: found destruction
- ❌ Skill shots are recognised — _inferred_: not found in source: genre patterns
- 🟡 Repeat work pays the same however it is done — _observed_: The debrief shows the release share and whether debris reached the road, but the pay is fixed: a sloppy release pays the same as a clean one.
- ✅ Hit-stop and vibration on the blast — _verified_: /home/user/ROCKSLIDE/docs/playcraft/evidence/playthrough.md

Questions to answer by playing:
- Does every press produce an immediate, visible acknowledgement?
- Do movement and collisions have weight (acceleration, impact, recovery)?
- Is feedback proportional (a big event feels bigger than a small one)?
- Is anything overdone (shake on every event, particle soup)?
- Does a big collapse feel bigger than a small knock (shake, slow-mo and sound scaled by mass/impulse)?
- Does the aim/release feel intentional (anticipation, release snap, a beat before impact)?

### Gameplay Loop Designer

- **every 5 seconds:** ride, fly or ski toward the objective; Koda at heel
- **after 60 seconds:** a mission step done, the next one on the HUD
- **ten minutes:** a mission paid out, something bought or built
- **long term:** rank, buildings, badges, gear
- **boredom point:** after the six story missions only two fixed callouts remain
- **mastery:** cleaner avalanche releases, flying the recon low and close
- ✅ Playing changes the game (inputs move the game state) — _verified_: 10/13 probed inputs changed the screen
- ✅ Game state advances during play (exposed numbers change) — _verified_: changed during play: game.heading, game.position.x
- ⬜ Little dead time during play — _not_tested_: the probe could not measure this
- ✅ Time controls (skip, sleep, speed) — _inferred_: found pattern

Questions to answer by playing:
- What is the player doing every 5 seconds?
- What keeps them engaged after 60 seconds?
- What makes them want to play for 10 minutes?
- What creates longer-term motivation?
- Where does repetition become boredom?
- Where is the mastery?
- What makes the player turn off the road? Can they see something interesting from where they stand?
- How long between a shot and the next decision? Is the player watching settling debris for too long?

### Progression Architect

- ✅ Progress is saved — _inferred_: found save
- ✅ Unlocks or upgrades that change play — _inferred_: found unlocks, upgrades
- ✅ Long-term goals (achievements, collections, ranks) — _inferred_: found achievements, collectibles, xp, stars
- ✅ No generic retention systems bolted on — _inferred_: none of: daily_reward, battle_pass, energy_gate, lootbox
- ✅ Discoveries are logged (catalogue, journal, map) — _inferred_: found pattern
- 🟡 No visible next goal; the last rank is a callout grind — _observed_: The playthrough ends at Lead patroller with 1225 rep; Chief of patrol needs 1500, reachable only by 70-rep callouts or 15-rep badges. Nothing on the mission table says what the next goal is or how far away it is.
- ✅ Station buildings are real buildings that open gear — _observed_: Workshop built from the mission table appears in the yard and opens the Mountain 800, measured faster in the playthrough.
- ✅ Rewards paid as advertised; rank Recruit to Lead patroller; workshop built; engine measured faster — _verified_: /home/user/ROCKSLIDE/docs/playcraft/evidence/playthrough.md

Questions to answer by playing:
- What does the player unlock, and does it change how they play?
- Is the reward cadence felt (not too sparse, not confetti for nothing)?
- Does progression come from the game itself rather than a bolted-on meta?

### Player Experience Designer

- ❌ Playable quickly (load + start ≤ 3 s) — _observed_: 7832 ms from navigation to playing (load 602 ms + start 7230 ms; served locally)
- ✅ Onboarding teaches by doing (hints, first-run guidance) — _inferred_: found tutorial
- ✅ Pause works, and the game pauses when hidden — _verified_: Escape: motion 0.0133 → 0.0000 while paused
- ✅ Auto-pause when the page is hidden — _inferred_: found visibility_pause
- ✅ Restart friction is low — _inferred_: found restart
- ✅ Text is legible on the target device (≥ 12 px) — _verified_: smallest visible text 12 px ('E') on phone
- ✅ Accessibility (reduced motion, ARIA, contrast, subtitles, mute) — _inferred_: found reduced_motion, aria, subtitles, mute
- ✅ Map / orientation — _inferred_: found pattern
- ✅ Systems are readable (gauges, indicators) — _inferred_: found pattern

Questions to answer by playing:
- Can a first-time player start and understand the goal without reading?
- Is the HUD readable at a glance on the target device?
- How fast is a restart after failure?
- Is the game accessible (motion, contrast, audio, text size)?

### Control & Device Specialist

- ✅ Each probed control produces a visible response — _verified_: 7/8 desktop inputs responded; no visible response: drag / pull back (rendering under 10 fps here: re-check misses on real hardware)
- ✅ More than one input method (keyboard + pointer/touch, gamepad) — _inferred_: found input_keyboard, input_pointer, input_touch
- ✅ Input forgiveness (buffering, deadzones, grace windows) — _inferred_: found deadzone
- ✅ Control settings (sensitivity, remap, invert) — _inferred_: found sensitivity, input_remap
- ✅ Inputs never throw errors — _verified_: no errors while inputs were played
- ✅ Game loads on every tested viewport — _verified_: loaded on desktop, phone
- ✅ No runtime errors during play — _verified_: 0 page errors (console errors: 1)
- ✅ No missing files — _verified_: no missing files
- ⬜ Frame rate holds during play — _not_tested_: not representative: the browser rendered on ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) (software), measured 1.1 fps; identical builds vary 2-3x between runs here. Test frame rate on a real d…
- ✅ Frame-rate-independent update (dt clamp / fixed step) — _inferred_: found fixed_step, dt_clamp
- ✅ Automated tests exist — _inferred_: found tests
- ✅ Renders on a phone viewport — _verified_: 1140
- ✅ Touch input responds — _verified_: 3/5 touch gestures changed the screen; fastest 493 ms
- ✅ Viewport meta set for phones — _verified_: width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover
- ✅ Touch targets ≥ 44 px — _verified_: all 4 visible controls ≥ 44 px
- ✅ No horizontal overflow on phones — _verified_: no horizontal overflow
- ✅ Browser gestures do not fight the game (touch-action, no zoom) — _verified_: play surface touch-action: none; viewport: width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover
- ✅ Safe areas respected (notch, home bar) — _inferred_: found safe_area
- ✅ Orientation handled — _inferred_: found orientation
- ⬜ Frame rate on the phone viewport — _not_tested_: not representative: the browser rendered on ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) (software), measured 3.3 fps; identical builds vary 2-3x between runs here. Test frame rate on a real d…
- ✅ Aim preview / trajectory guide — _inferred_: found pattern
- ✅ Unit tests pass — _verified_: /home/user/ROCKSLIDE/gitcraft-out/evidence/tests-before.json

Questions to answer by playing:
- Do controls respond within a frame or two on every target device?
- Are touch targets big enough and out of the thumb's way of the view?
- Does the game work in the orientation people hold the phone?
- Do vehicles feel different from each other and from walking?

### Difficulty & Balance Specialist

- ✅ Difficulty progresses (levels, waves, ramp) — _inferred_: found ramp, levels, difficulty
- ✅ Tuning values are centralised — _inferred_: found tuning_config
- ✅ Balance is measured (simulations, solvers, playtest bots) — _inferred_: found tune_tests
- ✅ Failure has a recovery path (retry, checkpoint, respawn) — _inferred_: found restart
- ✅ Assist / difficulty options — _inferred_: found assist, difficulty
- ✅ Simulation rules covered by tests — _inferred_: found tests
- ✅ Fixed-step, deterministic physics — _inferred_: found fixed_step, determinism
- ✅ Levels proven solvable (solver / par tests) — _inferred_: found tune_tests
- ✅ Firing refused on the slab; Koda leads on scent; missions finishable — _verified_: /home/user/ROCKSLIDE/docs/playcraft/evidence/playthrough.md

Questions to answer by playing:
- How often does a player fail, and is each failure their fault?
- Where are the spikes?
- What is the dominant strategy or exploit?
- Can every level be solved with the real controls (automated solver/par runs)?
- Are there degenerate one-shot exploits?

### Retention & Replayability Designer

- ✅ Variation between sessions (randomness, procedural content) — _inferred_: found randomness, procedural
- ✅ Mastery goals (best scores, ratings, records) — _inferred_: found highscore, stars
- ✅ Player expression (customisation, sandbox, styles) — _inferred_: found customization, sandbox_mode
- ✅ Shareable moments (share, replay, daily seed) — _inferred_: found share
- ✅ Secrets and hidden things — _inferred_: found collectibles
- 🟡 Nothing new after the six story missions — _observed_: After the story the board only offers the two fixed callouts (Tree Down, Stuck in the Drift), each 90 funds / 70 rep. The bowl reloads every day (fresh snow, danger level on the mission table) but Controlled Release and the recon flight are…
- ✅ Callouts recur; bunk ends the day with a new forecast; Continue restores a mission — _verified_: /home/user/ROCKSLIDE/docs/playcraft/evidence/playthrough.md

Questions to answer by playing:
- Why would someone play again tomorrow, legitimately?
- What is different next time (randomness, mastery, expression)?
- Is there a moment worth sharing?

### Presentation & Immersion

- ✅ Sound design and music — _inferred_: found audio, music
- ✅ Animation — _inferred_: found animation
- ✅ Atmosphere (lighting, fog, weather, post) — _inferred_: found atmosphere
- ✅ Transitions between screens and states — _inferred_: found transitions
- ✅ The world moves when the player is idle — _observed_: share of the screen changing per frame with no input: 0.08314
- ✅ Screens have visual range (not blank or flat) — _verified_: {"desktop": 1207, "phone": 1140}

Questions to answer by playing:
- Does the world feel alive when the player stands still?
- Do audio, animation and camera agree with what is happening?
- Are transitions and pacing deliberate?
- Does the world move and react (wind, wildlife, weather) when the player stands still?


_GITCRAFT PLAYCRAFT 1.0.0 · 2026-11-05T17:50:47+00:00_
