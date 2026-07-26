# Generator algorithms — recommendations (spec §9, question 1)

Ground rules that shaped every choice below, from spec §3: each mode is a pure
function `frame = f(seed, A, B, mode, phase)` — so nothing stateful (true
reaction-diffusion, particle systems, feedback buffers) is eligible, only
things expressible in a fragment shader. Each mode needs 2–3 genuinely
independent parameters, no dead zones at the extremes, and 60fps on an
iPhone 12 (practical budget: ≤5 fbm octaves, 3×3 cellular search, no
raymarching loops past ~40 steps). And no dial may be a bare rotation or bare
zoom of the image — every parameter must change structure, even when it also
scales or turns something.

Particle *fields* are in-bounds despite the no-state rule: hash-scattered
sites whose positions are pure functions of phase (linear drift, micro-orbits)
read as particles without being a simulation. Escape-time fractals are
in-bounds too — an iteration loop is pure. Both are represented below.

Every aesthetic gets its own 3–4 modes (per-aesthetic modes, spec §2). The
aesthetics differ in *structure and rendering strategy*, not palette — that's
the §4 bar.

## 1. Organic — flow, growth, soft gradients

(A-dials reworked after playtesting: the scale/frequency params read as bare
zoom in the hand, violating the structure rule. Scales are fixed now.)

1. **Warped bands** — domain-warped fbm with raking light. A: field character
   (billowy fbm → squared-ridge turbulence, i.e. veins). B: warp depth.
2. **Growth rings** — banded distance field, asymmetric profile. A: number of
   ring nuclei (one tree-ring system → four colliding, agate-style).
   B: distortion.
3. **Breathing cells** — drifting-site voronoi, edge-lit, wet specular.
   A: cell shape (euclidean rounded → chebyshev cracked-crystal, a distance-
   metric morph). B: pulse depth.
4. **Marbled silk** — banded field pushed through comb-like warping.
   A: marbling strength (flat weave → heavy swirl). B: band count.
5. **Spore drift** — three parallax layers of hash-scattered soft particles.
   A: clustering (uniform scatter → glowing veins along a hidden field).
   B: orbit turbulence.

All five use a muted natural cosine palette (narrower amplitude than stock).

## 2. Sci-fi — hard geometry, precision, luminous edges

Render strategy override: dark field, emissive edges, sharp `smoothstep`
transitions — lines glow, surfaces stay near-black.

1. **Tactical topo** — fbm iso-lines (`fract(fbm*n)` thresholded to glowing
   contours) over a fixed fine graticule with pulsing waypoint blips.
   A: contour density. B: field turbulence (calm chart → writhing storm;
   replaced graticule density, which was too tame a dial). (The planned
   domain-quantized "circuitry" variant produced hard tile seams — snapping
   coordinates before fbm is C0 discontinuous at every cell edge — dropped.)
2. **Greebled panels** — recursive grid subdivision by hash (3–4 levels),
   each cell edge-lit, sparse cells glowing. A: subdivision depth bias.
   B: emissive fraction.
3. **Warp field** — polar starfield: radial streaks from hash-placed points,
   length modulated by phase drift. A: density. B: streak curvature (straight
   jump → spiral).
4. **Julia set** — escape-time iteration (40 steps) with emissive contour
   bands outside and orbit-trap filaments inside. A: angle of the complex
   parameter c (shape morph). B: |c| (connectivity — solid blob → dust).

## 3. Abstract geometric — flat, constructivist, hard-edged

Render strategy override: flat fills, no gradients, no glow; 4–6 color
palette quantized from the seed; anti-aliased edges via `fwidth`.

1. **Block subdivision** — Mondrian-style recursive splits from hash.
   A: split depth. B: color-weight distribution (sparse accents → riot).
2. **Circle punch** — large overlapping discs and half-discs boolean-composed,
   Bauhaus-poster style. A: disc scale. B: overlap rule (union-ish → XOR-ish).
3. **Wedge rotation** — screen split into angular wedges from an off-center
   origin, alternating fills, phase drifts the origin slowly. A: wedge count.
   B: per-ring twist — concentric rings wind into a spiral staircase
   (replaced origin eccentricity, which read as a bare pan).
4. **Kaleidoscopic fold** — six abs-translate-rotate IFS folds, flat bands by
   folded distance with dark grout. A: fold rotation (symmetry family).
   B: fold offset (structure density).

## 4. Aurora — luminous sky physics

Replaced the glitch aesthetic wholesale (playtest verdict: never loved it).
Render strategy: additive light on deep-sky gradients — a luminous flowing
family that neither organic (matte) nor sci-fi (line-emissive) covers.

1. **Curtains** — vertical light ribbons wandering by a per-ribbon sine+fbm
   path, twinkling star field behind. A: curtain count. B: waviness.
2. **Nebula** — layered fbm cloud channels mixed into violet/rose/cyan light,
   stars gated by cloud density. A: cloud character (billow → ridged wisp).
   B: star density.
3. **Plasma filaments** — squared-ridge fbm thresholded into a glowing web,
   brightness pulsing along the field. A: web connectivity (sparse arcs →
   dense web). B: energy (pulse tempo and color heat).

## 5. Retro computer — phosphor, scanlines, plotter lines, limited palettes

Render strategy override: 1–2 phosphor tones on near-black, scanline overlay,
slight barrel hint. Careful: this one is closest to cliché; the modes must be
structurally interesting, not just a CRT filter.

1. **Plotter contours** — thin iso-lines of an fbm height field with light
   pen wobble. A: line spacing. B: engraving — up to three cross-hatch
   shading layers ink in over the darker regions (replaced wobble depth,
   which was too subtle a dial).
2. **Scope trace** — phosphor glow around a single-valued waveform.
   A: waveform chaos — pure tone through harmonics into FM scream.
   B: persistence — ghost count, decay length, *and* multi-channel vertical
   spread. (Replaced the planned Lissajous: distance-to-curve needs ~100
   samples per pixel to not render as dots; a y=f(x) trace is exact and
   cheap.)
3. **Vector terrain** — ridge-silhouette layers with glowing crests over a
   perspective wireframe floor, sliced sun. A: terrain ruggedness. B: scene
   depth (ridge layer count + grid density). (Replaced the Bayer dither
   field wholesale per playtest feedback.)

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
