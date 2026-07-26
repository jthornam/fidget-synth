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

// Neutral furniture tones; everything accent-colored comes from this.accent
// (set from the active aesthetic) via this.col().
const COL = {
  under: 'rgba(6,8,10,0.40)',
  band: 'rgba(13,16,20,0.32)',
  bandLit: 'rgba(16,20,25,0.45)',
  edge: 'rgba(200,210,222,0.10)',
  tick: 'rgba(148,160,172,0.50)',
  tickLit: 'rgba(190,200,212,0.75)',
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
    this.accent = [255, 178, 102];   // set from the active aesthetic
  }

  detentStep() { return SWEEP / (this.modesCount - 1); }

  // Accent rgba; l lightens toward white (for flash pulses).
  col(a, l = 0) {
    const c = this.accent.map((v) => Math.round(v + (255 - v) * l));
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  // Set C's rotation directly — drag and intro choreography share this.
  // Clamps to the sweep, updates the detent index, flashes on crossings.
  setCRot(rot) {
    this.c.rot = clamp(rot, 0, SWEEP);
    const idx = clamp(Math.round(this.c.rot / this.detentStep()), 0, this.modesCount - 1);
    if (idx !== this.c.idx) {
      this.c.idx = idx;
      this.c.flash = 1;
    }
  }

  // Angle where value 0 sits, and the direction values grow. Right hand:
  // 187° (bottom edge) sweeping to 265° (up the right edge). Left hand is the
  // mirror: 353° sweeping down to 275°.
  baseAngle() { return ((this.handed === 'L' ? 353 : 187) / 180) * Math.PI; }
  dir() { return this.handed === 'L' ? -1 : 1; }

  radius(i) { return this.rB * this.relRadii[i]; }
  ringWidth() {
    const w = clamp(this.rB * 0.05, 12, 22);
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
      this.c.snapping = false;
      this.setCRot(this.c.rot + d);
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
    g.addColorStop(0, `rgba(8,10,13,${(this.bare ? 0.72 : 0.22) + 0.2 * this.lift})`);
    g.addColorStop(1, 'rgba(8,10,13,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, scrimR, 0, TAU);
    ctx.fill();

    this.drawZone(ctx, 0, this.a.glow);
    this.drawZone(ctx, 1, this.b.glow);
    this.drawZone(ctx, 2, this.c.glow);
    this.drawContinuousRing(ctx, 0, this.a);
    this.drawContinuousRing(ctx, 1, this.b);
    this.drawSelectorRing(ctx);
  }

  // The whole hit band is drawn, not just the arc: a transparent gradient
  // deepens toward the arc at the band's outer edge and fades to nothing at
  // the inner boundary, so the touch area visibly belongs to the dial.
  drawZone(ctx, i, glow) {
    const { x, y } = this.pivot;
    const w = this.ringWidth();
    const rOut = this.radius(i) + w / 2;
    const rIn = i < 2
      ? this.radius(i + 1) + w / 2
      : Math.max(rOut - (this.radius(1) - this.radius(2)), rOut * 0.3);

    const g = ctx.createRadialGradient(x, y, rIn, x, y, rOut);
    g.addColorStop(0, 'rgba(10,13,16,0)');
    g.addColorStop(0.7, 'rgba(10,13,16,0.16)');
    g.addColorStop(1, 'rgba(10,13,16,0.34)');
    ctx.beginPath();
    ctx.arc(x, y, rOut, 0, TAU);
    ctx.arc(x, y, rIn, 0, TAU, true);
    ctx.fillStyle = g;
    ctx.fill();

    if (glow > 0.02) {
      const ga = ctx.createRadialGradient(x, y, rIn, x, y, rOut);
      ga.addColorStop(0, this.col(0));
      ga.addColorStop(0.7, this.col(0.10 * glow));
      ga.addColorStop(1, this.col(0.22 * glow));
      ctx.beginPath();
      ctx.arc(x, y, rOut, 0, TAU);
      ctx.arc(x, y, rIn, 0, TAU, true);
      ctx.fillStyle = ga;
      ctx.fill();
    }
  }

  // Translucent glass bands: the art reads through them. Shape is carried by
  // the soft under-shadow, two thin edge lines, and the knurl ticks — not by
  // an opaque fill.
  drawRingBase(ctx, r, w, glow) {
    const { x, y } = this.pivot;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.lineWidth = w * 1.7;
    ctx.strokeStyle = COL.under;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.lineWidth = w;
    ctx.strokeStyle = glow > 0.02 ? COL.bandLit : COL.band;
    ctx.stroke();

    // Outer edge hairline only — the inner boundary stays open so the band
    // gradient reads as part of the dial, not a separate stripe.
    ctx.lineWidth = 1;
    ctx.strokeStyle = COL.edge;
    ctx.beginPath();
    ctx.arc(x, y, r + w / 2, 0, TAU);
    ctx.stroke();

    if (glow > 0.02) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.lineWidth = w * 1.12;
      ctx.strokeStyle = this.col((this.bare ? 0.85 : 0.50) * glow);
      ctx.shadowColor = this.col(glow);
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
        ctx.strokeStyle = this.col(0.55 + 0.45 * s.glow);
      } else {
        ctx.lineWidth = this.px(1.5);
        ctx.strokeStyle = s.glow > 0.02 ? COL.tickLit : COL.tick;
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
    ctx.fillStyle = this.col(0.65 + 0.35 * s.glow);
    if (s.glow > 0.02) {
      ctx.shadowColor = this.col(s.glow);
      ctx.shadowBlur = this.px(12) * s.glow;
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    if (s.flash > 0.01) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.lineWidth = w * (1.2 + 0.5 * s.flash);
      ctx.strokeStyle = this.col(0.55 * s.flash, 0.5);
      ctx.stroke();
    }
  }
}
