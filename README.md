# Mob Swarm

An **ad-free, battery-optimized, mobile-first multiplier mob shooter** in the style of "Mob Control". Drag to aim your cannon, fire a stream of blue mobs through multiplier gates (`x2`, `+5`, ...), and swarm the opponent's base until its HP hits zero.

No ads. No tracking. No dependencies.

## Architecture

- **Single file, zero dependencies**: the entire game is one `index.html` (HTML5 Canvas + vanilla JS + embedded CSS).
- **Fixed-timestep-friendly loop** driven by `requestAnimationFrame`, with delta-time clamping.
- **Strict object pooling**: mobs live in pre-allocated parallel typed arrays with an active-count swap-remove scheme. There is no `push`/`splice` and no per-frame allocation in the hot path, so GC pauses and battery drain stay low.
- **Logical resolution scaling**: the game simulates in a fixed portrait coordinate space (e.g. 360x640) and scales to the viewport, with DPR capped for performance.
- **Unified pointer input** (Pointer Events) for touch and mouse.

## Run Locally

Any static server works:

```bash
python3 -m http.server 8000
# or
npx serve .
```

Open `http://localhost:8000` on desktop, or `http://<your-LAN-IP>:8000` from a phone on the same network. You can also open `index.html` directly (`file://`) in Chrome or Safari.

## Controls

| Input | Action |
|-------|--------|
| Touch / mouse drag horizontally | Move and aim the cannon |
| Hold / keep touching | Cannon fires continuously; releasing stops fire |
| Restart button | Appears after victory |

## Add to Home Screen

- **iOS (Safari)**: Share, then *Add to Home Screen*.
- **Android (Chrome)**: Menu (three dots), then *Add to Home screen* / *Install app*.

Full offline install (PWA manifest + service worker) is planned for Phase 5. See [BACKLOG.md](BACKLOG.md).

## Project Docs

- [BACKLOG.md](BACKLOG.md): phased roadmap
- [CHANGELOG.md](CHANGELOG.md): release history
- [PROJECT_STATUS.md](PROJECT_STATUS.md): current status dashboard

## License

TBD.
