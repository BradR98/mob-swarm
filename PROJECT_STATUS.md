# Project Status

_Last updated: 2026-10-05_

| Field | Value |
|-------|-------|
| **Current Phase** | Phase 5 delivered (100-level procedural campaign, bosses, bumpers, black holes); balance tuning outstanding |
| **Active Focus** | Validate Phase 1 `index.html` on real phones; begin Phase 2 lane flow |
| **Known Blockers** | None |

## Tech Stack Constraints

- Single self-contained `index.html` (HTML5 Canvas + vanilla JS + embedded CSS)
- No npm dependencies, no frameworks, no external assets, no ads or trackers
- Portrait, mobile-first; 60 FPS target via `requestAnimationFrame`
- Zero per-frame allocation in hot paths (pooled mobs, typed arrays)
- Battery-conscious: capped DPR, pause when tab hidden

## Verification Checklist

- [x] Repo initialized, default branch `main`
- [x] Docs created (README, BACKLOG, CHANGELOG, PROJECT_STATUS)
- [x] `index.html` JS passes syntax check and headless logic test
- [x] Headless suite: 28 checks (gates, collisions, shield, funnel, levels)
- [ ] Audio verified on a real device (iOS needs a first tap to unlock)
- [ ] Balance: bot sim shows idealised play clears the base in ~5s on all levels; decide on base HP / wave timing (see CHANGELOG)
- [ ] Manual test on iOS Safari
- [ ] Manual test on Android Chrome
- [ ] Sustained 60 FPS confirmed with 500+ active mobs
- [ ] Remote pushed to GitHub (requires valid `gh` auth)

## Open decisions
- Boss tuning: L10 is trivial (~1s), L20+ unwinnable at default speed. Options: slower boss, boss spawning above the gate field only, or throughput-aware boss HP.
- Base HP: 800+400n ignores gate throughput; clear times range 21-114s on L1-L9.
- Hand off to Gemini Pro with the output of `node test/bot-sim.js` and `node test/boss-sim.js`.

## Handoff Notes

If model quota runs out, continue from the next unchecked item in [BACKLOG.md](BACKLOG.md). Commit small and often.

## Phase 6 balance status (open)
Perfect-aim bot, no reds, 8 runs: L1 base 37s, L9 60s, L11 20s, L49 69s, L51 67s; boss L10 77s, L20 51s, L50 76s (targets 35s/45s).
With red waves: L1 8/8 wins; boss levels L10/L20/L50 0/8 (cannon dead in ~12-17s).
Causes: MTM assumes every shot passes every gate, but gates slide and the 1500 blue pool saturates, so real throughput is far below 9*MTM. The boss is a small strafing target and the shielded base absorbs most blues.
Options: calibrate with an empirical efficiency factor / pool-aware MTM cap; weaker or slower boss waves; make the boss wider.
