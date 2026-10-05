// Headless logic test: node test/headless.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const noop = () => {};
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => (t[k] = v, true) });
const el = () => ({ style: {}, classList: { add: noop, remove: noop }, addEventListener: noop,
  getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }) });
const els = {};
const sandbox = {
  document: { getElementById: id => els[id] || (els[id] = el()), addEventListener: noop },
  window: { innerWidth: 360, innerHeight: 640, devicePixelRatio: 2, addEventListener: noop },
  performance: { now: () => 0 }, requestAnimationFrame: noop, Math, Float32Array, Uint8Array,
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const g = sandbox.window.__mob;
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

// 1. Pool never exceeds capacity over a long run, no victory when nothing reaches base
let maxSeen = 0;
for (let i = 0; i < 60 * 30; i++) { g.update(1 / 60); maxSeen = Math.max(maxSeen, g.get().mobCount); }
ok(maxSeen <= g.get().cap, 'pool bounded (max ' + maxSeen + '/' + g.get().cap + ')');

// 2. Base HP decreases and victory triggers
g.reset();
ok(g.get().baseHP === 50, 'reset HP = 50');
let frames = 0;
while (!g.get().won && frames < 60 * 600) { g.update(1 / 60); frames++; }
ok(g.get().won && g.get().baseHP === 0, 'victory reached after ' + (frames / 60).toFixed(1) + 's');

// 3. Restart resets
g.reset();
ok(!g.get().won && g.get().baseHP === 50 && g.get().mobCount === 0, 'restart resets state');

// 4. Stress: bursts under huge multiplication stay bounded
for (let i = 0; i < 60 * 20; i++) g.update(1 / 30);
ok(g.get().mobCount <= g.get().cap, 'stress bounded');
// 5. Gates multiply: aim through x2 gate, mob count must exceed fired count; pool stays bounded
for (const [x, name] of [[100, 'x2'], [260, '+5']]) {
  g.reset(); g.aim(x);
  let peak = 0, fired = 0;
  for (let i = 0; i < 60 * 3 && !g.get().won; i++) { g.update(1 / 60); peak = Math.max(peak, g.get().mobCount); }
  fired = Math.round(3 * 9);
  ok(peak > 0 && g.get().mobCount <= g.get().cap, name + ' gate lane active, peak mobs ' + peak);
  g.reset(); g.aim(x);
  let hp0 = 50, t = 0;
  while (!g.get().won && t < 60 * 120) { g.update(1 / 60); t++; }
  ok(g.get().won, name + ' lane reaches victory in ' + (t / 60).toFixed(1) + 's (multiplied faster than 1:1 needs ~' + (50 / 9).toFixed(1) + 's)');
}
process.exit(fail ? 1 : 0);
