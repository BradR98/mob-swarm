# Backlog

Legend: `[ ]` todo, `[~]` in progress, `[x]` done. Suggested model: **Sonnet** = implementer, **Pro/Opus** = architecture/debug/balance, **Flash** = docs/small edits.

## Phase 1: Core Loop (Scaffolding)

| ID | Task | Status | Model |
|----|------|--------|-------|
| P1-1 | Core canvas loop (rAF, dt clamp, responsive portrait scaling, DPR cap) | [x] | Sonnet/Pro |
| P1-2 | Cannon swivel/drag via Pointer Events (touch + mouse) | [x] | Sonnet/Pro |
| P1-3 | Mob object pool (pre-allocated typed arrays, swap-remove) | [x] | Sonnet/Pro |
| P1-4 | Basic multiplier gates (`x2`, `+5`) with scatter on duplication | [x] | Sonnet/Pro |
| P1-5 | Opponent base with HP counter and Victory overlay + Restart | [x] | Sonnet/Pro |

## Phase 2: Lane Flow and Collisions

| ID | Task | Status | Model |
|----|------|--------|-------|
| P2-1 | Dynamic lane flow (mobs steer toward base along lanes) | [ ] | Sonnet |
| P2-2 | Gate math variants (`+N`, `xN`, negative gates `-N`, `/N`) | [ ] | Sonnet |
| P2-3 | Collision dynamics: Red vs Blue units (spatial hash grid) | [ ] | Pro (design), Sonnet |
| P2-4 | Per-gate single-pass guard to prevent re-triggering | [ ] | Sonnet |

## Phase 3: Opponent and Defense

| ID | Task | Status | Model |
|----|------|--------|-------|
| P3-1 | Moving gates (oscillating / sliding) | [ ] | Sonnet |
| P3-2 | Opponent AI spawner (red waves, adaptive rate) | [ ] | Pro |
| P3-3 | Base defense mechanics (turrets, shields, player-base HP and loss state) | [ ] | Pro |

## Phase 4: Progression and Polish

| ID | Task | Status | Model |
|----|------|--------|-------|
| P4-1 | Procedural level progression (seeded generator, difficulty curve) | [ ] | Pro/Opus |
| P4-2 | Audio effects via Web Audio API synthesis (no asset files) | [ ] | Sonnet |
| P4-3 | Visual polish (particles from pool, screen shake, gradients, haptics) | [ ] | Sonnet |

## Phase 5: PWA and Battery

| ID | Task | Status | Model |
|----|------|--------|-------|
| P5-1 | PWA `manifest.webmanifest` and icons | [ ] | Flash |
| P5-2 | Offline-caching service worker | [ ] | Sonnet |
| P5-3 | Frame-rate / battery throttling modes (60/30 FPS, pause on hidden, reduced effects) | [ ] | Sonnet |

## Model Handoff and Limits Plan

- Keep every phase deliverable independently committable. Commit at the end of each task so work resumes cleanly on a different model.
- When quota is hit: switch Sonnet to Gemini Pro (implementation), then to Flash (docs and small edits). If all are exhausted, pause and resume next session from `PROJECT_STATUS.md`.
- Keep `PROJECT_STATUS.md` updated after each session as the handoff note.
