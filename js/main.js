import { DialCluster, DETENT_STEP, NUM_MODES } from './dials.js';
import { ArtGen } from './gen.js';

const STORE_KEY = 'fidget-synth.pivot.v2';
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

if (Q.get('mode') != null) {
  cluster.c.idx = Math.min(NUM_MODES - 1, Math.max(0, parseInt(Q.get('mode'), 10) || 0));
  cluster.c.rot = cluster.c.idx * DETENT_STEP;
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
  return Math.min(0.78 * m, Math.max(0.42 * m, r));
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
    cluster.rB = Math.min(W, H) * 0.55;
    return;
  }

  const stored = placed ? loadPivot() : null;
  cluster.pivot = cornerPivot(cluster.handed);
  cluster.rB = stored
    ? clampRB(stored.rBn * Math.min(W, H))
    : clampRB(Math.min(W, H) * 0.62);
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

  cluster.update(now, dt);
  gen.render(phaseHold != null ? phaseHold : now / 1000 - phaseBase, {
    a: cluster.a.value,
    b: cluster.b.value,
    mode: cluster.mode(),
  });

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  cluster.render(ctx);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
