# Generator algorithms — recommendations (spec §9, question 1)

Ground rules that shaped every choice below, from spec §3: each mode is a pure
function `frame = f(seed, A, B, mode, phase)` — so nothing stateful (true
reaction-diffusion, particle systems, feedback buffers) is eligible, only
things expressible in a fragment shader. Each mode needs 2–3 genuinely
independent parameters, no dead zones at the extremes, and 60fps on an
iPhone 12 (practical budget: ≤5 fbm octaves, 3×3 cellular search, no
raymarching loops past ~32 steps).

Every aesthetic gets its own 3–4 modes (per-aesthetic modes, spec §2). The
aesthetics differ in *structure and rendering strategy*, not palette — that's
the §4 bar.

## 1. Organic — flow, growth, soft gradients

The shipped starting point (see `js/aesthetics.js`).

1. **Warped bands** — domain-warped fbm (`fbm(p + fbm(p))`). A: frequency.
   B: warp depth. The classic for a reason; at high warp it goes fluid.
2. **Growth rings** — radial distance field distorted by fbm, banded.
   A: ring frequency. B: distortion. Reads as tree rings / topography.
3. **Breathing cells** — voronoi with sinusoidally drifting sites, edge-lit.
   A: cell scale. B: pulse depth. The phase drift makes it feel alive at rest.
4. **Stripe interference** — two rotated sine fields multiplied. A: frequency.
   B: beam angle. Moiré-like; cheap and surprisingly deep.

To fully realize (build step 3): softer palettes (narrower cosine-palette
amplitude), gradient-based shading on the bands mode, and a wet specular hint
on cells.

## 2. Sci-fi — hard geometry, precision, luminous edges

Render strategy override: dark field, emissive edges, sharp `smoothstep`
transitions — lines glow, surfaces stay near-black.

1. **Contour circuitry** — fbm iso-lines (`fract(fbm*n)` thresholded to thin
   glowing lines), with occasional right-angle quantization of the field.
   A: contour density. B: quantization amount (flowing → circuit-board).
2. **Greebled panels** — recursive grid subdivision by hash (3–4 levels),
   each cell edge-lit, sparse cells glowing. A: subdivision depth bias.
   B: emissive fraction.
3. **Warp field** — polar starfield: radial streaks from hash-placed points,
   length modulated by phase drift. A: density. B: streak curvature (straight
   jump → spiral).

## 3. Abstract geometric — flat, constructivist, hard-edged

Render strategy override: flat fills, no gradients, no glow; 4–6 color
palette quantized from the seed; anti-aliased edges via `fwidth`.

1. **Block subdivision** — Mondrian-style recursive splits from hash.
   A: split depth. B: color-weight distribution (sparse accents → riot).
2. **Circle punch** — large overlapping discs and half-discs boolean-composed,
   Bauhaus-poster style. A: disc scale. B: overlap rule (union-ish → XOR-ish).
3. **Wedge rotation** — screen split into angular wedges from an off-center
   origin, alternating fills, phase drifts the origin slowly. A: wedge count.
   B: origin eccentricity.

## 4. Glitch — displacement, channel separation, controlled corruption

Render strategy override: a *base image* (cheap fbm field) passed through
corruption operators; the dials drive the corruption, not the base.

1. **Row shear** — horizontal slice displacement by quantized noise, RGB
   channels displaced unequally. A: shear amplitude. B: slice height.
2. **Pseudo pixel-sort** — per-column luminance ramp smears where the base
   exceeds a threshold. A: threshold (rare streaks → total melt). B: streak
   length. (True pixel-sort is stateful; a ramp-smear reads the same.)
3. **Block mosh** — the base sampled through a grid of hash-offset UV blocks,
   some blocks frozen at wrong coordinates. A: block size. B: fraction moshed.

## 5. Retro computer — phosphor, scanlines, plotter lines, limited palettes

Render strategy override: 1–2 phosphor tones on near-black, scanline overlay,
slight barrel hint. Careful: this one is closest to cliché; the modes must be
structurally interesting, not just a CRT filter.

1. **Plotter contours** — thin single-color iso-lines of an fbm height field
   with hand-wobble jitter, like pen-plotter output. A: line spacing.
   B: wobble.
2. **Lissajous phosphor** — distance-to-curve glow for a Lissajous figure
   (analytic distance approximation, no marching). A: frequency ratio
   (morphs the figure). B: decay length (crisp trace → smeared phosphor).
3. **Dither field** — an fbm field quantized through an 8×8 Bayer matrix to
   two colors, macro-blocks drifting with phase. A: field scale.
   B: quantization levels (1-bit → 4 grays).

## Mode-switch behavior

Instant swap on detent click, no crossfade. The detent flash covers the frame
of discontinuity, and a crossfade would mean rendering two modes in one frame
on the slowest supported device.

## Why not (rejected)

- **Reaction-diffusion, boids, sand/fluid sims** — stateful; violates the
  pure-function rule, and reversing a dial couldn't restore the image.
- **Raymarched 3D** — budget risk on the iPhone baseline for marginal payoff
  at phone size; every aesthetic above reads at full fidelity in 2D.
- **Feedback-buffer trails** — accumulating structure at rest, which §3
  explicitly forbids (drift yes, accumulation no).
