import * as THREE from 'three';

export const neonRegistry = [];
let flick = 1, dayNeon = 1;
function applyNeon() { const k = flick * dayNeon; for (const { m, base } of neonRegistry) m.color.copy(base).multiplyScalar(k); }

/** Unlit HDR material that blooms. Registered so the intro and the day/night cycle can dim every neon at once. */
export function neon(color, intensity = 2.6, opts = {}) {
  const c0 = new THREE.Color(color);
  const lum = 0.2126 * c0.r + 0.7152 * c0.g + 0.0722 * c0.b; // keep yellow/white from flooding the bloom
  const norm = Math.min(1.3, Math.max(0.55, Math.sqrt(0.4 / Math.max(lum, 0.15))));
  const base = c0.multiplyScalar(intensity * 0.62 * norm);
  const m = new THREE.MeshBasicMaterial({ color: base.clone(), fog: false, ...opts });
  neonRegistry.push({ m, base });
  return m;
}
export function setNeon(k) { flick = k; applyNeon(); }
export function setDayNeon(k) { if (Math.abs(k - dayNeon) > 0.002) { dayNeon = k; applyNeon(); } }

// cel-shaded ("anime") look for everything solid
let _grad;
function gradient() {
  if (_grad) return _grad;
  const d = new Uint8Array([90, 160, 225, 255]);
  _grad = new THREE.DataTexture(d, 4, 1, THREE.RedFormat); _grad.minFilter = _grad.magFilter = THREE.NearestFilter; _grad.needsUpdate = true;
  return _grad;
}
const DROP = ['roughness', 'metalness', 'envMapIntensity', 'flatShading', 'transmission'];
export function std(color, o = {}) {
  const p = { ...o }; DROP.forEach((k) => delete p[k]);
  return new THREE.MeshToonMaterial({ color, gradientMap: gradient(), ...p });
}

export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
export function cyl(rt, rb, h, mat, seg = 24, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  return m;
}
export function sphere(r, mat, x = 0, y = 0, z = 0, seg = 20) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75 | 0)), mat);
  m.position.set(x, y, z);
  return m;
}

/** Point on the room/ring convention: angle 0 → +z. */
export function polar(r, a, y = 0) { return new THREE.Vector3(r * Math.sin(a), y, r * Math.cos(a)); }

/** Tube along an arc (local convention θ=0 → +z) */
export function arcTube(r, a0, a1, y, thick, mat, seg = 48) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const a = a0 + (a1 - a0) * (i / seg);
    pts.push(new THREE.Vector3(r * Math.sin(a), y, r * Math.cos(a)));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, seg, thick, 6, false), mat);
}

export function halfDisc(r, seg = 48, a0 = -Math.PI / 2, a1 = Math.PI / 2) {
  const pos = [0, 0, 0], uv = [0.5, 0.5], idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = a0 + (a1 - a0) * (i / seg);
    pos.push(r * Math.sin(a), 0, r * Math.cos(a));
    uv.push(0.5 + 0.5 * Math.sin(a), 0.5 + 0.5 * Math.cos(a));
    if (i > 0) idx.push(0, i, i + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export const FONT = "'Space Grotesk','Noto Sans TC','PingFang TC','Microsoft JhengHei','Noto Sans CJK TC',sans-serif";

/** Canvas texture whose draw function can be re-run. */
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const api = { canvas: c, ctx, tex, draw: (...a) => { draw(ctx, w, h, ...a); tex.needsUpdate = true; } };
  api.draw();
  return api;
}

/** Glowing text sign; returns {mesh, set(text)} — two back-to-back planes so it reads from both sides. */
export function textSign(text, color, w = 2.6, h = 0.6, opts = {}) {
  const px = 128;
  const ct = canvasTex(Math.round(w * px), Math.round(h * px), (ctx, W, H, t = text) => {
    ctx.clearRect(0, 0, W, H);
    if (opts.panel !== false) {
      ctx.fillStyle = opts.light ? '#ffffff' : 'rgba(6,10,24,0.82)';
      roundRect(ctx, 4, 4, W - 8, H - 8, H * 0.3); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = opts.light ? 10 : 5; ctx.stroke();
    }
    let fs = H * (opts.scale || 0.5);
    ctx.font = `700 ${fs}px ${FONT}`;
    while (ctx.measureText(t).width > W * 0.86 && fs > 10) { fs -= 2; ctx.font = `700 ${fs}px ${FONT}`; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = color; ctx.shadowBlur = opts.light ? 0 : H * 0.18;
    ctx.fillStyle = opts.light ? '#1b2140' : '#ffffff';
    ctx.fillText(t, W / 2, H / 2 + fs * 0.04);
  });
  const mat = new THREE.MeshBasicMaterial({ map: ct.tex, transparent: true, depthWrite: false, fog: false,
    color: new THREE.Color(opts.bright || 1.15, opts.bright || 1.15, opts.bright || 1.15) });
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(w, h);
  const a = new THREE.Mesh(geo, mat); g.add(a);
  const b = new THREE.Mesh(geo, mat); b.rotation.y = Math.PI; g.add(b);
  return { mesh: g, set: (t) => ct.draw(t) };
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Simple additive particle cloud with per-particle size & alpha (CPU-driven). */
export function particles(n, color, size = 0.18) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), sz = new Float32Array(n), al = new Float32Array(n);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(al, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(1.5) }, uScale: { value: size * 420 } },
    vertexShader: `attribute float aSize; attribute float aAlpha; varying float vA; uniform float uScale;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vA=aAlpha; gl_PointSize = aSize*uScale/-mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; varying float vA;
      void main(){ vec2 d=gl_PointCoord-.5; float r=length(d); if(r>.5) discard; float a=smoothstep(.5,0.,r);
        gl_FragColor=vec4(mix(uColor, vec3(2.2), a*a*.35)*a*vA, 1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return { pts, pos, sz, al, mat, commit() { g.attributes.position.needsUpdate = true; g.attributes.aSize.needsUpdate = true; g.attributes.aAlpha.needsUpdate = true; } };
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export function angDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
