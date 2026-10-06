# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
