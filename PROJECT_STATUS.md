# Project Status

_Last updated: 2026-10-05_

| Field | Value |
|-------|-------|
| **Current Phase** | Phase 4 delivered (siege HP, negative gates, red shield); Phase 5 (100-level procedural) awaiting decisions |
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

## Open decisions (blocking Phase 5)
- Phase 5 asks for Base HP = 1000 + level*1250 (level 1 = 2,250), which conflicts with Phase 4's 1,000 / 3,500 / 10,000.
- Measured clear times are much longer than the 25-40s target (L3 ~167s with perfect aim).
- Boss/bumper/black-hole specs need a defined HP curve and pool budget first.

## Handoff Notes

If model quota runs out, continue from the next unchecked item in [BACKLOG.md](BACKLOG.md). Commit small and often.
