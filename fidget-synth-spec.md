# Generative Art Fidget — Build Spec

A one-handed, thumb-driven generative art toy for mobile web. You turn dials, art
happens. No words, no menus, no explanation needed.

**Audience:** me and my friends. Not a product. Optimize for feel, not for edge cases.

---

## 1. The feeling we're going for

An old analog synthesizer. Knobs on a panel, no labels that matter, no screens
inside screens. You turn a knob and something changes *immediately* and
*audibly* — except here it's visually. The pleasure is in the loop between hand
and output, not in understanding the system.

Two things follow from this:

- **Latency is a feature.** Regeneration must feel instant and continuous while
  dragging, not "release to render."
- **The user should never have to read anything.** If a piece of UI needs a
  label to be understood, it's the wrong piece of UI.

## 2. Interaction model

### Concentric arc dials

Three concentric arcs whose shared center is the **thumb's base joint** — just
off-screen past the bottom corner of the holding hand. The dials read as ring
segments sweeping across the screen and running off its edges; spatially
they're concentric with the joint the thumb actually rotates around, so turning
one is the thumb's natural arc, not a contortion around an on-screen point.
The arcs are the entire control surface.

- **Angular rotation only.** Touch a ring, drag around the pivot, the value
  changes with the angle. Continuous, no snapping (except the selector dial —
  see below).
- Rings should be spaced and sized so an adjacent ring is not hit by accident.
  This is the reason we're at three dials and not five. If hit-testing feels
  mushy, widen the gaps before adding rings back.
- Rings glow / brighten while being manipulated. The glow is the primary
  affordance signal.

### Dial assignment

- **Dial A — continuous parameter.** Primary shaping control.
- **Dial B — continuous parameter.** Secondary shaping control.
- **Dial C — mode selector.** Discrete detents rather than a continuous sweep.
  Rotating it swaps *which aspect of the generator* A and B are driving — a
  different algorithm, a different octave set, a different structural primitive.
  This is how we get combinatorial richness out of only three controls, and it's
  the analog to switching oscillators on a synth.

Modes are **per-aesthetic**: each aesthetic ships its own three or four modes
(count may vary by aesthetic) rather than reinterpreting one global set. Less
combinatorially pure, but it's what makes "genuinely distinct aesthetics" (§4)
achievable — an aesthetic designs variations of *its own* renderer instead of
every aesthetic implementing every mode. Switching synths gets you that synth's
oscillators.

Detents on Dial C should feel different from A and B — snappier, with a visual
"click" — so the difference in kind is legible through the hand alone. One hard
constraint here: iOS Safari exposes no vibration or haptics API, so the click
cannot literally be felt. It has to be carried by motion — the ring visibly
snapping and slightly overshooting into the detent — plus optionally the audio
tick permitted in §6.

### Dial mechanics

Feel-critical enough to pin down here rather than leave to the build:

- **Hit zones are bands, not strokes.** Each dial's touch area runs from its
  own outside edge inward to the next arc's outside edge; the innermost dial
  takes everything inside its edge. Landing a thumb on the drawn arc itself
  must never be required.
- **Delta tracking, not absolute.** Touching a ring never jumps the value to
  the touch angle; the drag applies angular delta from wherever the finger
  landed. Otherwise every touch is a glitch.
- **The visible window is the whole range.** From a corner pivot roughly 78° of
  arc is on screen, and A/B sweep their full range across exactly that window,
  gauge-style — value 0 where the arc leaves the bottom edge, value 1 where it
  leaves the side. The indicator tooth's position *is* the value; no endless
  spinning. Dial C's detents sit along the same window.
- **Gain:** full sweep = the visible window (~78°). Tune by hand from there.
  Whatever wins, record the number — this is *the* feel constant.
- **Mode switches don't reset anything.** When Dial C turns, A and B keep their
  physical positions and remap meaning. No snapping to defaults.
- **Single-touch only.** One thumb is the whole design; secondary touches are
  ignored. Simplifies hit-testing and kills a class of bugs for free.

### Handedness

Handedness is not cosmetic here. A right thumb sweeps an arc whose center sits
low and to the right; mirrored, the whole geometry fights the hand. This has to
be settable, and it has to be settable without a settings screen or the word
"left" appearing anywhere.

**Recommended approach — the first touch places the cluster.**

On first launch the intro animation plays from the default pose (right-hand
corner, mid radius). The moment the user puts a finger down anywhere on the
screen, that point is read as the thumb tip at rest: its side of the screen
picks the corner (handedness), and its distance from that corner becomes the
middle arc's radius. The cluster animates smoothly into that pose. One gesture
sets handedness *and* reach, and it's the same gesture they were going to make
anyway. There is no selection step, because the choice is inferred from the
first thing they naturally do.

Persist to `localStorage`; on subsequent launches the cluster is already in
place and the intro plays there. On those later launches a touch during the
intro takes control immediately (§5) but does **not** move the cluster —
long-press is the only re-placement gesture after first launch.

**Re-adjusting:** long-press on empty background, the cluster detaches and
follows the thumb, release to set. Same gesture works for a left-hander who got
handed the phone, or for fine-tuning pivot height. No words, no menu.

Two details that matter:

- The settle animation should be quick and confident (~250ms, eased), not a
  drifting float. It should read as the interface *snapping to your hand*, which
  is a nice moment in itself.
- The arc radius clamps to a sensible band (roughly 0.52–0.95 of the short
  screen dimension) so a touch very near or very far from the corner can't
  produce unusable geometry. The arcs running off-screen is the design, not a
  problem to clamp away.

**Fallback if first-touch inference tests badly:** play the intro animation
mirrored on both halves of the screen simultaneously and let the user tap the
one that's under their thumb. Still wordless, still one tap, but it costs a
discrete choice moment. Try the inference version first.

### Explicitly rejected (don't reintroduce these)

- **Radial / axial dragging** (pushing a dial in or out from the pivot). Too many
  degrees of freedom per ring, too fussy on a thumb.
- **Emotional or semantic axis labels** ("chaos," "joy," "order"). Adds a layer
  of translation between intent and gesture. This app has no words in it.
- **Five dials.** Tried on paper, too dense for one thumb.
- **A gallery, history, or undo.** Saving is one gesture producing one PNG
  (§3); everything else stays ephemeral. If you can't lose it, it isn't a
  fidget.

## 3. Generation

- Real-time, continuous regeneration as dials move. Target 60fps. The baseline
  device is an **iPhone 12** — "60fps" means 60fps there, not on whatever is
  newest. That makes the requirement testable.
- **Every session is different.** Seed the generator fresh on each app open so the
  same dial positions don't reproduce the same image across sessions. Within a
  session, dial positions should be stable and reversible — turn a dial back and
  you get the previous state back. Randomness lives in the seed, not in the frame
  loop.
- **A frame is a pure function:** `frame = f(seed, A, B, mode, aesthetic,
  phase)`. No hidden accumulating state anywhere in the pipeline. This is what
  makes reversibility true rather than approximate, and it constrains algorithm
  choice on purpose.
- **Alive at rest.** The art keeps moving when the thumb is still — but time
  feeds only *phase*, so things breathe and drift in place without ever
  accumulating structure. Reversibility holds for everything the dials control,
  and the intro-as-standalone-payoff (§5) lands better on a living field than
  on one that freezes the moment the animation ends.
- Canvas or WebGL. The pure-function constraint plus the framerate target
  points hard at **WebGL fragment shaders** as the default; Canvas 2D remains a
  per-aesthetic escape hatch (plotter-line styles may want it). Pick based on
  what actually holds framerate; document the choice.

### Keeping a result

Fresh seeds mean a good result is unrecoverable once the tab closes. That
ephemerality is right for this toy — no gallery, no history, no undo — but it
needs one release valve: **double-tap on empty background** exports the current
frame as a PNG through the iOS share sheet. One gesture, one image, no words.
(Long-press already means "move the cluster," which is why this is a
double-tap.)

**Please recommend the underlying algorithms.** I don't have a strong opinion
here and want your take. Constraints for your recommendation: it must expose 2–3
meaningfully independent parameters per mode, degrade gracefully at parameter
extremes (no dead zones where the canvas goes blank or solid), and run at 60fps
on mobile. **No dial may be a bare rotation or a bare zoom** of the image —
every parameter has to change structure (count, depth, distribution,
corruption), even if it also scales or turns something.

## 4. Aesthetics

Five aesthetic families. Same underlying generator and same three dials; the
aesthetic changes the visual language on top.

1. **Sci-fi** — hard geometry, precision, luminous edges
2. **Organic** — flow, growth, soft gradients, natural palettes
3. **Abstract geometric** — flat, constructivist, hard-edged shape play
4. **Glitch** — displacement, channel separation, controlled corruption
5. **Retro computer** — phosphor, scanlines, plotter lines, limited palettes

These should be genuinely distinct — if two of them are the same shapes with a
different palette swapped in, that's a failure. Each aesthetic can override
rendering strategy, not just color, and each defines its own Dial C mode set
(§2) — modes don't have to translate across aesthetics.

### Aesthetic selection — unresolved

I don't know how this should work yet, and I don't want to guess wrong before
touching it. **Build it as a simple discrete control in a corner, and keep it
architecturally decoupled** so the selection UI can be swapped without touching
the generator or the dial system.

Options I've considered and my read on each:

- A fourth outer ring — rejected for now, forces the thumb to contort.
- A plain button/tab bar — functional but reads as bolted-on UI chrome.
- Long-press or double-tap to enter an "aesthetic mode" where the dials
  temporarily select aesthetic instead of art — closest to what I want, but
  possibly a discoverability problem.
- Freezing the aesthetic mid-intro-animation by tapping — interesting, unproven.

If you have a better idea once the dials are actually working, propose it.

## 5. Intro animation

On every app open, a **2–3 second autonomous animation**:

- The dials turn by themselves, glowing as they move.
- The art field generates live, in sync with the dial movement.
- Then the app hands control to the user with no transition ceremony.

This does two jobs:

1. **Wordless tutorial.** It shows that the rings are touchable and that they
   drive the output, without a tooltip or an onboarding screen. This is the
   actual fix for "my friends open the thing and don't know what to do."
2. **Standalone payoff.** The animation is randomized every launch, so opening
   the app for three seconds, watching it make something, and closing it is a
   complete and satisfying use of the app. Treat this as a first-class use case,
   not a preamble to skip.

Should be interruptible — a touch during the animation takes control immediately.
On first launch that interrupting touch is also what sets handedness and reach
(see §2), so the animation must look right playing from the default right-hand
pose as well as from any re-posed geometry.

## 6. Sound

There isn't any. The synth is a metaphor. One permitted exception: a tiny dry
tick on Dial C detents if it helps the click read (§2) — nothing else makes
sound, ever.

## 7. Deployment

- Static site, no backend.
- GitHub repo → Cloudflare Pages, deploy on push.
- Primary target: Safari on iPhone. Desktop can look broken; don't spend time
  there.
- **Portrait only**, locked via manifest/CSS — the pivot geometry assumes it.
- Should work added-to-homescreen (fullscreen, no browser chrome, no bounce
  scroll, no text selection or callout menus on drag).

## 8. Visual quality bar

The most important non-functional requirement: **this must not look like default
AI-generated work.**

Concretely, avoid: warm cream backgrounds with a serif display face and a
terracotta accent; near-black with a single acid-green accent; generic glassmorphic
panels; gradient-on-everything. These are the current house style of generated
UI and they read as a tell.

Instead, derive the interface's look from its own subject — analog synth panels,
oscilloscopes, control surfaces, plotter output. The dial furniture itself
(rings, glow, detent marks) is the signature element; everything around it should
be quiet. Spend the boldness there.

## 9. Open questions for you

Answer these with a recommendation and a reason, don't just ask me back:

1. What generative algorithms for the five aesthetics? (see §3)
2. Is three dials actually right, or does the mode-selector approach free up
   room for a fourth? Prototype and tell me how it feels.
3. Does first-touch pivot placement (§2) actually feel good, or is the first
   touch too loaded to also be doing setup work? Report back after trying it.
4. Verify the WebGL-fragment-shader default (§3) actually holds framerate on
   the baseline device; fall back per-aesthetic if it doesn't.
5. Better idea for aesthetic selection? (see §4)

## 10. Build order

1. Three dials, hit-testing, angular tracking, glow, and first-touch pivot
   placement. One placeholder generator. Get the *feel* right before anything
   else — if the drag doesn't feel good, nothing else matters.
2. Real generator + Dial C mode switching.
3. One aesthetic, fully realized. Then the other four.
4. Intro animation with per-launch randomization.
5. Aesthetic selection UI (last, deliberately).
6. Double-tap PNG save (§3), deploy config, homescreen behavior.
