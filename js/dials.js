// Dial cluster: three concentric rings around a thumb pivot.
// Ring 0 = A (outer, continuous), ring 1 = B (middle, continuous),
// ring 2 = C (inner, mode selector with detents).
//
// Feel constants live here — spec §2 says record what wins.
export const NUM_MODES = 4;
export const GAIN = 1.0;             // revolutions per full parameter sweep
export const DETENT_STEP = Math.PI / 4; // 45° per detent on Dial C
const TAU = Math.PI * 2;

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

export class DialCluster {
  constructor() {
    this.pivot = { x: 0, y: 0 };
    this.outerR = 140;
    this.relRadii = [1.0, 0.71, 0.44];
    this.hitHalf = 0.115;            // hit band half-width as fraction of outerR
    this.a = { value: 0.62, glow: 0, glowT: 0 };
    this.b = { value: 0.38, glow: 0, glowT: 0 };
    this.c = { rot: 0, idx: 0, glow: 0, glowT: 0, flash: 0, snapping: false };
    this.lift = 0;                   // move-mode emphasis, 0..1
    this.liftT = 0;
    this.settle = null;              // {fx,fy,tx,ty,t0} placement animation
    this.bare = false;               // icon-capture framing: fatter, brighter
  }

  radius(i) { return this.outerR * this.relRadii[i]; }
  ringWidth() { return this.outerR * (this.bare ? 0.115 : 0.085); }
  // Fixed-pixel details (tick strokes, blur radii) scale with cluster size so
  // a 1024px icon render doesn't turn them into hairlines.
  px(v) { return v * (this.outerR / 140); }
  mode() { return ((this.c.idx % NUM_MODES) + NUM_MODES) % NUM_MODES; }
  ringState(i) { return i === 0 ? this.a : i === 1 ? this.b : this.c; }

  hitTest(x, y) {
    const d = Math.hypot(x - this.pivot.x, y - this.pivot.y);
    const half = this.outerR * this.hitHalf;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d - this.radius(i)) <= half) return i;
    }
    return null;
  }

  setGlow(i, target) { this.ringState(i).glowT = target; }

  // Angular delta from the interaction layer. A/B: value clamps, and the ring's
  // visible rotation is tied to value, so hitting an end reads as the ring
  // stopping under the finger. C: rotation is free; nearest detent is the mode.
  applyDelta(i, delta) {
    if (i === 2) {
      this.c.rot += delta;
      this.c.snapping = false;
      const idx = Math.round(this.c.rot / DETENT_STEP);
      if (idx !== this.c.idx) {
        this.c.idx = idx;
        this.c.flash = 1;           // the visual "click"
      }
      return;
    }
    const s = this.ringState(i);
    s.value = Math.min(1, Math.max(0, s.value + (delta / TAU) * GAIN));
  }

  snapC() { this.c.snapping = true; }

  placeAt(x, y) {
    this.settle = {
      fx: this.pivot.x, fy: this.pivot.y,
      tx: x, ty: y,
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
      const target = this.c.idx * DETENT_STEP;
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
      if (t >= 1) this.settle = null;
    }
  }

  render(ctx) {
    const { x, y } = this.pivot;
    const w = this.ringWidth();

    // Scrim seats the cluster on top of whatever the art is doing.
    const scrimR = this.outerR * 1.4;
    const g = ctx.createRadialGradient(x, y, this.radius(2) * 0.4, x, y, scrimR);
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

  // A/B: knurled ticks rotate with value (rotation = value * GAIN revolutions),
  // one brighter indicator tooth so position and motion are legible.
  drawContinuousRing(ctx, i, s) {
    const { x, y } = this.pivot;
    const r = this.radius(i);
    const w = this.ringWidth();
    this.drawRingBase(ctx, r, w, s.glow);

    const rot = (s.value / GAIN) * TAU;
    const count = 28;
    const tl = w * 0.34;
    for (let k = 0; k < count; k++) {
      const ang = rot + (k / count) * TAU;
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

  // C: a single pointer dot rotates; fixed detent marks sit just outside the
  // ring on the panel. Flash pulses on every detent crossing.
  drawSelectorRing(ctx) {
    const { x, y } = this.pivot;
    const r = this.radius(2);
    const w = this.ringWidth();
    const s = this.c;
    this.drawRingBase(ctx, r, w, s.glow);

    const markR = r + w * 1.35;
    for (let k = 0; k < TAU / DETENT_STEP; k++) {
      const ang = k * DETENT_STEP;
      ctx.beginPath();
      ctx.arc(x + Math.cos(ang) * markR, y + Math.sin(ang) * markR, this.px(1.6), 0, TAU);
      ctx.fillStyle = COL.tick;
      ctx.fill();
    }

    const px = x + Math.cos(s.rot) * r;
    const py = y + Math.sin(s.rot) * r;
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
