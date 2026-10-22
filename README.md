# Mob Swarm

An **ad-free, battery-optimized, mobile-first multiplier mob shooter** in the style of "Mob Control". Slide your thumb along the trackpad to steer the cannon, hold to fire a stream of blue mobs up a lane, send them through multiplier gates (`x2`, `+10`, ...), and swarm the enemy base until its HP hits zero, while a river of red mobs pours down at you.

No ads. No tracking. No dependencies. Live: https://bradr98.github.io/mob-swarm/ (installable PWA).

## Architecture

Short version below; the full description is in [ARCHITECTURE.md](ARCHITECTURE.md).

- **Single file, zero dependencies**: the whole game is one `index.html` (HTML5 Canvas + vanilla JS + embedded CSS), plus `sw.js`, `manifest.json` and icons for the PWA.
- **Split rendering**: the physics world is drawn on a canvas that is CSS-tilted (45 degrees, 800px perspective) for a forward-angled view; the HUD, base bar, trackpad strip and hit flash live on a flat overlay canvas that also receives all touch input (1:1 finger-to-cannon mapping). All collisions and math stay strictly 2D.
- **Strict object pooling**: mobs live in pre-allocated parallel typed arrays (1500 blue, 1000 red), swap-remove, no `push`/`splice` or per-frame allocation in the hot path.
- **Logical resolution scaling**: the game simulates in a fixed 360x640 portrait space and scales to the viewport, with DPR capped at 2.
- **Swarm physics**: reds fall under gravity and collide softly (about 20% of an overlap resolved per frame), so they pile up and flow like a liquid; barricades act as dams.

## Campaign

Procedurally generated, seeded levels (each level is always the same board).

- **Levels 1-8 (Tier 1)**: one endless pour of reds (45/s on L1, +2% per level) that never stops; only the enemy base reaching 0 HP ends the level. One narrow centre chute (96px, narrowing to 84px by L9); gate values are rolled at random inside a per-level window. Level 1 base HP is 250.
- **Obstacles unlock by tier**: multiplier gates (L3+), negative gates (L11+, unvetted), pinball bumpers (L31+), black holes (L51+); barricades (gray, red), and supply crates with power-ups.
- **Every 10th level is a boss fight.** Levels 9+ and bosses still use the older timed-wave balance (see [BACKLOG.md](BACKLOG.md)).
- **Weapon**: 22 shots/s, each blue cleaves 2 red HP, wide random spray. The cannon has 5 HP; a red crossing the cannon line costs 1.

## Controls

| Input | Action |
|-------|--------|
| Touch / mouse drag horizontally (anywhere on the screen) | Steer the cannon |
| Hold / keep touching | Fire continuously; releasing stops fire |
| Pause button (top right) | Pause; the overlay has a Level box + Warp button to jump to any level |
| Mute button | Toggle audio |

## Run locally

Any static server works (the service worker needs http, not `file://`):

```bash
python3 -m http.server 8000
# or
npx serve .
```

Open `http://localhost:8000`, or `http://<your-LAN-IP>:8000` from a phone on the same network.

## Add to Home Screen

- **iOS (Safari)**: Share, then *Add to Home Screen*.
- **Android (Chrome)**: Menu (three dots), then *Add to Home screen* / *Install app*.

The service worker caches the game for offline play. Each release bumps the cache name in `sw.js` and the version label next to the pause button; a new build is picked up and reloaded automatically.

## Developer tools

- **Level warp**: Level box + Warp on the pause / end screens, or `?level=N` / `#level=N` in the URL.
- **Level 99** is a physics sandbox: one wide chute, ~30 reds/s pouring onto an indestructible plug, no win or loss, cannon enabled.
- **`#debug`** exposes `window.__mob` (state + hooks) for the tests.

## Testing

Needs Node 18+; nothing to install.

```bash
node --expose-gc test/headless.js      # ~200 checks: gates, collisions, physics, level generator, pour, input, rendering contracts
node test/pour-sim.js 10 1 2 3 4 5 6 7 8   # perfect-aim bot over levels 1-8 (runs, then level numbers)
node test/bot-sim.js 5                 # pure time-to-kill + full games (slow: minutes)
node test/boss-sim.js                  # boss fights (slow)
```

The headless suite loads the first bare `<script>` of `index.html` into a Node `vm` with stub DOM objects (so don't give the game script an `id`). The sims use a bot that tracks the lowest red and steers for gates. Levels 9+ and bosses have not been re-simulated since Phase 14.

## Project docs

- [ARCHITECTURE.md](ARCHITECTURE.md): files, rendering, simulation, pacing, HP formulas, known gaps
- [BACKLOG.md](BACKLOG.md): phased roadmap and open items
- [CHANGELOG.md](CHANGELOG.md): release history, phase by phase
- [PROJECT_STATUS.md](PROJECT_STATUS.md): current status dashboard

## License

TBD.
