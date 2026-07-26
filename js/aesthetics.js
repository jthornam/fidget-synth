// Aesthetic modules. Each owns its Dial C mode set (spec §2/§4) and supplies
// one GLSL function the engine wraps:
//
//   vec3 art(vec2 uv, float A, float B, float mode, float t, float shift)
//
// Contract (spec §3): pure function of its inputs; 2–3 meaningfully
// independent params per mode; no dead zones at parameter extremes; time (t)
// feeds phase only — drift, never accumulated structure; and no dial is a
// bare rotation or zoom. Names are internal — the app shows no words.
// Algorithm rationale: ALGORITHMS.md.

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
  vec3 col;

  if (mode < 0.5) {
    // Warped bands. A: field character — billowy fbm morphs into ridged
    // turbulence (veins). B: warp depth. Scale is fixed on purpose.
    vec2 q = uv * 3.4;
    float warp = mix(0.5, 3.0, B);
    vec2 w1 = vec2(fbm(q + t * 0.05), fbm(q + 3.7 - t * 0.04));
    float wf = fbm(q + w1 * warp);
    float wr = 1.0 - abs(2.0 * wf - 1.0);
    float w = mix(wf, wr * wr, A);
    float w2f = fbm(q + w1 * warp + vec2(0.06, 0.045));
    float w2r = 1.0 - abs(2.0 * w2f - 1.0);
    float w2 = mix(w2f, w2r * w2r, A);
    float grad = (w - w2) * 8.0;
    col = opal(w * 0.9 + t * 0.006, shift);
    col *= 0.72 + 0.45 * w;
    col += vec3(0.10, 0.09, 0.07) * max(0.0, grad);
    col -= vec3(0.06) * max(0.0, -grad);

  } else if (mode < 1.5) {
    // Growth rings. A: number of ring nuclei — one tree ring system up to
    // four colliding ones, agate-style. B: distortion.
    vec2 q = uv * 4.2;
    float cnt = 1.0 + floor(A * 3.99);
    float rr = 1e9;
    for (int i = 0; i < 4; i++) {
      if (float(i) >= cnt) break;
      vec2 cc = (vec2(hash(vec2(float(i), 2.2)), hash(vec2(float(i), 6.6))) - 0.5)
              * vec2(1.4, 2.2);
      rr = min(rr, length(uv - cc));
    }
    rr = rr * 4.2 + fbm(q * 1.5 + t * 0.05) * mix(0.2, 2.5, B);
    float ph = fract(rr);
    float band = smoothstep(0.0, 0.35, ph) * smoothstep(1.0, 0.65, ph);
    col = opal(floor(rr) * 0.13 + shift, shift) * mix(0.30, 1.0, band);
    col += vec3(0.05) * smoothstep(0.0, 0.1, ph) * (1.0 - band);

  } else if (mode < 2.5) {
    // Breathing cells. A: cell shape — rounded voronoi morphs to cracked
    // crystal via the distance metric. B: pulse depth.
    vec2 q = uv * 4.5;
    vec2 i = floor(q), f = fract(q);
    float d1 = 8.0, d2 = 8.0;
    float id = 0.0;
    for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(hash(i + g), hash(i + g + 7.7));
      o = 0.5 + 0.35 * sin(t * 0.35 + 6.2831 * o + B * 4.0);
      vec2 rv = g + o - f;
      vec2 av = abs(rv);
      float dC = max(av.x, av.y);
      float d = mix(dot(rv, rv), dC * dC, A);
      if (d < d1) { d2 = d1; d1 = d; id = hash(i + g + 3.3); }
      else if (d < d2) { d2 = d; }
    }
    float edge = d2 - d1;
    col = opal(id * 0.9 + d1 * 0.5 + shift, shift);
    col *= smoothstep(0.0, 0.15, edge) * 0.85 + 0.15;
    float spec = pow(max(0.0, 1.0 - sqrt(d1) * 1.8), 8.0);
    col += vec3(0.35, 0.33, 0.28) * spec;

  } else if (mode < 3.5) {
    // Marbled silk. A: marbling comb strength — flat weave to heavy swirl.
    // B: band count.
    vec2 q = uv * 2.2;
    float freq = mix(4.0, 18.0, B);
    float sw = mix(0.15, 2.6, A);
    float wv = fbm(q * 1.6 + t * 0.04);
    float y2 = q.y + sw * (0.5 * sin(q.x * 3.0 + wv * 4.0) + wv);
    float v = sin(y2 * freq) * 0.5 + 0.5;
    v = smoothstep(0.12, 0.88, v);
    col = opal(floor(y2 * freq / 6.2831) * 0.11 + shift, shift);
    col = mix(col * 0.35, col * 1.15, v);
    col *= 0.94 + 0.06 * sin(q.x * 60.0);

  } else {
    // Spore drift. A: clustering — uniform scatter condenses into glowing
    // veins along an invisible field. B: orbit turbulence.
    col = opal(shift + 0.1, shift) * 0.10;
    for (int l = 0; l < 3; l++) {
      float fl = float(l);
      float sl = 6.0 * (1.0 + fl * 0.9);
      vec2 q = uv * sl + vec2(t * 0.05 * (fl + 1.0), t * 0.028 * (fl * 0.7 + 1.0));
      vec2 cb = floor(q);
      for (int gy = -1; gy <= 1; gy++)
      for (int gx = -1; gx <= 1; gx++) {
        vec2 cell = cb + vec2(float(gx), float(gy));
        vec2 o = (vec2(hash(cell), hash(cell + 4.2)) - 0.5) * 0.7;
        float hp = hash(cell + 8.8) * 6.2831;
        o += B * 0.22 * vec2(sin(t * 0.5 + hp), cos(t * 0.43 + hp));
        vec2 site = cell + 0.5 + o;
        float fv = fbm(site / sl * 3.2);
        float wgt = mix(1.0, smoothstep(0.42, 0.62, fv) * 2.2, A);
        float d = length(site - q);
        float size = mix(0.06, 0.20, hash(cell + 2.6)) * (1.0 + fl * 0.35)
                   * mix(1.0, 0.5 + 1.6 * fv, A);
        float spot = smoothstep(size, size * 0.25, d);
        float halo = exp(-d * 9.0) * 0.25;
        vec3 tint = opal(hash(cell + 6.1) * 0.6 + shift, shift);
        col += (spot * 0.85 + halo) * tint * (1.0 - fl * 0.28) * wgt;
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
  float hue = fract(shift * 3.0);
  vec3 em = mix(vec3(0.3, 0.9, 1.0),
                mix(vec3(0.85, 0.9, 1.0), vec3(0.7, 0.5, 1.0), step(0.66, hue)),
                step(0.33, hue));
  vec3 col = bg;

  if (mode < 0.5) {
    // Tactical topo. A: contour density. B: field turbulence — calm chart
    // to writhing storm. Graticule is fixed furniture now.
    vec2 q = uv * 2.4;
    float f = fbm(q + mix(0.0, 2.2, B) * fbm(q * 2.3 + t * 0.05) + t * 0.02);
    float n = mix(5.0, 18.0, A);
    float d = abs(fract(f * n) - 0.5);
    float line = smoothstep(0.16, 0.05, d);
    float glow = smoothstep(0.5, 0.0, d);
    float idx = floor(f * n + 0.5);
    float bright = 0.5 + 0.7 * step(0.8, hash(vec2(idx, 7.0)));
    col += em * (line * 0.85 * bright + glow * 0.10);
    vec2 gq = fract(uv * 7.0) - 0.5;
    float gl = smoothstep(0.02, 0.008, min(abs(gq.x), abs(gq.y)));
    col += em * gl * 0.14;
    vec2 gid = floor(uv * 7.0);
    float wp = step(0.93, hash(gid + 4.4));
    float wd = length(fract(uv * 7.0) - 0.5);
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
      col += em * exp(-trap * 22.0) * 0.5;
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
    // Circle punch. A: disc scale. B: disc count.
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
    // Wedge rotation. A: wedge count. B: per-ring twist — flat pinwheel
    // winds into a spiral staircase (replaces the bare origin pan).
    float cnt = floor(mix(3.0, 16.0, A));
    vec2 o = 0.15 * vec2(cos(shift * 6.2831 + t * 0.03), sin(shift * 6.2831 + t * 0.025));
    vec2 p = uv - o;
    float ring = floor(length(p) * mix(2.0, 5.0, fract(shift * 7.0)));
    float twist = mix(0.0, 0.45, B);
    float w = floor((atan(p.y, p.x) / 6.2831 + 0.5 + ring * twist) * cnt);
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

// Replaced the glitch aesthetic wholesale (feedback: never loved it).
// Aurora: luminous sky physics — a family none of the other four covers.
export const AURORA = {
  id: 'aurora',
  name: 'Aurora',
  modes: 3,
  accent: [140, 235, 190],
  art: `
vec3 art(vec2 uv, float A, float B, float mode, float t, float shift) {
  vec3 col;

  if (mode < 0.5) {
    // Aurora curtains. A: curtain count. B: waviness.
    col = mix(vec3(0.012, 0.02, 0.055), vec3(0.03, 0.015, 0.07), uv.y + 0.5);
    vec2 sq = uv * 22.0;
    vec2 sc = floor(sq);
    float st = step(0.93, hash(sc)) * smoothstep(0.12, 0.02, length(fract(sq) - 0.5));
    col += vec3(0.8, 0.85, 1.0) * st * (0.4 + 0.3 * sin(t + hash(sc + 3.3) * 6.2831));
    float cnt = 2.0 + floor(A * 4.99);
    for (int i = 0; i < 7; i++) {
      if (float(i) >= cnt) break;
      float fi = float(i);
      float ph = hash(vec2(fi, 9.1)) * 6.2831;
      float wav = mix(1.2, 4.5, B);
      float cx = (hash(vec2(fi, 1.7)) - 0.5) * 1.3
               + 0.45 * sin(uv.y * wav + ph + t * 0.12)
               + 0.25 * fbm(vec2(uv.y * wav * 0.7 + fi * 7.0, t * 0.05));
      float d = abs(uv.x - cx);
      float w = mix(0.025, 0.09, hash(vec2(fi, 5.5)));
      float g = exp(-(d * d) / (w * w));
      vec3 ac = mix(vec3(0.15, 1.0, 0.5), vec3(0.5, 0.3, 1.0), hash(vec2(fi, 7.7)));
      float hgt = smoothstep(-1.1, -0.2, uv.y);
      col += ac * g * 0.6 * (0.6 + 0.4 * sin(t * 0.35 + ph + uv.y * 2.0)) * hgt;
    }

  } else if (mode < 1.5) {
    // Nebula. A: cloud character — billow to wisp (ridged mix).
    // B: star density.
    vec2 q = uv * 2.3;
    float n1 = fbm(q + fbm(q + t * 0.015) * 1.6);
    float r1 = 1.0 - abs(2.0 * n1 - 1.0);
    float n = mix(n1, r1 * r1, A);
    float n2 = fbm(q * 1.7 + 4.7 - t * 0.01);
    col = vec3(0.015, 0.012, 0.045);
    col += pow(n, 2.2) * vec3(0.35, 0.15, 0.6) * 1.4;
    col += pow(n2 * n, 3.0) * vec3(0.9, 0.35, 0.45) * 1.2;
    col += pow(n * (1.0 - n2), 4.0) * vec3(0.2, 0.7, 0.9);
    vec2 sq = uv * 30.0;
    vec2 id2 = floor(sq);
    float st = step(1.0 - B * 0.12, hash(id2))
             * smoothstep(0.35, 0.05, length(fract(sq) - 0.5));
    col += vec3(0.9, 0.9, 1.0) * st * (0.5 + 0.5 * sin(t * 1.3 + hash(id2 + 7.7) * 6.2831))
         * (0.4 + n * 1.6);

  } else {
    // Plasma filaments. A: web connectivity — sparse arcs to dense web.
    // B: energy — pulse tempo and color heat.
    vec2 q = uv * 2.6;
    float r = 1.0 - abs(2.0 * fbm(q + 0.35 * fbm(q * 2.1 + t * 0.04)) - 1.0);
    float th = mix(0.86, 0.62, A);
    float fil = pow(smoothstep(th, 0.99, r), 3.0);
    float pulse = 0.55 + 0.45 * sin(fbm(q * 1.4) * 14.0 - t * mix(0.6, 3.2, B));
    vec3 cool = vec3(0.25, 0.55, 1.0);
    vec3 hot = vec3(1.0, 0.5, 0.75);
    col = vec3(0.012, 0.015, 0.035);
    col += fbm(q * 0.5) * vec3(0.025, 0.025, 0.06);
    col += mix(cool, hot, B * pulse) * fil * (0.7 + 1.0 * pulse);
    col += mix(cool, hot, B) * pow(r, 12.0) * 0.35;
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

vec3 art(vec2 uv, float A, float B, float mode, float t, float shift) {
  vec3 paper = vec3(0.03, 0.035, 0.04);
  vec3 em = ink(shift);
  vec3 col = paper;

  if (mode < 0.5) {
    // Plotter contours. A: line spacing. B: engraving — cross-hatch shading
    // layers ink in over the darker regions as B rises.
    float n = mix(8.0, 30.0, A);
    vec2 q = uv * 2.6;
    q += (noise(q * 24.0) - 0.5) * 0.012;
    float f = fbm(q + t * 0.008);
    float d = abs(fract(f * n) - 0.5) / n;
    float line = smoothstep(0.0030, 0.0010, d);
    float idx = floor(f * n + 0.5);
    float heavy = 1.0 + 0.6 * step(0.75, hash(vec2(idx, 3.0)));
    col += em * line * heavy;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float on = smoothstep(0.10 + fi * 0.28, 0.30 + fi * 0.28, B);
      float lvl = 0.62 - fi * 0.16;
      float ang2 = 0.7 + fi * 0.55;
      vec2 hd = vec2(cos(ang2), sin(ang2));
      float hl = abs(fract(dot(q, hd) * 14.0) - 0.5);
      float hline = smoothstep(0.18, 0.05, hl);
      col += em * hline * 0.28 * on * smoothstep(lvl + 0.06, lvl - 0.06, f);
    }

  } else if (mode < 1.5) {
    // Scope trace. A: waveform chaos — pure tone to FM scream.
    // B: persistence — ghost count, decay, and channel spread.
    float fa = mix(2.0, 9.0, A);
    float fmA = pow(A, 2.0) * 3.5;
    float decay = mix(70.0, 18.0, B);
    float cntT = 3.0 + floor(B * 4.99);
    for (int i = 0; i < 8; i++) {
      if (float(i) >= cntT) break;
      float gi = float(i);
      float phi = t * 0.6 - gi * mix(0.06, 0.4, B);
      float w = 0.42 * sin(uv.x * fa + phi + fmA * sin(uv.x * fa * 2.33 + phi * 1.3));
      w *= mix(1.0, 0.6 + 0.4 * sin(uv.x * 0.9 + phi * 0.27), 0.6);
      float d = abs(uv.y - w - (gi - (cntT - 1.0) * 0.5) * mix(0.0, 0.16, B));
      float fade = pow(0.6, gi);
      col += em * exp(-d * decay) * 0.85 * fade;
      col += em * exp(-d * decay * 5.0) * 1.0 * fade;
    }

  } else {
    // Vector terrain: ridge silhouettes over a perspective wireframe floor.
    // Replaces the dither field wholesale. A: terrain ruggedness.
    // B: scene depth — ridge layers and grid density.
    col = mix(vec3(0.008, 0.01, 0.02), vec3(0.03, 0.02, 0.05), uv.y + 0.5);
    float hor = 0.06;
    float sd = length(uv - vec2(0.30, 0.34));
    float sun = smoothstep(0.15, 0.142, sd)
              * (0.6 + 0.4 * step(0.5, fract(uv.y * 26.0)));
    col += em * sun * 0.5;
    float layers = 2.0 + floor(B * 2.99);
    float rug = mix(0.04, 0.20, A);
    for (int i = 0; i < 4; i++) {
      if (float(i) >= layers) break;
      float fi = float(i);
      float yBase = hor + 0.16 - fi * 0.055;
      float amp = (0.35 + fi * 0.3) * rug;
      float ry = yBase
               + (fbm(vec2(uv.x * mix(1.5, 4.0, A) * (1.0 + fi * 0.6) + fi * 13.0 + t * 0.008 * (fi + 1.0), fi * 3.3)) - 0.5)
               * 2.0 * amp;
      float below = smoothstep(0.004, -0.004, uv.y - ry);
      col = mix(col, vec3(0.010, 0.016, 0.026) * (1.0 - fi * 0.12), below * 0.88);
      col += em * exp(-abs(uv.y - ry) * 90.0) * (1.0 - fi * 0.18);
    }
    if (uv.y < hor) {
      float z = 1.0 / (hor - uv.y + 0.02);
      float gden = mix(2.0, 6.0, B);
      float lx = abs(fract(uv.x * z * gden * 0.5) - 0.5);
      float lz = abs(fract(z * gden * 0.6 - t * 0.25) - 0.5);
      float wpx = 0.12 * (hor - uv.y + 0.05);
      float gl = smoothstep(wpx, wpx * 0.3, lx) + smoothstep(wpx, wpx * 0.3, lz);
      float fog = smoothstep(hor, hor - 0.5, uv.y);
      col = vec3(0.008, 0.01, 0.018);
      col += em * min(gl, 1.0) * 0.5 * fog;
    }
  }

  // CRT scanlines over everything.
  col *= 0.88 + 0.12 * sin(gl_FragCoord.y * 1.5708);
  return col;
}
`,
};

export const AESTHETICS = [ORGANIC, SCIFI, GEOMETRIC, AURORA, RETRO];
