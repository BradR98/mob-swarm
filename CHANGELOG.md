# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Phase 15 - soft collisions and the L99 physics sandbox
- **Soft collisions:** the rigid separation (90% of an overlap per pass) is replaced by over-relaxed "soft resolving": ~20% of a light overlap per frame (3 passes of RED_SOFT/3), ramping up only for deep overlaps (> 55% of a body) so a pile compresses and flows like mud but cannot collapse into a blob. Sideways velocity also bleeds off faster (viscous).
- **Spawn jitter:** every emitted red gets +/-5px X and Y jitter, and spawns at its terminal fall speed so a 30/s stream is spaced ~6px instead of stacking on one pixel (the "shotgun blast").
- **Level 99 sandbox** (replaces the campaign L99): 1 wide (320px) column, no gates/doors/blues/crates/threats, one indestructible plug at y=470, a single pipe pouring 30 reds/s forever (until the 1000 pool is full). Win/loss disabled. Reach it with the Warp box (pause screen), `?level=99` or `#level=99`.
- Measured in the sandbox: spawn stream ~24px wide, median sideways speed ~23 px/s (p95 63) in the spawn zone; 1000 reds pile ~90px tall on the plug.
- Tests: 195 headless checks. Generic 150-level loops use L98 in place of L99; the 150-level soak was not re-tuned for this commit. Bot sims were not re-run.

### Phase 13 + 14 - dam physics, multiplier zones, pressure doors
- **UI:** the Phase 12 Main Menu is gone; the game starts immediately. Level/Warp stays on the Pause/Victory/Defeat overlay.
- **Swarm physics (Phase 13):** Brownian drift removed. Reds fall under gravity (1100 px/s^2 to a terminal speed) and are solved position-based: integrate, then 4 passes of mob-vs-mob separation (uniform grid, capped shove) + barricade tops + lane walls, then velocity = displacement / dt. A red that lands on a barricade really stops; the mobs behind it stack into a pile. Barricades are now full-width plugs (dams), so nothing slides round them.
- **Dam burst:** destroying a barricade removes the support; the whole pile accelerates down together.
- **Multiplier zones:** a Blue Barricade at 0 HP no longer bursts. It leaves a translucent x2 zone across its column for 10s; each blue passing through splits into two, once per bullet (mask bit 6).
- **Retired trapdoors (Phase 14):** the %-leak gaps are gone; dividers are solid.
- **Pressure Doors:** 1 per divider (2+ columns), HP 100-250 (by tier), 56px tall, placed just above a neighbouring barricade so the dam's pile presses on it. Colour shifts yellow -> orange -> red with cracks as HP drops. Damage only comes from a red pushed into the door with heavy lateral force (`crushHit`: |vx| >= 45 px/s and |vx| >= |vy|, i.e. > 45 deg off vertical), 0.3s cooldown per mob; free-falling mobs deal 0.
- **Breach:** a door at 0 HP is gone for the level; the stack that was pushing on it gets a sideways impulse and spills into the next lane; blue bullets can cross through the gap.
- Debug hooks: `setDoors`, `setCannonHP`, `crushHit`, `spawnZone`. Version label `v14 · c12`, cache `mob-swarm-v12`.
- Tests: 187 headless checks (dam stack, separation, dam burst, 1000-red frame cost 3.5ms avg, zone split/expiry, crush filter, breach spill, blue pass-through, no heap growth with 200 mobs through a breach).
- Sims (bot ignores doors, aims one column): bosses L10/20/30/50 4/4 (TTK 45-66s vs 45s target); L1, L10, L16, L20, L50 4/4; L6 (3 cols) 0/4 dies at ~13s. Not device-tested.
- Behaviour changes to watch: reds pile up so peak red counts are higher (soak bound raised to the 1000 pool); boss TTK and bot results changed (see sims).

### Phase 12 - aggressive pacing and threat budgeting
- **Level selector:** Level input + Warp button on the Pause/Victory/Defeat overlay, plus a new Main Menu (Start + warp) on load. `?level=N` still works but no longer needed (the SW stripped it). Debug hook `__mob.warp(n)`.
- **Columns:** L1-2 = 1, L3-5 = 2, L6-9 = 3, L10+ = 4.
- **Cleanup:** red pipe/chute graphics removed; L1-2 have no gates at all (strict 1.0x start, 9 shots/s, 1 pellet) and no supply crates; L1-2 spawn only gray barricades. First-wave grace 2s, base wave interval 5s (was 7s).
- **Threat Budget:** each Blue Barricade generates a red wave (size = round(hits x 1.0), 8-24) in an ADJACENT column. Released 10s after play starts, at 14 reds/s. Never generated on single-column levels. Boss levels get no blue barricades (the boss is the threat).
- **Anti-stacking:** at most one Blue Barricade per column per level.
- 4-column levels hit the 6-gate bit limit, so negative gates are trimmed there (known side effect).
- Tests: 163 headless checks. Sim (single-target bot): boss fights 4/4; L1 3/3, L6 1/3, L16 0/3 (too hard for a bot that covers one column), not device-tested.

### Phase 11 - discrete columns, trapdoors, barricades, level warp
- **Pivot:** the Phase 10 carved-lane terrain and open-field slide generator are replaced by a discrete column grid (1-4 vertical lanes, 8px dividers). L1-8: 1 narrow centre column (rest letterboxed/grayed); L9-16: 2; L17-24: 3; L25+: 4.
- **Cannon:** drags across the active span; shots are clamped into the column the cannon aligns with. Gates are bound to a column; every column has an `x` gate.
- **Red dispatch:** per-column queues and pipes. Waves alternate columns (1-2 columns at once on 1-4 cols, up to 3 at L41+). Boss waves come from the hull's column.
- **Trapdoors:** staggered breaks in the dividers (2+ columns). Reds crossing a gap leak sideways at 25-40% (`L.leakP`) into the neighbour column.
- **Barricades:** gray (absorbs), blue (shatters into blues upward), red (shatters into reds downward), with visible hit counters. Replace the old indestructible terrain.
- **`?level=N`:** dev warp, e.g. `index.html?level=20`.
- Balance tweaks from sims: red barricade bursts capped at 10, first-wave grace 3+2.5*(cols-1)s, big waves fan out (<=~16 reds per column).
- Known: bot-sim L16 (2 cols, 6584 HP) is still 0/3 for a single-target bot; boss TTK 53-79s vs 45s target. Not device-tested.
- Tests: headless suite now 148 checks, including level warp, column containment and the trackpad deadzone. Sims aim per column.

### Phase 8 - terrain, fluid pathing, supply crates
- **Terrain:** solid indestructible gray oriented rectangles (typed arrays, max 8). Circle-vs-OBB resolve pushes mobs out along the surface normal and strips only the velocity component into the wall, so blues and reds slide instead of bouncing. A minimum tangential slide speed (toward the nearer end of the slab) stops mobs stalling on flat faces.
- **Layouts in `generateLevel`:** central pillars, angled funnels (56px mouth) and zig-zag baffles, placed in the free bands above and below the gate rows (none on L1). Crowded boards drop overlapping bumpers rather than lose the terrain. HP derates 7% per piece.
- **Red pipe:** waves are queued and metered out (14/s) from one concentrated pipe at the top (fixed x per level), or from the boss hull on boss levels. Replaces the wide wall spawns.
- **Speed cap:** any red is capped at 280px/s and the per-tier speed multiplier is capped at 1.25x. Late tiers scale wave size and the Tank/Sprinter mix (Tank up to 45%, Sprinter up to 30%) instead.
- **Crowding:** reds push each other apart (grid broadphase, 2 passes/frame) and re-resolve against terrain, so a dense stream piles up at a choke point and overflows sideways.
- **Supply crate:** a 30 HP gray crate spawns every 15-20s, drifts down at 16px/s (sliding round terrain), absorbs blue impacts, and drops a pill when broken. Catching the pill equips Shotgun (3-way spread) or Piercing Rounds (3 HP per blue) for 8s via new Armory entries (`pellets`, `spreadVx`), then reverts to the equipped base weapon.
- Pool throughput cap lowered 600 -> 250 hits/s (terrain lengthens blue lifetimes, so the pool saturates sooner). Funnels no longer seal the screen edges, zig-zag and funnel slabs carry a preferred slide direction (toward the gap or mouth), and the upper band never gets an inverted funnel (it used to shove the whole stream to the edges, away from the boss).
- **Bot-sim:** `smartAim` now uses a debug `traceBlue` dry-run so the bot aims round terrain (the old lane-based bot stalled for 400s on many levels).

### Phase 7 - balance fixes and data-driven refactor
- **Throughput model replaces raw MTM.** Raw MTM overestimates badly (bot-sim measured efficiency falling from ~0.9 at MTM 2 to ~0.1 at MTM 700), so a flat 0.35 cannot hold TTK. HP now uses `throughput = min(9 * 1.05 * MTM^0.7, 600)` (efficiency curve + 1,500-pool cap), derated 8% per bumper and 15% per black hole. Base HP = throughput * 35 * (1 + 2% per tier); Boss HP = throughput * 45.
- **Fixed `calculateLevelMTM`:** a `+n` gate turns each mob into n+1, so it multiplies by (n+1); Phase 6 added n.
- **Mothership boss:** hull is 40% of screen width (144px), drifts at ~22px/s at the base line, hull extends below the shielded base so blues actually reach it (previously the base absorbed them first). Waves are sparse: 5-14 reds every 4.5-6.9s.
- **Spatial gate logic:** x3/+10 are narrow and high, x2/+2 wide and low, negatives wide and directly below a high gate, sliding opposite it. (`+5` replaced by `+2`.)
- **Bestiary:** `RedMobTypes` (Basic, Tank, Sprinter) with typed-array per-type lookups; reds carry a type id through all pool operations.
- **Armory:** `Armory` dictionary (`fireRate` ms, `bulletVelocity`, `piercing`) with standard / piercer / rapid presets; blues carry remaining pierce points.
- **Tiers:** `generateLevel` groups 5 levels per tier. Spawn rate, wave size, speed and enemy mix are constant within a tier; gate layouts randomize per level. T1 Basics, T2 +Tanks, T3 +Negative gates, T4 +Sprinters. Bumpers (L31+) and black holes (L51+) unchanged.
- HP scalar is now +2% per **tier** (was per level) so TTK stays near target.

### Phase 6
- Added `calculateLevelMTM(gates)` (Max Theoretical Multiplier). Base HP = `9 * MTM * 35 * (1 + 0.02 * (level - 1))`. Boss HP = `9 * MTM * 45`.
- Boss is now a hovering mothership at the base line. It strafes left/right and drops dense red waves aimed at the blue mass. It no longer marches down the lane.
- PWA: added `manifest.json` and `sw.js` (cache-first offline for `index.html` + `manifest.json`), manifest link and SW registration in `<head>`.
- Sims updated (`bot-sim.js`, `boss-sim.js`) and headless tests updated (all pass).
- KNOWN ISSUE: the sims do NOT confirm the 35s/45s TTK targets (see PROJECT_STATUS.md). Boss levels are 0/8 winnable by the perfect-aim bot.

### Added (Phase 5: procedural 100-level campaign)
- `generateLevel(n)` replaces the hardcoded levels: seeded PRNG so level N is always the same board. Base HP = 800 + 400n (L1 1,200 ... L100 40,800).
- Red spawn interval shrinks 2% per level (floor 2.5s); wave size grows +1 (min) / +2 (max) per level, hard-capped at 150 so two walls always fit the 500-red pool. Red speed +0.5%/level (max +50%).
- Tiered obstacles: L1-10 gates x2/x3/+5/+10; L11-30 add negative gates (`-10`, `/2`) sliding opposite the nearest multiplier; L31-50 add pinball bumpers (gray circles that reflect blues and knock reds back); L51+ add rotating black holes that pull in and destroy blues and reds.
- Boss every 10 levels: normal waves stop, one giant boss (HP = level x 100, 1 damage per blue impact) marches down the center lane; touching the cannon line is instant defeat. The base is shielded on boss levels; killing the boss wins.
- HUD shows "LEVEL X / 100" (+ BOSS tag). Next Level regenerates board, pools and gates in place; level 100 shows "Victory - Play Again" and wraps to level 1.
- Gates: up to 6 per level (mask bit 7 reserved for the bumped/sucked flag). Red pool gained knock-velocity arrays for bumper/black-hole physics.
- Tests: generator math/determinism/tiers, bumpers, black holes, bosses, level transitions, 150-level soak (67 checks). `test/bot-sim.js` and `test/boss-sim.js` for balance.

### Balance findings (not fixed, see BACKLOG)
- Base HP 800+400n gives pure-siege clear times of 69s (L1), 62s, 114s (L3), 21s, 61s, 24s (L7), 90s (L9) with perfect aim: the 25-40s target is not met because throughput depends on the random gate mix.
- Boss: L10 (1,000 HP) is won 20/20 but in ~1s; L20 and L30 are 0/20 at the default boss speed.

### Added (Phase 4: siege balance)
- Siege base HP: L1 1,000 / L2 3,500 / L3 10,000. Base strobes and shakes in proportion to hit rate, with a yellow chip-damage trail on the HP bar and thousands-separated HP text.
- Negative gates (red): `-10` is a tax that destroys up to 10 mobs and recharges at 5/s (charge bar shown); `/2` destroys every second mob. They slide opposite to the multiplier gate below them and play a dissonant tritone buzz. L2 has `-10`; L3 has `/2` and `-10`.
- Red shield: reds have 2 HP. The first blue hit turns a red orange, the second destroys it.
- Up to 4 gates per level; gate bitmask still fits in a Uint8.

### Balance verification (`node test/bot-sim.js`)
- Perfect-aim bot, no red spawner: L1 clears in ~58s, L2 ~57s, L3 ~167s. L3 therefore misses the 25-40s target by ~4x with 10,000 HP.
- With red walls active, idealised bots win L1 half the time and rarely/never win L2-L3.

### Fixed
- Cannon no longer auto-fires. It fires only while the player is touching/dragging and stops the instant the touch ends (also on pointer-capture loss and window blur). A 1-shot cooldown charges while idle so a tap fires at once but tapping cannot exceed the 9 shots/s rate.

### Changed (balance pass)
- Red waves are now dense clustered walls (staggered rows, ~2:1 aspect, emerging all at once, centered toward the blue cluster) instead of a single-file line.
- Wave sizes per level: L1 8-12, L2 20-25, L3 40-50 reds.
- Wave interval raised to 7.0s / 8.5s / 10.0s (was 3.0 / 1.9 / 1.1s) and first-wave grace set to 3s. At the old intervals, a 40-50 wall every ~1s would have been unwinnable (every leaked red costs 1 cannon HP).
- The red mass now drifts toward the blue mass as a single body, so walls keep their shape instead of collapsing into one column.
- Added `test/bot-sim.js` (idealised-bot balance simulator) and tests for fire gating, wave sizes/shape, wall integrity and 500-red/1500-blue stress timing.

### Added
- Cannon shield: 5 HP pips, red flash on hit; Defeat only at 0 HP (replaces instant defeat).
- Red waves funnel toward the blue cluster; red and blue masses attract laterally.
- 3-level progression (base HP 40/80/150, faster gates and spawns), level HUD, "Next Level" / "Victory - Play Again".
- Web Audio synthesized SFX (cannon pop, gate chime, collision click, hit thud, win/lose fanfares) and a mute toggle (persisted).
- Tests for shield, funneling, attraction, level progression.

### Changed
- Opponent base moved down 28px to make room for the HUD.

### Added
- Moving gates (sliding, bouncing, opposite directions) with rect-overlap trigger; no dead zones.
- Red enemy mobs (pool of 500) spawned from the opponent base, moving down at 0.75x blue speed.
- Blue-vs-red 1:1 cancellation using a zero-allocation spatial grid, with pop effects (pooled ring buffer).
- Defeat condition and "Try Again" overlay when red reaches the cannon line.
- Headless test suite (`node test/headless.js`).

### Changed
- `applyGate` parameter renamed to `mobIdx`; clones inherit parent gate bits.
- Debug hooks (`window.__mob`) only exposed at `index.html#debug`.

## [0.1.0] - 2026-10-05

### Added
- Repository created and initialized on branch `main`.
- Baseline architecture documentation (`README.md`): single-file, zero-dependency HTML5 Canvas game.
- Five-phase task roadmap (`BACKLOG.md`) and model handoff plan.
- Project status dashboard (`PROJECT_STATUS.md`).
- Phase 1 prototype `index.html`: canvas loop, draggable cannon, pooled mobs, multiplier gates, opponent base HP, Victory overlay with Restart.

[Unreleased]: https://github.com/BradR98/mob-swarm/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/BradR98/mob-swarm/releases/tag/v0.1.0

## Phase 9 - Trackpad zone, thumb cannon, entity scale, boss rebalance
- Bottom 15% (y >= 544) is a Trackpad Zone: nothing spawns, enters or renders there. Cannon line (`CANNON_Y`) sits on its border; touch works anywhere on the canvas (X-only mapping).
- Cannon redrawn as an upward crescent cradling a thumb glow.
- Global entity scale `ES = 0.82` (mobs, reds, gates, crates, pills, boss, terrain, bumpers, holes); gate rows re-spaced.
- Boss rebalance: waves 3-12 reds (0.35 x 0.4 of level wave), interval 16-24 s, pipe 7 reds/s (level pipe 14/s).
- Sim (idealised bot that never shoots reds, N=20, full fight): L10 20/20, L20 18/20 (was 2/10 and 1/10 before tuning). Pure boss TTK is 57 s (L10) / 86 s (L20) vs the 45 s target - not recalibrated.
- Headless: 131 PASS / 0 FAIL (trackpad boundary, render arcs, scale, boss pacing, input checks).

## Phase 10 - Negative-space terrain, true lanes, swarm density, pause (v10 / cache c9)
- Terrain rewritten: massive edge-hugging blocks carve continuous lanes. Layouts: Bridge (80px neck), Fork (central island), S-Curve (interlocking peninsulas) + edge rails. Placed in the free band above the gates (or below them when 4+ gates). Bumpers/holes keep clear of lanes.
- Gate slots moved up 26px (354..164) to give the lower band room for a lane layout.
- A bridge ramp must not be a single thick slab: it poked into the opposite ramp and trapped 1500 blues in a crevice (found by sim, L6 TTK 300s). Ramps are now a thin slab + stacked strips.
- Reds no longer track the blue mass; each random-walks sideways (Brownian drift, 55px/s cap). Sloped faces: reds slide downstream, blues upstream.
- Swarm: red pool 500 -> 1000, MAX_WAVE 300, pipe 14 -> 28/s, boss pipe 7 -> 14/s, Basic hp 2 -> 1, Tank 5 -> 3.
- Pause button (top right, left of mute): freezes the rAF loop (cancelAnimationFrame), PAUSED overlay with Resume; also auto-pauses when the tab is hidden.
- Throughput derate per layout (bridge 0.9, fork 0.8, s-curve 0.75; x0.75 on bosses) from bot-sim.
- Headless: 137 PASS / 0 FAIL, incl. independent 2px BFS proving a >=60px path exists on levels 1-150, row scan min open span 80px, bridge neck 80px.
