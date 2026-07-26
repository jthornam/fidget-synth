// Aesthetic modules. Each owns its Dial C mode set (spec §2/§4) and supplies
// one GLSL function the engine wraps:
//
//   vec3 art(vec2 uv, float A, float B, float mode, float t, float shift)
//
// Contract (spec §3): pure function of its inputs; 2–3 meaningfully
// independent params per mode; no dead zones at parameter extremes; time (t)
// feeds phase only — drift, never accumulated structure. Names are internal —
// the app shows no words. Algorithm rationale: ALGORITHMS.md.
//
// The engine's prelude provides hash/noise/fbm/pal plus the uniforms
// (uRes etc.); gl_FragCoord is available for pixel-grid effects.

export const ORGANIC = {
  id: 'organic',
  name: 'Organic',
  modes: 5,
  accent: [255, 178, 102],
  art: `
// Muted natural ramp — narrower amplitude than the stock palette.
vec3 opal(float x, float shift) {
  vec3 a = vec3(0.46, 0.45, 0.42);
  vec3 b = vec3(0.30, 0.28, 0.26);
  vec3 c = vec3(0.9, 0.75, 0.6);
  vec3 d = vec3(shift, shift + 0.28, shift + 0.55);
  return a + b * cos(6.2831 * (c * x + d));
}

vec3 art(vec2 uv, float A, float B, float mode, float t, float shift) {
  float sc = mix(1.5, 7.0, A);
  vec3 col;

  if (mode < 0.5) {
    // Warped bands with raking light. A: frequency. B: warp depth.
    vec2 q = uv * sc;
    float warp = mix(0.5, 3.0, B);
    vec2 w1 = vec2(fbm(q + t * 0.05), fbm(q + 3.7 - t * 0.04));
    float w = fbm(q + w1 * warp);
    float w2 = fbm(q + w1 * warp + vec2(0.06, 0.045));
    float grad = (w - w2) * 8.0;
    col = opal(w * 0.9 + t * 0.006, shift);
    col *= 0.72 + 0.45 * w;
    col += vec3(0.10, 0.09, 0.07) * max(0.0, grad);
    col -= vec3(0.06) * max(0.0, -grad);
    // A also drives contrast so it's never a bare zoom.
    col = (col - 0.5) * mix(0.9, 1.25, A) + 0.5;

  } else if (mode < 1.5) {
    // Growth rings with an asymmetric band profile. A: frequency. B: distortion.
    vec2 q = uv * sc;
    float rr = length(uv) * sc + fbm(q * 1.5 + t * 0.05) * mix(0.2, 2.5, B);
    float ph = fract(rr);
    float band = smoothstep(0.0, 0.35, ph) * smoothstep(1.0, 0.65, ph);
    col = opal(floor(rr) * 0.13 + shift, shift) * mix(0.30, 1.0, band);
    col += vec3(0.05) * smoothstep(0.0, 0.1, ph) * (1.0 - band);

  } else if (mode < 2.5) {
    // Breathing cells, wet-lit. A: cell scale. B: pulse depth.
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
      vec2 rv = g + o - f;
      float d = dot(rv, rv);
      if (d < d1) { d2 = d1; d1 = d; id = hash(i + g + 3.3); }
      else if (d < d2) { d2 = d; }
    }
    float edge = d2 - d1;
    col = opal(id * 0.9 + d1 * 0.5 + shift, shift);
    col *= smoothstep(0.0, 0.15, edge) * 0.85 + 0.15;
    float spec = pow(max(0.0, 1.0 - sqrt(d1) * 1.8), 8.0);
    col += vec3(0.35, 0.33, 0.28) * spec;

  } else if (mode < 3.5) {
    // Silk flow. A: scale. B: grain angle *and* fiber tightness — never a
    // bare rotation.
    float aa = B * 2.4;
    vec2 dir = vec2(cos(aa), sin(aa));
    vec2 per = vec2(-dir.y, dir.x);
    float tight = mix(1.6, 3.6, B);
    vec2 q = vec2(dot(uv, dir) * sc * 0.5, dot(uv, per) * sc * tight);
    float v = fbm(q + vec2(0.0, fbm(q * 0.8 + t * 0.05) * 1.2));
    col = opal(v + t * 0.006, shift) * (0.55 + 0.65 * v);
    col *= 0.92 + 0.08 * sin(q.y * 12.0);

  } else {
    // Spore drift: three parallax layers of soft particles. Positions are
    // pure functions of t (linear drift + micro-orbits) — a particle field,
    // not a simulation. A: density/size. B: orbit turbulence.
    col = opal(shift + 0.1, shift) * 0.10;
    for (int l = 0; l < 3; l++) {
      float fl = float(l);
      float sl = mix(3.0, 9.0, A) * (1.0 + fl * 0.9);
      vec2 q = uv * sl + vec2(t * 0.05 * (fl + 1.0), t * 0.028 * (fl * 0.7 + 1.0));
      vec2 cb = floor(q);
      // 3x3 neighborhood so a particle near a cell edge isn't clipped by it.
      for (int gy = -1; gy <= 1; gy++)
      for (int gx = -1; gx <= 1; gx++) {
        vec2 cell = cb + vec2(float(gx), float(gy));
        vec2 o = (vec2(hash(cell), hash(cell + 4.2)) - 0.5) * 0.7;
        float hp = hash(cell + 8.8) * 6.2831;
        o += B * 0.22 * vec2(sin(t * 0.5 + hp), cos(t * 0.43 + hp));
        float d = length(cell + 0.5 + o - q);
        float size = mix(0.06, 0.20, hash(cell + 2.6)) * (1.0 + fl * 0.35);
        float spot = smoothstep(size, size * 0.25, d);
        float halo = exp(-d * 9.0) * 0.25;
        vec3 tint = opal(hash(cell + 6.1) * 0.6 + shift, shift);
        col += (spot * 0.85 + halo) * tint * (1.0 - fl * 0.28);
      }
    }
  }

  return col;
}
`,
};

export const SCIFI = {
  id: 'scifi',
  name: 'Sci-fi',
  modes: 4,
  accent: [120, 210, 255],
  art: `
vec3 art(vec2 uv, float A, float B, float mode, float t, float shift) {
  vec3 bg = vec3(0.015, 0.02, 0.035);
  // Seed-varied emissive tint: cyan / white / violet.
  float hue = fract(shift * 3.0);
  vec3 em = mix(vec3(0.3, 0.9, 1.0),
                mix(vec3(0.85, 0.9, 1.0), vec3(0.7, 0.5, 1.0), step(0.66, hue)),
                step(0.33, hue));
  vec3 col = bg;

  if (mode < 0.5) {
    // Tactical topo: glowing contours + graticule + waypoint blips.
    // A: contour density. B: graticule density/strength.
    vec2 q = uv * 2.4;
    float f = fbm(q + t * 0.02);
    float n = mix(5.0, 18.0, A);
    float d = abs(fract(f * n) - 0.5);
    float line = smoothstep(0.16, 0.05, d);
    float glow = smoothstep(0.5, 0.0, d);
    float idx = floor(f * n + 0.5);
    float bright = 0.5 + 0.7 * step(0.8, hash(vec2(idx, 7.0)));
    col += em * (line * 0.85 * bright + glow * 0.10);
    float gden = mix(3.0, 14.0, B);
    vec2 gq = fract(uv * gden) - 0.5;
    float gl = smoothstep(0.02, 0.008, min(abs(gq.x), abs(gq.y)));
    col += em * gl * (0.10 + 0.15 * B);
    vec2 gid = floor(uv * gden);
    float wp = step(0.93, hash(gid + 4.4));
    float wd = length(fract(uv * gden) - 0.5);
    col += em * wp * smoothstep(0.12, 0.02, wd)
         * (0.5 + 0.5 * sin(t * 1.5 + hash(gid) * 6.2831));

  } else if (mode < 1.5) {
    // Greebled panels. A: subdivision depth bias. B: emissive fraction.
    float bias = mix(0.25, 0.9, A);
    vec2 q = uv * 3.0 + 10.0;
    float scl = 1.0;
    vec2 id = floor(q);
    for (int i = 0; i < 3; i++) {
      id = floor(q * scl);
      if (hash(id + float(i) * 13.1) > bias) break;
      scl *= 2.0;
    }
    id = floor(q * scl);
    vec2 f = fract(q * scl);
    float e = min(min(f.x, f.y), min(1.0 - f.x, 1.0 - f.y));
    float edge = smoothstep(0.05, 0.015, e) * 0.45
               + smoothstep(0.018, 0.006, e);
    float lit = step(1.0 - B * 0.35, hash(id + 3.7));
    float pulse = 0.6 + 0.4 * sin(t * 0.8 + hash(id) * 6.2831);
    col += vec3(0.03, 0.04, 0.06) * hash(id + 1.1);
    col += em * edge * 0.8;
    col += em * lit * pulse * 0.5 * (1.0 - edge);

  } else if (mode < 2.5) {
    // Warp field. A: streak density. B: curvature (jump → spiral).
    // Integer lane count + mod hides the atan wrap seam: the wrap jumps the
    // raw lane index by exactly N, which mod folds away.
    float r = length(uv) + 0.05;
    float ang = atan(uv.y, uv.x) + mix(0.0, 3.0, B) * r;
    float N = floor(mix(20.0, 90.0, A));
    float lane = mod(floor(ang / 6.2831 * N + 0.5), N);
    float ho = hash(vec2(lane, 3.3));
    float on = step(0.30, ho);
    float ph = fract(r * mix(3.0, 1.0, ho) - t * 0.05 - ho * 7.0);
    float streak = smoothstep(0.0, 0.30, ph) * smoothstep(1.0, 0.55, ph);
    float lanep = smoothstep(0.34, 0.12, abs(fract(ang / 6.2831 * N + 0.5) - 0.5));
    col += em * on * streak * lanep * smoothstep(0.1, 0.5, r) * (0.4 + 0.8 * ho);
    col += vec3(0.02, 0.03, 0.05) * fbm(uv * 3.0 + t * 0.01);

  } else {
    // Julia set with emissive escape contours. A: c angle (shape morph).
    // B: c radius (connectivity). The angle drifts slowly with phase.
    float ca = A * 6.2831 + t * 0.01;
    float cr = mix(0.55, 0.95, B);
    vec2 c = cr * vec2(cos(ca), sin(ca));
    vec2 z = uv * 1.5;
    float m = -1.0;
    float trap = 1e9;
    for (int i = 0; i < 40; i++) {
      z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
      trap = min(trap, abs(z.x * 0.707 + z.y * 0.707));
      if (dot(z, z) > 16.0) { m = float(i); break; }
    }
    if (m < 0.0) {
      col += em * exp(-trap * 22.0) * 0.5;  // interior orbit-trap filaments
    } else {
      float sm = m - log2(log(dot(z, z)) * 0.5);
      float v = clamp(sm / 40.0, 0.0, 1.0);
      float band = abs(fract(v * 9.0) - 0.5);
      col += em * smoothstep(0.32, 0.05, band) * (0.25 + 0.75 * v);
      col += em * pow(v, 2.0) * 0.35;
    }
  }

  return col;
}
`,
};

export const GEOMETRIC = {
  id: 'geometric',
  name: 'Abstract geometric',
  modes: 4,
  accent: [230, 90, 50],
  art: `
// Five-step constructivist palette, ordered by how common each should be:
// cream ground first, then three seed colors, ink last so the skew dial
// controls how rare the black slabs are.
vec3 gcol(float k, float shift) {
  float i = floor(mod(k, 5.0));
  if (i < 0.5) return vec3(0.93, 0.89, 0.82);
  if (i > 3.5) return vec3(0.12, 0.12, 0.13);
  return 0.5 + 0.45 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) * 0.9 + shift + i * 0.21));
}

vec3 art(vec2 uv, float A, float B, float mode, float t, float shift) {
  float aaw = 1.5 / min(uRes.x, uRes.y);
  vec3 col;

  if (mode < 0.5) {
    // Block subdivision. A: split depth bias. B: color-weight skew.
    float bias = mix(0.2, 0.85, A);
    vec2 q = uv * 2.2 + 5.0 + t * 0.004;
    float scl = 1.0;
    vec2 id = floor(q);
    for (int i = 0; i < 4; i++) {
      id = floor(q * scl);
      if (hash(id + float(i) * 7.7) > bias) break;
      scl *= 2.0;
    }
    id = floor(q * scl);
    vec2 f = fract(q * scl);
    float pick = pow(hash(id + 11.2), mix(2.2, 0.45, B)) * 5.0;
    vec3 fill = gcol(pick, shift);
    float e = min(min(f.x, f.y), min(1.0 - f.x, 1.0 - f.y));
    float grout = 1.0 - smoothstep(0.025, 0.025 + aaw * scl * 3.0, e);
    col = mix(fill, vec3(0.10, 0.10, 0.11), grout);

  } else if (mode < 1.5) {
    // Circle punch. A: disc scale. B: disc count — structural, not a bare
    // rotation of the composition.
    float cnt2 = mix(3.0, 9.0, B);
    float acc = 0.0;
    float rs = mix(0.22, 0.62, A);
    for (int i = 0; i < 9; i++) {
      if (float(i) >= cnt2) break;
      vec2 c = (vec2(hash(vec2(float(i), 1.3)), hash(vec2(float(i), 4.7))) - 0.5) * 1.6;
      c += 0.03 * vec2(sin(t * 0.2 + float(i)), cos(t * 0.16 + float(i) * 1.7));
      float rr = rs * mix(0.5, 1.1, hash(vec2(float(i), 9.1)));
      acc += 1.0 - smoothstep(rr - aaw, rr + aaw, length(uv - c));
    }
    col = gcol(acc, shift);

  } else if (mode < 2.5) {
    // Wedge rotation. A: wedge count. B: origin eccentricity.
    float cnt = floor(mix(3.0, 16.0, A));
    vec2 o = mix(0.0, 0.55, B)
           * vec2(cos(shift * 6.2831 + t * 0.03), sin(shift * 6.2831 + t * 0.025));
    vec2 p = uv - o;
    float w = floor((atan(p.y, p.x) / 6.2831 + 0.5) * cnt);
    float ring = floor(length(p) * mix(2.0, 5.0, fract(shift * 7.0)));
    col = gcol(hash(vec2(w, ring)) * 5.0, shift);

  } else {
    // Kaleidoscopic fold (IFS): abs-translate-rotate, six folds, flat bands
    // in folded space. A: fold rotation (symmetry family). B: fold offset
    // (structure density).
    vec2 p = uv * 1.7;
    float fa = mix(0.35, 1.05, A) + t * 0.004;
    mat2 R = mat2(cos(fa), -sin(fa), sin(fa), cos(fa));
    float off = mix(0.28, 0.62, B);
    for (int i = 0; i < 6; i++) {
      p = abs(p) - off;
      p = R * p;
    }
    float d = length(p);
    float k = floor(mod(d * 3.0, 5.0));
    col = gcol(k, shift);
    float e = abs(fract(d * 3.0) - 0.5);
    col = mix(vec3(0.10, 0.10, 0.11), col, smoothstep(0.04, 0.09, e));
  }

  return col;
}
`,
};

export const GLITCH = {
  id: 'glitch',
  name: 'Glitch',
  modes: 3,
  accent: [255, 70, 160],
  art: `
// The base image the corruption operators eat. Vivid on purpose.
vec3 gbase(vec2 p, float shift) {
  float f = fbm(p * 3.0 + fbm(p * 3.0) * 1.4);
  return pal(f * 1.1 + shift, shift) * (0.6 + 0.8 * f);
}

vec3 art(vec2 uv, float A, float B, float mode, float t, float shift) {
  vec3 col;

  if (mode < 0.5) {
    // Row shear + channel split. A: shear amplitude. B: slice height.
    float hs = mix(0.006, 0.09, B);
    float id = floor(uv.y / hs);
    float on = step(0.6, hash(vec2(id, floor(t * 0.4) + 2.0)));
    float amp = mix(0.0, 0.35, A) * (hash(vec2(id, 5.0)) * 2.0 - 1.0) * (0.35 + 0.65 * on);
    vec2 p = uv + vec2(amp, 0.0);
    col.r = gbase(p + vec2(amp * 0.6, 0.0), shift).r;
    col.g = gbase(p, shift).g;
    col.b = gbase(p - vec2(amp * 0.6, 0.0), shift).b;

  } else if (mode < 1.5) {
    // Melt (pseudo pixel-sort). A: threshold. B: streak length.
    float th = mix(0.75, 0.35, A);
    float m = fbm(vec2(uv.x * 6.0, 3.3));
    float s = smoothstep(th, th + 0.25, m);
    float anchor = fbm(vec2(uv.x * 6.0, 8.8)) * 1.2 - 0.6;
    float L = mix(0.15, 0.95, B);
    float y = mix(uv.y, anchor, s * L);
    col.r = gbase(vec2(uv.x, y + s * L * 0.012), shift).r;
    col.g = gbase(vec2(uv.x, y), shift).g;
    col.b = gbase(vec2(uv.x, y - s * L * 0.012), shift).b;
    col *= 1.0 - 0.25 * s * L;

  } else {
    // Block mosh. A: fraction moshed. B: block size.
    float gs = mix(0.03, 0.16, B);
    vec2 id = floor(uv / gs);
    float sel = step(hash(id + floor(t * 0.5) * 0.37), mix(0.05, 0.65, A));
    vec2 off = (vec2(hash(id + 2.2), hash(id + 8.4)) - 0.5) * 0.5 * sel;
    col.r = gbase(uv + off * 1.1, shift).r;
    col.g = gbase(uv + off, shift).g;
    col.b = gbase(uv + off * 0.9, shift).b;
    col = mix(col, floor(col * 6.0) / 6.0, sel);
  }

  return col;
}
`,
};

export const RETRO = {
  id: 'retro',
  name: 'Retro computer',
  modes: 3,
  accent: [140, 255, 170],
  art: `
// Seed-picked phosphor ink on near-black.
vec3 ink(float shift) {
  float k = floor(fract(shift * 5.0) * 4.0);
  if (k < 0.5) return vec3(1.0, 0.72, 0.25);
  if (k < 1.5) return vec3(0.45, 1.0, 0.55);
  if (k < 2.5) return vec3(0.65, 0.85, 1.0);
  return vec3(0.55, 1.0, 0.9);
}

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

vec3 art(vec2 uv, float A, float B, float mode, float t, float shift) {
  vec3 paper = vec3(0.03, 0.035, 0.04);
  vec3 em = ink(shift);
  vec3 col = paper;

  if (mode < 0.5) {
    // Plotter contours. A: line spacing. B: pen wobble.
    float n = mix(8.0, 30.0, A);
    vec2 q = uv * 2.6;
    q += (noise(q * 24.0) - 0.5) * 0.02 * mix(0.2, 3.0, B);
    float f = fbm(q + t * 0.008);
    float d = abs(fract(f * n) - 0.5) / n;
    float line = smoothstep(0.0030, 0.0010, d);
    float idx = floor(f * n + 0.5);
    float heavy = 1.0 + 0.6 * step(0.75, hash(vec2(idx, 3.0)));
    col += em * line * heavy;

  } else if (mode < 1.5) {
    // Oscilloscope trace with phosphor persistence. A: waveform complexity.
    // B: persistence (ghost spread + glow decay).
    float fa = mix(2.0, 14.0, A);
    float decay = mix(70.0, 16.0, B);
    for (int i = 0; i < 4; i++) {
      float gi = float(i);
      float phi = t * 0.6 - gi * mix(0.06, 0.5, B);
      float w = 0.45 * sin(uv.x * fa + phi) * sin(uv.x * 0.7 + phi * 0.31)
              + 0.12 * sin(uv.x * fa * 2.7 - phi * 1.7);
      float d = abs(uv.y - w);
      float fade = pow(0.5, gi);
      col += em * exp(-d * decay) * 0.9 * fade;
      col += em * exp(-d * decay * 5.0) * 1.1 * fade;
    }

  } else {
    // Dither field. A: field scale. B: gray levels.
    float sc2 = mix(1.2, 6.0, A);
    vec2 cell = floor(gl_FragCoord.xy / 3.0);
    float v = fbm(uv * sc2 + vec2(t * 0.01, 0.0));
    // A also mixes in fine grain so it's never a bare zoom.
    v += A * 0.45 * (fbm(uv * sc2 * 3.7 + 5.0) - 0.5);
    float L = floor(mix(1.0, 4.99, B));
    float bay = bayer4(cell) - 0.5;
    float qv = floor(v * L + 0.5 + bay * 0.9) / L;
    col += em * qv * 0.85;
  }

  // CRT scanlines over everything.
  col *= 0.88 + 0.12 * sin(gl_FragCoord.y * 1.5708);
  return col;
}
`,
};

export const AESTHETICS = [ORGANIC, SCIFI, GEOMETRIC, GLITCH, RETRO];
