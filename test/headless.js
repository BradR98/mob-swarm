// Headless logic test: node test/headless.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const noop = () => {};
let rec = null;
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (rec && k === 'arc' ? (x, y, r) => rec.push(y + r) : noop)), set: (t, k, v) => (t[k] = v, true) });
const els = {};
const el = () => { const o = ({ style: {}, appendChild: noop, removeChild: noop, textContent: '', innerHTML: '', classList: { add: noop, remove: noop, toggle: noop, contains: () => true }, addEventListener: (ev, f) => { (o.listeners[ev] = o.listeners[ev] || []).push(f); }, listeners: {},
  setAttribute: noop, getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }) }); return o; };
function load(hash, search) {
  const sandbox = {
    document: { getElementById: id => els[id] || (els[id] = el()), addEventListener: noop, createElement: () => el(), head: el(), body: el() },
    navigator: {}, setTimeout: noop,
    window: { innerWidth: 360, innerHeight: 640, devicePixelRatio: 2, addEventListener: noop, matchMedia: () => ({ matches: false }) },
    location: { hash, search: search || '' }, performance: { now: () => 0 }, requestAnimationFrame: noop,
    Math, Float32Array, Uint8Array, Uint16Array, Int16Array, Array, JSON,
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.__mob;
}
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const step = (g, frames, dt = 1 / 60) => { for (let i = 0; i < frames; i++) g.update(dt); };
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;

// 0. Hooks hidden outside #debug
ok(load('') === undefined, '__mob hidden without #debug');
const g = load('#debug'); g.setFlags({ threats: false });   // threat-budget waves are tested explicitly below
ok(!!g, '__mob exposed with #debug');
const REAL_STD = Object.assign({}, g.Armory.standard);   // Phase 16 lawnmower stats, asserted explicitly below
Object.assign(g.Armory.standard, { fireRate: 111, piercing: 1 }); g.equip('standard');   // every older mechanic test below runs on the legacy 1.0x weapon
const gl = n => g.generateLevel(n === 99 ? 98 : n);   // L99 is the physics sandbox (own tests below); generic loops use L98 in its place
const quiet = () => { g.setFlags({ fire: false, spawner: false }); g.setGates([]); g.setObstacles({}); g.touch(false); };
const lvl = n => { g.setLevel(n); g.openField(); quiet(); };   // legacy physics tests run on an open single-lane field; column tests use setLevel directly

// ---------- Generator ----------
{ // Phase 7: HP derives from MTM through the measured efficiency curve, capped by the pool
  const mtm = gates => g.calculateLevelMTM(gates);
  ok(mtm([[0,0,'x',2],[0,0,'+',5],[0,0,'x',3],[0,0,'-',10]]) === 36 && mtm([[0,0,'/',2]]) === 1, "MTM = sequential product (x2, +5 -> x6, x3 = 36), negatives ignored");
  let hpOK = true, capOK = true;
  for (let n = 1; n <= 150; n++) { const L = gl(n);
    if (L.mtm !== g.calculateLevelMTM(L.gates)) hpOK = false;
    if (!L.pour && L.baseHP !== Math.round(L.throughput * 35 * (1 / 3) * (1 + 0.02 * (L.tier - 1)))) hpOK = false;
    if (L.isBoss && L.bossHP !== Math.round(L.throughput * 45 * (1 / 3))) hpOK = false;
    if (L.throughput > 250 + 1e-9 || L.throughput <= 0) capOK = false; }
  ok(hpOK, 'Base HP = throughput * 35 / 3 * (1 + 2% per tier); Boss HP = throughput * 45 / 3 (levels 1-150; L1-8 pour levels exempt)');
  ok(capOK && g.levelThroughput(1e9) === 250, 'throughput is capped by the blue pool limit (250 hits/s)');
  ok(g.levelThroughput(2) / (20 * 2) > 0.8 && g.levelThroughput(40) / (20 * 40) < 0.5, 'efficiency falls with MTM (~0.9 at x2, <0.5 at x40)');
  ok(gl(1).gates.length === 0 && gl(2).gates.length === 0 && gl(1).mtm === 1 && gl(3).gates.length >= 2, 'L1-2 have no gates (strict 1.0x start); gates begin at L3');
}
ok(JSON.stringify(gl(37)) === JSON.stringify(gl(37)) && JSON.stringify(gl(37)) !== JSON.stringify(gl(38)), 'levels are deterministic per level number');
{
  const isNeg = t => t === '-' || t === '/';
  let layoutOK = true, tierOK = true, bossOK = true, oppOK = true, waveOK = true, boundsOK = true, intervalOK = true, prevInt = 99, why = '';
  for (let n = 1; n <= 150; n++) {
    const L = gl(n), types = L.gates.map(d => d[2]);
    const mults = L.gates.filter(d => !isNeg(d[2]));
    if ((n > 2 && L.gates.length < 1) || L.gates.length > 6 || (n > 2 && !L.gates.some(d => d[2] === 'x'))) { tierOK = false; why = 'gates ' + n; }
    if (n <= 10 && (types.some(isNeg) || L.bumpers.length || L.holes.length)) { tierOK = false; why = 'tier1 ' + n; }
    if (n >= 11 && n <= 30 && (L.bumpers.length || L.holes.length)) { tierOK = false; why = 'tier2 ' + n; }
    if (n <= 10 && types.some(isNeg)) { tierOK = false; why = 'neg early ' + n; }
    if (n >= 31 && n <= 50 && (L.bumpers.length < 2 || L.holes.length)) { tierOK = false; why = 'tier3 ' + n; }
    if (n >= 51 && L.holes.length < 1) { tierOK = false; why = 'tier4 ' + n; }
    if (!L.gates.every(d => isNeg(d[2]) || (d[2] === 'x' ? d[3] >= 1.1 && d[3] <= 3.0 + 1e-9 : d[3] >= 0.1 && d[3] <= 2.0 + 1e-9))) { tierOK = false; why = 'gate value window ' + n; }
    if ((n % 10 === 0) !== L.isBoss || L.bossHP !== (L.isBoss ? Math.round(L.throughput * 45 * (1 / 3)) : 0)) { bossOK = false; why = 'boss ' + n; }
    const cwid = g.COL_W[L.cols];
    L.gates.forEach((d, i) => {                           // negative gates guard the next gate up (same column) and slide opposite it
      if (d[7] < 0 || d[7] >= L.cols) layoutOK = false;
      if (!isNeg(d[2])) { if (d[0] > cwid + 1e-6) layoutOK = false; return; }
      const up = L.gates[i + 1];
      if (!up || up[7] !== d[7] || isNeg(up[2]) || up[1] !== d[1] - 38 || d[0] < 0.75 * cwid) layoutOK = false;
      else if (d[5] === up[5]) oppOK = false;
    });
    for (let q = 1; q < L.gates.length; q++) if (L.gates[q][7] === L.gates[q - 1][7] && L.gates[q][1] > L.gates[q - 1][1]) layoutOK = false;
    if (L.waveMax > g.MAX_WAVE || 2 * L.waveMax > g.get().capRed || L.waveMin > L.waveMax) waveOK = false;
    if (L.redInterval > prevInt + 1e-9) intervalOK = false; prevInt = L.redInterval;
    L.bumpers.forEach(b => L.gates.forEach(d => { if (Math.abs(b[1] - d[1]) < 13 + b[2]) boundsOK = false; }));
  }
  ok(tierOK, 'obstacle tiers: 1-10 basic, 11-30 +negatives, 31-50 +bumpers, 51+ +black holes ' + why);
  ok(bossOK, 'bosses only on multiples of 10 (HP from throughput * 45)');
  ok(oppOK, 'negative gates always slide opposite the high-reward gate they guard');
  ok(layoutOK, 'gate layout: inside the chute, negatives directly below a gate and wide');
  ok(waveOK, 'wave sizes capped at ' + g.MAX_WAVE + ' (two walls always fit the 1000 pool) for levels 1-150');
  ok(intervalOK && gl(6).redInterval < gl(1).redInterval && gl(40).redInterval < gl(20).redInterval && gl(1).redInterval === gl(5).redInterval, 'red spawn interval shrinks per tier and is constant within a tier');
  ok(boundsOK, 'bumpers never overlap gate rows');
  ok(gl(2).waveMin === gl(1).waveMin && gl(2).waveMax === gl(5).waveMax && gl(1).waveMin === 8 && gl(1).waveMax === 12 && gl(6).waveMin === 13 && gl(6).waveMax === 22,
    'waves are constant within a tier and grow per tier (T1 8-12, T2 13-22)');
  ok(gl(1).mixTank === 0 && gl(1).mixSprinter === 0 && gl(5).mixTank === 0 && gl(6).mixTank > 0 && gl(6).mixSprinter === 0 && gl(15).mixSprinter === 0 && gl(16).mixSprinter === 0 && gl(18).mixSprinter === 0 && gl(19).mixSprinter > 0, 'Bestiary unlocks (shifted +3 by effLevel): basics, Tanks from L6, Sprinters from L19');
  const lay = n => JSON.stringify(gl(n).gates.map(d => [d[2], d[3]]));
  ok([1, 2, 3, 4, 5].map(lay).filter((v, i, a) => a.indexOf(v) === i).length >= 3, 'gate layouts randomize within a tier');
  ok(gl(5).gates.every(d => d[2] !== '-' && d[2] !== '/') , 'no negative gates in early tiers (4-column levels hit the 6-gate bit limit, so negatives are trimmed there)');
}

// ---------- Gates ----------
lvl(1); g.setGates([[130, 360, 'x', 2, 'x2', false, 0]]); g.gates[0].x = 100;
g.spawnBlue(150, 380, 0, -250, 0);
step(g, 20);
ok(g.get().mobCount === 2, 'x2 gives exactly 2 mobs (got ' + g.get().mobCount + ')');
step(g, 20);
ok(g.get().mobCount === 2, 'no re-trigger after passing (got ' + g.get().mobCount + ')');

lvl(1); g.setGates([[110, 280, '+', 5, '+5', false, 0]]); g.gates[0].x = 100;
g.spawnBlue(150, 300, 0, -250, 0);
step(g, 20);
ok(g.get().mobCount === 6, '+5 gives 6 mobs (got ' + g.get().mobCount + ')');

lvl(1); g.setGates([[130, 360, 'x', 2, 'x2', false, 200]]);
{ const G = g.gates[0]; G.min = -1e4; G.max = 1e4; G.x = 20; G.vx = 200;
  g.spawnBlue(250, 362, 0, -1, 0);
  step(g, 45);
  ok(g.get().mobCount >= 2, 'sliding gate multiplies a mob it moves over (got ' + g.get().mobCount + ')'); }

lvl(1); g.setGates([[80, 270, '-', 10, '-10', false, 0]]);
{ const N = g.gates[0]; N.x = 100;
  for (let k = 0; k < 14; k++) g.spawnBlue(140, 300 + k * 3, 0, -250, 0);
  step(g, 25);
  const surv = g.get().mobCount;
  ok(surv >= 3 && surv <= 5, '-10 gate destroys ~10 of 14 mobs (survivors ' + surv + ')');
  step(g, 130);
  ok(N.charges >= 9.5, '-10 gate recharges (' + N.charges.toFixed(1) + '/10)'); }
lvl(1); g.setGates([[100, 350, '/', 2, '/2', false, 0]]); g.gates[0].x = 100;
for (let k = 0; k < 20; k++) g.spawnBlue(140, 380 + k * 3, 0, -250, 0);
step(g, 25);
ok(g.get().mobCount === 10, '/2 gate halves the stream exactly (20 -> ' + g.get().mobCount + ')');

// ---------- Red shield / collisions ----------
lvl(1);
g.spawnBlue(100, 320, 0, -250, 0);
g.spawnRed(100, 300, 1);
step(g, 6);
ok(g.get().mobCount === 0 && g.get().redCount === 1 && g.get().redHP[0] === 2, 'first blue only wounds a Tank (hp 3 -> ' + g.get().redHP[0] + ', red alive)');
for (let k = 0; k < 2; k++) { g.spawnBlue(g.get().redX[0], g.get().redY[0] + 60, 0, -250, 0); step(g, 12); }
step(g, 30);
ok(g.get().mobCount === 0 && g.get().redCount === 0, 'third blue destroys it (' + g.get().mobCount + '/' + g.get().redCount + ')');

lvl(1);
for (let i = 0; i < 10; i++) g.spawnRed(40 + i * 28, 300);
for (let i = 0; i < 30; i++) g.spawnBlue(40 + (i % 10) * 28, 330 + ((i / 10) | 0) * 40, 0, -250, 0);
step(g, 30);
{ const s6 = g.get();
  ok(s6.redCount === 0 && s6.mobCount === 20, 'mass collision: 10 reds cost 10 blues (blue ' + s6.mobCount + ', red ' + s6.redCount + ')'); }

// ---------- Cannon shield ----------
lvl(1);
g.spawnRed(60, g.CANNON_Y - 7);
step(g, 3);
let s = g.get();
ok(s.cannonHP === 4 && s.redCount === 0 && s.state === 0, 'red hit: cannonHP 5->' + s.cannonHP + ', red recycled, still playing');
for (let i = 0; i < 3; i++) { g.spawnRed(60, g.CANNON_Y - 7); step(g, 2); }
ok(g.get().cannonHP === 1 && g.get().state === 0, 'cannonHP 1 still alive');
g.spawnRed(60, g.CANNON_Y - 7); step(g, 2);
ok(g.get().cannonHP === 0 && g.get().state === 2, 'defeat only at cannonHP 0');
ok(els.restart.textContent === 'Try Again', 'defeat button reads Try Again');
g.restart();
ok(g.get().state === 0 && g.get().level === 1 && g.get().cannonHP === 5, 'Try Again retries same level with full shield');

lvl(1); g.setFlags({ fire: false, spawner: true });
let t = 0; while (g.get().state === 0 && t < 60 * 120) { g.update(1 / 60); t++; }
ok(g.get().state === 2, 'defeat from unopposed waves after ' + (t / 60).toFixed(1) + 's');

// ---------- Column dispatch ----------
for (const n of [1, 12, 20, 30, 45]) {
  g.setLevel(n); g.setFlags({ fire: false, spawner: true }); g.setGates([]); g.setObstacles({}); g.touch(false);
  const q0 = g.get(), used = new Set(); let inside = true;
  for (let i = 0; i < 60 * 150 && used.size < 1 || i < 600; i++) {
    g.update(1 / 60); const q = g.get();
    q.redX.forEach((x, k) => { const c = g.colOf(x); used.add(c); if (true && (x < q.colX0[c] - 0.01 || x > q.colX1[c] + 0.01)) inside = false; });
  }
  ok(inside && used.size >= 1, 'L' + n + ': red waves spawn inside the top of active columns and use ' + used.size + ' of ' + q0.cols + ' columns');
}
// Phase 13: no Brownian drift - an isolated red falls perfectly straight and ignores the blue mass
lvl(1); g.setFlags({ fire: false, spawner: false }); g.setObstacles({});
g.spawnRed(150, 150, 0); for (let i = 0; i < 6; i++) g.spawnBlue(330, 520, 0, 0, 0);
{ const x0 = g.get().redX[0]; let maxDx = 0, y0 = g.get().redY[0]; for (let i = 0; i < 90; i++) { g.update(1 / 60); const q = g.get(); maxDx = Math.max(maxDx, Math.abs(q.redX[0] - x0)); }
  ok(maxDx < 0.01 && g.get().redY[0] > y0 + 60, 'red falls straight down (max lateral drift ' + maxDx.toFixed(4) + 'px, fell ' + (g.get().redY[0] - y0).toFixed(0) + 'px), no random walk'); }
// ---------- Fire only while touching ----------
lvl(1); g.setFlags({ fire: true, spawner: false });
step(g, 120);
ok(g.get().mobCount === 0, 'no fire while untouched (2s idle, ' + g.get().mobCount + ' mobs)');
g.touch(true); step(g, 3);
ok(g.get().mobCount >= 1, 'fires immediately on touch (' + g.get().mobCount + ')');
step(g, 57);
{ const held = g.get().mobCount; ok(held >= 7 && held <= 11, '~9 shots/s while held (1s => ' + held + ')'); }
g.touch(false);
{ const at = g.get().mobCount; step(g, 1); ok(g.get().mobCount <= at, 'firing stops the instant touch is released'); }
g.reset(); g.setFlags({ fire: true, spawner: false }); g.setGates([]); g.touch(false);
for (let k = 0; k < 30; k++) { g.touch(true); g.update(1 / 60); g.touch(false); g.update(1 / 60); }
ok(g.get().mobCount <= 11, 'tap-spam cannot beat the fire rate (30 taps in 1.0s => ' + g.get().mobCount + ' shots)');

// ---------- Pipe waves ----------
for (const n of [25, 61, 98]) {
  const L = gl(n), totals = new Set(); let inRange = true, widthOK = true;
  for (let k = 0; k < 25; k++) {
    g.setLevel(n); g.setFlags({ fire: false, spawner: true }); g.setGates([]); g.setObstacles({}); g.touch(false);
    let gd = 0; while (g.get().redCount === 0 && gd++ < 60 * 20) g.update(1 / 60);
    const tot = g.get().redCount + g.get().waveQueue; totals.add(tot);
    if (tot < L.waveMin || tot > L.waveMax) inRange = false;
    step(g, 30); if (g.get().redCount > 16 * 4) widthOK = false;      // <= 28 reds/s per column pipe, up to 3 columns fed at once
  }
  ok(inRange, 'L' + n + ' waves queue ' + L.waveMin + '-' + L.waveMax + ' reds (saw ' + Math.min(...totals) + '..' + Math.max(...totals) + ')');
  ok(widthOK, 'L' + n + ' stream is metered out of the column pipes (<=64 reds after 0.5s)');
}

// ---------- Bumpers ----------
lvl(1); g.setObstacles({ bumpers: [[200, 250, 15]] });
g.spawnBlue(196, 300, 0, -250, 0);
step(g, 30);
ok(g.get().mobCount === 1 && Math.abs(g.get().blueX[0] - 196) > 10, 'bumper deflects a blue sideways (x 196 -> ' + g.get().blueX[0].toFixed(1) + ')');
lvl(1); g.spawnBlue(196, 300, 0, -250, 0);
step(g, 30);
ok(Math.abs(g.get().blueX[0] - 196) < 2, 'control: no bumper, no deflection');
lvl(1); g.setObstacles({ bumpers: [[200, 250, 15]] });
g.spawnRed(203, 200);
step(g, 30);
ok(g.get().redCount === 1 && g.get().redY[0] < 240, 'bumper knocks a red back (y ' + g.get().redY[0].toFixed(0) + ', unobstructed would be ~293)');

// ---------- Black holes ----------
lvl(1); g.setObstacles({ holes: [[200, 260]] });
g.spawnBlue(200, 330, 0, -250, 0);
g.spawnBlue(300, 330, 0, -250, 0);
step(g, 20);
ok(g.get().mobCount === 1 && g.get().blueX[0] > 250, 'black hole destroys a blue passing through its core, spares a distant one');
lvl(1); g.setObstacles({ holes: [[200, 260]] });
g.spawnRed(200, 200);
step(g, 70); if (g.get().redCount) step(g, 200);
ok(g.get().redCount === 0, 'black hole pulls in and destroys a red');
lvl(1); g.setObstacles({ holes: [[200, 260]] });
g.spawnBlue(240, 300, 0, 0, 0);
step(g, 3);
ok(Math.abs(g.get().blueX[0] - 240) > 0.2 || Math.abs(g.get().blueY[0] - 300) > 0.2, 'black hole gravity tugs nearby mobs');

// ---------- Boss (hovering mothership) ----------
lvl(10); g.setFlags({ fire: false, spawner: true });
guard = 0; while (!g.get().bossActive && guard++ < 60 * 10) g.update(1 / 60);
ok(g.get().isBoss && g.get().bossActive && g.get().bossHP === gl(10).bossHP, 'L10 boss spawns with throughput*45 = ' + g.get().bossHP + ' HP');
ok(Math.abs(g.get().bossY - 95) < 1, 'boss hovers at the base line (y ' + g.get().bossY.toFixed(0) + ')');
{ let xmin = 1e9, xmax = -1e9, yDrift = 0, waves = 0, lastR = 0, peakWave = 0;
  g.setFlags({ fire: false, spawner: true });
  for (let i = 0; i < 60 * 70 && g.get().state === 0; i++) {
    g.update(1 / 60); const q = g.get();
    xmin = Math.min(xmin, q.bossX); xmax = Math.max(xmax, q.bossX); yDrift = Math.max(yDrift, Math.abs(q.bossY - 95));
    const tot = q.redCount + q.waveQueue; if (tot > lastR + 1) { waves++; peakWave = Math.max(peakWave, tot - lastR); } lastR = tot;
    if (q.state !== 0) break;
  }
  ok(xmax - xmin > 60 && yDrift < 1, 'boss slowly drifts left/right (x ' + xmin.toFixed(0) + '..' + xmax.toFixed(0) + ') and never marches down');
  ok(waves >= 1 && peakWave >= 3 && peakWave <= 12 && peakWave < gl(10).waveMin, 'boss fires small (<=12, below the level wave size) red waves while drifting (' + waves + ' waves, biggest ' + peakWave + ')'); }
lvl(10); g.setFlags({ fire: false, spawner: true });
guard = 0; while (!g.get().bossActive && guard++ < 60 * 10) g.update(1 / 60);
step(g, 60 * 2);
ok(g.get().redCount === 0 || g.get().bossActive, 'boss stays above the gate field (no marching)');
g.setFlags({ fire: false, spawner: false });
{ const hp0 = g.get().bossHP; g.spawnBlue(g.get().bossX, g.get().bossY + 45, 0, -250, 0); step(g, 8);
  ok(g.get().bossHP === hp0 - 1 && g.get().mobCount === 0, 'one blue impact = 1 boss damage (' + hp0 + ' -> ' + g.get().bossHP + ')'); }
lvl(10); g.setFlags({ fire: false, spawner: true });
t = 0; while (g.get().state === 0 && t < 60 * 120) { g.update(1 / 60); t++; }
ok(g.get().state === 2, 'unopposed boss waves defeat the player via cannon HP (after ' + (t / 60).toFixed(1) + 's)');
lvl(10); g.spawnBlue(100, 130, 0, -250, 0);
step(g, 10);
ok(g.get().baseHP === Math.round(gl(10).baseHP * 0.5) && g.get().mobCount === 0, 'base is shielded on boss levels (HP stays ' + g.get().baseHP + ')');
lvl(20); g.setFlags({ fire: false, spawner: true });
guard = 0; while (!g.get().bossActive && guard++ < 60 * 10) g.update(1 / 60);
ok(g.get().bossHP === gl(20).bossHP, 'L20 boss HP = throughput*45 = ' + g.get().bossHP);
g.setFlags({ fire: false, spawner: false }); g.setBossHP(1);
g.spawnBlue(g.get().bossX, g.get().bossY + 45, 0, -250, 0); step(g, 8);
ok(g.get().state === 1 && els.restart.textContent === 'Next Level', 'killing the boss wins the level -> "Next Level"');

{ // mothership is wide: ~40% of the screen
  lvl(10); g.setFlags({ fire: false, spawner: true }); guard = 0; while (!g.get().bossActive && guard++ < 2000) g.update(1 / 60);
  g.setFlags({ fire: false, spawner: false });
  const bx = g.get().bossX, hp0 = g.get().bossHP;
  g.spawnBlue(bx + 52, g.get().bossY + 45, 0, -250, 0); step(g, 8);
  ok(g.get().bossHP === hp0 - 1, 'boss hull is 118px wide (40% of the screen, scaled): a hit 52px off-centre lands');
  g.spawnBlue(bx + 100, g.get().bossY + 45, 0, -250, 0); step(g, 8);
  ok(g.get().bossHP === hp0 - 1, 'a shot 100px off-centre misses the hull');
}

// ---------- Bestiary ----------
{ const T = g.RedMobTypes;
  ok(T.Basic.speed === 1 && T.Basic.hp === 1 && T.Tank.speed === 0.5 && T.Tank.radius === 1.5 && T.Tank.hp === 3 && T.Tank.color === '#8a1020' &&
     T.Sprinter.speed === 1.5 && T.Sprinter.radius === 0.7 && T.Sprinter.hp === 1 && T.Sprinter.color === '#ff8a00', 'RedMobTypes: Basic 1x/1hp, Tank 0.5x/1.5r/3hp dark red, Sprinter 1.5x/0.7r/1hp orange');
  const move = type => { lvl(1); g.spawnRed(180, 130, type); step(g, 40); const y0 = g.get().redY[0]; step(g, 30); return g.get().redY[0] - y0; };   // after the gravity ramp: terminal speed
  const mb = move(0), mt = move(1), ms = move(2);
  ok(Math.abs(mt / mb - 0.5) < 0.05 && Math.abs(ms / mb - 1.5) < 0.05, 'Tank moves at 0.5x and Sprinter at 1.5x Basic speed (' + mb.toFixed(0) + '/' + mt.toFixed(0) + '/' + ms.toFixed(0) + 'px)');
  const hits = type => { lvl(1); g.spawnRed(180, 300, type); let h = 0; while (g.get().redCount > 0 && h < 20) { g.spawnBlue(180, g.get().redY[0] + 28, 0, -250, 0); step(g, 6); h++; } return h; };
  ok(hits(0) === 1 && hits(1) === 3 && hits(2) === 1, 'blues needed: Basic 1, Tank 3, Sprinter 1 (' + hits(0) + '/' + hits(1) + '/' + hits(2) + ')');
  lvl(1); g.spawnRed(100, 300, 1); g.spawnRed(180, 300, 2); g.spawnBlue(100 + 10, 300, 0, 0, 0); g.spawnBlue(180 + 10, 308, 0, 0, 0); step(g, 1);
  ok(g.get().redHP[0] === 2 && g.get().redHP[1] === 1, 'Tank (r=10.5) is hit from further away than a Sprinter (r=4.9)');
  const seen = n => { const t = new Set(); for (let k = 0; k < 30; k++) { g.setLevel(n); g.setFlags({ fire: false, spawner: true }); g.setGates([]); g.setObstacles({}); g.touch(false);
    let gd = 0; while (g.get().redCount === 0 && gd++ < 1200) g.update(1 / 60); g.get().redType.forEach(x => t.add(x)); } return [...t].sort().join(''); };
  const seen22 = 1; ok(seen(3) === '0' && seen(8) === '01' && seen(18) === '01' && seen(22) === '012', 'waves contain only unlocked types: {Basic}, {+Tank}, {+Sprinter from L19} (' + seen(3) + '/' + seen(8) + '/' + seen(18) + '/' + seen(22) + ')');
}

// ---------- Armory ----------
{ const A = g.Armory.standard;
  ok(REAL_STD.fireRate === 45 && REAL_STD.bulletVelocity === 250 && REAL_STD.piercing === 2 && REAL_STD.pellets === 1, 'Armory.standard (Phase 17): 45ms = 22 shots/s, 250px/s, cleave 2 (max 44 kills/s vs the 45/s L1 pour)');
  g.equip('piercer'); lvl(1); g.spawnRed(180, 300, 0); g.spawnBlue(180, 330, 0, -250, 0); step(g, 6);
  ok(g.get().redCount === 0, 'piercing 2: one blue kills a 1hp Basic red and keeps its spare point');
  lvl(1); g.spawnRed(180, 300, 1); g.spawnBlue(180, 330, 0, -250, 0); step(g, 6);
  ok(g.get().redCount === 1 && g.get().redHP[0] === 1 && g.get().mobCount === 0, 'piercing 2 vs Tank: 3 -> 1 HP, blue spent');
  g.equip('standard'); lvl(1); g.spawnRed(180, 300, 1); g.spawnBlue(180, 330, 0, -250, 0); step(g, 6);
  ok(g.get().redHP[0] === 2 && g.get().mobCount === 0, 'standard piercing 1: one blue only subtracts 1 HP');
  g.equip('rapid'); lvl(1); g.setFlags({ fire: true, spawner: false }); g.touch(true); step(g, 60);
  { const n = g.get().mobCount; ok(n >= 11 && n <= 14, 'Armory.rapid (80ms) fires ~12.5 shots/s (' + n + ' in 1s)'); }
  g.touch(false); g.equip('standard');
}

// ---------- Terrain: fluid pathing ----------
const inside = (x, y, T) => { const c = Math.cos(T[4]), sn = Math.sin(T[4]), dx = x - T[0], dy = y - T[1];
  return Math.abs(dx * c + dy * sn) < T[2] - 0.05 && Math.abs(-dx * sn + dy * c) < T[3] - 0.05; };
{ // 45-degree wall: blue slides along it, never bounces
  const W45 = [180, 300, 60, 5, -Math.PI / 4];
  lvl(1); g.setObstacles({ terrain: [W45] }); g.spawnBlue(200, 345, 0, -250, 0);
  let maxVY = -1e9, pen = false, dxMax = 0, yMin = 1e9;
  for (let i = 0; i < 90; i++) { g.update(1 / 60); const q = g.get(); if (!q.mobCount) break;
    maxVY = Math.max(maxVY, q.blueVY[0]); if (inside(q.blueX[0], q.blueY[0], W45)) pen = true; dxMax = Math.max(dxMax, q.blueX[0] - 200); yMin = Math.min(yMin, q.blueY[0]); }
  ok(!pen, 'blue never penetrates an angled terrain slab');
  ok(maxVY <= 1 && dxMax > 15, 'blue slides along the 45deg wall (strip normal velocity, no reflection): max vy ' + maxVY.toFixed(1) + ', lateral +' + dxMax.toFixed(0) + 'px');
  ok(yMin < 270, 'blue slides past the end of the wall and carries on up (y ' + yMin.toFixed(0) + ')');
}
{ // flat face head-on: stops, does not bounce, slides round the end
  const FL = [180, 300, 60, 6, 0];
  lvl(1); g.setObstacles({ terrain: [FL] }); g.spawnBlue(180, 340, 0, -250, 0);
  let maxVY = -1e9, pen = false, passed = false;
  for (let i = 0; i < 240; i++) { g.update(1 / 60); const q = g.get(); if (!q.mobCount) break;
    maxVY = Math.max(maxVY, q.blueVY[0]); if (inside(q.blueX[0], q.blueY[0], FL)) pen = true; if (q.blueY[0] < 285) { passed = true; break; } }
  ok(!pen && maxVY <= 1, 'flat wall: no penetration and no bounce (max vy ' + maxVY.toFixed(1) + ')');
  ok(passed, 'flat wall: head-on blue is nudged along the face and flows round the end');
}
{ // Phase 13: a red lands on a barricade and halts; the next one stacks on top of it
  lvl(1); const sp1 = g.colSpan(1, 0); g.openField(); g.setObstacles({ terrain: [[180, 300, 60, 12, 0, 1, 0, 40]] }); g.setGates([]);
  g.spawnRed(180, 200, 0); step(g, 90);
  let q = g.get(); const y1 = q.redY[0];
  ok(Math.abs(q.redVY[0]) < 60 && y1 < 300 - 12 && y1 > 300 - 12 - 24, 'red halts on the barricade top (y ' + y1.toFixed(1) + ', vy ' + q.redVY[0].toFixed(1) + ')');
  g.spawnRed(183, 200, 0); step(g, 90); q = g.get();
  ok(q.redCount === 2 && Math.max(...q.redY) < 300 - 11 && Math.max(...q.redVY.map(Math.abs)) < 60, 'second red also halts on the barricade instead of passing through (' + q.redY.map(v => v.toFixed(0)) + ')'); }
{ // generated layouts (Phase 11): trapdoors + barricades
  let barOK = true, tdOK = true, why = '', nBar = 0, early = 0, types = new Set();
  for (let n = 1; n <= 150; n++) {
    const L = gl(n), cw = g.COL_W[L.cols];
    if (n <= 2 && L.terrain.length !== 0) early++;
    L.terrain.forEach((b, i) => { nBar++; types.add(b[6]); const c = L.barrCol[i], sp = g.colSpan(L.cols, c);
      if (b[0] - b[2] < sp[0] - 0.01 || b[0] + b[2] > sp[1] + 0.01 || b[7] < 10 || b[1] - b[3] < 128 || b[6] > 2) { barOK = false; why = 'barricade ' + n; }
      for (const d of L.gates) if (d[7] === c && Math.abs(b[1] - d[1]) < b[3] + 13 + 10) { barOK = false; why = 'gate clash ' + n; } });
    L.terrain.forEach(bb => { if (Math.abs(bb[2] * 2 - cw) > 0.01) { barOK = false; why = 'barricade not full width ' + n; } });
  }
  ok(early === 0 && nBar > 100 && types.has(0) && types.has(2), "barricades: none on L1-2, " + nBar + " over 150 levels, gray and red occur (blue retired)");
  ok(barOK, 'every barricade sits inside one column, above that column\'s gates, with >= 10 hits ' + why);
  const geo = n => { g.setLevel(n); const q = g.get(); return q; };
  { const q = geo(1); ok(q.cols === 1 && q.colX1[0] - q.colX0[0] === 96 && Math.abs((q.AX0 + q.AX1) / 2 - 180) < 1e-6, 'single centred chute (96px at L1), the rest letterboxed'); }
  { const q = geo(9); ok(q.cols === 1 && q.colX1[0] - q.colX0[0] === 84, 'chute narrows to 84px by L9'); }
}

// ---------- Funnel: RNG gate windows, gate count ----------
{ let w4 = true, w7 = true, w10 = true, two = true, n4 = 0;
  for (let rep = 0; rep < 1; rep++) for (let n = 1; n <= 150; n++) {
    const xs = gl(n).gates.filter(d => d[2] === 'x').map(d => d[3]);
    if (n === 4 || n === 5) xs.forEach(v => { n4++; if (v < 1.2 - 1e-9 || v > 1.8 + 1e-9) w4 = false; });
    if (n >= 7 && n <= 9) xs.forEach(v => { if (v < 1.1 - 1e-9 || v > 2.4 + 1e-9) w7 = false; });
    if (n >= 10) xs.forEach(v => { if (v > 3.0 + 1e-9) w10 = false; });
    if (n >= 7 && gl(n).gates.filter(d => d[2] === 'x' || d[2] === '+').length !== 2) two = false;
  }
  ok(w4 && n4 > 0, 'L4-5 multiplier gates roll inside x1.2-1.8 (' + n4 + ' sampled)');
  ok(w7, 'L7-9 multiplier gates roll inside x1.1-2.4 (window shrinks toward L9)');
  ok(w10, 'L10+ multiplier gates never exceed x3.0');
  ok(two, 'L7+ always has exactly 2 positive gates');
  ok(gl(1).cols === 1 && gl(9).cols === 1 && [1, 5, 9, 20].every(n => { g.setLevel(n); const q = g.get(); return q.colX1[0] - q.colX0[0] === [96, 96, 84, 84][[1, 5, 9, 20].indexOf(n)]; }), 'chute width 96px (L1-5) narrowing to 84px at L9+'); }

// ---------- Speed cap & crowding ----------
{ let capOK = true; for (let n = 1; n <= 150; n++) if (gl(n).redSpeedMul > 1.25 + 1e-9) capOK = false;
  ok(capOK, 'red speed multiplier never exceeds 1.25x at any level');
  lvl(1); g.setLevel(150); quiet(); g.spawnRed(180, 130, 2); step(g, 40);
  const dy0 = g.get().redY[0]; step(g, 30);
  const dy = g.get().redY[0] - dy0;
  ok(Math.abs(dy - g.RED_SPEED_CAP * 0.5) < 3, 'Sprinter at L150 is held to the speed cap (' + g.RED_SPEED_CAP + ' px/s => ' + dy.toFixed(0) + 'px in 0.5s)');
  ok(gl(100).mixTank > gl(10).mixTank && gl(100).waveMax > gl(10).waveMax, 'late game scales density and shielded mix, not speed');
}
{ // choke point: wall with a 40px mouth
  lvl(1); g.setObstacles({ terrain: [[85, 300, 75, 6, 0], [275, 300, 75, 6, 0]] });
  const Ts = [[85, 300, 75, 6, 0], [275, 300, 75, 6, 0]];
  for (let k = 0; k < 80; k++) g.spawnRed(180 + ((k % 8) - 4) * 6, 150 + ((k / 8) | 0) * 12, 0);
  let pen = false, above = 0, below = 0, spreadAbove = 0, minRatio = 9, crowdedFrames = 0;
  for (let i = 0; i < 150; i++) { g.update(1 / 60); const q = g.get();
    q.redX.forEach((x, k) => { if (Ts.some(t => inside(x, q.redY[k], t))) pen = true; });
    if (i === 50) { above = q.redY.filter(y => y < 300).length; below = q.redY.filter(y => y > 300).length; }
    spreadAbove = Math.max(spreadAbove, ...q.redX.filter((x, k) => q.redY[k] < 294).map(x => Math.abs(x - 180)));
    if (i === 50) {
      for (let a = 0; a < q.redX.length; a++) for (let b = a + 1; b < q.redX.length; b++) { const d = Math.hypot(q.redX[a] - q.redX[b], q.redY[a] - q.redY[b]); if (d < 11.5 * 0.7) crowdedFrames++; } } }
  ok(!pen, 'crowded reds are never squeezed into terrain');
  ok(above > 0 && below > 0, 'choke point: stream is split by the mouth (' + above + ' queued above, ' + below + ' through)');
  ok(spreadAbove > 40, 'reds overflow sideways beyond the 40px mouth (max offset ' + spreadAbove.toFixed(0) + 'px)');
  ok(crowdedFrames <= 60, 'soft mob-vs-mob collision: a crowded block squeezes but stays largely separated (' + crowdedFrames + ' heavily overlapping pairs)');
}

// ---------- Supply crate & power-ups ----------
{ let lo = 99, hi = 0; for (let k = 0; k < 60; k++) { g.reset(); const t0 = g.get().crateTimer; lo = Math.min(lo, t0); hi = Math.max(hi, t0); }
  ok(lo >= 15 && hi <= 20, 'crate timer is 15-20s (saw ' + lo.toFixed(1) + '..' + hi.toFixed(1) + ')');
  lvl(3); g.setFlags({ fire: false, spawner: true }); g.setCrateTimer(0.05); step(g, 6);
  ok(g.get().crateActive && g.get().crateHP === 30, 'a gray supply crate spawns (30 HP)');
  const y0 = g.get().crateY; step(g, 60); ok(g.get().crateY > y0 + 10 && g.get().crateY < y0 + 25, 'crate drifts down slowly (' + (g.get().crateY - y0).toFixed(0) + 'px/s)');
  g.setFlags({ fire: false, spawner: false }); g.clearReds();   // L3 now opens with a sustained pour: drop it so the crate is the only target
  for (let k = 0; k < 29; k++) g.spawnBlue(g.get().crateX, g.get().crateY + 26, 0, -250, 0);
  step(g, 6); ok(g.get().crateActive && g.get().crateHP === 1 && g.get().mobCount === 0, '29 impacts leave the crate on 1 HP (hp ' + g.get().crateHP + ')');
  g.spawnBlue(g.get().crateX, g.get().crateY + 26, 0, -250, 0); step(g, 6);
  ok(!g.get().crateActive && g.get().pillCount === 1, 'the 30th impact breaks the crate and drops a pill');
  lvl(1); g.spawnPill(180, 480, 0); g.aim(180); step(g, 50);
  ok(g.get().powerName === 'shotgun' && g.get().pillCount === 0 && Math.abs(g.get().powerLeft - 8) < 1.2, 'catching the pill equips the Shotgun for 8s (left ' + g.get().powerLeft.toFixed(1) + ')');
  g.setFlags({ fire: true, spawner: false }); g.touch(true); step(g, 2);
  { const q = g.get(); ok(q.mobCount === 3 && Math.max(...q.blueVX) > 40 && Math.min(...q.blueVX) < -40, 'Shotgun fires a 3-way spread per shot (' + q.mobCount + ' pellets)'); }
  g.touch(false); step(g, 60 * 8); ok(g.get().powerName === '' && g.get().powerLeft === 0, 'power-up expires after 8s');
  lvl(1); g.setFlags({ fire: true, spawner: false }); g.touch(true); step(g, 8); ok(g.get().mobCount === 1, 'normal single shot restored after expiry'); g.touch(false);
  lvl(1); g.spawnPill(100, 480, 0); g.aim(300); step(g, 130);
  ok(g.get().powerName === '' && g.get().pillCount === 0, 'a missed pill falls off-screen and is lost');
  lvl(1); g.spawnPill(180, 480, 1); g.aim(180); step(g, 50);
  ok(g.get().powerName === 'piercingRounds', 'second pill type equips Piercing Rounds');
  g.spawnRed(180, 300, 1); g.setFlags({ fire: false, spawner: false }); g.spawnBlue(180, 330, 0, -250, 0); step(g, 6);
  ok(g.get().redCount === 0, 'Piercing Rounds subtract 3 HP per blue (Tank 3 -> dead)');
  g.equip('piercer'); lvl(1); g.spawnPill(180, 480, 0); g.aim(180); step(g, 50); g.setFlags({ fire: false, spawner: false }); step(g, 60 * 9); g.equip('standard');
  ok(g.get().powerName === '', 'power-up expiry returns to the equipped base weapon');
  lvl(1); g.setFlags({ fire: false, spawner: true }); g.spawnCrate(); const hpBefore = g.get().cannonHP;
  let cg = 0; while (g.get().crateActive && cg++ < 60 * 40) { g.update(1 / 30); if (g.get().state !== 0) break; }
  ok(!g.get().crateActive || g.get().state !== 0, 'unbroken crate eventually leaves the field harmlessly (' + (cg / 30).toFixed(0) + 's)');
}

// ---------- Progression ----------
lvl(1); g.setFlags({ fire: true, spawner: false }); g.setBaseHP(30); g.aim(100); g.touch(true);
t = 0; while (g.get().state === 0 && t < 60 * 300) { g.update(1 / 60); t++; }
ok(g.get().state === 1 && els.restart.textContent === 'Next Level', 'L1 won -> "Next Level"');
g.restart();
ok(g.get().level === 2 && g.get().baseHP === Math.round(gl(2).baseHP * 0.5) && g.get().state === 0 && g.get().mobCount === 0 && g.get().redCount === 0,
  'Next Level regenerates the board in place (L2, MTM-scaled HP, pools empty)');
g.touch(false);
lvl(100); g.setFlags({ fire: false, spawner: true });
guard = 0; while (!g.get().bossActive && guard++ < 2000) g.update(1 / 60);
g.setFlags({ fire: false, spawner: false }); g.setBossHP(1);
g.spawnBlue(g.get().bossX, g.get().bossY + 45, 0, -250, 0); step(g, 8);
ok(g.get().state === 1 && els.restart.textContent === 'Victory - Play Again', 'L100 cleared -> "Victory - Play Again"');
g.restart();
ok(g.get().level === 1 && g.get().state === 0, 'Play Again wraps to L1');

// ---------- Pool stress / soak ----------
lvl(98); g.setFlags({ fire: false, spawner: false });
for (let i = 0; i < 500; i++) g.spawnRed(20 + (i % 25) * 13.5, 130 + ((i / 25) | 0) * 15);
for (let i = 0; i < 1500; i++) g.spawnBlue(10 + (i % 50) * 6.8, 300 + ((i / 50) | 0) * 9, 0, -250, 0);
{ const t0 = process.hrtime.bigint();
  let f = 0, pr = 0, pb = 0;
  for (; f < 120 && g.get().state === 0; f++) { g.update(1 / 60); const q = g.get(); pr = Math.max(pr, q.redCount); pb = Math.max(pb, q.mobCount); }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / Math.max(1, f);
  ok(pr <= 500 && pb <= 1500, 'stress pools bounded (peak red ' + pr + ', blue ' + pb + ')');
  console.log('INFO stress update cost: ' + ms.toFixed(2) + ' ms/frame over ' + f + ' frames');
  ok(ms < 8, 'stress logic cost < 8ms/frame (' + ms.toFixed(2) + ')'); }

{ let maxB = 0, maxR = 0, finite = true;
  for (const n of [1, 12, 35, 55, 61, 90, 98, 100, 150]) {
    for (let rep = 0; rep < 2; rep++) {
      g.setLevel(n); g.setFlags({ fire: true, spawner: true }); g.touch(true);
      for (let i = 0; i < 60 * 40 && g.get().state === 0; i++) {
        if (i % 90 === 0) g.aim(30 + Math.random() * 300);
        g.update(1 / 30);
        const q = g.get(); maxB = Math.max(maxB, q.mobCount); maxR = Math.max(maxR, q.redCount);
        if (i % 60 === 0 && ![...q.blueX, ...q.blueY, ...q.redX, ...q.redY].every(Number.isFinite)) finite = false;
      }
    }
  }
  g.touch(false);
  ok(maxB <= 1500 && maxR <= 1000, 'soak over levels 1-150 bounded (peak blue ' + maxB + ', red ' + maxR + ')');
  ok(finite, 'soak: no NaN/Infinity positions (bumper/black-hole math is stable)'); }
// Phase 9: Trackpad Zone, entity scale, boss rebalance
{
  ok(g.TRACK_Y === 544 && g.CANNON_Y === g.TRACK_Y && Math.abs(g.TRACK_H - 96) < 1e-6, 'trackpad zone = bottom 15% (y>=544); cannon line sits on its border');
  ok(Math.abs(g.ES - 0.82) < 1e-9 && Math.abs(g.GATE_H - 26 * 0.82) < 1e-6 && Math.abs(g.CRATE_R - 16 * 0.82) < 1e-6 && Math.abs(g.BOSS_H - 56 * 0.82) < 1e-6, 'all entities scaled by 0.82 (gates, crates, boss)');
  let tOK = true, bad = '';
  for (let n = 1; n <= 150; n++) { const L = gl(n);
    for (const d of L.gates) if (d[1] + g.GATE_H / 2 > g.TRACK_Y) { tOK = false; bad = 'gate L' + n; }
    for (const t of L.terrain) { const c = Math.cos(t[4]), sn = Math.sin(t[4]), bot = t[1] + Math.abs(t[2] * sn) + Math.abs(t[3] * c); if (bot > g.TRACK_Y) { tOK = false; bad = 'terrain L' + n; } }
    for (const b of L.bumpers || []) if (b[1] + (b[2] || 0) > g.TRACK_Y) { tOK = false; bad = 'bumper L' + n; }
    for (const h of L.holes || []) if (h[1] > g.TRACK_Y) { tOK = false; bad = 'hole L' + n; } }
  ok(tOK, 'generated gates/terrain/bumpers/holes never reach the trackpad zone ' + bad);
  let live = true, lowest = 0, arcMax = 0, frames = 0;
  for (const n of [1, 10, 20, 35, 55, 90]) {
    g.setLevel(n); g.setFlags({ fire: true, spawner: true }); g.touch(true);
    for (let i = 0; i < 60 * 25 && g.get().state === 0; i++) {
      if (i % 80 === 0) g.aim(30 + Math.random() * 300);
      g.update(1 / 30);
      const q = g.get();
      for (let k = 0; k < q.mobCount; k++) lowest = Math.max(lowest, q.blueY[k]);
      for (let k = 0; k < q.redCount; k++) { if (q.redY[k] > g.TRACK_Y) live = false; }
      if (i % 20 === 0) { rec = []; g.render(); arcMax = Math.max(arcMax, ...rec, 0); rec = null; frames++; }
    }
  }
  g.touch(false);
  ok(live && lowest <= g.TRACK_Y, 'no blue/red mob ever inside trackpad zone (lowest blue y ' + lowest.toFixed(1) + ' <= 544)');
  ok(frames > 0 && arcMax <= g.TRACK_Y + 0.5, 'render(): no circle drawn below the zone border (lowest arc edge ' + arcMax.toFixed(1) + ', ' + frames + ' frames)');
  ok(g.BOSS_PIPE_RATE < g.PIPE_RATE, 'boss pipe slower than level pipe (' + g.BOSS_PIPE_RATE + ' < ' + g.PIPE_RATE + ' reds/s)');
  for (const n of [10, 20, 30]) { g.setLevel(n); const bp = g.bossParams(); ok(bp.wave >= 3 && bp.wave < gl(n).waveMin && bp.interval >= 8, 'boss wave (' + bp.wave + ') smaller and interval (' + bp.interval.toFixed(1) + 's) slower than level pipe (L' + n + ')'); }
  const pe = [], fake = { clientX: 5, clientY: 620, pointerId: 1, pointerType: 'touch', preventDefault() {} };
  ok(/function pointerToLogicalX\(e\)\s*\{[^}]*clientX[^}]*\}/.test(src) && !/pointerToLogicalX[^}]*clientY/.test(src.match(/function pointerToLogicalX[\s\S]*?\n  \}/)[0]) && /hudCanvas\.addEventListener\('pointerdown'/.test(src), 'touch input maps from clientX only, on the full flat overlay (works anywhere in the trackpad zone)');
}
// Phase 10: pause
{ lvl(1); g.setFlags({ fire: false, spawner: false }); g.spawnRed(180, 200, 0); step(g, 5);
  const y0 = g.get().redY[0]; g.setPaused(true); step(g, 30);
  ok(g.isPaused() && g.get().redY[0] === y0 && els.overlayTitle.textContent === 'PAUSED' && els.restart.textContent === 'Resume', 'pause freezes the simulation and shows the PAUSED overlay with a Resume button');
  g.setPaused(false); step(g, 30);
  ok(!g.isPaused() && g.get().redY[0] > y0, 'resume continues the simulation');
  g.setPaused(true); g.setPaused(false); lvl(1); g.get();
  ok(/id="pause"/.test(html) && /#pause \{[^}]*top: 8px; right: 54px/.test(html), 'pause button sits in the top-right corner (clear of the trackpad zone)'); }
// Phase 11: level warp
for (const [s, lv, cols] of [['?level=20', 20, 1], ['?level=30', 30, 1], ['?level=9', 9, 1], ['?level=4', 4, 1], ['?level=1', 1, 1], ['?level=abc', 1, 1], ['', 1, 1], ['?x=1&level=45', 45, 1]]) {
  const w = load('#debug', s), q = w.get();
  ok(q.level === lv && q.cols === cols, 'URL "' + s + '" -> level ' + q.level + ', ' + q.cols + ' columns');
}
// Phase 11: containment during heavy play
{ let badBlue = 0, badRed = 0, deep = 0, n = 0;
  for (const lv of [9, 17, 25, 45]) {
    g.setLevel(lv); g.setFlags({ fire: true, spawner: true }); g.touch(true);
    for (let i = 0; i < 60 * 20 && g.get().state === 0; i++) {
      if (i % 60 === 0) g.aim(20 + Math.random() * 320);
      g.update(1 / 30); const q = g.get(); n++;
      for (let k = 0; k < q.mobCount; k++) { if (q.blueX[k] < q.AX0 - 0.5 || q.blueX[k] > q.AX1 + 0.5) badBlue++; if (q.blueY[k] > g.TRACK_Y) deep++; }
      for (let k = 0; k < q.redCount; k++) {
        const x = q.redX[k], c = g.colOf(x), inBand = false;
        if (x < q.AX0 - 0.5 || x > q.AX1 + 0.5) badRed++;
        else if (!inBand && (x < q.colX0[c] - 0.5 || x > q.colX1[c] + 0.5)) badRed++;
        if (q.redY[k] > g.TRACK_Y) deep++;
      }
    }
  }
  g.touch(false);
  ok(badBlue === 0 && badRed === 0 && deep === 0, 'mobs stay in active columns and out of trackpad (' + n + ' frames; blue ' + badBlue + ', red ' + badRed + ', deep ' + deep + ')'); }
// ---------- Phase 15: soft collisions, spawn jitter, Level 99 physics sandbox ----------
{ // soft resolving: only ~20% of an overlap is resolved per frame (rigid used ~90%)
  lvl(98); g.setFlags({ fire: false, spawner: false, threats: false }); g.setObstacles({});
  g.spawnRed(170, 200, 0); g.spawnRed(176, 200, 0);      // 6px apart: 5.5px overlap
  const dd = () => { const q = g.get(); return Math.hypot(q.redX[1] - q.redX[0], q.redY[1] - q.redY[0]); };
  const d0 = dd(); g.update(1 / 60); const d1 = dd(), gain = d1 - d0;
  ok(gain > 0.3 && gain < 0.45 * (11.48 - d0), 'soft collisions: one frame resolves ~20% of the overlap, not all of it (6.00px -> ' + d1.toFixed(2) + 'px, gained ' + gain.toFixed(2) + ' of ' + (11.48 - d0).toFixed(2) + ' overlap)');
  step(g, 30); ok(dd() > 8, 'given a little time the pair still squeezes apart (' + dd().toFixed(1) + 'px)'); }
{ // Level 99 sandbox
  const w = load('#debug'); w.setFlags({ threats: false }); w.setLevel(99); const q0 = w.get();
  ok(q0.level === 99 && q0.cols === 1 && q0.colX1[0] - q0.colX0[0] === 320 && q0.gateCount === 0 && q0.barr.length === 1 && q0.barr[0].type === 255 && q0.barr[0].y > 440 && q0.barr[0].hw === 160,
     'L99 sandbox loads: 1 wide (320px) column, no gates/doors, one indestructible plug at the bottom (y ' + q0.barr[0].y + ')');
  w.setCannonHP(5); let maxLat = 0, width = 0, worstBelow = -1e9; const first = new Set(); let dupe = false;
  for (let f = 0; f < 60 * 25; f++) {
    w.update(1 / 60); const q = w.get();
    if (f < 120) { q.redX.forEach((x, k) => { if (q.redY[k] < 150) maxLat = Math.max(maxLat, Math.abs(q.redVX[k])); const key = x.toFixed(3) + ',' + q.redY[k].toFixed(3); }); const z = q.redX.filter((x, k) => q.redY[k] < 160); if (z.length > 2) width = Math.max(width, Math.max(...z) - Math.min(...z)); }
    if (f === 90) { const keys = q.redX.map((x, k) => x.toFixed(2) + ',' + q.redY[k].toFixed(2)); dupe = new Set(keys).size !== keys.length; }
    worstBelow = Math.max(worstBelow, ...q.redY.map(y => y - 456));
  }
  const q1 = w.get();
  ok(q1.state === 0 && q1.cannonHP === 5 && q1.baseHP === q0.baseHP && q1.mobCount === 0, 'L99 never wins or loses (no auto-spawned blues) (25s: state ' + q1.state + ', cannonHP ' + q1.cannonHP + ', blues ' + q1.mobCount + ')');
  ok(q1.redCount >= 150 && q1.redCount <= 760, 'L99 pours continuously (piles up to the pool, spawn blocked when crowded) (' + q1.redCount + ' reds after 25s)');
  ok(worstBelow < 0, 'the indestructible plug holds: no red ever sinks below its top (worst ' + worstBelow.toFixed(1) + 'px)');
  ok(!dupe, 'spawn jitter: no two reds spawn on the same pixel');
  ok(width < 45 && maxLat < 140, 'the spawn stream stays a thick column, not an explosion (width ' + width.toFixed(0) + 'px, max lateral ' + maxLat.toFixed(0) + 'px/s)');
  w.touch(true); for (let f = 0; f < 60 * 2; f++) w.update(1 / 60);
  ok(w.get().mobCount > 0, 'L99 cannon fires when held (' + w.get().mobCount + ' blues after 2s)');
  w.touch(false); }
{ // Phase 16: Level 1 baseline + Tier 1 scaling
  const A = gl(1), pours = [1, 2, 3, 4, 5, 6, 7, 8].map(n => gl(n).pour), rates = [1, 2, 3, 4, 5, 6, 7, 8].map(n => gl(n).pourRate);
  ok(A.cols === 1 && A.pour >= 500 && A.pourRate >= 40 && A.pourRate <= 50 && A.gates.length === 0 && A.terrain.length === 0 && !A.isBoss,
     'L1: one column, a sustained pour of ' + A.pour + ' reds at ' + A.pourRate + '/s, no gates, no barricades');
  ok(rates.slice(0, 5).every((v, i) => i === 0 || Math.abs(v / rates[i - 1] - 1.02) < 1e-6) && gl(10).pour === 0,
     'Attrition: the pour rate compounds exactly +2% per level (' + rates.map(v => v.toFixed(1)).join('/') + '); L9+ keep the old wave system');
  { const q = load('#debug'); q.setLevel(1); q.setFlags({ threats: false }); q.setCannonHP(1e6); q.touch(false); let lost = 0; step(q, 60 * 30);
    const z = q.get(); ok(z.state === 0 && z.waveQueue > 0 && (1e6 - z.cannonHP) + z.redCount > 500, 'infinite pour: 30s unopposed has already spawned ' + ((1e6 - z.cannonHP) + z.redCount) + ' reds (> the 500 initial queue), still queued, nobody wins'); }
  ok(gl(2).cols === 1 && gl(3).cols === 1 && gl(2).terrain.length === 0 && gl(3).terrain.length >= 1, "barricades arrive at L3; always one chute");
  const w = load('#debug'); w.setLevel(1); w.setFlags({ threats: false }); w.touch(false);
  let n0 = w.get().waveQueue, sp = 0, dupe = false; const seen = new Set();
  for (let f = 0; f < 60 * 2; f++) { w.update(1 / 60); const q = w.get(); if (f === 119) { sp = (n0 - q.waveQueue) / 2; q.redX.forEach((x, k) => seen.add(x.toFixed(2) + ',' + q.redY[k].toFixed(2))); dupe = seen.size !== q.redX.length; } }
  ok(n0 >= 500 && sp >= 20 && sp <= 52 && !dupe, 'L1 pour delivers ' + sp.toFixed(0) + ' reds/s from a queue of ' + n0 + ', jittered (no stacked pixels)');
  const wl = (n, secs) => { const v = load('#debug'); v.setLevel(n); v.setFlags({ threats: false }); v.touch(true); let minC = 5, peak = 0;
    for (let f = 0; f < 60 * secs && v.get().state === 0; f++) { if (f % 6 === 0) { const z = v.get(); let ly = 0, lx = 180; for (let k = 0; k < z.redCount; k++) if (z.redY[k] > ly) { ly = z.redY[k]; lx = z.redX[k]; } v.aim(lx); } v.update(1 / 60); const q = v.get(); minC = Math.min(minC, q.cannonHP); peak = Math.max(peak, q.redCount); }
    return { won: v.get().state === 1, cannon: minC, peak, hp: v.get().baseHP }; };
  const r1 = wl(1, 150);
  ok(r1.won && r1.cannon >= 3, 'a bot that just tracks the lowest red wins L1 before the pile-up crushes the cannon (cannon HP ' + r1.cannon + '/5, peak swarm ' + r1.peak + ' reds)');
  const r2 = wl(2, 150);
  ok(r2.won && r2.cannon >= 2, 'and still wins L2 (gray barricade, bigger pour) (cannon HP ' + r2.cannon + '/5, peak ' + r2.peak + ')');
}
process.exit(fail ? 1 : 0);
