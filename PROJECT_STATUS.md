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

## Phase 7 balance status
Perfect-aim bot, no reds (`node test/bot-sim.js 3`): base TTK L1 32s, L6 29s, L11 47s, L16 32s, L26 48s, L36 36s, L49 60s, L51 26s (target 35-42s).
Boss TTK: L10 37s, L20 49s, L30 62s, L50 73s (target 45s).
Full fights with reds (boss-sim, 6 runs): L10 6/6, L20 4/6, L30 5/6, L50 0/6.
Known gaps: spread grows from L26+ because gate layout, bumpers and holes affect real throughput more than the model captures (L50 has only MTM 12 plus obstacles). The bot never dodges or targets reds, so full-fight win rates are a lower bound for humans. Next: model bumper/hole position vs gate lanes, or normalise by per-level sim calibration table.
Still unverified on a real device (touch, audio, FPS, PWA install).
