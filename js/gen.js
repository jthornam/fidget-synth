// Placeholder generator. WebGL fragment shader: frame = f(seed, A, B, mode, phase).
// No accumulating state — spec §3. Four modes stand in for one aesthetic's mode set.

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uSeed;
uniform float uA;
uniform float uB;
uniform float uMode;
uniform float uPhase;

float hash(vec2 p) {
  p = 50.0 * fract(p * 0.3183099 + vec2(0.71, 0.113) + uSeed * 0.017);
  return fract(p.x * p.y * (p.x + p.y));
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0, amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p = p * 2.03 + vec2(17.1, 9.3);
    amp *= 0.55;
  }
  return v;
}

vec3 pal(float t, float shift) {
  vec3 a = vec3(0.5);
  vec3 b = vec3(0.5);
  vec3 c = vec3(1.0, 0.9, 0.7);
  vec3 d = vec3(shift, shift + 0.33, shift + 0.67);
  return a + b * cos(6.2831 * (c * t + d));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float t = uPhase;
  float shift = fract(uSeed * 0.61803);
  // A maps to a safe scale range: no dead zones at either extreme (spec §3).
  float sc = mix(1.5, 8.0, uA);
  vec3 col;

  if (uMode < 0.5) {
    // Warped bands.
    vec2 q = uv * sc;
    float w = fbm(q + fbm(q + t * 0.05) * mix(0.5, 3.0, uB));
    col = pal(w + t * 0.006, shift);
    col *= 0.75 + 0.5 * w;

  } else if (uMode < 1.5) {
    // Warped rings.
    vec2 q = uv * sc;
    float r = length(uv) * sc + fbm(q * 1.5 + t * 0.05) * mix(0.2, 2.5, uB);
    float bands = sin(r * 6.2831) * 0.5 + 0.5;
    bands = smoothstep(0.2, 0.8, bands);
    col = pal(floor(r) * 0.15 + bands * 0.15 + shift, shift) * mix(0.35, 1.0, bands);

  } else if (uMode < 2.5) {
    // Breathing cells.
    vec2 q = uv * sc;
    vec2 i = floor(q), f = fract(q);
    float d1 = 8.0, d2 = 8.0;
    float id = 0.0;
    for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(hash(i + g), hash(i + g + 7.7));
      // Jitter capped at 0.35: keeps every nearest site inside the 3x3
      // neighborhood search, which is what kills the vertical seam artifact.
      o = 0.5 + 0.35 * sin(t * 0.35 + 6.2831 * o + uB * 4.0);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = hash(i + g + 3.3); }
      else if (d < d2) { d2 = d; }
    }
    float edge = d2 - d1;
    col = pal(id * 0.9 + d1 * 0.6 + shift, shift);
    col *= smoothstep(0.0, 0.15, edge) * 0.85 + 0.15;

  } else {
    // Stripe interference.
    float a1 = uB * 3.1416;
    float s1 = sin(dot(uv, vec2(cos(a1), sin(a1))) * sc * 6.2831 + t * 0.35);
    float s2 = sin(dot(uv, vec2(cos(a1 + 1.9), sin(a1 + 1.9))) * sc * 6.2831 - t * 0.25);
    float v = s1 * s2 * 0.5 + 0.5;
    col = pal(v * 0.8 + shift, shift) * (0.4 + 0.6 * smoothstep(0.15, 0.85, v));
  }

  col *= 1.0 - 0.35 * dot(uv, uv);
  gl_FragColor = vec4(col, 1.0);
}
`;

export class ArtGen {
  constructor(canvas, seed = null) {
    this.canvas = canvas;
    // preserveDrawingBuffer stays false for now; the PNG save (build step 6)
    // will need a same-frame readback or this flipped on.
    const gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;
    // Randomness lives here, once per open. A ?poster= seed overrides it so
    // asset captures and deep links are repeatable.
    this.seed = seed != null && isFinite(seed) ? seed : Math.random() * 100.0;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s));
      }
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.u = {};
    for (const name of ['uRes', 'uSeed', 'uA', 'uB', 'uMode', 'uPhase']) {
      this.u[name] = gl.getUniformLocation(prog, name);
    }
    gl.uniform1f(this.u.uSeed, this.seed);
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
    this.gl.uniform2f(this.u.uRes, w, h);
  }

  render(timeSec, params) {
    const gl = this.gl;
    gl.uniform1f(this.u.uA, params.a);
    gl.uniform1f(this.u.uB, params.b);
    gl.uniform1f(this.u.uMode, params.mode);
    gl.uniform1f(this.u.uPhase, timeSec);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
