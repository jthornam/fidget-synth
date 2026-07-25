// Render engine. Compiles an aesthetic module's `art()` GLSL function into a
// full-screen fragment shader and renders it as a pure function of
// (seed, A, B, mode, phase) — no accumulating state anywhere (spec §3).
// Aesthetic modules live in aesthetics.js and only supply GLSL; everything
// WebGL-shaped stays here.

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

// Shared toolkit every aesthetic can rely on. hash is iq's — the classic
// fract(p.x*p.y) tutorial hash has axis-aligned correlations that show up as
// hard vertical seams in cellular patterns.
const PRELUDE = `
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
`;

const POSTLUDE = `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float shift = fract(uSeed * 0.61803);
  vec3 col = art(uv, uA, uB, uMode, uPhase, shift);
  col *= 1.0 - 0.35 * dot(uv, uv);
  gl_FragColor = vec4(col, 1.0);
}
`;

const UNIFORMS = ['uRes', 'uSeed', 'uA', 'uB', 'uMode', 'uPhase'];

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

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    this.programs = new Map(); // aesthetic.id -> {prog, u}
    this.current = null;
    this.w = 0;
    this.h = 0;
  }

  compile(type, src) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  use(aesthetic) {
    const gl = this.gl;
    let entry = this.programs.get(aesthetic.id);
    if (!entry) {
      const prog = gl.createProgram();
      gl.attachShader(prog, this.compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog,
        this.compile(gl.FRAGMENT_SHADER, PRELUDE + aesthetic.art + POSTLUDE));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(prog));
      }
      const u = {};
      for (const name of UNIFORMS) u[name] = gl.getUniformLocation(prog, name);
      entry = { prog, u };
      this.programs.set(aesthetic.id, entry);
    }
    this.current = entry;
    gl.useProgram(entry.prog);
    const loc = gl.getAttribLocation(entry.prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(entry.u.uSeed, this.seed);
    if (this.w) gl.uniform2f(entry.u.uRes, this.w, this.h);
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
    if (this.current) this.gl.uniform2f(this.current.u.uRes, w, h);
  }

  render(phase, params) {
    if (!this.current) return;
    const gl = this.gl;
    const u = this.current.u;
    gl.uniform1f(u.uA, params.a);
    gl.uniform1f(u.uB, params.b);
    gl.uniform1f(u.uMode, params.mode);
    gl.uniform1f(u.uPhase, phase);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
