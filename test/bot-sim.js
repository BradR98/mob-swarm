// Balance sim: node test/bot-sim.js [bossRuns]
// Idealised bots (predict gate positions perfectly): an UPPER bound on human skill.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = () => {}; const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : noop, set: (t, k, v) => (t[k] = v, true) });
const els = {}; const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop }, addEventListener: noop, setAttribute: noop, getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }) });
const sb = { document: { getElementById: id => els[id] || (els[id] = el()), addEventListener: noop }, window: { innerWidth: 360, innerHeight: 640, devicePixelRatio: 2, addEventListener: noop }, location: { hash: '#debug' }, performance: { now: () => 0 }, requestAnimationFrame: noop, Math, Float32Array, Uint8Array, Int16Array, Array, JSON };
sb.window.window = sb.window; vm.createContext(sb); vm.runInContext(src, sb); const g = sb.window.__mob;

// Predict a bouncing gate's left edge t seconds ahead.
function predict(G, t) { const span = G.max - G.min; if (span <= 0) return G.x; let d = (G.x - G.min) + G.vx * t; const per = 2 * span; d = ((d % per) + per) % per; if (d > span) d = per - d; return G.min + d; }
// Choose the lane that maximises the predicted multiplier product through all gates.
function smartAim(q) {                       // terrain-aware: traces where a shot launched at x really crosses each gate row
  let best = 180, bs = -1;
  const ys = []; for (let gi = 0; gi < q.gateCount; gi++) ys.push(g.gates[gi].y);
  const bossT = q.isBoss && q.bossActive; if (bossT) ys.push(108);      // also aim the stream at the boss hull
  for (let x = 20; x <= 340; x += 6) {
    let sc = 1;
    const tr = g.traceBlue(x, ys);
    for (let gi = 0; gi < q.gateCount; gi++) {
      const G = g.gates[gi], gx = predict(G, tr.t[gi]), px = tr.x[gi];
      if (px >= gx - 4 && px <= gx + G.w + 4) sc *= G.type === 'x' ? G.n : G.type === '+' ? G.n + 1 : G.type === '/' ? 0.5 : 0.6;
    }
    if (bossT && Math.abs(tr.x[q.gateCount] - q.bossX) > 76) sc *= 0.05;
    sc -= Math.abs(x - 180) * 1e-4;
    if (sc > bs) { bs = sc; best = x; }
  }
  return best;
}
function play(n, { spawner = true, cap = 600 } = {}) {
  g.setLevel(n); g.setFlags({ fire: true, spawner }); g.touch(true);
  let t = 0, peakR = 0, minCannon = 5, maxMobs = 0;
  while (g.get().state === 0 && t < 60 * cap) {
    if (t % 6 === 0) g.aim(Math.max(16, Math.min(344, smartAim(g.get()))));
    g.update(1 / 60); t++;
    if (t % 6 === 0) { const q = g.get(); peakR = Math.max(peakR, q.redCount); minCannon = Math.min(minCannon, q.cannonHP); maxMobs = Math.max(maxMobs, q.mobCount); }
  }
  const q = g.get();
  return { won: q.state === 1, secs: t / 60, peakR, minCannon, maxMobs };
}
const avg = a => a.reduce((s, v) => s + v, 0) / a.length;

function playPure(n) {            // no red waves; boss levels get the boss spawned at t=0
  g.setLevel(n); g.setFlags({ fire: true, spawner: false }); g.touch(true);
  if (g.get().isBoss) g.spawnBoss();
  let t = 0;
  while (g.get().state === 0 && t < 60 * 300) { if (t % 6 === 0) g.aim(Math.max(16, Math.min(344, smartAim(g.get())))); g.update(1 / 60); t++; }
  return { won: g.get().state === 1, secs: t / 60 };
}
const R = +process.argv[2] || 10;
console.log('--- 1. pure time-to-kill, no reds, perfect aim (' + R + ' runs): targets base 35s / boss 45s ---');
for (const n of [1, 6, 11, 16, 26, 36, 49, 51, 10, 20, 30, 50]) {
  const L = g.generateLevel(n), r = []; for (let i = 0; i < R; i++) r.push(playPure(n));
  const secs = r.map(x => x.secs);
  console.log('L' + String(n).padEnd(3), (L.isBoss ? 'BOSS ' : 'base ') + String(L.isBoss ? L.bossHP : L.baseHP).padEnd(6) + 'HP  MTM ' + String(L.mtm).padEnd(5),
    'TTK avg ' + avg(secs).toFixed(0) + 's  (min ' + Math.min(...secs).toFixed(0) + ' / max ' + Math.max(...secs).toFixed(0) + ')  target ' + (L.isBoss ? 45 : 35 * (1 + 0.02 * (L.tier - 1))).toFixed(0) + 's  tier ' + L.tier + ' thr ' + L.throughput.toFixed(0) + '/s');
}

console.log('--- 2. full games with red waves (perfect aim, ' + R + ' runs each) ---');
for (const n of [1, 6, 10, 16, 20, 50]) {
  const r = []; for (let i = 0; i < R; i++) r.push(play(n));
  console.log('L' + n, 'win ' + r.filter(x => x.won).length + '/' + R, 'avg ' + avg(r.map(x => x.secs)).toFixed(0) + 's', 'peak reds ' + Math.max(...r.map(x => x.peakR)), 'worst cannon HP ' + Math.min(...r.map(x => x.minCannon)), 'peak blues ' + Math.max(...r.map(x => x.maxMobs)));
}
