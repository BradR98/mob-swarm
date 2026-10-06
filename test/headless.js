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
    Math, Float32Array, Uint8Array, Int16Array, Array, JSON,
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
const g = load('#debug');
ok(!!g, '__mob exposed with #debug');
const gl = g.generateLevel;
const quiet = () => { g.setFlags({ fire: false, spawner: false }); g.setGates([]); g.setObstacles({}); g.touch(false); };
const lvl = n => { g.setLevel(n); quiet(); };

// ---------- Generator ----------
{ // Phase 7: HP derives from MTM through the measured efficiency curve, capped by the pool
  const mtm = gates => g.calculateLevelMTM(gates);
  ok(mtm([[0,0,'x',2],[0,0,'+',5],[0,0,'x',3],[0,0,'-',10]]) === 36 && mtm([[0,0,'/',2]]) === 1, "MTM = sequential product (x2, +5 -> x6, x3 = 36), negatives ignored");
  let hpOK = true, capOK = true;
  for (let n = 1; n <= 150; n++) { const L = gl(n);
    if (L.mtm !== g.calculateLevelMTM(L.gates)) hpOK = false;
    if (L.baseHP !== Math.round(L.throughput * 35 * (1 + 0.02 * (L.tier - 1)))) hpOK = false;
    if (L.isBoss && L.bossHP !== Math.round(L.throughput * 45)) hpOK = false;
    if (L.throughput > 600 + 1e-9 || L.throughput <= 0) capOK = false; }
  ok(hpOK, 'Base HP = throughput * 35 * (1 + 2% per tier); Boss HP = throughput * 45 (levels 1-150)');
  ok(capOK && g.levelThroughput(1e9) === 600, 'throughput is capped by the blue pool limit (600 hits/s)');
  ok(g.levelThroughput(2) / (9 * 2) > 0.8 && g.levelThroughput(40) / (9 * 40) < 0.5, 'efficiency falls with MTM (~0.9 at x2, <0.5 at x40)');
  ok(gl(1).gates.length === 1 && gl(1).gates[0][4] === 'x2', 'L1 is a single wide x2 gate');
}
ok(JSON.stringify(gl(37)) === JSON.stringify(gl(37)) && JSON.stringify(gl(37)) !== JSON.stringify(gl(38)), 'levels are deterministic per level number');
{
  const isNeg = t => t === '-' || t === '/';
  let layoutOK = true, tierOK = true, bossOK = true, oppOK = true, waveOK = true, boundsOK = true, intervalOK = true, prevInt = 99, why = '';
  for (let n = 1; n <= 150; n++) {
    const L = gl(n), types = L.gates.map(d => d[2]);
    const mults = L.gates.filter(d => !isNeg(d[2]));
    if (L.gates.length < 1 || L.gates.length > 6 || !mults.some(d => d[2] === 'x')) { tierOK = false; why = 'gates ' + n; }
    if (n <= 10 && (types.some(isNeg) || L.bumpers.length || L.holes.length)) { tierOK = false; why = 'tier1 ' + n; }
    if (n >= 11 && n <= 30 && (!types.some(isNeg) || L.bumpers.length || L.holes.length)) { tierOK = false; why = 'tier2 ' + n; }
    if (n >= 31 && n <= 50 && (L.bumpers.length < 2 || L.holes.length)) { tierOK = false; why = 'tier3 ' + n; }
    if (n >= 51 && L.holes.length < 1) { tierOK = false; why = 'tier4 ' + n; }
    if (n <= 10 && !L.gates.every(d => ['x2', 'x3', '+2', '+10'].includes(d[4]))) { tierOK = false; why = 'labels ' + n; }
    if ((n % 10 === 0) !== L.isBoss || L.bossHP !== (L.isBoss ? Math.round(L.throughput * 45) : 0)) { bossOK = false; why = 'boss ' + n; }
    L.gates.forEach((d, i) => {                           // negative gates guard the next gate up and slide opposite it
      if (!isNeg(d[2])) { if (d[2] === 'x' && d[3] === 3 || d[2] === '+' && d[3] === 10) { if (!(d[0] <= 75)) layoutOK = false; } else if (!(d[0] >= 95)) layoutOK = false; return; }
      const up = L.gates[i + 1];
      if (!up || isNeg(up[2]) || !(up[3] === 3 || up[3] === 10) || up[1] !== d[1] - 40 || d[0] < 100) layoutOK = false;
      else if (d[5] === up[5]) oppOK = false;
    });
    for (let q = 1; q < L.gates.length; q++) if (L.gates[q][1] > L.gates[q - 1][1]) layoutOK = false;
    if (L.waveMax > g.MAX_WAVE || 2 * L.waveMax > 500 || L.waveMin > L.waveMax) waveOK = false;
    if (L.redInterval > prevInt + 1e-9) intervalOK = false; prevInt = L.redInterval;
    L.bumpers.forEach(b => L.gates.forEach(d => { if (Math.abs(b[1] - d[1]) < 13 + b[2]) boundsOK = false; }));
  }
  ok(tierOK, 'obstacle tiers: 1-10 basic, 11-30 +negatives, 31-50 +bumpers, 51+ +black holes ' + why);
  ok(bossOK, 'bosses only on multiples of 10 (HP from throughput * 45)');
  ok(oppOK, 'negative gates always slide opposite the high-reward gate they guard');
  ok(layoutOK, 'risk vs reward: x3/+10 narrow (<=75px) and high, x2/+2 wide (>=95px) and low, negatives wide and directly below a high gate');
  ok(waveOK, 'wave sizes capped at ' + g.MAX_WAVE + ' (two walls always fit the 500 pool) for levels 1-150');
  ok(intervalOK && gl(6).redInterval < gl(1).redInterval && gl(40).redInterval < gl(20).redInterval && gl(1).redInterval === gl(5).redInterval, 'red spawn interval shrinks per tier and is constant within a tier');
  ok(boundsOK, 'bumpers never overlap gate rows');
  ok(gl(2).waveMin === gl(1).waveMin && gl(2).waveMax === gl(5).waveMax && gl(1).waveMin === 8 && gl(1).waveMax === 12 && gl(6).waveMin === 13 && gl(6).waveMax === 22,
    'waves are constant within a tier and grow per tier (T1 8-12, T2 13-22)');
  ok(gl(1).mixTank === 0 && gl(1).mixSprinter === 0 && gl(5).mixTank === 0 && gl(6).mixTank > 0 && gl(6).mixSprinter === 0 && gl(15).mixSprinter === 0 && gl(16).mixSprinter > 0, 'Bestiary unlocks: T1 basics only, T2 +Tanks, T4 +Sprinters');
  const lay = n => JSON.stringify(gl(n).gates.map(d => [d[2], d[3]]));
  ok([1, 2, 3, 4, 5].map(lay).filter((v, i, a) => a.indexOf(v) === i).length >= 3, 'gate layouts randomize within a tier');
  ok(gl(5).gates.every(d => d[2] !== '-' && d[2] !== '/') && gl(11).gates.some(d => d[2] === '-' || d[2] === '/'), 'negative gates appear from Tier 3 (L11)');
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
g.spawnRed(100, 300);
step(g, 6);
ok(g.get().mobCount === 0 && g.get().redCount === 1 && g.get().redHP[0] === 1, 'first blue only wounds the red (hp 2 -> ' + g.get().redHP[0] + ', red alive)');
g.spawnBlue(100, 380, 0, -250, 0);
step(g, 20);
ok(g.get().mobCount === 0 && g.get().redCount === 0, 'second blue destroys it (' + g.get().mobCount + '/' + g.get().redCount + ')');

lvl(1);
for (let i = 0; i < 10; i++) g.spawnRed(40 + i * 28, 300);
for (let i = 0; i < 30; i++) g.spawnBlue(40 + (i % 10) * 28, 330 + ((i / 10) | 0) * 40, 0, -250, 0);
step(g, 30);
{ const s6 = g.get();
  ok(s6.redCount === 0 && s6.mobCount === 10, 'mass collision: 10 reds cost 20 blues (blue ' + s6.mobCount + ', red ' + s6.redCount + ')'); }

// ---------- Cannon shield ----------
lvl(1);
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
ok(g.get().state === 0 && g.get().level === 1 && g.get().cannonHP === 5, 'Try Again retries same level with full shield');

lvl(1); g.setFlags({ fire: false, spawner: true });
let t = 0; while (g.get().state === 0 && t < 60 * 120) { g.update(1 / 60); t++; }
ok(g.get().state === 2, 'defeat from unopposed waves after ' + (t / 60).toFixed(1) + 's');

// ---------- Funneling / attraction ----------
lvl(1); g.setFlags({ fire: false, spawner: true });
for (let i = 0; i < 20; i++) g.spawnBlue(310 + (i % 5) * 4, 450 + ((i / 5) | 0) * 8, 0, 0, 0);
let guard = 0; while (g.get().redCount < 2 && guard++ < 600) g.update(1 / 60);
ok(mean(g.get().redX) > 230, 'red wave spawns over blue cluster (mean x ' + mean(g.get().redX).toFixed(0) + ' vs center 180)');
lvl(1);
for (let i = 0; i < 10; i++) g.spawnBlue(180 + (i % 2) * 6, 300, 0, 0, 0);
g.setFlags({ fire: false, spawner: true });
guard = 0; while (g.get().redCount < 2 && guard++ < 600) g.update(1 / 60);
ok(Math.abs(mean(g.get().redX) - 180) < 30, 'blues at center => wave at center (mean x ' + mean(g.get().redX).toFixed(0) + ')');

lvl(1);
g.spawnRed(100, 200);
for (let i = 0; i < 6; i++) g.spawnBlue(280, 480, 0, 0, 0);
step(g, 40);
ok(g.get().redX[0] - 100 > 10, 'red drifts toward blue mass (+' + (g.get().redX[0] - 100).toFixed(1) + 'px)');
lvl(1);
g.spawnRed(280, 200);
g.spawnBlue(100, 500, 0, -1, 0);
step(g, 40);
ok(g.get().blueX[0] > 105, 'blue drifts toward red mass (x ' + g.get().blueX[0].toFixed(1) + ')');

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

// ---------- Red walls ----------
for (const n of [1, 25, 61, 99]) {
  const L = gl(n), counts = new Set(); let inRange = true; const widths = [];
  for (let k = 0; k < 25; k++) {
    g.setLevel(n); g.setFlags({ fire: false, spawner: true }); g.setGates([]); g.setObstacles({}); g.touch(false);
    let gd = 0; while (g.get().redCount === 0 && gd++ < 60 * 20) g.update(1 / 60);
    const c = g.get().redCount; counts.add(c);
    const xs = g.get().redX; widths.push(Math.max(...xs) - Math.min(...xs));
    if (c < L.waveMin || c > L.waveMax) inRange = false;
  }
  ok(inRange, 'L' + n + ' waves are ' + L.waveMin + '-' + L.waveMax + ' reds (saw ' + Math.min(...counts) + '..' + Math.max(...counts) + ')');
  ok(Math.max(...widths) < 250, 'L' + n + ' wall is a cluster (width <= ' + Math.max(...widths).toFixed(0) + 'px)');
}
lvl(25); g.setFlags({ fire: false, spawner: true });
for (let i = 0; i < 6; i++) g.spawnBlue(300, 540, 0, 0, 0);
while (g.get().redCount === 0) g.update(1 / 60);
{ const spread = a => Math.max(...a) - Math.min(...a);
  const w0 = spread(g.get().redX);
  g.setFlags({ fire: false, spawner: false });
  step(g, 45);
  const w1 = spread(g.get().redX);
  ok(g.get().redCount > 0 && w1 > w0 * 0.8, 'wall width preserved while marching (' + w0.toFixed(0) + ' -> ' + w1.toFixed(0) + 'px)'); }

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
step(g, 70);
ok(g.get().redCount === 0, 'black hole pulls in and destroys a red');
lvl(1); g.setObstacles({ holes: [[200, 260]] });
g.spawnBlue(240, 300, 0, 0, 0);
step(g, 3);
ok(Math.abs(g.get().blueX[0] - 240) > 0.2 || Math.abs(g.get().blueY[0] - 300) > 0.2, 'black hole gravity tugs nearby mobs');

// ---------- Boss (hovering mothership) ----------
lvl(10); g.setFlags({ fire: false, spawner: true });
guard = 0; while (!g.get().bossActive && guard++ < 60 * 10) g.update(1 / 60);
ok(g.get().isBoss && g.get().bossActive && g.get().bossHP === gl(10).bossHP, 'L10 boss spawns with throughput*45 = ' + g.get().bossHP + ' HP');
ok(Math.abs(g.get().bossY - 100) < 1, 'boss hovers at the base line (y ' + g.get().bossY.toFixed(0) + ')');
{ let xmin = 1e9, xmax = -1e9, yDrift = 0, waves = 0, lastR = 0, peakWave = 0;
  g.setFlags({ fire: false, spawner: true });
  for (let i = 0; i < 60 * 40 && g.get().state === 0; i++) {
    g.update(1 / 60); const q = g.get();
    xmin = Math.min(xmin, q.bossX); xmax = Math.max(xmax, q.bossX); yDrift = Math.max(yDrift, Math.abs(q.bossY - 100));
    if (q.redCount > lastR + 5) { waves++; peakWave = Math.max(peakWave, q.redCount - lastR); } lastR = q.redCount;
    if (q.state !== 0) break;
  }
  ok(xmax - xmin > 60 && yDrift < 1, 'boss slowly drifts left/right (x ' + xmin.toFixed(0) + '..' + xmax.toFixed(0) + ') and never marches down');
  ok(waves >= 1 && peakWave >= 5 && peakWave <= 14, 'boss fires sparse (<=14) red waves while drifting (' + waves + ' waves, biggest ' + peakWave + ')'); }
lvl(10); g.setFlags({ fire: false, spawner: true });
guard = 0; while (!g.get().bossActive && guard++ < 60 * 10) g.update(1 / 60);
step(g, 60 * 2);
ok(g.get().redCount === 0 || g.get().bossActive, 'boss stays above the gate field (no marching)');
g.setFlags({ fire: false, spawner: false });
{ const hp0 = g.get().bossHP; g.spawnBlue(g.get().bossX, g.get().bossY + 60, 0, -250, 0); step(g, 8);
  ok(g.get().bossHP === hp0 - 1 && g.get().mobCount === 0, 'one blue impact = 1 boss damage (' + hp0 + ' -> ' + g.get().bossHP + ')'); }
lvl(10); g.setFlags({ fire: false, spawner: true });
t = 0; while (g.get().state === 0 && t < 60 * 120) { g.update(1 / 60); t++; }
ok(g.get().state === 2, 'unopposed boss waves defeat the player via cannon HP (after ' + (t / 60).toFixed(1) + 's)');
lvl(10); g.spawnBlue(100, 130, 0, -250, 0);
step(g, 10);
ok(g.get().baseHP === gl(10).baseHP && g.get().mobCount === 0, 'base is shielded on boss levels (HP stays ' + g.get().baseHP + ')');
lvl(20); g.setFlags({ fire: false, spawner: true });
guard = 0; while (!g.get().bossActive && guard++ < 60 * 10) g.update(1 / 60);
ok(g.get().bossHP === gl(20).bossHP, 'L20 boss HP = throughput*45 = ' + g.get().bossHP);
g.setFlags({ fire: false, spawner: false }); g.setBossHP(1);
g.spawnBlue(g.get().bossX, g.get().bossY + 60, 0, -250, 0); step(g, 8);
ok(g.get().state === 1 && els.restart.textContent === 'Next Level', 'killing the boss wins the level -> "Next Level"');

{ // mothership is wide: ~40% of the screen
  lvl(10); g.setFlags({ fire: false, spawner: true }); guard = 0; while (!g.get().bossActive && guard++ < 600) g.update(1 / 60);
  g.setFlags({ fire: false, spawner: false });
  const bx = g.get().bossX, hp0 = g.get().bossHP;
  g.spawnBlue(bx + 65, g.get().bossY + 60, 0, -250, 0); step(g, 8);
  ok(g.get().bossHP === hp0 - 1, 'boss hull is 144px wide: a hit 65px off-centre lands');
  g.spawnBlue(bx + 100, g.get().bossY + 60, 0, -250, 0); step(g, 8);
  ok(g.get().bossHP === hp0 - 1, 'a shot 100px off-centre misses the hull');
}

// ---------- Bestiary ----------
{ const T = g.RedMobTypes;
  ok(T.Basic.speed === 1 && T.Basic.hp === 2 && T.Tank.speed === 0.5 && T.Tank.radius === 1.5 && T.Tank.hp === 5 && T.Tank.color === '#8a1020' &&
     T.Sprinter.speed === 1.5 && T.Sprinter.radius === 0.7 && T.Sprinter.hp === 1 && T.Sprinter.color === '#ff8a00', 'RedMobTypes: Basic 1x/2hp, Tank 0.5x/1.5r/5hp dark red, Sprinter 1.5x/0.7r/1hp orange');
  const move = type => { lvl(1); g.spawnRed(180, 200, type); step(g, 30); return g.get().redY[0] - 200; };
  const mb = move(0), mt = move(1), ms = move(2);
  ok(Math.abs(mt / mb - 0.5) < 0.05 && Math.abs(ms / mb - 1.5) < 0.05, 'Tank moves at 0.5x and Sprinter at 1.5x Basic speed (' + mb.toFixed(0) + '/' + mt.toFixed(0) + '/' + ms.toFixed(0) + 'px)');
  const hits = type => { lvl(1); g.spawnRed(180, 300, type); let h = 0; while (g.get().redCount > 0 && h < 20) { g.spawnBlue(180, 330, 0, -250, 0); step(g, 6); h++; } return h; };
  ok(hits(0) === 2 && hits(1) === 5 && hits(2) === 1, 'blues needed: Basic 2, Tank 5, Sprinter 1 (' + hits(0) + '/' + hits(1) + '/' + hits(2) + ')');
  lvl(1); g.spawnRed(100, 300, 1); g.spawnRed(180, 300, 2); g.spawnBlue(100 + 12, 300, 0, 0, 0); g.spawnBlue(180 + 10, 308, 0, 0, 0); step(g, 1);
  ok(g.get().redHP[0] === 4 && g.get().redHP[1] === 1, 'Tank (r=10.5) is hit from further away than a Sprinter (r=4.9)');
  const seen = n => { const t = new Set(); for (let k = 0; k < 30; k++) { g.setLevel(n); g.setFlags({ fire: false, spawner: true }); g.setGates([]); g.setObstacles({}); g.touch(false);
    let gd = 0; while (g.get().redCount === 0 && gd++ < 1200) g.update(1 / 60); g.get().redType.forEach(x => t.add(x)); } return [...t].sort().join(''); };
  ok(seen(3) === '0' && seen(8) === '01' && seen(18) === '012', 'waves contain only unlocked types: T1 {Basic}, T2 {+Tank}, T4 {+Sprinter} (' + seen(3) + '/' + seen(8) + '/' + seen(18) + ')');
}

// ---------- Armory ----------
{ const A = g.Armory.standard;
  ok(A.fireRate === 111 && A.bulletVelocity === 250 && A.piercing === 1, 'Armory.standard: 111ms, 250px/s, piercing 1');
  g.equip('piercer'); lvl(1); g.spawnRed(180, 300, 0); g.spawnBlue(180, 330, 0, -250, 0); step(g, 6);
  ok(g.get().redCount === 0 && g.get().mobCount === 0, 'piercing 2: one blue subtracts both HP of a Basic red and dies');
  lvl(1); g.spawnRed(180, 300, 1); g.spawnBlue(180, 330, 0, -250, 0); step(g, 6);
  ok(g.get().redCount === 1 && g.get().redHP[0] === 3 && g.get().mobCount === 0, 'piercing 2 vs Tank: 5 -> 3 HP, blue spent');
  g.equip('standard'); lvl(1); g.spawnRed(180, 300, 0); g.spawnBlue(180, 330, 0, -250, 0); step(g, 6);
  ok(g.get().redHP[0] === 1 && g.get().mobCount === 0, 'standard piercing 1: one blue only subtracts 1 HP');
  g.equip('rapid'); lvl(1); g.setFlags({ fire: true, spawner: false }); g.touch(true); step(g, 60);
  { const n = g.get().mobCount; ok(n >= 11 && n <= 14, 'Armory.rapid (80ms) fires ~12.5 shots/s (' + n + ' in 1s)'); }
  g.touch(false); g.equip('standard');
}

// ---------- Progression ----------
lvl(1); g.setFlags({ fire: true, spawner: false }); g.setBaseHP(30); g.aim(100); g.touch(true);
t = 0; while (g.get().state === 0 && t < 60 * 300) { g.update(1 / 60); t++; }
ok(g.get().state === 1 && els.restart.textContent === 'Next Level', 'L1 won -> "Next Level"');
g.restart();
ok(g.get().level === 2 && g.get().baseHP === gl(2).baseHP && g.get().state === 0 && g.get().mobCount === 0 && g.get().redCount === 0,
  'Next Level regenerates the board in place (L2, MTM-scaled HP, pools empty)');
g.touch(false);
lvl(100); g.setFlags({ fire: false, spawner: true });
guard = 0; while (!g.get().bossActive && guard++ < 600) g.update(1 / 60);
g.setFlags({ fire: false, spawner: false }); g.setBossHP(1);
g.spawnBlue(g.get().bossX, g.get().bossY + 60, 0, -250, 0); step(g, 8);
ok(g.get().state === 1 && els.restart.textContent === 'Victory - Play Again', 'L100 cleared -> "Victory - Play Again"');
g.restart();
ok(g.get().level === 1 && g.get().state === 0, 'Play Again wraps to L1');

// ---------- Pool stress / soak ----------
lvl(99); g.setFlags({ fire: false, spawner: false });
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
  for (const n of [1, 12, 35, 55, 61, 90, 99, 100, 150]) {
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
  ok(maxB <= 1500 && maxR <= 500, 'soak over levels 1-150 bounded (peak blue ' + maxB + ', red ' + maxR + ')');
  ok(finite, 'soak: no NaN/Infinity positions (bumper/black-hole math is stable)'); }
process.exit(fail ? 1 : 0);
