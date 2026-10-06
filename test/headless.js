// Headless logic test: node test/headless.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const noop = () => {};
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => (t[k] = v, true) });
const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop }, addEventListener: noop,
  getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }) });
const els = {};
function load(hash) {
  const sandbox = {
    document: { getElementById: id => els[id] || (els[id] = el()), addEventListener: noop },
    window: { innerWidth: 360, innerHeight: 640, devicePixelRatio: 2, addEventListener: noop },
    location: { hash }, performance: { now: () => 0 }, requestAnimationFrame: noop,
    Math, Float32Array, Uint8Array, Int16Array,
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

// 0. Hooks hidden outside #debug
ok(load('') === undefined, '__mob hidden without #debug');
const g = load('#debug');
ok(!!g, '__mob exposed with #debug');
const [G0, G1] = g.gates;

// 1. x2 gate fires exactly once per mob (no re-entry, no infinite multiplication)
g.reset(); g.setFlags({ fire: false, spawner: false }); parkGates(g);
G0.min = -1e4; G0.max = 1e4; G0.x = 100;               // x2 at y=360, spans x 100..230
g.spawnBlue(150, 380, 0, -250, 0);
step(g, 20);
ok(g.get().mobCount === 2, 'x2 gives exactly 2 mobs (got ' + g.get().mobCount + ')');
step(g, 40);
ok(g.get().mobCount === 2, 'no re-trigger after passing (got ' + g.get().mobCount + ')');

// 2. +5 gate: 1 -> 6
g.reset(); g.setFlags({ fire: false, spawner: false }); parkGates(g);
G1.min = -1e4; G1.max = 1e4; G1.x = 100;               // +5 at y=280
g.spawnBlue(150, 300, 0, -250, 0);
step(g, 20);
ok(g.get().mobCount === 6, '+5 gives 6 mobs (got ' + g.get().mobCount + ')');

// 3. Moving gate catches a mob it slides onto (no dead zone from sideways motion)
g.reset(); g.setFlags({ fire: false, spawner: false }); parkGates(g);
G0.min = -1e4; G0.max = 1e4; G0.x = 20; G0.vx = 200;   // sliding right toward x=250
g.spawnBlue(250, 362, 0, -1, 0);                       // nearly stationary mob sitting at gate height
step(g, 90);
ok(g.get().mobCount >= 2, 'sliding gate multiplies a mob it moves over (got ' + g.get().mobCount + ')');

// 4. Red vs blue cancel 1:1
g.reset(); g.setFlags({ fire: false, spawner: false }); parkGates(g);
g.spawnBlue(100, 320, 0, -250, 0);
g.spawnRed(100, 300);
step(g, 6);
ok(g.get().mobCount === 0 && g.get().redCount === 0, 'blue and red cancel (' + g.get().mobCount + '/' + g.get().redCount + ')');

// 5. Mass collision keeps pools consistent: 30 blue vs 10 red -> 20 blue, 0 red
g.reset(); g.setFlags({ fire: false, spawner: false }); parkGates(g);
for (let i = 0; i < 10; i++) { g.spawnRed(40 + i * 28, 300); }
for (let i = 0; i < 30; i++) { g.spawnBlue(40 + (i % 10) * 28, 330 + ((i / 10) | 0) * 40, 0, -250, 0); }
step(g, 30);
const s5 = g.get();
ok(s5.redCount === 0 && s5.mobCount === 20, 'mass collision (blue ' + s5.mobCount + ', red ' + s5.redCount + ')');

// 6. Defeat when a red reaches the cannon line
g.reset(); g.setFlags({ fire: false, spawner: true }); parkGates(g);
let t = 0; while (g.get().state === 0 && t < 60 * 60) { g.update(1 / 60); t++; }
ok(g.get().state === 2, 'defeat triggered after ' + (t / 60).toFixed(1) + 's');
g.reset();
ok(g.get().state === 0 && g.get().redCount === 0 && g.get().mobCount === 0, 'restart after defeat resets state');

// 7. Victory with no opposition
g.reset(); g.setFlags({ fire: true, spawner: false }); g.aim(100);
t = 0; while (g.get().state === 0 && t < 60 * 120) { g.update(1 / 60); t++; }
ok(g.get().state === 1 && g.get().baseHP === 0, 'victory after ' + (t / 60).toFixed(1) + 's');

// 8. Full-play soak: pools bounded, stable under low-FPS dt
g.reset(); g.setFlags({ fire: true, spawner: true });
let maxB = 0, maxR = 0;
for (let n = 0; n < 5; n++) {
  g.reset();
  for (let i = 0; i < 60 * 40 && g.get().state === 0; i++) {
    if (i % 90 === 0) g.aim(30 + Math.random() * 300);
    g.update(1 / 30);
    const s = g.get(); maxB = Math.max(maxB, s.mobCount); maxR = Math.max(maxR, s.redCount);
  }
}
ok(maxB <= 1500 && maxR <= 500, 'soak bounded (peak blue ' + maxB + ', red ' + maxR + ')');
process.exit(fail ? 1 : 0);
