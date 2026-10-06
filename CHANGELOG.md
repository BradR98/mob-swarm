# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
