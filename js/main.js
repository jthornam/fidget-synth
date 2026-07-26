import { DialCluster } from './dials.js';
import { ArtGen } from './gen.js';
import { AESTHETICS } from './aesthetics.js';

// v4: radius band changed again (0.65–1.25); old stored reaches would mask it.
const STORE_KEY = 'fidget-synth.pivot.v4';
const LONGPRESS_MS = 450;
const MOVE_CANCEL_PX = 12;

// Capture hooks for tools/render-assets.mjs, inert in normal use:
//   ?poster=<seed>  fixed seed, phase frozen until the first touch — which
//                   makes it double as a deep link to a moment, not dead code
//   &mode=<n>       Dial C detent to pose for the shot
//   ?bare=1         cluster centered and enlarged, rings glowing (icon shots)
const Q = new URLSearchParams(location.search);
const POSTER = Q.get('poster');
const BARE = Q.has('bare');

const artCanvas = document.getElementById('art');
const uiCanvas = document.getElementById('ui');
const ctx = uiCanvas.getContext('2d');
const gen = new ArtGen(artCanvas, POSTER != null ? parseFloat(POSTER) : null);
const cluster = new DialCluster();

// Aesthetic selection (spec §4): a wordless dot strip in the corner opposite
// the thumb. Decoupled — the strip, the ?aes= override, and persistence all
// route through setAesthetic().
const AES_KEY = 'fidget-synth.aes.v1';
let aesIndex = 0;
function setAesthetic(i, persist) {
  aesIndex = Math.min(AESTHETICS.length - 1, Math.max(0, i));
  const aes = AESTHETICS[aesIndex];
  gen.use(aes);
  cluster.modesCount = aes.modes;
  cluster.accent = aes.accent;
  if (cluster.c.idx > aes.modes - 1) cluster.c.idx = aes.modes - 1;
  cluster.c.rot = cluster.c.idx * cluster.detentStep();
  cluster.c.flash = Math.max(cluster.c.flash, 0.6);
  if (persist) {
    try { localStorage.setItem(AES_KEY, String(aesIndex)); } catch (e) { /* ignore */ }
  }
}
{
  let initial = parseInt(Q.get('aes'), 10);
  if (!isFinite(initial)) {
    try { initial = parseInt(localStorage.getItem(AES_KEY), 10) || 0; } catch (e) { initial = 0; }
  }
  setAesthetic(initial, false);
}

if (Q.get('mode') != null) {
  cluster.c.idx = Math.min(cluster.modesCount - 1, Math.max(0, parseInt(Q.get('mode'), 10) || 0));
  cluster.c.rot = cluster.c.idx * cluster.detentStep();
}
if (BARE) {
  cluster.bare = true;
  // Silhouette + one bright focal point: outer and inner rings glow hard,
  // the middle ring stays a dark silhouette between them.
  cluster.a.glow = cluster.a.glowT = 1;
  cluster.b.glow = cluster.b.glowT = 0;
  cluster.c.glow = cluster.c.glowT = 1;
}

let phaseHold = POSTER != null ? 42.0 : null;
let phaseBase = 0;

let W = 0, H = 0, DPR = 1;
let placed = false;

// The arc center sits at the thumb's base joint: just past the bottom corner
// of the holding hand, slightly off-screen.
function cornerPivot(handed) {
  return handed === 'L' ? { x: -12, y: H + 16 } : { x: W + 12, y: H + 16 };
}

// Middle-arc radius limits, as fractions of the short screen dimension.
function clampRB(r) {
  const m = Math.min(W, H);
  return Math.min(1.25 * m, Math.max(0.65 * m, r));
}

function persistPivot(rB = cluster.rB) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      handed: cluster.handed,
      rBn: rB / Math.min(W, H),
    }));
  } catch (e) { /* private mode etc.; toy degrades to re-placing each open */ }
}

function loadPivot() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p.rBn !== 'number') return null;
    return p;
  } catch (e) { return null; }
}

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  uiCanvas.width = W * DPR;
  uiCanvas.height = H * DPR;
  gen.resize(Math.round(W * DPR), Math.round(H * DPR));

  if (BARE) {
    // Centered full rings for the icon; outer ring at 80% diameter is the
    // maskable-icon safe area.
    cluster.pivot.x = W / 2;
    cluster.pivot.y = H / 2;
    cluster.rB = (Math.min(W, H) * 0.40) / cluster.relRadii[0];
    return;
  }
  if (POSTER != null) {
    cluster.handed = 'R';
    cluster.pivot = cornerPivot('R');
    cluster.rB = Math.min(W, H) * 0.62;
    return;
  }

  const stored = placed ? loadPivot() : null;
  cluster.pivot = cornerPivot(cluster.handed);
  cluster.rB = stored
    ? clampRB(stored.rBn * Math.min(W, H))
    : clampRB(Math.min(W, H) * 0.95);
}

if (POSTER != null || BARE) {
  placed = true; // posed shots never run first-touch placement
} else {
  const stored = loadPivot();
  if (stored) {
    placed = true;
    cluster.handed = stored.handed === 'L' ? 'L' : 'R';
  }
}
resize();
window.addEventListener('resize', resize);

// --- Aesthetic selector strip ----------------------------------------------
const SELECTOR_Y = 56; // clears the status bar / notch region
function selectorVisible() {
  return !BARE && !(POSTER != null && phaseHold != null);
}
function selectorDots() {
  const fromLeft = cluster.handed === 'R'; // opposite corner from the thumb
  const dots = [];
  for (let i = 0; i < AESTHETICS.length; i++) {
    const x = fromLeft ? 26 + i * 26 : W - 26 - i * 26;
    dots.push({ x, y: SELECTOR_Y, i });
  }
  return dots;
}
// TEMP: aesthetic.mode label (e.g. "2.3") so per-mode feedback can name what
// it's about. Remove once the visual set is settled — the app has no words.
function drawDebugLabel() {
  const dots = selectorDots();
  const x0 = Math.min(dots[0].x, dots[dots.length - 1].x);
  ctx.font = '11px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(170,180,190,0.55)';
  ctx.fillText((aesIndex + 1) + '.' + (cluster.mode() + 1), x0 - 4, SELECTOR_Y + 26);
}

function drawSelector() {
  for (const d of selectorDots()) {
    const act = d.i === aesIndex;
    ctx.beginPath();
    ctx.arc(d.x, d.y, act ? 4.5 : 3.2, 0, Math.PI * 2);
    if (act) {
      ctx.fillStyle = cluster.col(0.95);
      ctx.shadowColor = cluster.col(0.9);
      ctx.shadowBlur = 10;
    } else {
      ctx.fillStyle = 'rgba(150,162,174,0.45)';
    }
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// --- Intro animation (spec §5) ----------------------------------------------
// The dials play themselves for ~2.6s on every open, glowing as they move —
// wordless tutorial and standalone payoff. Any touch interrupts instantly.
let intro = null;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function startIntro() {
  if (POSTER != null || BARE) return;
  const rnd = (a, b) => a + Math.random() * (b - a);
  let target = Math.floor(Math.random() * cluster.modesCount);
  if (target === cluster.c.idx && cluster.modesCount > 1) {
    target = (target + 1) % cluster.modesCount;
  }
  intro = {
    t0: null, // set on the first rendered frame, so a hidden/backgrounded
              // load doesn't burn the intro before anyone sees it
    D: 2600,
    a: [cluster.a.value, rnd(0.15, 0.85), rnd(0.15, 0.85)],
    b: [cluster.b.value, rnd(0.15, 0.85), rnd(0.15, 0.85)],
    c0: cluster.c.rot,
    cTarget: target,
  };
}
function stopIntro() {
  if (!intro) return;
  intro = null;
  cluster.a.glowT = 0;
  cluster.b.glowT = 0;
  cluster.c.glowT = 0;
  cluster.snapC();
}
function updateIntro(now) {
  if (intro.t0 == null) intro.t0 = now;
  const e = (now - intro.t0) / intro.D;
  if (e >= 1) { stopIntro(); return; }
  const prog = (s, en) => Math.min(1, Math.max(0, (e - s) / (en - s)));
  const wp = (arr, t) => (t < 0.5
    ? arr[0] + (arr[1] - arr[0]) * easeInOut(t * 2)
    : arr[1] + (arr[2] - arr[1]) * easeInOut(t * 2 - 1));
  cluster.a.value = wp(intro.a, prog(0.05, 0.55));
  cluster.a.glowT = e > 0.05 && e < 0.55 ? 1 : 0;
  cluster.b.value = wp(intro.b, prog(0.30, 0.85));
  cluster.b.glowT = e > 0.30 && e < 0.85 ? 1 : 0;
  const cp = prog(0.55, 0.88);
  if (cp > 0) {
    const target = intro.cTarget * cluster.detentStep();
    cluster.setCRot(intro.c0 + (target - intro.c0) * easeInOut(cp));
  }
  cluster.c.glowT = e > 0.55 && e < 0.88 ? 1 : 0;
}
startIntro();

// Dev/test handle; harmless in production, no UI depends on it.
window.__fs = { cluster, introActive: () => !!intro };

// --- Interaction ------------------------------------------------------------
// Single-touch only (spec §2): one active pointer, all others ignored.
let active = null; // {type:'dial'|'bg'|'move', id, ...}

function angleTo(x, y) {
  return Math.atan2(y - cluster.pivot.y, x - cluster.pivot.x);
}

function shortestDelta(a, b) {
  let d = a - b;
  d -= Math.PI * 2 * Math.round(d / (Math.PI * 2));
  return d;
}

// First touch and long-press reposition share this: the touched point is the
// thumb tip at rest, so its side picks the corner and its distance from that
// corner becomes the middle-arc radius.
function poseFromPoint(x, y) {
  const handed = x < W / 2 ? 'L' : 'R';
  const p = (handed === 'L') ? { x: -12, y: H + 16 } : { x: W + 12, y: H + 16 };
  const rB = clampRB(Math.hypot(x - p.x, y - p.y));
  return { handed, p, rB };
}

function onDown(e) {
  if (active || !e.isPrimary) return;
  if (phaseHold != null) {
    // Release the poster hold with phase continuity — no visual jump.
    phaseBase = performance.now() / 1000 - phaseHold;
    phaseHold = null;
  }
  const x = e.clientX, y = e.clientY;
  stopIntro();

  if (selectorVisible()) {
    for (const d of selectorDots()) {
      if (Math.hypot(x - d.x, y - d.y) < 20) {
        setAesthetic(d.i, true);
        return;
      }
    }
  }

  if (!placed) {
    // The first touch places the cluster and sets handedness (spec §2).
    const pose = poseFromPoint(x, y);
    cluster.handed = pose.handed;
    cluster.placeAt(pose.p.x, pose.p.y, pose.rB);
    placed = true;
    persistPivot(pose.rB);
    return;
  }

  const ring = cluster.hitTest(x, y);
  if (ring !== null) {
    active = { type: 'dial', id: e.pointerId, ring, last: angleTo(x, y) };
    cluster.setGlow(ring, 1);
    return;
  }

  active = { type: 'bg', id: e.pointerId, x, y, moved: false };
  active.timer = setTimeout(() => {
    if (active && active.type === 'bg' && !active.moved) {
      active = { type: 'move', id: active.id };
      cluster.liftT = 1;
    }
  }, LONGPRESS_MS);
}

function onMove(e) {
  if (!active || e.pointerId !== active.id) return;
  const x = e.clientX, y = e.clientY;

  if (active.type === 'dial') {
    const ang = angleTo(x, y);
    cluster.applyDelta(active.ring, shortestDelta(ang, active.last));
    active.last = ang;
  } else if (active.type === 'move') {
    const pose = poseFromPoint(x, y);
    cluster.handed = pose.handed;
    cluster.pivot = pose.p;
    cluster.rB = pose.rB;
  } else if (active.type === 'bg' && !active.moved) {
    if (Math.hypot(x - active.x, y - active.y) > MOVE_CANCEL_PX) {
      active.moved = true;
      clearTimeout(active.timer);
    }
  }
}

function onUp(e) {
  if (!active || e.pointerId !== active.id) return;
  if (active.type === 'dial') {
    cluster.setGlow(active.ring, 0);
    if (active.ring === 2) cluster.snapC();
  } else if (active.type === 'move') {
    persistPivot();
    cluster.liftT = 0;
  } else if (active.type === 'bg') {
    clearTimeout(active.timer);
    // Horizontal background swipe steps through aesthetics (spec §4):
    // swipe left = next, right = previous. Dot strip shows where you are.
    const dx = e.clientX - active.x;
    const dy = e.clientY - active.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > 2 * Math.abs(dy)) {
      const n = AESTHETICS.length;
      setAesthetic((aesIndex + (dx < 0 ? 1 : n - 1)) % n, true);
    }
  }
  active = null;
}

window.addEventListener('pointerdown', onDown);
window.addEventListener('pointermove', onMove);
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', onUp);
window.addEventListener('contextmenu', (e) => e.preventDefault());
// Safari pinch/double-tap zoom suppression beyond touch-action.
for (const ev of ['gesturestart', 'gesturechange']) {
  window.addEventListener(ev, (e) => e.preventDefault());
}

// --- Frame loop -------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (intro) updateIntro(now);
  cluster.update(now, dt);
  gen.render(phaseHold != null ? phaseHold : now / 1000 - phaseBase, {
    a: cluster.a.value,
    b: cluster.b.value,
    mode: cluster.mode(),
  });

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  cluster.render(ctx);
  if (selectorVisible()) {
    drawSelector();
    drawDebugLabel();
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
