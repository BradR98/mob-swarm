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
| P2-1 | Dynamic lane flow (lateral attraction between red and blue masses) | [x] | Sonnet |
| P2-2 | Gate math variants (`+N`, `xN`, negative `-N` tax and `/N` halving) | [x] | Sonnet |
| P2-3 | Collision dynamics: Red vs Blue units (spatial hash grid) | [x] | Pro (design), Sonnet |
| P2-4 | Per-gate single-pass guard to prevent re-triggering | [x] | Sonnet |

## Phase 3: Opponent and Defense

| ID | Task | Status | Model |
|----|------|--------|-------|
| P3-1 | Moving gates (oscillating / sliding) | [x] | Sonnet |
| P3-2 | Opponent AI spawner (red waves, adaptive rate) | [x] targeted waves (funneled toward blue cluster), per-level rate/size | Pro |
| P3-3 | Base defense mechanics: cannon shield (5 HP), hit flash, defeat at 0 | [x] | Pro |

## Phase 4: Progression and Polish

| ID | Task | Status | Model |
|----|------|--------|-------|
| P4-1 | Level progression: 3 hand-tuned levels done; procedural generator still open | [~] | Pro/Opus |
| P4-2 | Audio effects via Web Audio API synthesis (pop, chime, crunch, fanfares, mute toggle) | [x] | Sonnet |
| P4-3 | Visual polish (particles from pool, screen shake, gradients, haptics) | [ ] | Sonnet |

## Phase 5: PWA and Battery

| ID | Task | Status | Model |
|----|------|--------|-------|
| P5-1 | PWA `manifest.webmanifest` and icons | [ ] | Flash |
| P5-2 | Offline-caching service worker | [ ] | Sonnet |
| P5-3 | Frame-rate / battery throttling modes (60/30 FPS, pause on hidden, reduced effects) | [ ] | Sonnet |

## Phase 4 (delivered): Siege Balance
- [x] Siege base HP (1,000 / 3,500 / 10,000) with damage flicker + chip-damage trail
- [x] Negative gates (`-10`, `/2`), red, sliding opposite the multiplier below, dissonant SFX
- [x] Red shield: 2 blue hits per red (orange when wounded)
- [ ] **Re-tune base HP**: L3 takes ~167s of perfect aim (target was 25-40s); see CHANGELOG / bot-sim

## Phase 5 (NOT STARTED): 100-level procedural campaign
- [ ] `generateLevel(n)`, obstacle unlocks (negatives 11+, bumpers 31+, black holes 51+), boss every 10 levels
- [ ] Blocked on: base HP formula decision (see PROJECT_STATUS)

## Model Handoff and Limits Plan

- Keep every phase deliverable independently committable. Commit at the end of each task so work resumes cleanly on a different model.
- When quota is hit: switch Sonnet to Gemini Pro (implementation), then to Flash (docs and small edits). If all are exhausted, pause and resume next session from `PROJECT_STATUS.md`.
- Keep `PROJECT_STATUS.md` updated after each session as the handoff note.
