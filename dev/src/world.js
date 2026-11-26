import * as THREE from 'three';
import { G, BLOCK, CAMPUS, COLORS } from './config.js';
import { neon, std, box, cyl, sphere, canvasTex, rand, setDayNeon, clamp, lerp } from './util.js';

const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const C = (h) => new THREE.Color(h);
const PAL = {
  night: { top: C('#050a1f'), hor: C('#1d1a48'), fog: C('#12143a'), hemiS: C('#5a68c8'), hemiG: C('#141428'), sun: C('#9fb0ff') },
  dusk:  { top: C('#5a5fb0'), hor: C('#ffb08a'), fog: C('#f0b8a8'), hemiS: C('#ffd2b0'), hemiG: C('#8a7a7a'), sun: C('#ffb070') },
  day:   { top: C('#3d8ff0'), hor: C('#c9ecff'), fog: C('#bfe2ff'), hemiS: C('#d8efff'), hemiG: C('#8fb07a'), sun: C('#fff6e0') },
};

/** Real local time (or ?hour=HH for previews) → light state. */
export function timeOfDay(override) {
  const d = new Date();
  const h = override != null ? override : d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  const day = smooth(5.3, 7.6, h) * (1 - smooth(17.2, 19.4, h));
  const dusk = Math.max(Math.exp(-Math.pow((h - 6.4) / 0.9, 2)), Math.exp(-Math.pow((h - 18.2) / 0.9, 2)));
  return { h, day, dusk, night: 1 - day };
}

export function buildWorld(scene, reduced, hourOverride) {
  const ups = [];
  const nightOnly = []; // materials that only glow after dark

  // ---------- sky ----------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: C('#000') }, uHor: { value: C('#000') }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunC: { value: C('#fff') }, uNight: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uTop, uHor, uSunC, uSun; uniform float uNight; varying vec3 vW;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1)))*43758.5); }
      void main(){ float h = vW.y;
        vec3 c = mix(uHor, uTop, smoothstep(-.02, .55, h));
        c = mix(c, uHor*.55, smoothstep(0., -.2, h));
        float s = max(dot(vW, normalize(uSun)), 0.); c += uSunC*(pow(s, 600.)*2. + pow(s, 12.)*.25)*(1.-uNight*.7);
        vec2 g = floor(vW.xz/ max(.15,vW.y) * 140.); float st = step(.997, h21(g)) * smoothstep(.05,.3,h) * uNight;
        c += vec3(st);
        gl_FragColor = vec4(c, 1.); }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat));

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -55; sun.shadow.camera.right = 55; sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
  sun.shadow.camera.far = 400; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // ---------- ground & far city ----------
  const far = new THREE.Mesh(new THREE.CircleGeometry(700, 64), std('#9bb59a'));
  far.rotation.x = -Math.PI / 2; far.position.y = -0.05; far.receiveShadow = true; scene.add(far);
  const farMat = far.material;

  const winTex = canvasTex(64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 14) for (let x = 5; x < w; x += 12) if (Math.random() < 0.45) { ctx.fillStyle = Math.random() < 0.8 ? '#ffd9a0' : '#9fe0ff'; ctx.fillRect(x, y, 7, 8); }
  }).tex;
  const pastel = ['#f6e3c8', '#d8e6f5', '#f2d0d8', '#d9efd9', '#e9e0f7', '#fff1c4', '#cfe6ee'];
  const cityMats = [];
  const roads = new THREE.Group(); scene.add(roads);
  for (let i = 0; i < 230; i++) {
    const a = Math.random() * Math.PI * 2, r = rand(62, 320);
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    const camSide = z > 20;
    let h = rand(4, 14) + Math.max(0, r - 80) * rand(0.05, 0.35);
    if (camSide) h = Math.min(h, 3 + Math.max(0, r - 90) * 0.12);
    const w = rand(8, 18), d = rand(8, 18);
    const tex = winTex.clone(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(Math.max(1, Math.round(w / 5)), Math.max(1, Math.round(h / 5)));
    const m = new THREE.MeshToonMaterial({ color: pastel[i % pastel.length], emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 });
    cityMats.push(m);
    const b = box(w, h, d, m, Math.round(x / 6) * 6, h / 2, Math.round(z / 6) * 6); b.castShadow = r < 120; scene.add(b);
    const roof = box(w * 0.4, 1.2, d * 0.4, std('#8a93a8'), b.position.x, h + 0.6, b.position.z); scene.add(roof);
  }
  // city road grid outside the campus
  const asphalt = std('#5c6273');
  for (let k = -6; k <= 6; k++) {
    const p = k * 48 + 36 * Math.sign(k || 1);
    if (Math.abs(p) < 45) continue;
    roads.add(box(700, 0.04, 7, asphalt, 0, 0.0, p), box(7, 0.04, 700, asphalt, p, 0.0, 0));
  }

  // ---------- campus ground (painted plan) ----------
  const S = CAMPUS * 2 + 8, PX = 2048, k = PX / S;
  const W = (v) => (v + S / 2) * k;
  const plan = canvasTex(PX, PX, (ctx) => {
    ctx.fillStyle = '#7fbf6a'; ctx.fillRect(0, 0, PX, PX); // lawn
    // sidewalk base for the whole campus
    ctx.fillStyle = '#d9dde6'; ctx.fillRect(W(-CAMPUS), W(-CAMPUS), 2 * CAMPUS * k, 2 * CAMPUS * k);
    // streets (6 wide) between blocks + outer loop
    ctx.fillStyle = '#5a6072';
    for (const c of [-12, 12, -36, 36]) { ctx.fillRect(W(c - 3), W(-39), 6 * k, 78 * k); ctx.fillRect(W(-39), W(c - 3), 78 * k, 6 * k); }
    // curbs/sidewalk stripes along streets
    ctx.fillStyle = '#c6ccd8';
    for (const c of [-12, 12, -36, 36]) for (const s of [-1, 1]) { ctx.fillRect(W(c + s * 3 - 0.9), W(-39), 1.8 * k, 78 * k); ctx.fillRect(W(-39), W(c + s * 3 - 0.9), 78 * k, 1.8 * k); }
    ctx.fillStyle = '#5a6072';
    for (const c of [-12, 12, -36, 36]) { ctx.fillRect(W(c - 2.1), W(-38), 4.2 * k, 76 * k); ctx.fillRect(W(-38), W(c - 2.1), 76 * k, 4.2 * k); }
    // lane dashes
    ctx.strokeStyle = '#fff6c8'; ctx.lineWidth = 0.18 * k; ctx.setLineDash([1.6 * k, 1.6 * k]);
    for (const c of [-12, 12, -36, 36]) { ctx.beginPath(); ctx.moveTo(W(c), W(-38)); ctx.lineTo(W(c), W(38)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(W(-38), W(c)); ctx.lineTo(W(38), W(c)); ctx.stroke(); }
    ctx.setLineDash([]);
    // intersections: clean + zebra crossings
    for (const x of [-36, -12, 12, 36]) for (const z of [-36, -12, 12, 36]) {
      ctx.fillStyle = '#5a6072'; ctx.fillRect(W(x - 2.1), W(z - 2.1), 4.2 * k, 4.2 * k);
      ctx.fillStyle = '#f4f6fb';
      for (let i = -3; i <= 3; i++) {
        for (const s of [-1, 1]) {
          ctx.fillRect(W(x + i * 0.55 - 0.18), W(z + s * 3.1 - 0.5), 0.36 * k, 1.0 * k);
          ctx.fillRect(W(x + s * 3.1 - 0.5), W(z + i * 0.55 - 0.18), 1.0 * k, 0.36 * k);
        }
      }
    }
    // mid-block zebras where the lab agents cross from the plaza
    ctx.fillStyle = '#f4f6fb';
    for (const [x, z, alongZ] of [[12, 0, true], [-12, 0, true], [0, 12, false], [0, -12, false]])
      for (let i = -3; i <= 3; i++) {
        if (alongZ) ctx.fillRect(W(x + i * 0.55 - 0.18), W(z - 2.6), 0.36 * k, 5.2 * k);
        else ctx.fillRect(W(x - 2.6), W(z + i * 0.55 - 0.18), 5.2 * k, 0.36 * k);
      }
    // block plots: lawn with paved yard
    for (const bx of [-1, 0, 1]) for (const bz of [-1, 0, 1]) {
      const cx = bx * G, cz = bz * G, hb = BLOCK / 2 - 0.4;
      ctx.fillStyle = bx === 0 && bz === 0 ? '#e7e3f2' : '#86c873';
      ctx.fillRect(W(cx - hb), W(cz - hb), 2 * hb * k, 2 * hb * k);
      if (bx === 0 && bz === 0) { // plaza tiles
        ctx.strokeStyle = 'rgba(120,110,170,.25)'; ctx.lineWidth = 2;
        for (let i = -8; i <= 8; i += 1.5) { ctx.beginPath(); ctx.moveTo(W(cx + i), W(cz - hb)); ctx.lineTo(W(cx + i), W(cz + hb)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(W(cx - hb), W(cz + i)); ctx.lineTo(W(cx + hb), W(cz + i)); ctx.stroke(); }
      }
    }
    // map-style contour lines on the lawns
    ctx.strokeStyle = 'rgba(40,90,40,.18)'; ctx.lineWidth = 2;
    for (let r = 4; r < 70; r += 3.2) { ctx.beginPath(); ctx.ellipse(W(-20), W(28), r * k, r * 0.7 * k, 0.4, 0, 7); ctx.stroke(); }
  });
  plan.tex.anisotropy = 8;
  const groundMat = new THREE.MeshToonMaterial({ map: plan.tex });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(S, S), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  // ---------- trees, lamps, sensors ----------
  const trunkG = new THREE.CylinderGeometry(0.16, 0.22, 1.4, 6); trunkG.translate(0, 0.7, 0);
  const crownG = new THREE.IcosahedronGeometry(1, 1); crownG.translate(0, 2.2, 0);
  const treeSpots = [];
  for (const c of [-12, 12, -36, 36]) for (let v = -34; v <= 34; v += 5.5) for (const s of [-1, 1]) {
    if ([-36, -12, 12, 36].some((q) => Math.abs(v - q) < 4.5)) continue;
    const p = new THREE.Vector3(c + s * 3.9, 0, v); if (Math.random() < 0.55) treeSpots.push(p);
    const q = new THREE.Vector3(v, 0, c + s * 3.9); if (Math.random() < 0.55) treeSpots.push(q);
  }
  const trees = treeSpots.filter((p) => !(Math.abs(p.x) < 10 && Math.abs(p.z) < 10));
  const trunks = new THREE.InstancedMesh(trunkG, std('#8a5a3a'), trees.length);
  const crowns = new THREE.InstancedMesh(crownG, std('#ffffff'), trees.length);
  const greens = ['#4fbf5a', '#3faa6a', '#6fcf55', '#2f9f5f', '#8ad66a', '#ff9fc8'];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  trees.forEach((p, i) => {
    const s = p.z > 30 ? rand(0.45, 0.6) : rand(0.75, 1.1);
    m4.compose(p, q.setFromEuler(new THREE.Euler(0, rand(0, 6), 0)), sc.set(s, s * rand(0.9, 1.2), s));
    trunks.setMatrixAt(i, m4); crowns.setMatrixAt(i, m4); crowns.setColorAt(i, C(greens[i % greens.length]));
  });
  trunks.castShadow = crowns.castShadow = true; scene.add(trunks, crowns);

  // street lamps along the inner streets (glow at night)
  const lampHead = neon('#ffe2a8', 2.2);
  const poleM = std('#4a5068');
  const pools = [];
  const poolTex = canvasTex(64, 64, (ctx, w, h) => { const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,220,150,1)'); g.addColorStop(1, 'rgba(255,220,150,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }).tex;
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const c of [-12, 12]) for (const v of [-30, -20, 20, 30, -4.5, 4.5]) for (const swap of [0, 1]) {
    const x = swap ? v : c + 3.4, z = swap ? c + 3.4 : v;
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    g.add(cyl(0.07, 0.09, 3.6, poleM, 6, 0, 1.8, 0), sphere(0.22, lampHead, 0, 3.7, 0, 10));
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.03; g.add(pool);
  }

  // air-quality sensor poles (LED shows a live AQI colour)
  const sensors = [];
  for (const [x, z] of [[-15.6, -20], [15.6, -28], [-28, 15.6], [28, -15.6], [15.6, 28], [-20, -15.6], [6, 15.6], [-6, -15.6]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    g.add(cyl(0.06, 0.06, 2.4, poleM, 6, 0, 1.2, 0), box(0.5, 0.6, 0.35, std('#eef2fa'), 0, 2.4, 0));
    const led = new THREE.MeshBasicMaterial({ color: 0x3fd17a }); const l = sphere(0.09, led, 0, 2.45, 0.2, 8); g.add(l);
    sensors.push(led);
  }
  const aqi = ['#3fd17a', '#ffd23f', '#ff9a3c'];
  let sensT = 0;
  ups.push((t, dt) => { sensT -= dt; if (sensT < 0) { sensT = 2.5; sensors.forEach((m) => m.color.set(aqi[(Math.random() * (Math.random() < 0.7 ? 1 : 3)) | 0]).multiplyScalar(1.6)); } });

  // ---------- street network shared by traffic, signals and pedestrians ----------
  const NODES = [-36, -12, 12, 36];
  const nIdx = (i, j) => i * 4 + j;
  const nPos = (n) => new THREE.Vector3(NODES[(n / 4) | 0], 0, NODES[n % 4]);
  const nbr = (n) => { const i = (n / 4) | 0, j = n % 4, o = []; if (i > 0) o.push(nIdx(i - 1, j)); if (i < 3) o.push(nIdx(i + 1, j)); if (j > 0) o.push(nIdx(i, j - 1)); if (j < 3) o.push(nIdx(i, j + 1)); return o; };
  const lit = (n) => nbr(n).length >= 3;               // the 4 outer corners are plain bends
  const obstacles = [];                                 // things cars must not hit (walkers + agents, filled below / by main)
  const cars = [];
  /** How far (x,z), for a body of radius r, intrudes on a vehicle: its body (moving or parked) or the road just ahead of a moving one. 0 = free. */
  const carIntrusion = (x, z, r) => {
    let pen = 0;
    for (const c of cars) {
      const P = c.g.position, rx = x - P.x, rz = z - P.z;
      if (rx * rx + rz * rz > 144) continue;
      const fx = Math.sin(c.g.rotation.y), fz = Math.cos(c.g.rotation.y), ahead = rx * fx + rz * fz, lat = Math.abs(rx * fz - rz * fx);
      const ex = c.len / 2 + r + 0.2 - Math.abs(ahead), ez = 0.55 + r + 0.2 - lat;
      if (ex > 0 && ez > 0) pen = Math.max(pen, 0.5 + Math.min(ex, ez));
      else if (c.v >= 0.3 && ahead > 0 && ahead < c.len / 2 + r + 1.2 + c.v * 1.2 && lat < 0.55 + r + 0.3) pen = Math.max(pen, 0.01 + (c.len / 2 + r + 1.2 + c.v * 1.2 - ahead) * 0.05);
    }
    return pen;
  };
  /** May a body step from (x0,z0) to (x1,z1)? Never further into a vehicle's way. */
  const canStep = (x0, z0, x1, z1, r) => { const p1 = carIntrusion(x1, z1, r); return p1 === 0 || p1 <= carIntrusion(x0, z0, r) + 1e-6; };

  // ---------- traffic lights ----------
  // cycle per junction: X green 7s → yellow 1.5s → all-red .5s → Z green 7s → yellow 1.5s → all-red .5s
  const CYC = 18;
  const phase = (n, t) => (t + (((n / 4) | 0) + (n % 4)) % 2 * 9) % CYC;
  const sig = (n, axis, t) => { // → [state 'g'|'y'|'r', seconds of green left]
    if (!lit(n)) return ['g', 99];
    const p = (phase(n, t) + (axis === 'z' ? 9 : 0)) % CYC;
    return p < 7 ? ['g', 7 - p] : p < 8.5 ? ['y', 0] : ['r', 0];
  };
  const lampCol = { r: C('#ff3344'), y: C('#ffc23a'), g: C('#36ff8a') };
  const sigMats = {}; // per junction & axis: three bulbs
  const housing = std('#262b3a'), poleS = std('#3c4256');
  const bulbG = new THREE.SphereGeometry(0.12, 10, 8);
  for (let n = 0; n < 16; n++) if (lit(n)) {
    const P = nPos(n);
    for (const axis of ['x', 'z']) {
      const mats = { r: new THREE.MeshBasicMaterial(), y: new THREE.MeshBasicMaterial(), g: new THREE.MeshBasicMaterial() };
      sigMats[n + axis] = mats;
      // pole on the corner, arm reaching over the approach lane, head facing both ways
      const sx = axis === 'x' ? 1 : -1, sz = axis === 'x' ? 1 : -1;
      const g = new THREE.Group(); g.position.set(P.x + sx * 3.75, 0, P.z + sz * 3.75); scene.add(g);
      g.add(cyl(0.07, 0.09, 3.4, poleS, 8, 0, 1.7, 0));
      const arm = axis === 'x' ? box(0.08, 0.08, 2.6, poleS, 0, 3.3, -sz * 1.3) : box(2.6, 0.08, 0.08, poleS, -sx * 1.3, 3.3, 0);
      g.add(arm);
      const hx = axis === 'x' ? 0 : -sx * 2.5, hz = axis === 'x' ? -sz * 2.5 : 0;
      const head = new THREE.Group(); head.position.set(hx, 2.75, hz); if (axis === 'z') head.rotation.y = Math.PI / 2; g.add(head);
      head.add(box(0.3, 0.95, 0.2, housing, 0, 0, 0));
      [['r', 0.3], ['y', 0], ['g', -0.3]].forEach(([k, y]) => { const b1 = new THREE.Mesh(bulbG, mats[k]); b1.position.set(0, y, 0); b1.scale.set(1, 1, 1.05); head.add(b1); });
      g.traverse((o) => { if (o.isMesh && o.material !== mats.r && o.material !== mats.y && o.material !== mats.g) o.castShadow = true; });
    }
  }
  ups.push((t) => {
    for (let n = 0; n < 16; n++) if (lit(n)) for (const axis of ['x', 'z']) {
      const st = sig(n, axis, t)[0], m = sigMats[n + axis];
      for (const k of ['r', 'y', 'g']) m[k].color.copy(lampCol[k]).multiplyScalar(k === st ? 2.4 : 0.12);
    }
  });

  // ---------- pedestrians: walk the sidewalks, cross only on zebras with a green light ----------
  const OFF = 2.8; // sidewalk lane (road edge 2.1, trees 3.9)
  const corner = (n, cx, cz) => { const P = nPos(n); return new THREE.Vector3(P.x + cx * OFF, 0, P.z + cz * OFF); };
  const cOk = (n, cx, cz) => { const p = corner(n, cx, cz); return Math.abs(p.x) <= 36 && Math.abs(p.z) <= 36; };
  const cId = (n, cx, cz) => n * 4 + (cx > 0 ? 1 : 0) + (cz > 0 ? 2 : 0);
  const cDec = (id) => [(id / 4) | 0, id & 1 ? 1 : -1, id & 2 ? 1 : -1];
  const cPos = []; const cEdges = [];
  for (let n = 0; n < 16; n++) for (const cx of [-1, 1]) for (const cz of [-1, 1]) {
    const id = cId(n, cx, cz); cPos[id] = corner(n, cx, cz); cEdges[id] = [];
    if (!cOk(n, cx, cz)) continue;
    const i = (n / 4) | 0, j = n % 4;
    if (cOk(n, -cx, cz)) cEdges[id].push({ to: cId(n, -cx, cz), cross: 'x', n });   // zebra across the N–S road
    if (cOk(n, cx, -cz)) cEdges[id].push({ to: cId(n, cx, -cz), cross: 'z', n });   // zebra across the E–W road
    const ii = i + cx, jj = j + cz;
    if (ii >= 0 && ii < 4) cEdges[id].push({ to: cId(nIdx(ii, j), -cx, cz) });        // sidewalk along the block
    if (jj >= 0 && jj < 4) cEdges[id].push({ to: cId(nIdx(i, jj), cx, -cz) });
  }
  const starts = cPos.map((_, id) => id).filter((id) => cEdges[id].length);
  const NW = 60;
  const bodyG = new THREE.CapsuleGeometry(0.17, 0.42, 3, 8); bodyG.translate(0, 0.45, 0);
  const headG = new THREE.SphereGeometry(0.15, 8, 6); headG.translate(0, 0.95, 0);
  const bodies = new THREE.InstancedMesh(bodyG, std('#ffffff'), NW);
  const heads = new THREE.InstancedMesh(headG, std('#ffe0c2'), NW);
  bodies.castShadow = true;
  const shirts = ['#ff6b6b', '#4d8dff', '#ffd23f', '#3fd17a', '#ff9fd0', '#7a6bff', '#ffffff', '#2e3a59', '#ff9a3c'];
  const walkers = [];
  const pickEdge = (w) => { const es = cEdges[w.b]; const fwd = es.filter((e) => e.to !== w.a); const c = fwd.length ? fwd : es; return c[(Math.random() * c.length) | 0]; };
  for (let i = 0; i < NW; i++) {
    const a = starts[(Math.random() * starts.length) | 0];
    const w = { a, b: a, e: null, t: 1, sp: rand(1.0, 1.5), j: rand(-0.25, 0.25), ph: rand(0, 6), pos: new THREE.Vector3(), yaw: 0 };
    // drop them somewhere along a sidewalk edge
    const side = cEdges[a].filter((e) => !e.cross); if (side.length) { w.e = side[(Math.random() * side.length) | 0]; w.b = w.e.to; w.t = Math.random(); }
    walkers.push(w); obstacles.push({ pos: w.pos, r: 0.3 });
    bodies.setColorAt(i, C(shirts[i % shirts.length]));
  }
  scene.add(bodies, heads);
  const pp = new THREE.Vector3(), e = new THREE.Euler();
  ups.push((t, dt) => {
    const k = reduced ? 0.35 : 1;
    walkers.forEach((w, i) => {
      if (w.t >= 1) { // at a corner: choose where next, wait for the walk signal before a zebra
        if (!w.next) w.next = pickEdge(w);
        const nx = w.next;
        if (nx.cross) { const [st, left] = sig(nx.n, nx.cross, t); if (st !== 'g' || left < 3) { w.waiting = true; } else w.waiting = false; } else w.waiting = false;
        if (!w.waiting) { w.a = w.b; w.b = nx.to; w.e = nx; w.next = null; w.t = 0; }
      }
      const A = cPos[w.a], B = cPos[w.b], L = Math.max(0.01, A.distanceTo(B));
      const dx = B.x - A.x, dz = B.z - A.z, l = Math.hypot(dx, dz) || 1;
      let held = false;
      if (!w.waiting) {
        const nt = Math.min(1, w.t + (w.sp * (w.e && w.e.cross ? 1.35 : 1) * dt * k) / L);
        const x1 = A.x + dx * nt + (-dz / l) * w.j, z1 = A.z + dz * nt + (dx / l) * w.j;
        if (canStep(w.pos.x, w.pos.z, x1, z1, 0.3)) w.t = nt; else held = true;
      }
      pp.lerpVectors(A, B, w.t); pp.x += (-dz / l) * w.j; pp.z += (dx / l) * w.j;
      pp.y = w.waiting || held ? 0 : Math.abs(Math.sin(t * 8 * w.sp + w.ph)) * 0.05;
      w.pos.copy(pp);
      if (l > 0.02 && !w.waiting) w.yaw = Math.atan2(dx, dz);
      e.set(0, w.yaw, 0); q.setFromEuler(e);
      m4.compose(pp, q, sc.set(1, 1, 1)); bodies.setMatrixAt(i, m4); heads.setMatrixAt(i, m4);
    });
    bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
  });

  // ---------- traffic: cars, taxis, vans and buses routed over the street grid ----------
  const VEH = [
    { kind: 'car', n: 12 }, { kind: 'taxi', n: 4 }, { kind: 'van', n: 4 }, { kind: 'bus', n: 3 },
  ];
  const carCols = ['#ff6b6b', '#4d8dff', '#ffffff', '#3fd17a', '#c35bff', '#2e3a59', '#ff9a3c'];
  const glass = std('#bfe3ff'), tyre = std('#22252e'), headL = neon('#fff6d0', 2), tailL = neon('#ff3b4a', 2.2);
  const wheels = (g, xs, zs) => { for (const x of xs) for (const z of zs) { const w = cyl(0.2, 0.2, 0.16, tyre, 10, x, 0.2, z); w.rotation.z = Math.PI / 2; g.add(w); } };
  const lights = (g, w, y, front, back) => { g.add(box(w, 0.1, 0.05, headL, 0, y, front), box(w, 0.1, 0.05, tailL, 0, y, back)); };
  const MAKE = {
    car(g, i) { const m = std(carCols[i % carCols.length]);
      g.add(box(1.0, 0.42, 1.9, m, 0, 0.42, 0), box(0.86, 0.36, 1.0, glass, 0, 0.8, -0.1));
      wheels(g, [-0.5, 0.5], [-0.6, 0.6]); lights(g, 0.7, 0.45, 0.96, -0.96); return 1.9; },
    taxi(g) { const m = std('#ffd23f');
      g.add(box(1.0, 0.42, 1.95, m, 0, 0.42, 0), box(0.86, 0.36, 1.0, glass, 0, 0.8, -0.1), box(0.4, 0.14, 0.22, std('#ffffff', { emissive: new THREE.Color('#fff2a0'), emissiveIntensity: 0.6 }), 0, 1.05, -0.1));
      g.add(box(1.02, 0.08, 1.4, std('#222831'), 0, 0.5, 0));
      wheels(g, [-0.5, 0.5], [-0.6, 0.6]); lights(g, 0.7, 0.45, 0.98, -0.98); return 1.95; },
    van(g, i) { const m = std(['#ffffff', '#9fd8ff', '#ffb0a0'][i % 3]);
      g.add(box(1.1, 0.95, 2.4, m, 0, 0.72, 0), box(1.0, 0.36, 0.06, glass, 0, 0.95, 1.2));
      wheels(g, [-0.55, 0.55], [-0.8, 0.8]); lights(g, 0.8, 0.45, 1.21, -1.21); return 2.4; },
    bus(g, i) { const m = std(['#3fd17a', '#4d8dff', '#ff6b6b'][i % 3]);
      g.add(box(1.25, 1.25, 4.2, m, 0, 0.88, 0), box(1.27, 0.34, 3.6, glass, 0, 1.12, -0.15), box(1.1, 0.06, 3.8, std('#ffffff'), 0, 1.53, 0));
      wheels(g, [-0.62, 0.62], [-1.4, 1.4]); lights(g, 0.95, 0.5, 2.11, -2.11); return 4.2; },
  };
  VEH.forEach(({ kind, n }) => { for (let i = 0; i < n; i++) {
    const g = new THREE.Group(); scene.add(g);
    const len = MAKE[kind](g, i);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const a = (Math.random() * 16) | 0, ns = nbr(a);
    const b0 = ns[(Math.random() * ns.length) | 0]; const nn = nbr(b0).filter((x) => x !== a);
    cars.push({ g, a, b: b0, nb: nn[(Math.random() * nn.length) | 0], t: Math.random() * 0.6, len, vmax: kind === 'bus' ? rand(3.2, 4) : rand(4.5, 6.5), v: 0, init: true });
  } });
  const ca = new THREE.Vector3(), cb = new THREE.Vector3(), tgt = new THREE.Vector3();
  const STOP = 4.1; // front bumper stops this far from the junction centre (zebra ends at 3.6)
  ups.push((t, dt) => {
    const k = reduced ? 0.3 : 1;
    const lanes = {};
    cars.forEach((c) => (lanes[c.a * 16 + c.b] ||= []).push(c));
    cars.forEach((c) => {
      ca.copy(nPos(c.a)); cb.copy(nPos(c.b)); const L = ca.distanceTo(cb);
      const dx = cb.x - ca.x, dz = cb.z - ca.z, l = Math.hypot(dx, dz), fx = dx / l, fz = dz / l;
      let v = c.vmax;
      // 1) keep a gap behind whoever is ahead on the same lane
      for (const o of lanes[c.a * 16 + c.b]) if (o !== c && o.t > c.t) { const gap = (o.t - c.t) * L - (o.len + c.len) / 2; v = Math.min(v, Math.max(0, (gap - 1.2) * 1.5)); }
      for (const o of lanes[c.b * 16 + c.nb] || []) { const gap = (1 - c.t) * L + o.t * 24 - (o.len + c.len) / 2; v = Math.min(v, Math.max(0, (gap - 1.2) * 1.5)); } // queue into the next block too
      // 2) traffic light at the junction ahead
      const front = (1 - c.t) * L - c.len / 2;
      const [st] = sig(c.b, fx !== 0 ? 'x' : 'z', t);
      if (st !== 'g' && front > STOP - 0.3 && !(st === 'y' && front < STOP + 1.2)) v = Math.min(v, Math.max(0, (front - STOP) * 1.6));
      let yieldStop = false;
      // 3) never drive into a pedestrian or an agent — check along the lane and along the body's actual heading (mid-turn)
      const P = c.g.position, hx = Math.sin(c.g.rotation.y), hz = Math.cos(c.g.rotation.y);
      for (const ob of obstacles) {
        const o = ob.pos, rx = o.x - P.x, rz = o.z - P.z;
        if (rx * rx + rz * rz > 100) continue;
        for (const [gx, gz] of [[fx, fz], [hx, hz]]) {
          const ahead = rx * gx + rz * gz;
          if (ahead < c.len / 2 - 0.1 || ahead > c.len / 2 + ob.r + 4.5) continue;
          if (Math.abs(rx * gz - rz * gx) < 0.6 + ob.r + 0.35) { const gp = ahead - c.len / 2 - ob.r - 0.7; v = Math.min(v, gp < 0.4 ? 0 : gp * 1.6); yieldStop = true; }
        }
      }
      if (yieldStop && v < c.v) c.v = v; else c.v += (v - c.v) * Math.min(1, dt * (v < c.v ? 6 : 2)); // brake hard for people
      c.t += (c.v * dt * k) / L;
      if (c.t >= 1) { c.a = c.b; c.b = c.nb; const ns = nbr(c.b).filter((n) => n !== c.a); c.nb = ns[(Math.random() * ns.length) | 0]; c.t = 0; ca.copy(nPos(c.a)); cb.copy(nPos(c.b)); }
      const ex = cb.x - ca.x, ez = cb.z - ca.z, el = Math.hypot(ex, ez);
      tgt.lerpVectors(ca, cb, c.t); tgt.x += (-ez / el) * 1.05; tgt.z += (ex / el) * 1.05; // drive on the right
      if (c.init) { c.g.position.copy(tgt); c.g.rotation.y = Math.atan2(ex, ez); c.init = false; }
      c.g.position.lerp(tgt, Math.min(1, dt * 10));
      const yaw = Math.atan2(ex, ez);
      c.g.rotation.y += ((yaw - c.g.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 8);
    });
  });

  // ---------- day / night ----------
  const fog = new THREE.Fog(0xffffff, 260, 900); scene.fog = fog;
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  const mix3 = (key, s, out) => { out.copy(PAL.night[key]).lerp(PAL.day[key], s.day); return out.lerp(PAL.dusk[key], s.dusk * 0.5); };
  const state = { day: 1, night: 0, dusk: 0, h: 12 };
  let acc = 1e9;
  const apply = () => {
    const s = timeOfDay(hourOverride); Object.assign(state, s);
    mix3('top', s, skyMat.uniforms.uTop.value); mix3('hor', s, skyMat.uniforms.uHor.value); skyMat.uniforms.uNight.value = s.night;
    mix3('fog', s, fog.color);
    mix3('hemiS', s, hemi.color); mix3('hemiG', s, hemi.groundColor); hemi.intensity = lerp(0.55, 1.25, s.day);
    // sun arcs from east (+x) to west (-x); at night a cool moon light from above
    const ang = ((s.h - 6) / 12) * Math.PI;
    const el = Math.max(0.25, Math.sin(ang));
    sun.position.set(Math.cos(ang) * 80, el * 90 + 10, 45);
    sun.color.copy(PAL.day.sun).lerp(PAL.dusk.sun, s.dusk).lerp(PAL.night.sun, s.night);
    sun.intensity = lerp(0.35, 2.4, s.day);
    skyMat.uniforms.uSun.value.copy(sun.position).normalize(); skyMat.uniforms.uSunC.value.copy(sun.color);
    cityMats.forEach((m) => (m.emissiveIntensity = s.night * 0.9));
    poolMat.opacity = s.night * 0.55;
    setDayNeon(lerp(0.55, 1, s.night));
    farMat.color.set('#9bb59a').lerp(tmp2.set('#3a4a5a'), s.night * 0.4);
  };
  ups.push((t, dt) => { acc += dt; if (acc > 5) { acc = 0; apply(); } });
  apply();

  return { ups, state, sun, obstacles, cars, canStep };
}
