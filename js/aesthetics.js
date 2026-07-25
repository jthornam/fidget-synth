// Aesthetic modules. Each owns its Dial C mode set (spec §2/§4) and supplies
// one GLSL function the engine wraps:
//
//   vec3 art(vec2 uv, float A, float B, float mode, float t, float shift)
//
// Contract (spec §3): pure function of its inputs; 2–3 meaningfully
// independent params per mode; no dead zones at parameter extremes; time (t)
// feeds phase only — drift, never accumulated structure. Names are internal —
// the app shows no words.
//
// Algorithm plans for all five aesthetics: see ALGORITHMS.md. Modules get
// added here one at a time as build step 3 realizes them.

export const ORGANIC = {
  id: 'organic',
  name: 'Organic',
  modes: 4,
  art: `
vec3 art(vec2 uv, float A, float B, float mode, float t, float shift) {
  float sc = mix(1.5, 8.0, A);
  vec3 col;

  if (mode < 0.5) {
    // Warped bands: A frequency, B warp depth.
    vec2 q = uv * sc;
    float w = fbm(q + fbm(q + t * 0.05) * mix(0.5, 3.0, B));
    col = pal(w + t * 0.006, shift);
    col *= 0.75 + 0.5 * w;

  } else if (mode < 1.5) {
    // Growth rings: A frequency, B distortion.
    vec2 q = uv * sc;
    float r = length(uv) * sc + fbm(q * 1.5 + t * 0.05) * mix(0.2, 2.5, B);
    float bands = sin(r * 6.2831) * 0.5 + 0.5;
    bands = smoothstep(0.2, 0.8, bands);
    col = pal(floor(r) * 0.15 + bands * 0.15 + shift, shift) * mix(0.35, 1.0, bands);

  } else if (mode < 2.5) {
    // Breathing cells: A cell scale, B pulse depth.
    vec2 q = uv * sc;
    vec2 i = floor(q), f = fract(q);
    float d1 = 8.0, d2 = 8.0;
    float id = 0.0;
    for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(hash(i + g), hash(i + g + 7.7));
      // Jitter capped at 0.35 keeps every nearest site inside the 3x3 search.
      o = 0.5 + 0.35 * sin(t * 0.35 + 6.2831 * o + B * 4.0);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = hash(i + g + 3.3); }
      else if (d < d2) { d2 = d; }
    }
    float edge = d2 - d1;
    col = pal(id * 0.9 + d1 * 0.6 + shift, shift);
    col *= smoothstep(0.0, 0.15, edge) * 0.85 + 0.15;

  } else {
    // Stripe interference: A frequency, B beam angle.
    float a1 = B * 3.1416;
    float s1 = sin(dot(uv, vec2(cos(a1), sin(a1))) * sc * 6.2831 + t * 0.35);
    float s2 = sin(dot(uv, vec2(cos(a1 + 1.9), sin(a1 + 1.9))) * sc * 6.2831 - t * 0.25);
    float v = s1 * s2 * 0.5 + 0.5;
    col = pal(v * 0.8 + shift, shift) * (0.4 + 0.6 * smoothstep(0.15, 0.85, v));
  }

  return col;
}
`,
};

export const AESTHETICS = [ORGANIC];
