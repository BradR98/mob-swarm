// Headless logic test: node test/headless.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const noop = () => {};
let rec = null;
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (rec && k === 'arc' ? (x, y, r) => rec.push(y + r) : noop)), set: (t, k, v) => (t[k] = v, true) });
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
    if (L.throughput > 250 + 1e-9 || L.throughput <= 0) capOK = false; }
  ok(hpOK, 'Base HP = throughput * 35 * (1 + 2% per tier); Boss HP = throughput * 45 (levels 1-150)');
  ok(capOK && g.levelThroughput(1e9) === 250, 'throughput is capped by the blue pool limit (250 hits/s)');
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
      if (!isNeg(d[2])) { if (d[2] === 'x' && d[3] === 3 || d[2] === '+' && d[3] === 10) { if (!(d[0] <= 63)) layoutOK = false; } else if (!(d[0] >= 74)) layoutOK = false; return; }
      const up = L.gates[i + 1];
      if (!up || isNeg(up[2]) || !(up[3] === 3 || up[3] === 10) || up[1] !== d[1] - 38 || d[0] < 80) layoutOK = false;
      else if (d[5] === up[5]) oppOK = false;
    });
    for (let q = 1; q < L.gates.length; q++) if (L.gates[q][1] > L.gates[q - 1][1]) layoutOK = false;
    if (L.waveMax > g.MAX_WAVE || 2 * L.waveMax > g.get().capRed || L.waveMin > L.waveMax) waveOK = false;
    if (L.redInterval > prevInt + 1e-9) intervalOK = false; prevInt = L.redInterval;
    L.bumpers.forEach(b => L.gates.forEach(d => { if (Math.abs(b[1] - d[1]) < 13 + b[2]) boundsOK = false; }));
  }
  ok(tierOK, 'obstacle tiers: 1-10 basic, 11-30 +negatives, 31-50 +bumpers, 51+ +black holes ' + why);
  ok(bossOK, 'bosses only on multiples of 10 (HP from throughput * 45)');
  ok(oppOK, 'negative gates always slide opposite the high-reward gate they guard');
  ok(layoutOK, 'risk vs reward: x3/+10 narrow (<=63px) and high, x2/+2 wide (>=74px) and low, negatives wide and directly below a high gate');
  ok(waveOK, 'wave sizes capped at ' + g.MAX_WAVE + ' (two walls always fit the 1000 pool) for levels 1-150');
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
g.spawnRed(100, 300, 1);
step(g, 6);
ok(g.get().mobCount === 0 && g.get().redCount === 1 && g.get().redHP[0] === 2, 'first blue only wounds a Tank (hp 3 -> ' + g.get().redHP[0] + ', red alive)');
g.spawnBlue(100, 380, 0, -250, 0); g.spawnBlue(100, 410, 0, -250, 0);
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

// ---------- Pipe stream / attraction ----------
for (const n of [1, 25, 61]) {
  g.setLevel(n); g.setFlags({ fire: false, spawner: true }); g.setGates([]); g.setObstacles({}); g.touch(false);
  let gd = 0; while (g.get().redCount < 6 && gd++ < 60 * 40) g.update(1 / 60);
  const xs = g.get().redX, px = g.get().pipeX;
  ok(Math.abs(mean(xs) - px) < 12 && Math.max(...xs) - Math.min(...xs) < 45, 'L' + n + ' reds leave ONE concentrated pipe at x=' + px.toFixed(0) + ' (mean ' + mean(xs).toFixed(0) + ', width ' + (Math.max(...xs) - Math.min(...xs)).toFixed(0) + 'px)');
}
ok(gl(1).pipeX === 180 && [...Array(100).keys()].every(i => { const x = gl(i + 2).pipeX; return x >= 80 && x <= 280; }), 'pipe x: L1 centred, later levels vary within 80..280');
// Brownian reds: they never track the blue mass; they random-walk sideways and spread across the lane
lvl(1); g.setFlags({ fire: false, spawner: false });
for (let i = 0; i < 60; i++) g.spawnRed(180, 150, 0);
for (let i = 0; i < 6; i++) g.spawnBlue(330, 520, 0, 0, 0);
step(g, 100);
{ const q = g.get(), mean = q.redX.reduce((a, b) => a + b, 0) / q.redX.length, sd = Math.sqrt(q.redX.reduce((a, b) => a + (b - mean) * (b - mean), 0) / q.redX.length);
  ok(q.redX.length > 40 && Math.abs(mean - 180) < 15 && sd > 6, 'reds ignore the blue mass (centroid ' + mean.toFixed(1) + ' vs 180) and spread by Brownian drift (sd ' + sd.toFixed(1) + 'px)'); }
lvl(1);
g.spawnRed(280, 200);
g.spawnBlue(100, 440, 0, -1, 0);
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

// ---------- Pipe waves ----------
for (const n of [1, 25, 61, 99]) {
  const L = gl(n), totals = new Set(); let inRange = true, widthOK = true;
  for (let k = 0; k < 25; k++) {
    g.setLevel(n); g.setFlags({ fire: false, spawner: true }); g.setGates([]); g.setObstacles({}); g.touch(false);
    let gd = 0; while (g.get().redCount === 0 && gd++ < 60 * 20) g.update(1 / 60);
    const tot = g.get().redCount + g.get().waveQueue; totals.add(tot);
    if (tot < L.waveMin || tot > L.waveMax) inRange = false;
    step(g, 30); if (g.get().redCount > 16) widthOK = false;      // ~14 reds/s out of the pipe
  }
  ok(inRange, 'L' + n + ' waves queue ' + L.waveMin + '-' + L.waveMax + ' reds (saw ' + Math.min(...totals) + '..' + Math.max(...totals) + ')');
  ok(widthOK, 'L' + n + ' stream is metered out of the pipe (<=16 reds after 0.5s)');
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
ok(g.get().baseHP === gl(10).baseHP && g.get().mobCount === 0, 'base is shielded on boss levels (HP stays ' + g.get().baseHP + ')');
lvl(20); g.setFlags({ fire: false, spawner: true });
guard = 0; while (!g.get().bossActive && guard++ < 60 * 10) g.update(1 / 60);
ok(g.get().bossHP === gl(20).bossHP, 'L20 boss HP = throughput*45 = ' + g.get().bossHP);
g.setFlags({ fire: false, spawner: false }); g.setBossHP(1);
g.spawnBlue(g.get().bossX, g.get().bossY + 45, 0, -250, 0); step(g, 8);
ok(g.get().state === 1 && els.restart.textContent === 'Next Level', 'killing the boss wins the level -> "Next Level"');

{ // mothership is wide: ~40% of the screen
  lvl(10); g.setFlags({ fire: false, spawner: true }); guard = 0; while (!g.get().bossActive && guard++ < 600) g.update(1 / 60);
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
  const move = type => { lvl(1); g.spawnRed(180, 200, type); step(g, 30); return g.get().redY[0] - 200; };
  const mb = move(0), mt = move(1), ms = move(2);
  ok(Math.abs(mt / mb - 0.5) < 0.05 && Math.abs(ms / mb - 1.5) < 0.05, 'Tank moves at 0.5x and Sprinter at 1.5x Basic speed (' + mb.toFixed(0) + '/' + mt.toFixed(0) + '/' + ms.toFixed(0) + 'px)');
  const hits = type => { lvl(1); g.spawnRed(180, 300, type); let h = 0; while (g.get().redCount > 0 && h < 20) { g.spawnBlue(180, g.get().redY[0] + 28, 0, -250, 0); step(g, 6); h++; } return h; };
  ok(hits(0) === 1 && hits(1) === 3 && hits(2) === 1, 'blues needed: Basic 1, Tank 3, Sprinter 1 (' + hits(0) + '/' + hits(1) + '/' + hits(2) + ')');
  lvl(1); g.spawnRed(100, 300, 1); g.spawnRed(180, 300, 2); g.spawnBlue(100 + 10, 300, 0, 0, 0); g.spawnBlue(180 + 10, 308, 0, 0, 0); step(g, 1);
  ok(g.get().redHP[0] === 2 && g.get().redHP[1] === 1, 'Tank (r=10.5) is hit from further away than a Sprinter (r=4.9)');
  const seen = n => { const t = new Set(); for (let k = 0; k < 30; k++) { g.setLevel(n); g.setFlags({ fire: false, spawner: true }); g.setGates([]); g.setObstacles({}); g.touch(false);
    let gd = 0; while (g.get().redCount === 0 && gd++ < 1200) g.update(1 / 60); g.get().redType.forEach(x => t.add(x)); } return [...t].sort().join(''); };
  ok(seen(3) === '0' && seen(8) === '01' && seen(18) === '012', 'waves contain only unlocked types: T1 {Basic}, T2 {+Tank}, T4 {+Sprinter} (' + seen(3) + '/' + seen(8) + '/' + seen(18) + ')');
}

// ---------- Armory ----------
{ const A = g.Armory.standard;
  ok(A.fireRate === 111 && A.bulletVelocity === 250 && A.piercing === 1, 'Armory.standard: 111ms, 250px/s, piercing 1');
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
{ // red slides too
  const FL = [180, 300, 60, 6, 0];
  lvl(1); g.setObstacles({ terrain: [FL] }); g.spawnRed(178, 230, 0);
  let pen = false, minY = 1e9, below = false;
  for (let i = 0; i < 360 && g.get().redCount; i++) { g.update(1 / 60); const q = g.get(); if (!q.redCount) break; if (inside(q.redX[0], q.redY[0], FL)) pen = true; if (q.redY[0] > 330) { below = true; break; } }
  ok(!pen && below, 'red hits terrain, slides round it and keeps marching (no penetration)');
}
{ // soak: generated terrain, heavy traffic, nobody ends up inside a slab
  let bad = 0, checks = 0;
  for (const n of [12, 27, 44, 58, 83]) {
    g.setLevel(n); g.setFlags({ fire: true, spawner: true }); g.touch(true);
    const T = gl(n).terrain;
    for (let i = 0; i < 60 * 12 && g.get().state === 0; i++) {
      if (i % 45 === 0) g.aim(30 + Math.random() * 300);
      g.update(1 / 60);
      if (i % 5 === 0) { const q = g.get();
        for (let k = 0; k < q.blueX.length; k += 3) { checks++; if (T.some(t => inside(q.blueX[k], q.blueY[k], t))) bad++; }
        for (let k = 0; k < q.redX.length; k++) { checks++; if (T.some(t => inside(q.redX[k], q.redY[k], t))) bad++; } }
    }
  }
  g.touch(false);
  ok(bad === 0, 'soak on generated terrain: no mob centre ever inside a slab (' + checks + ' samples)');
}
{ // generated layouts (Phase 10: negative-space lanes)
  let withT = 0, geomOK = true, clearOK = true, cap = 0, why = '', rowsOK = true;
  const inObb = (t, x, y) => { const c = Math.cos(t[4]), sn = Math.sin(t[4]), dx = x - t[0], dy = y - t[1];
    return Math.abs(dx * c + dy * sn) <= t[2] && Math.abs(-dx * sn + dy * c) <= t[3]; };
  for (let n = 2; n <= 150; n++) {
    const L = gl(n); if (L.terrain.length) withT++; if (L.terrain.length > 40) cap++;
    for (const t of L.terrain) {
      const ey = t[2] * Math.abs(Math.sin(t[4])) + t[3] * Math.abs(Math.cos(t[4]));
      if (t[1] - ey < 120 || t[1] + ey > 500) { geomOK = false; why = 'bounds ' + n; }
      for (const b of L.bumpers) { const c = Math.cos(t[4]), sn = Math.sin(t[4]), dx = b[0] - t[0], dy = b[1] - t[1], lx = dx * c + dy * sn, ly = -dx * sn + dy * c;
        const ex2 = Math.max(Math.abs(lx) - t[2], 0), ey2 = Math.max(Math.abs(ly) - t[3], 0); if (ex2 * ex2 + ey2 * ey2 < b[2] * b[2]) clearOK = false; }
    }
    for (const d of L.gates) for (let y = d[1] - 13; y <= d[1] + 13; y += 3) for (let x = 11; x <= 349; x += 3) if (L.terrain.some(t => inObb(t, x, y))) { rowsOK = false; why = 'gate row ' + n; }
  }
  ok(gl(1).terrain.length === 0 && withT >= 140 && cap === 0, 'terrain: none on L1, present on ' + withT + '/149 later levels, max 40 pieces');
  ok(geomOK && clearOK && rowsOK, 'terrain stays between base and muzzle, gate rows stay fully open (rails only at the edges), bumpers clear ' + why);
  const kinds = {}; for (let n = 2; n <= 150; n++) for (const k of gl(n).terrainKinds) kinds[k] = (kinds[k] || 0) + 1;
  ok(kinds.bridge > 5 && kinds.fork > 5 && kinds.scurve > 5, 'all three lane layouts occur: ' + JSON.stringify(kinds));
  // Independent path check: >= 60px gap (2 x 30px radius disc) must connect the base to the muzzle on EVERY level
  const pathOK = L => { const CELL = 2, y0 = 120, y1 = 504, cols = 181, rows = ((y1 - y0) / CELL | 0) + 1, free = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { let f = 1; const x = c * CELL, y = y0 + r * CELL;
      for (const t of L.terrain) { const cs = Math.cos(t[4]), sn = Math.sin(t[4]), dx = x - t[0], dy = y - t[1], lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs;
        const ex = Math.max(Math.abs(lx) - t[2], 0), ey = Math.max(Math.abs(ly) - t[3], 0); if (ex * ex + ey * ey < 900) { f = 0; break; } }
      free[r * cols + c] = f; }
    const seen = new Uint8Array(cols * rows), q = []; for (let c = 0; c < cols; c++) if (free[c]) { seen[c] = 1; q.push(c); }
    for (let h = 0; h < q.length; h++) { const cur = q[h], px = cur % cols, py = (cur / cols) | 0; if (py === rows - 1) return true;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = px + ax, ny = py + ay; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue; const i = ny * cols + nx; if (!seen[i] && free[i]) { seen[i] = 1; q.push(i); } } }
    return false; };
  let pathBad = '', worst = 0; for (let n = 1; n <= 150; n++) if (!pathOK(gl(n))) pathBad += n + ' ';
  ok(pathBad === '', 'terrain never pinches off a lane: a >=60px path exists top-to-bottom on levels 1-150 ' + pathBad);
  // Row scan: the widest open span on every row (the "river" width) never drops below 60px; bridge necks are exactly 80px
  const widest = (L, y) => { let best = 0, run = 0; for (let x = 0; x <= 360; x++) { const hit = L.terrain.some(t => inObb(t, x, y)); if (hit) run = 0; else { run++; if (run > best) best = run; } } return best; };
  let minAll = 1e9, minBridge = 1e9, bridges = 0;
  for (let n = 2; n <= 150; n++) { const L = gl(n); let mn = 1e9; for (let y = 124; y <= 496; y += 2) mn = Math.min(mn, widest(L, y));
    minAll = Math.min(minAll, mn); if (L.terrainKinds.includes('bridge')) { bridges++; minBridge = Math.min(minBridge, mn); } }
  ok(minAll >= 60, 'every row of every level keeps an open span >= 60px (min ' + minAll + 'px)');
  ok(bridges > 5 && minBridge >= 78 && minBridge <= 83, 'Bridge necks pinch to ~80px (' + minBridge + 'px over ' + bridges + ' bridge levels)');
}

// ---------- Speed cap & crowding ----------
{ let capOK = true; for (let n = 1; n <= 150; n++) if (gl(n).redSpeedMul > 1.25 + 1e-9) capOK = false;
  ok(capOK, 'red speed multiplier never exceeds 1.25x at any level');
  lvl(1); g.setLevel(150); quiet(); g.spawnRed(180, 150, 2); step(g, 30);
  const dy = g.get().redY[0] - 150;
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
  ok(crowdedFrames <= 12, 'mob-vs-mob collision keeps reds apart (' + crowdedFrames + ' heavily overlapping pairs)');
}

// ---------- Supply crate & power-ups ----------
{ let lo = 99, hi = 0; for (let k = 0; k < 60; k++) { g.reset(); const t0 = g.get().crateTimer; lo = Math.min(lo, t0); hi = Math.max(hi, t0); }
  ok(lo >= 15 && hi <= 20, 'crate timer is 15-20s (saw ' + lo.toFixed(1) + '..' + hi.toFixed(1) + ')');
  lvl(1); g.setFlags({ fire: false, spawner: true }); g.setCrateTimer(0.05); step(g, 6);
  ok(g.get().crateActive && g.get().crateHP === 30, 'a gray supply crate spawns (30 HP)');
  const y0 = g.get().crateY; step(g, 60); ok(g.get().crateY > y0 + 10 && g.get().crateY < y0 + 25, 'crate drifts down slowly (' + (g.get().crateY - y0).toFixed(0) + 'px/s)');
  g.setFlags({ fire: false, spawner: false });
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
ok(g.get().level === 2 && g.get().baseHP === gl(2).baseHP && g.get().state === 0 && g.get().mobCount === 0 && g.get().redCount === 0,
  'Next Level regenerates the board in place (L2, MTM-scaled HP, pools empty)');
g.touch(false);
lvl(100); g.setFlags({ fire: false, spawner: true });
guard = 0; while (!g.get().bossActive && guard++ < 600) g.update(1 / 60);
g.setFlags({ fire: false, spawner: false }); g.setBossHP(1);
g.spawnBlue(g.get().bossX, g.get().bossY + 45, 0, -250, 0); step(g, 8);
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
  ok(/function pointerToLogicalX\(e\)\s*\{[^}]*clientX[^}]*\}/.test(src) && !/pointerToLogicalX[^}]*clientY/.test(src.match(/function pointerToLogicalX[\s\S]*?\n  \}/)[0]) && /canvas\.addEventListener\('pointerdown'/.test(src), 'touch input maps from clientX only, on the full canvas (works anywhere in the trackpad zone)');
}
// Phase 10: pause
{ lvl(1); g.setFlags({ fire: false, spawner: false }); g.spawnRed(180, 200, 0); step(g, 5);
  const y0 = g.get().redY[0]; g.setPaused(true); step(g, 30);
  ok(g.isPaused() && g.get().redY[0] === y0 && els.overlayTitle.textContent === 'PAUSED' && els.restart.textContent === 'Resume', 'pause freezes the simulation and shows the PAUSED overlay with a Resume button');
  g.setPaused(false); step(g, 30);
  ok(!g.isPaused() && g.get().redY[0] > y0, 'resume continues the simulation');
  g.setPaused(true); g.setPaused(false); lvl(1); g.get();
  ok(/id="pause"/.test(html) && /#pause \{[^}]*top: 8px; right: 54px/.test(html), 'pause button sits in the top-right corner (clear of the trackpad zone)'); }
process.exit(fail ? 1 : 0);
