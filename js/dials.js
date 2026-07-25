// Dial cluster: three concentric arc dials whose shared center is the thumb's
// base joint — just off-screen past the bottom corner of the holding hand.
// The rings are drawn as full circles and clipped by the screen, so they read
// as arcs running off the edges. Ring 0 = A (outer), 1 = B (middle),
// 2 = C (inner, mode selector).
const TAU = Math.PI * 2;

// Feel constant — spec §2 says record what wins.
// The visible angular window from a bottom-corner pivot is ~78°; that window
// IS the full sweep: A/B run their whole range across it, and C's detents
// (one per mode of the active aesthetic) sit along it like a gauge.
export const SWEEP = (78 / 180) * Math.PI;

const COL = {
  under: 'rgba(8,10,13,0.55)',
  track: '#23282e',
  trackLit: '#2d333a',
  tick: '#49525c',
  indicator: '#9a7a50',
  glow: 'rgba(255,178,102,',   // amber phosphor; alpha appended
  flash: 'rgba(255,217,168,',
};

function cubicOut(t) { return 1 - Math.pow(1 - t, 3); }
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class DialCluster {
  constructor() {
    this.pivot = { x: 0, y: 0 };
    this.rB = 230;                   // middle-arc radius: the feel-critical length
    this.handed = 'R';
    this.relRadii = [1.30, 1.0, 0.70];
    this.a = { value: 0.62, glow: 0, glowT: 0 };
    this.b = { value: 0.38, glow: 0, glowT: 0 };
    this.c = { rot: 0, idx: 0, glow: 0, glowT: 0, flash: 0, snapping: false };
    this.lift = 0;                   // move-mode emphasis, 0..1
    this.liftT = 0;
    this.settle = null;              // {fx,fy,frB,tx,ty,trB,t0}
    this.bare = false;               // icon-capture framing: fatter, brighter
    this.modesCount = 4;             // set from the active aesthetic
  }

  detentStep() { return SWEEP / (this.modesCount - 1); }

  // Angle where value 0 sits, and the direction values grow. Right hand:
  // 187° (bottom edge) sweeping to 265° (up the right edge). Left hand is the
  // mirror: 353° sweeping down to 275°.
  baseAngle() { return ((this.handed === 'L' ? 353 : 187) / 180) * Math.PI; }
  dir() { return this.handed === 'L' ? -1 : 1; }

  radius(i) { return this.rB * this.relRadii[i]; }
  ringWidth() {
    const w = clamp(this.rB * 0.055, 10, 18);
    return this.bare ? w * 1.35 : w;
  }
  // Fixed-pixel details (tick strokes, blur radii) scale with cluster size so
  // a 1024px icon render doesn't turn them into hairlines.
  px(v) { return v * Math.max(0.8, this.rB / 230); }
  mode() { return this.c.idx; }
  ringState(i) { return i === 0 ? this.a : i === 1 ? this.b : this.c; }

  // Hit zones are bands, not strokes: each dial owns everything from its own
  // outside edge inward to the next arc's outside edge; the innermost dial
  // takes everything inside its edge. Nobody lands a thumb on a 12px arc.
  hitTest(x, y) {
    const d = Math.hypot(x - this.pivot.x, y - this.pivot.y);
    const w = this.ringWidth();
    const outer = (i) => this.radius(i) + w / 2;
    if (d > outer(0) + w * 1.2) return null; // background
    if (d > outer(1)) return 0;
    if (d > outer(2)) return 1;
    return 2;
  }

  setGlow(i, target) { this.ringState(i).glowT = target; }

  // Angular delta from the interaction layer, already in screen radians.
  // A/B: the visible window is the whole range, so value moves delta/SWEEP.
  // C: a bounded gauge — four detents along the same window.
  applyDelta(i, delta) {
    const d = this.dir() * delta;
    if (i === 2) {
      this.c.rot = clamp(this.c.rot + d, 0, SWEEP);
      this.c.snapping = false;
      const idx = clamp(Math.round(this.c.rot / this.detentStep()), 0, this.modesCount - 1);
      if (idx !== this.c.idx) {
        this.c.idx = idx;
        this.c.flash = 1;           // the visual "click"
      }
      return;
    }
    const s = this.ringState(i);
    s.value = clamp(s.value + d / SWEEP, 0, 1);
  }

  snapC() { this.c.snapping = true; }

  placeAt(x, y, rB) {
    this.settle = {
      fx: this.pivot.x, fy: this.pivot.y, frB: this.rB,
      tx: x, ty: y, trB: rB,
      t0: performance.now(),
    };
  }

  update(now, dt) {
    for (const s of [this.a, this.b, this.c]) {
      const k = s.glowT > s.glow ? 20 : 7; // fast attack, slow release
      s.glow += (s.glowT - s.glow) * (1 - Math.exp(-dt * k));
    }
    this.lift += (this.liftT - this.lift) * (1 - Math.exp(-dt * 14));
    this.c.flash = Math.max(0, this.c.flash - dt * 6);

    if (this.c.snapping) {
      const target = this.c.idx * this.detentStep();
      this.c.rot += (target - this.c.rot) * (1 - Math.exp(-dt * 16));
      if (Math.abs(target - this.c.rot) < 0.001) {
        this.c.rot = target;
        this.c.snapping = false;
      }
    }

    if (this.settle) {
      const t = Math.min(1, (now - this.settle.t0) / 250);
      const e = cubicOut(t);
      this.pivot.x = this.settle.fx + (this.settle.tx - this.settle.fx) * e;
      this.pivot.y = this.settle.fy + (this.settle.ty - this.settle.fy) * e;
      this.rB = this.settle.frB + (this.settle.trB - this.settle.frB) * e;
      if (t >= 1) this.settle = null;
    }
  }

  render(ctx) {
    const { x, y } = this.pivot;

    // Scrim seats the arcs on top of whatever the art is doing.
    const scrimR = this.radius(0) * 1.25;
    const g = ctx.createRadialGradient(x, y, this.radius(2) * 0.5, x, y, scrimR);
    g.addColorStop(0, `rgba(8,10,13,${(this.bare ? 0.72 : 0.5) + 0.2 * this.lift})`);
    g.addColorStop(1, 'rgba(8,10,13,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, scrimR, 0, TAU);
    ctx.fill();

    this.drawContinuousRing(ctx, 0, this.a);
    this.drawContinuousRing(ctx, 1, this.b);
    this.drawSelectorRing(ctx);
  }

  drawRingBase(ctx, r, w, glow) {
    const { x, y } = this.pivot;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.lineWidth = w * 1.65;
    ctx.strokeStyle = COL.under;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.lineWidth = w;
    ctx.strokeStyle = glow > 0.02 ? COL.trackLit : COL.track;
    ctx.stroke();

    if (glow > 0.02) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.lineWidth = w * 1.12;
      ctx.strokeStyle = COL.glow + ((this.bare ? 0.85 : 0.55) * glow) + ')';
      ctx.shadowColor = COL.glow + glow + ')';
      ctx.shadowBlur = this.px(18) * glow + this.px(10) * this.lift;
      ctx.stroke();
      ctx.restore();
    }
  }

  // A/B: knurled ticks rotate with the value; the brighter indicator tooth
  // travels the visible window like a gauge needle — value 0 at the bottom
  // edge, value 1 up the side edge.
  drawContinuousRing(ctx, i, s) {
    const { x, y } = this.pivot;
    const r = this.radius(i);
    const w = this.ringWidth();
    this.drawRingBase(ctx, r, w, s.glow);

    const rot = s.value * SWEEP;
    const count = 48; // full circle; the screen clips to the visible arc
    const tl = w * 0.34;
    for (let k = 0; k < count; k++) {
      const ang = this.baseAngle() + this.dir() * (rot + (k / count) * TAU);
      const cx = Math.cos(ang), sy = Math.sin(ang);
      ctx.beginPath();
      ctx.moveTo(x + cx * (r - tl), y + sy * (r - tl));
      ctx.lineTo(x + cx * (r + tl), y + sy * (r + tl));
      if (k === 0) {
        ctx.lineWidth = this.px(2.5);
        ctx.strokeStyle = s.glow > 0.02
          ? COL.glow + (0.6 + 0.4 * s.glow) + ')'
          : COL.indicator;
      } else {
        ctx.lineWidth = this.px(1.5);
        ctx.strokeStyle = s.glow > 0.02 ? '#5d6873' : COL.tick;
      }
      ctx.stroke();
    }
  }

  // C: a bounded gauge. Four fixed detent marks sit on the panel just outside
  // the arc; the pointer dot snaps between them. Flash pulses on crossings.
  drawSelectorRing(ctx) {
    const { x, y } = this.pivot;
    const r = this.radius(2);
    const w = this.ringWidth();
    const s = this.c;
    this.drawRingBase(ctx, r, w, s.glow);

    const markR = r + w * 1.35;
    for (let k = 0; k < this.modesCount; k++) {
      const ang = this.baseAngle() + this.dir() * k * this.detentStep();
      ctx.beginPath();
      ctx.arc(x + Math.cos(ang) * markR, y + Math.sin(ang) * markR, this.px(1.6), 0, TAU);
      ctx.fillStyle = COL.tick;
      ctx.fill();
    }

    const pAng = this.baseAngle() + this.dir() * s.rot;
    const px = x + Math.cos(pAng) * r;
    const py = y + Math.sin(pAng) * r;
    ctx.beginPath();
    ctx.arc(px, py, w * 0.34, 0, TAU);
    ctx.fillStyle = s.glow > 0.02 ? COL.glow + (0.7 + 0.3 * s.glow) + ')' : COL.indicator;
    if (s.glow > 0.02) {
      ctx.shadowColor = COL.glow + s.glow + ')';
      ctx.shadowBlur = this.px(12) * s.glow;
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    if (s.flash > 0.01) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.lineWidth = w * (1.2 + 0.5 * s.flash);
      ctx.strokeStyle = COL.flash + (0.55 * s.flash) + ')';
      ctx.stroke();
    }
  }
}
