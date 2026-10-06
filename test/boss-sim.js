// Boss fairness sim: node test/boss-sim.js  (fire-early vs fire-late, and boss-speed sweeps)
// Balance sim: node test/bot-sim.js [bossRuns]
// Idealised bots (predict gate positions perfectly): an UPPER bound on human skill.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(require('path').join(__dirname,'..','index.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
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


function playBoss(n, { holdUntilBoss = true, spawner = true } = {}) {
  g.setLevel(n); g.setFlags({ fire: true, spawner }); g.touch(!holdUntilBoss);
  if (!spawner) { g.spawnBoss(); g.touch(true); }
  let t = 0, spawnT = null, minCannon = 5;
  while (g.get().state === 0 && t < 60 * 180) {
    const q = g.get();
    if (q.bossActive && spawnT === null) { spawnT = t; g.touch(true); }
    if (t % 6 === 0) g.aim(Math.max(16, Math.min(344, smartAim(q))));
    g.update(1 / 60); t++; minCannon = Math.min(minCannon, g.get().cannonHP);
  }
  return { won: g.get().state === 1, fight: spawnT === null ? 0 : (t - spawnT) / 60, minCannon };
}
const N = +process.argv[2] || 10;
function row(label, n, opts) {
  const r = []; for (let i = 0; i < N; i++) r.push(playBoss(n, opts));
  const L = g.generateLevel(n);
  console.log(label.padEnd(36), 'HP ' + String(L.bossHP).padEnd(6), 'win', r.filter(x => x.won).length + '/' + N, 'avg fight', avg(r.map(x => x.fight)).toFixed(1) + 's', 'min ' + Math.min(...r.map(x => x.fight)).toFixed(0) + ' max ' + Math.max(...r.map(x => x.fight)).toFixed(0), 'worst cannonHP ' + Math.min(...r.map(x => x.minCannon)));
}
console.log('boss = hovering mothership; TTK target 45s (perfect stream); N=' + N);
for (const n of [10, 20, 30, 50]) row('L' + n + ' no red waves (pure TTK)', n, { spawner: false });
for (const n of [10, 20, 30, 50]) row('L' + n + ' full fight, fire once boss shows', n, { holdUntilBoss: true });
for (const n of [10, 50]) row('L' + n + ' full fight, pre-loaded swarm', n, { holdUntilBoss: false });
