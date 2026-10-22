# Project Status

_Last updated: 2026-10-22_

| Field | Value |
|-------|-------|
| **Current Phase** | Phase 19 (v19 / cache c21): single 96px chute, RNG gates, Vertical Surge, density tiers, L9 reshape. Tuning panel hidden on `main` (`#tune`). Headless suite green (163 checks). Not device-tested. |
| **Active Focus** | Vet levels 10+ and bosses on the chute model; real-device playtest; remove the tuning panel from `main` |
| **Known Blockers** | None |
| **Test build** | `feature/funnel-logic` -> https://bradr98.github.io/funnelswarm/ keeps the tuning panel visible; it is the testing environment. |

## Tech Stack Constraints

- Single self-contained `index.html` (HTML5 Canvas + vanilla JS + embedded CSS), plus the PWA files
- No npm dependencies, no frameworks, no external assets, no ads or trackers
- Portrait, mobile-first; 60 FPS target via `requestAnimationFrame`
- Zero per-frame allocation in hot paths (pooled mobs, typed arrays)
- Battery-conscious: capped DPR, pause when tab hidden

## Verification Checklist

- [x] Repo on GitHub (`BradR98/mob-swarm`), Pages live from `main`
- [x] Docs: README, ARCHITECTURE, BACKLOG, CHANGELOG, PROJECT_STATUS
- [x] Headless suite passes (`node --expose-gc test/headless.js`)
- [x] Tier 1 (L1-8) bot sim: 10/10 wins per level, L1 about 17s (`node test/pour-sim.js`)
- [x] PWA: manifest, service worker, cache-busting update lifecycle
- [ ] Levels 9+ and bosses re-simulated on the 22 shots/s weapon and 1/3 HP scale
- [ ] 150-level soak re-run (last run before Phase 15)
- [ ] Audio verified on a real device (iOS needs a first tap to unlock)
- [ ] Manual test on iOS Safari and Android Chrome (tilt readability, thumb ergonomics, installed-PWA update)
- [ ] Sustained 60 FPS confirmed with 500+ active mobs
- [ ] Player gameplay guide (BACKLOG P18-3)

## Handoff Notes

Continue from the next unchecked item in [BACKLOG.md](BACKLOG.md). Commit small and often; each release bumps the `#ver` label and `CACHE_NAME` in `sw.js`. Push with `env -u GITHUB_TOKEN git push origin main` if a stale `GITHUB_TOKEN` env var breaks auth.

---

# Historical phase notes (Phases 8-10, kept for reference)

## Phase 8 balance status
Terrain-aware perfect-aim bot, no reds (`node test/bot-sim.js 2`): base TTK L1 32s, L6 28s, L11 19s, L16 48s, L26 34s, L36 22s, L49 30s, L51 42s (target ~35-42s). Boss TTK (cal run after the final terrain fix): L10 42s, L30 35s, L40 38s, L60 41s, but L20 72s and L50 84s (target 45s).
Full fights with red waves and crates active, bot never fights reds: L1 2/2, L6 2/2, L50 2/2 (base levels); boss levels are weak (boss-sim 3 runs, before the last funnel fix: L10 0/3, L20 0/3, L30 1/3, L50 1/3). Reds now arrive as one dense stream down a single lane; the bot does not target it, so these are a floor for humans, but boss full-fight balance needs a pass (smaller boss waves or a slower pipe rate).
Known gaps: HP model is still a global fit; terrain (lane displacement) and obstacle layout cause +/-50% TTK spread. A launch-lane reachability check exists as a debug probe (`traceBlue`); every generated level has >=3 lanes reaching the base area.
Still unverified on a real device (touch, audio, FPS, PWA install). Supply-crate pill catch and terrain feel need a real playtest.

## Phase 9 status
Trackpad zone, crescent cannon, 0.82 entity scale and boss rebalance done; headless 131/0; boss full-fight sim L10 20/20, L20 18/20 (bot ignores reds). Open: boss pure TTK exceeds 45 s target (57 s/86 s), base-level TTK not re-simmed after scaling. Needs real-device check: thumb ergonomics, crescent look, touch in zone, FPS.

## Phase 10 status
Lanes, Brownian reds, swarm density and pause done; headless 137/0. Bot sim (perfect aim, no reds): base TTK 17-41s vs 35-43s target (often fast), boss TTK L10 74s / L20 64s vs 45s target (still slow; terrain makes the hull harder to hit), boss full fights 10/10 (bot never shoots reds). Open: boss TTK, no real-device playtest (lane feel, 1000-red FPS, pause button reach).
