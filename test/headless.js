// Headless logic test: node test/headless.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const noop = () => {};
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => (t[k] = v, true) });
const els = {};
const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop }, addEventListener: noop,
  setAttribute: noop, getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }) });
function load(hash) {
  const sandbox = {
    document: { getElementById: id => els[id] || (els[id] = el()), addEventListener: noop },
    window: { innerWidth: 360, innerHeight: 640, devicePixelRatio: 2, addEventListener: noop },
    location: { hash }, performance: { now: () => 0 }, requestAnimationFrame: noop,
    Math, Float32Array, Uint8Array, Int16Array, Array,
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.__mob;
}
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const step = (g, frames, dt = 1 / 60) => { for (let i = 0; i < frames; i++) g.update(dt); };
const parkGates = g => g.gates.forEach(G => { G.x = G.min = G.max = -1000; G.vx = 0; });
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;

// 0. Hooks hidden outside #debug
ok(load('') === undefined, '__mob hidden without #debug');
const g = load('#debug');
ok(!!g, '__mob exposed with #debug');
const [G0, G1] = g.gates;
const quiet = () => { g.setFlags({ fire: false, spawner: false }); parkGates(g); };

// 1. Level config
g.setLevel(0); ok(g.get().gateCount === 1 && g.get().baseHP === 40, 'L1: 1 gate, base 40');
g.setLevel(1); ok(g.get().gateCount === 2 && g.get().baseHP === 80, 'L2: 2 gates, base 80');
g.setLevel(2); ok(g.get().gateCount === 2 && g.get().baseHP === 150, 'L3: 2 gates, base 150');
ok(g.gates[0].speed > 150, 'L3 gates are high-speed (' + g.gates[0].speed + ')');
g.setFlags({ fire: true, spawner: true });

// 2. x2 gate fires exactly once per mob (no re-entry)
g.setLevel(1); quiet();
G0.min = -1e4; G0.max = 1e4; G0.x = 100;
g.spawnBlue(150, 380, 0, -250, 0);
step(g, 20);
ok(g.get().mobCount === 2, 'x2 gives exactly 2 mobs (got ' + g.get().mobCount + ')');
step(g, 40);
ok(g.get().mobCount === 2, 'no re-trigger after passing (got ' + g.get().mobCount + ')');

// 3. +5 gate: 1 -> 6
g.setLevel(1); quiet();
G1.min = -1e4; G1.max = 1e4; G1.x = 100;
g.spawnBlue(150, 300, 0, -250, 0);
step(g, 20);
ok(g.get().mobCount === 6, '+5 gives 6 mobs (got ' + g.get().mobCount + ')');

// 4. Sliding gate catches a mob it moves onto
g.setLevel(1); quiet();
G0.min = -1e4; G0.max = 1e4; G0.x = 20; G0.vx = 200;
g.spawnBlue(250, 362, 0, -1, 0);
step(g, 45);   // gate reaches the mob around frame 28; the clone would hit the base ~60 frames later
ok(g.get().mobCount >= 2, 'sliding gate multiplies a mob it moves over (got ' + g.get().mobCount + ')');

// 5. Red vs blue cancel 1:1
g.setLevel(1); quiet();
g.spawnBlue(100, 320, 0, -250, 0);
g.spawnRed(100, 300);
step(g, 6);
ok(g.get().mobCount === 0 && g.get().redCount === 0, 'blue and red cancel (' + g.get().mobCount + '/' + g.get().redCount + ')');

// 6. Mass collision keeps pools consistent (each red kills exactly one blue)
g.setLevel(1); quiet();
for (let i = 0; i < 10; i++) g.spawnRed(40 + i * 28, 300);
for (let i = 0; i < 30; i++) g.spawnBlue(40 + (i % 10) * 28, 330 + ((i / 10) | 0) * 40, 0, -250, 0);
step(g, 30);
const s6 = g.get();
ok(s6.redCount === 0 && s6.mobCount === 20, 'mass collision (blue ' + s6.mobCount + ', red ' + s6.redCount + ')');

// 7. Cannon shield: a red crossing the line costs 1 HP, is recycled, game continues
g.setLevel(0); quiet();
g.spawnRed(60, 583);
step(g, 3);
let s = g.get();
ok(s.cannonHP === 4 && s.redCount === 0 && s.state === 0, 'red hit: cannonHP 5->' + s.cannonHP + ', red recycled, still playing');
for (let i = 0; i < 3; i++) { g.spawnRed(60, 583); step(g, 2); }
ok(g.get().cannonHP === 1 && g.get().state === 0, 'cannonHP 1 still alive');
g.spawnRed(60, 583); step(g, 2);
ok(g.get().cannonHP === 0 && g.get().state === 2, 'defeat only at cannonHP 0');
ok(els.restart.textContent === 'Try Again', 'defeat button reads Try Again');
g.restart();
ok(g.get().state === 0 && g.get().level === 0 && g.get().cannonHP === 5, 'Try Again retries same level with full shield');

// 8. Natural defeat from the spawner (nobody firing)
g.setLevel(0); g.setFlags({ fire: false, spawner: true }); parkGates(g);
let t = 0; while (g.get().state === 0 && t < 60 * 120) { g.update(1 / 60); t++; }
ok(g.get().state === 2, 'defeat from unopposed waves after ' + (t / 60).toFixed(1) + 's');

// 9. Funneling: waves spawn toward the blue cluster, not uniformly
g.setLevel(1); g.setFlags({ fire: false, spawner: true }); parkGates(g);
for (let i = 0; i < 20; i++) g.spawnBlue(310 + (i % 5) * 4, 450 + ((i / 5) | 0) * 8, 0, 0, 0);
let guard = 0; while (g.get().redCount < 2 && guard++ < 600) g.update(1 / 60);
const spawnX = mean(g.get().redX);
ok(spawnX > 230, 'red wave spawns over blue cluster (mean x ' + spawnX.toFixed(0) + ' vs center 180)');
g.setLevel(1); g.setFlags({ fire: false, spawner: false }); parkGates(g);
for (let i = 0; i < 10; i++) g.spawnBlue(180 + (i % 2) * 6, 300, 0, 0, 0);
ok(g.get().redCount === 0, 'baseline: no reds');
g.setFlags({ fire: false, spawner: true });
guard = 0; while (g.get().redCount < 2 && guard++ < 600) g.update(1 / 60);
ok(Math.abs(mean(g.get().redX) - 180) < 30, 'blues at center => wave at center (mean x ' + mean(g.get().redX).toFixed(0) + ')');

// 10. Lateral attraction
g.setLevel(1); quiet();
g.spawnRed(100, 200);
for (let i = 0; i < 6; i++) g.spawnBlue(280, 480, 0, 0, 0);
step(g, 40);
const redMoved = g.get().redX[0] - 100;
ok(redMoved > 10, 'red drifts toward blue mass (+' + redMoved.toFixed(1) + 'px)');
g.setLevel(1); quiet();
g.spawnRed(280, 200);
g.spawnBlue(100, 500, 0, -1, 0);
step(g, 40);
ok(g.get().blueX[0] > 105, 'blue drifts toward red mass (x ' + g.get().blueX[0].toFixed(1) + ')');

// 11. Level progression
g.setLevel(0); g.setFlags({ fire: true, spawner: false }); g.aim(100);
t = 0; while (g.get().state === 0 && t < 60 * 300) { g.update(1 / 60); t++; }
ok(g.get().state === 1 && els.restart.textContent === 'Next Level', 'L1 won in ' + (t / 60).toFixed(1) + 's -> "Next Level"');
g.restart();
ok(g.get().level === 1 && g.get().baseHP === 80 && g.get().state === 0, 'Next Level loads L2');
g.setLevel(2); g.aim(100);
t = 0; while (g.get().state === 0 && t < 60 * 600) { g.update(1 / 60); t++; }
ok(g.get().state === 1 && els.restart.textContent === 'Victory - Play Again', 'L3 won in ' + (t / 60).toFixed(1) + 's -> "Victory - Play Again"');
g.restart();
ok(g.get().level === 0 && g.get().state === 0, 'Play Again wraps to L1');

// 12. Full-play soak across all levels: pools bounded
let maxB = 0, maxR = 0;
for (let lv = 0; lv < 3; lv++) {
  g.setFlags({ fire: true, spawner: true });
  for (let n = 0; n < 3; n++) {
    g.setLevel(lv);
    for (let i = 0; i < 60 * 40 && g.get().state === 0; i++) {
      if (i % 90 === 0) g.aim(30 + Math.random() * 300);
      g.update(1 / 30);
      const q = g.get(); maxB = Math.max(maxB, q.mobCount); maxR = Math.max(maxR, q.redCount);
    }
  }
}
ok(maxB <= 1500 && maxR <= 500, 'soak bounded (peak blue ' + maxB + ', red ' + maxR + ')');
process.exit(fail ? 1 : 0);
