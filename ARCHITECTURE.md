# Mob Swarm - architecture (handover, v18)

**What it is:** an ad-free, battery-friendly "Mob Control"-style multiplier shooter. One self-contained `index.html` (HTML5 Canvas, vanilla JS, embedded CSS, no dependencies) plus PWA files (`manifest.json`, `sw.js`, icons). Live: https://bradr98.github.io/mob-swarm/ (GitHub Pages from `main`).

## Layout
- `index.html` - the whole game (logical space 360x640, scaled to the viewport, DPR capped at 2).
- `sw.js` - service worker; `CACHE_NAME` is bumped each release, old caches are deleted on activate; `index.html` reloads once when a new worker takes over.
- `test/headless.js` - ~200 headless checks (loads the script in a Node `vm` with stub DOM; debug hooks via `#debug`). `test/pour-sim.js`, `bot-sim.js`, `boss-sim.js` - bot balance sims.
- `CHANGELOG.md`, `BACKLOG.md`, `README.md`, `PROJECT_STATUS.md` (stale after Phase 11).

## Rendering (perspective tilt, locked)
- `#game` canvas (the physics world, play field y 52-544) sits inside `#tilt`, CSS `perspective(800) rotateX(45deg)`, origin bottom, up to 1.9x vertical stretch, top faded by a mask.
- `#hud` canvas (flat, full stage): level text, base bar + HP, trackpad strip, hit flash. It also receives all pointer input (touch X maps 1:1 to the cannon). Pause / mute / version / overlay are DOM elements on top.
- All collisions and math are 2D; the tilt is purely visual.

## Simulation
- Fixed pools in typed arrays (blues 1500, reds 1000), no per-frame allocation. Uniform grids for blue-vs-red and red-vs-red.
- Reds: gravity to a terminal speed, 3 solver iterations, soft collisions (~20% overlap resolved per frame, ramping up for deep overlap) so they pile like a liquid. Spawn jitter +-5px.
- Board: a single chute (96px, 84px from L9) with destructible barricades (gray / red), sliding gates with RNG-rolled values (`rollGate`, windows in `gateWinBase`), gate concurrency cap, Vertical Surge, difficulty via `effLevel(n)`; the tuning panel (`TUNING`, `#tune` on main) is hidden on `main`. Sliding gates (x, +, -, /), bumpers (L31+), black holes (L51+), supply crates with power-ups, bosses every 10th level.
- Weapon (`Armory.standard`): 22 shots/s, cleave 2, 110px/s random spray. Cannon has 5 HP; a red crossing the cannon line costs 1.
- Levels are procedural and seeded (`generateLevel(n)`, deterministic). L1-8 use an endless "pour" (45/s, +2% per level, Tier-1 fall speed ramps 0.4x -> 1x). L9+ use timed waves. Level 99 is a physics sandbox.
- Base HP: gateless pour levels = 250 x 1.02^(n-1) (a leaked blue hits for 15); other levels = throughput x 35 / 3 x (1 + 2% per tier); gate pour levels x0.6; boss HP = throughput x 45 / 3.

## Dev hooks
`?level=N` or `#level=N` warps; Warp box on the pause / end overlay; `#debug` exposes `window.__mob` (used by tests only).

## Known gaps
- Levels 9+ and bosses not re-balanced for the 22 shots/s weapon or the 1/3 HP scale (BACKLOG P17-4, P16-5); 150-level soak not re-run since Phase 14.
- Never playtested on a real device (FPS with ~1000 reds, tilt readability, thumb ergonomics).
- In-world labels (gate / barricade counters, boss) tilt with the board.
