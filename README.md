# fidget synth

A one-handed, thumb-driven generative art toy. Turn the dials; art happens.

Live: https://fidget-synth.pages.dev

- Static site, no build step. Serve the repo root with any static server
  (`python3 -m http.server`) to run locally.
- `node tools/render-assets.mjs` regenerates the link card (`og.png`) and the
  icon set by screenshotting the page itself (needs Chrome installed).
- Design spec: [fidget-synth-spec.md](fidget-synth-spec.md)
- Generator algorithm plans: [ALGORITHMS.md](ALGORITHMS.md)
