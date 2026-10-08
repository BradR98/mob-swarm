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
| P4-1 | Procedural level generator (seeded, levels 1-100+) | [x] | Pro/Opus |
| P4-2 | Audio effects via Web Audio API synthesis (pop, chime, crunch, fanfares, mute toggle) | [x] | Sonnet |
| P4-3 | Visual polish (particles from pool, screen shake, gradients, haptics) | [ ] | Sonnet |

## Phase 5: PWA and Battery

| ID | Task | Status | Model |
|----|------|--------|-------|
| P5-1 | PWA `manifest.webmanifest` and icons | [ ] | Flash |
| P5-2 | Offline-caching service worker | [ ] | Sonnet |
| P5-3 | Frame-rate / battery throttling modes (60/30 FPS, pause on hidden, reduced effects) | [ ] | Sonnet |

## Phase 4 (delivered): Siege Balance
- [x] Negative gates (`-10`, `/2`), red, sliding opposite the multiplier below, dissonant SFX
- [x] Red shield: 2 blue hits per red (orange when wounded)
- [x] Base damage flicker + chip-damage trail

## Phase 5 (delivered): Procedural 100-level campaign
- [x] `generateLevel(n)`: seeded, deterministic; Base HP = 800 + 400n
- [x] Red spawn interval -2%/level (floor 2.5s); waves +1 min / +2 max per level, capped at 150 (pool-safe)
- [x] Tiered obstacles: 1-10 basic gates, 11-30 negatives, 31-50 pinball bumpers, 51+ black holes
- [x] Boss every 10 levels (HP = level * 100), shielded base, instant defeat at the cannon line
- [x] HUD "LEVEL X / 100"; Next Level regenerates the board in place; wrap after level 100

## Open balance work (from bot sims)
- [ ] Boss cliff: L10 melts in ~1s, L20/L30 unwinnable even for perfect aim (boss sits in the gate field and shadows upper gates)
- [ ] Siege time varies 21-114s across L1-L9 because throughput depends on the random gate mix, not on n
- [ ] Level 3 style single-gate levels vs 4-gate levels need throughput-aware base HP

## Model Handoff and Limits Plan

- Keep every phase deliverable independently committable. Commit at the end of each task so work resumes cleanly on a different model.
- When quota is hit: switch Sonnet to Gemini Pro (implementation), then to Flash (docs and small edits). If all are exhausted, pause and resume next session from `PROJECT_STATUS.md`.
- Keep `PROJECT_STATUS.md` updated after each session as the handoff note.

## Phase 11: Discrete Columns

| ID | Task | Status | Model |
|----|------|--------|-------|
| P11-1 | `?level=N` warp | [x] | Sonnet |
| P11-2 | 1-4 column grid by tier | [x] | Pro |
| P11-3 | Per-column red dispatch | [x] | Pro |
| P11-4 | Trapdoor leaks | [x] | Pro |
| P11-5 | Gray/blue/red barricades | [x] | Pro |
| P11-6 | Real-device playtest of columns, leaks, FPS | [ ] | - |

## Phase 12: Pacing and Threat Budget

| ID | Task | Status | Model |
|----|------|--------|-------|
| P12-1 | In-game level selector + main menu | [x] | Sonnet |
| P12-2 | 1/2/3/4 columns at L1/3/6/10 | [x] | Sonnet |
| P12-3 | Threat budget + anti-stacking | [x] | Pro |
| P12-4 | Rebalance L6-L20 for multi-lane play (bot L16 0/3) | [ ] | Pro |

## Phases 13-14: Dam physics, zones, pressure doors

| ID | Task | Status | Model |
|----|------|--------|-------|
| P13-1 | Remove main menu | [x] | Sonnet |
| P13-2 | Gravity + separation + barricade dams, dam burst | [x] | Pro |
| P13-3 | Blue barricade -> 10s x2 zone | [x] | Pro |
| P14-1 | Retire trapdoors, solid dividers | [x] | Sonnet |
| P14-2 | Pressure doors, crush-angle damage, breach | [x] | Pro |
| P14-3 | Real-device feel check: pile stability, door HP pacing, FPS | [ ] | - |

## Phase 15: Soft collisions + sandbox

| ID | Task | Status | Model |
|----|------|--------|-------|
| P15-1 | L99 physics sandbox | [x] | Pro |
| P15-2 | Soft collision resolving | [x] | Pro |
| P15-3 | Spawn jitter + terminal-speed spawns | [x] | Sonnet |
| P15-4 | Re-tune door crush/pile balance + bot sims on soft physics | [ ] | Pro |
