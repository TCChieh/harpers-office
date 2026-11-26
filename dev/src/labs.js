import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROOMS, LOBBY, G, ROOM, COLORS } from './config.js';
import { neon, std, box, cyl, sphere, canvasTex, textSign, roundRect, FONT, rand, particles } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const H = ROOM, RC = 2.2, WALL_H = 3.6, GLASS_H = 2.5, DOOR = 1.35;

/** Rounded-square outline (local xz), spaced ~0.8 apart. */
function outline() {
  const pts = [];
  const corner = (cx, cz, a0) => { for (let i = 0; i <= 5; i++) { const a = a0 + (i / 5) * (Math.PI / 2); pts.push(V(cx + Math.cos(a) * RC, 0, cz + Math.sin(a) * RC)); } };
  const edge = (x0, z0, x1, z1) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.8); for (let i = 1; i < n; i++) pts.push(V(x0 + ((x1 - x0) * i) / n, 0, z0 + ((z1 - z0) * i) / n)); };
  const a = H - RC;
  corner(a, a, 0); edge(a, H, -a, H);
  corner(-a, a, Math.PI / 2); edge(-H, a, -H, -a);
  corner(-a, -a, Math.PI); edge(-a, -H, a, -H);
  corner(a, -a, Math.PI * 1.5); edge(H, -a, H, a);
  return pts;
}
function floorShape() {
  const s = new THREE.Shape(), a = H - RC;
  s.moveTo(-a, -H); s.lineTo(a, -H); s.absarc(a, -a, RC, -Math.PI / 2, 0); s.lineTo(H, a); s.absarc(a, a, RC, 0, Math.PI / 2);
  s.lineTo(-a, H); s.absarc(-a, a, RC, Math.PI / 2, Math.PI); s.lineTo(-H, -a); s.absarc(-a, -a, RC, Math.PI, Math.PI * 1.5);
  return s;
}

function shell(def, opts = {}) {
  const g = new THREE.Group();
  const cx = def.gx * G, cz = def.gz * G;
  g.position.set(cx, 0, cz);
  const ux = -def.gx, uz = -def.gz, l = Math.hypot(ux, uz);
  g.rotation.y = Math.atan2(ux / l, uz / l); // local +z → toward the plaza
  const col = new THREE.Color(def.color);

  // floor: soft tinted tiles + raised base
  const fg = new THREE.ShapeGeometry(floorShape(), 12); fg.rotateX(-Math.PI / 2);
  const floorMat = std(col.clone().lerp(new THREE.Color('#ffffff'), 0.78));
  const floor = new THREE.Mesh(fg, floorMat); floor.position.y = 0.21; floor.receiveShadow = true; g.add(floor);
  const baseG = new THREE.ExtrudeGeometry(floorShape(), { depth: 0.2, bevelEnabled: false, curveSegments: 12 }); baseG.rotateX(Math.PI / 2); baseG.translate(0, 0.2, 0);
  const base = new THREE.Mesh(baseG, std('#c9cfdd')); base.receiveShadow = true; g.add(base);

  const fade = [];
  const pts = outline();
  const wallGeo = [], bandGeo = [], glassGeo = [], trimGeo = [], neonGeo = [];
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[i], p1 = pts[(i + 1) % pts.length], m = p0.clone().add(p1).multiplyScalar(0.5), L = p0.distanceTo(p1) + 0.04;
    if (opts.noWall && m.z < 0) continue;
    if (m.z > H - 0.6 && Math.abs(m.x) < DOOR) continue; // door gap
    const ang = Math.atan2(p1.x - p0.x, p1.z - p0.z);
    const solid = !opts.noWall && m.z < -1.2;
    const h = solid ? WALL_H : GLASS_H;
    const mk = (w, hh, d, y) => { const b = new THREE.BoxGeometry(d, hh, w); b.rotateY(ang); b.translate(m.x, y, m.z); return b; };
    if (opts.glassless && !solid) continue;
    if (solid) { wallGeo.push(mk(L, h, 0.3, 0.2 + h / 2)); bandGeo.push(mk(L, 0.45, 0.42, 0.2 + h + 0.2)); neonGeo.push(mk(L, 0.07, 0.46, 0.2 + h + 0.44)); }
    else { glassGeo.push(mk(L, h, 0.06, 0.2 + h / 2)); trimGeo.push(mk(L, 0.12, 0.16, 0.2 + h)); trimGeo.push(mk(L, 0.16, 0.18, 0.28)); }
  }
  if (wallGeo.length) {
    const wm = std('#f4f1ea', { transparent: true }); const wall = new THREE.Mesh(mergeGeometries(wallGeo), wm); wall.castShadow = wall.receiveShadow = true; g.add(wall);
    const bm = std(def.color, { transparent: true }); const band = new THREE.Mesh(mergeGeometries(bandGeo), bm); band.castShadow = true; g.add(band);
    fade.push({ m: wm, o: 1 }, { m: bm, o: 1 });
    // neon strip on the wall top (shows at night)
    const n = new THREE.Mesh(mergeGeometries(neonGeo), neon(def.color, 2.4, { transparent: true })); g.add(n); fade.push({ m: n.material, o: 1, neon: true });
  }
  if (glassGeo.length) {
    g.add(new THREE.Mesh(mergeGeometries(glassGeo), new THREE.MeshToonMaterial({ color: col.clone().lerp(new THREE.Color('#d9f2ff'), 0.7), transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })));
    const tm = new THREE.Mesh(mergeGeometries(trimGeo), std(col.clone().lerp(new THREE.Color('#ffffff'), 0.25))); tm.castShadow = true; g.add(tm);
  }
  if (!opts.noDoor) {
    // door frame + awning in the type colour
    const fm = std(def.color);
    const dz = H;
    g.add(box(0.22, 2.7, 0.3, fm, -DOOR, 1.55, dz), box(0.22, 2.7, 0.3, fm, DOOR, 1.55, dz), box(DOOR * 2 + 0.22, 0.3, 0.3, fm, 0, 2.95, dz));
    const awn = box(DOOR * 2 + 1.2, 0.12, 1.2, std(col.clone().lerp(new THREE.Color('#ffffff'), 0.15)), 0, 3.15, dz + 0.45); awn.rotation.x = 0.25; awn.castShadow = true; g.add(awn);
    for (let i = 0; i < 5; i++) g.add(box(0.36, 0.13, 1.22, std(i % 2 ? '#ffffff' : def.color), -DOOR - 0.4 + i * ((DOOR * 2 + 0.8) / 4), 3.16, dz + 0.45).rotateX(0.25));
    const mat = box(2.2, 0.03, 1.1, std('#6b5a4a'), 0, 0.03, dz + 1.0); g.add(mat);
    g.add(box(DOOR * 2 - 0.1, 0.08, 0.6, neon(def.color, 1.6), 0, 0.22, dz - 0.1));
  }
  // light inside (stronger at night, see main)
  const pl = new THREE.PointLight(col.clone().lerp(new THREE.Color('#ffffff'), 0.55), 6, 12, 1.6); pl.position.set(0, 3.2, 0.5); g.add(pl);
  return { g, floor, fade, light: pl };
}

function desk(g, col, z, faceZ = 1, w = 2.6) {
  const top = std('#ffffff'), leg = std('#8a93a8');
  g.add(box(w, 0.1, 1.1, top, 0, 0.98, z), box(w - 0.1, 0.06, 0.06, std(col), 0, 0.92, z + faceZ * 0.53));
  g.add(box(0.1, 0.76, 0.9, leg, -w / 2 + 0.2, 0.58, z), box(0.1, 0.76, 0.9, leg, w / 2 - 0.2, 0.58, z));
  const cz = z - faceZ * 1.1;
  const seat = std(col);
  g.add(cyl(0.42, 0.42, 0.12, seat, 20, 0, 0.7, cz), cyl(0.06, 0.06, 0.45, leg, 8, 0, 0.45, cz), cyl(0.34, 0.34, 0.05, leg, 16, 0, 0.24, cz));
  g.add(box(0.82, 0.72, 0.12, seat, 0, 1.15, cz - faceZ * 0.42));
  // laptop
  const lap = new THREE.Group(); lap.position.set(0.5, 1.04, z); lap.rotation.y = faceZ > 0 ? 0 : Math.PI; g.add(lap);
  lap.add(box(0.62, 0.03, 0.42, std('#c9ced8'), 0, 0, 0));
  const scr = box(0.62, 0.4, 0.03, std('#c9ced8'), 0, 0.2, 0.21); scr.rotation.x = -0.25; lap.add(scr);
  const glow = box(0.55, 0.33, 0.01, neon(col, 0.9), 0, 0.2, 0.19); glow.rotation.x = -0.25; lap.add(glow);
  g.add(cyl(0.12, 0.1, 0.18, std('#ffffff'), 12, -0.8, 1.12, z)); // mug
  return cz;
}
function projector(g, col, x, z) {
  const b = new THREE.Group(); b.position.set(x, 0.2, z); g.add(b);
  b.add(cyl(0.4, 0.48, 0.18, std('#ffffff'), 24, 0, 0.09, 0));
  { const tr = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.03, 6, 32), neon(col, 3)); tr.rotation.x = Math.PI / 2; tr.position.y = 0.19; b.add(tr); }
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.25, 1.0, 32, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(0.9), transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.y = 0.7; b.add(cone);
  const h = new THREE.Group(); h.position.y = 1.45; b.add(h);
  return h;
}
const wire = (col, k = 1.3) => new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), wireframe: true, transparent: true, opacity: 0.85, depthWrite: false });

/** Big wall screen on the back wall, with an animated research map. */
function wallScreen(g, def, draw, w = 6.6, h = 2.6) {
  const ct = canvasTex(660, 260, (ctx, W, Hh, t = 0) => {
    ctx.fillStyle = '#0d1430'; ctx.fillRect(0, 0, W, Hh);
    draw(ctx, W, Hh, t);
    ctx.fillStyle = 'rgba(8,12,30,.78)'; roundRect(ctx, 10, 10, 250, 38, 10); ctx.fill();
    ctx.fillStyle = def.color; ctx.font = `700 22px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillText(`${def.type} MAP`, 22, 30);
    ctx.fillStyle = '#cfe0ff'; ctx.font = `500 16px ${FONT}`; ctx.fillText('live', 150, 30);
  });
  g.add(box(w + 0.3, h + 0.3, 0.12, std('#2b3350'), 0, 2.3, -H + 0.32));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: ct.tex, color: new THREE.Color(1.15, 1.15, 1.15), toneMapped: true }));
  m.position.set(0, 2.3, -H + 0.39); g.add(m);
  let acc = 0;
  return (t, dt) => { acc += dt; if (acc > 0.3) { acc = 0; ct.draw(t); } };
}
const heatRamp = (v) => { const s = [[0, [40, 60, 200]], [0.35, [60, 200, 220]], [0.55, [250, 230, 80]], [0.75, [255, 140, 40]], [1, [230, 40, 60]]]; for (let i = 1; i < s.length; i++) if (v <= s[i][0]) { const [a, ca] = s[i - 1], [b, cb] = s[i]; const f = (v - a) / (b - a); return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * f)).join(',')})`; } return 'rgb(230,40,60)'; };

// ---------------------------------------------------------------- per-lab decor
const DECOR = {
  heat(g, def) {
    const ups = [];
    ups.push(wallScreen(g, def, (ctx, W, Hh, t) => {
      for (let x = 0; x < W; x += 20) for (let y = 0; y < Hh; y += 20) {
        const d = Math.hypot(x - W / 2 - Math.sin(t * 0.4) * 120, y - Hh / 2) / 260;
        const v = Math.min(1, Math.max(0, 1 - d + Math.sin(x * 0.05 + y * 0.03) * 0.08 + ((x / 20 + y / 20) % 3 === 0 ? 0.08 : 0)));
        ctx.fillStyle = heatRamp(v); ctx.fillRect(x, y, 19, 19);
      }
      ctx.fillStyle = '#fff'; ctx.font = `700 34px ${FONT}`; ctx.fillText(`${(35.4 + Math.sin(t * 0.7) * 0.8).toFixed(1)}°C`, W - 170, 40);
      ctx.font = `500 15px ${FONT}`; ctx.fillText('WBGT 31.2  · DANGER', W - 200, 72);
    }));
    // giant thermometer
    const th = new THREE.Group(); th.position.set(-4.3, 0.2, -3.4); g.add(th);
    th.add(cyl(0.45, 0.55, 0.3, std('#ffffff'), 20, 0, 0.15, 0), cyl(0.25, 0.25, 3.0, new THREE.MeshToonMaterial({ color: '#ffffff', transparent: true, opacity: 0.45 }), 16, 0, 1.8, 0));
    th.add(sphere(0.42, std(def.color, { emissive: new THREE.Color(def.color), emissiveIntensity: 0.3 }), 0, 0.55, 0, 20));
    const col = cyl(0.14, 0.14, 1, std(def.color, { emissive: new THREE.Color(def.color), emissiveIntensity: 0.3 }), 12, 0, 0, 0); th.add(col);
    for (let i = 0; i < 6; i++) th.add(box(0.2, 0.03, 0.03, std('#2b3350'), 0.32, 1.0 + i * 0.4, 0));
    // WBGT globe on a tripod
    const tri = new THREE.Group(); tri.position.set(-4.2, 0.2, 1.8); g.add(tri);
    for (const a of [0, 2.1, 4.2]) { const lg = cyl(0.03, 0.03, 1.5, std('#8a93a8'), 6, Math.sin(a) * 0.3, 0.7, Math.cos(a) * 0.3); lg.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25); tri.add(lg); }
    tri.add(sphere(0.32, std('#2a2a33'), 0, 1.6, 0, 16), box(0.5, 0.3, 0.2, std('#ffffff'), 0, 1.15, 0.12));
    // fan
    const fan = new THREE.Group(); fan.position.set(4.3, 0.2, -3.6); fan.rotation.y = -0.6; g.add(fan);
    fan.add(cyl(0.3, 0.35, 0.1, std('#ffffff'), 16, 0, 0.05, 0), cyl(0.04, 0.04, 1.3, std('#ffffff'), 6, 0, 0.7, 0));
    const blades = new THREE.Group(); blades.position.set(0, 1.45, 0.1); fan.add(blades);
    for (let i = 0; i < 3; i++) { const b = box(0.16, 0.5, 0.02, std('#9fdcff'), 0, 0.25, 0); const p = new THREE.Group(); p.rotation.z = (i / 3) * Math.PI * 2; p.add(b); blades.add(p); }
    fan.add(new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.02, 6, 24), std('#ffffff')).translateY(1.45).translateZ(0.12));
    ups.push((t, dt) => { blades.rotation.z += dt * 14; const v = 0.5 + Math.sin(t * 0.5) * 0.3; col.scale.y = 2.2 * v + 0.3; col.position.y = 0.6 + (2.2 * v + 0.3) / 2; });
    return { ups, holo: (h) => {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), wire('#ffb36a', 1.4)); h.add(s);
      const rs = [0, 1, 2].map((k) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.012, 4, 48), wire(def.color, 1.6)); r.rotation.x = Math.PI / 2; h.add(r); return r; });
      return (t) => { s.rotation.y = t * 0.6; rs.forEach((r, k) => { const f = (t * 0.4 + k / 3) % 1; r.scale.setScalar(0.8 + f * 1.4); r.material.opacity = 1 - f; }); };
    } };
  },
  air(g, def) {
    const ups = [];
    ups.push(wallScreen(g, def, (ctx, W, Hh, t) => {
      ctx.fillStyle = '#1c2a3e'; ctx.fillRect(0, 0, W, Hh);
      ctx.strokeStyle = 'rgba(150,180,230,.25)'; for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.moveTo(i * 50, 0); ctx.lineTo(i * 50 - 80, Hh); ctx.stroke(); }
      for (let k = 0; k < 6; k++) {
        const x = ((t * 30 + k * 130) % (W + 200)) - 100, y = 70 + (k * 47) % 170, r = 50 + k * 8;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, k % 2 ? 'rgba(255,154,60,.75)' : 'rgba(255,210,63,.6)'); gr.addColorStop(1, 'rgba(255,154,60,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#fff'; ctx.font = `700 34px ${FONT}`; ctx.fillText(`PM2.5 ${Math.round(18 + Math.sin(t * 0.6) * 6)}`, W - 230, 40);
      ctx.font = `500 15px ${FONT}`; ctx.fillText('µg/m³ · AQI MODERATE', W - 230, 72);
    }));
    // monitoring tower
    const tw = new THREE.Group(); tw.position.set(-4.3, 0.2, -3.4); g.add(tw);
    tw.add(box(1.1, 2.6, 1.0, std('#ffffff'), 0, 1.3, 0));
    for (let i = 0; i < 6; i++) tw.add(box(1.12, 0.05, 1.02, std('#c9ced8'), 0, 0.5 + i * 0.3, 0));
    const scr = box(0.7, 0.42, 0.02, neon(def.color, 1.4), 0, 2.2, 0.51); tw.add(scr);
    tw.add(cyl(0.06, 0.06, 0.6, std('#8a93a8'), 6, 0.3, 2.9, 0), sphere(0.08, neon('#3fd17a', 2.5), 0.3, 3.2, 0, 8));
    // anemometer
    const an = new THREE.Group(); an.position.set(4.2, 0.2, -3.3); g.add(an);
    an.add(cyl(0.05, 0.05, 2.8, std('#8a93a8'), 6, 0, 1.4, 0));
    const cups = new THREE.Group(); cups.position.y = 2.85; an.add(cups);
    for (let i = 0; i < 3; i++) { const arm = new THREE.Group(); arm.rotation.y = (i / 3) * Math.PI * 2; cups.add(arm); arm.add(box(0.6, 0.03, 0.03, std('#ffffff'), 0.3, 0, 0)); arm.add(sphere(0.13, std(def.color), 0.62, 0, 0, 10)); }
    const vane = box(0.04, 0.3, 0.7, std('#ffffff'), 0, 2.55, 0); an.add(vane);
    // potted plant
    g.add(cyl(0.35, 0.28, 0.5, std('#e98a5a'), 14, -4.4, 0.45, 2.2), sphere(0.5, std('#4fbf5a'), -4.4, 1.0, 2.2, 10));
    ups.push((t, dt) => { cups.rotation.y += dt * 5; vane.rotation.y = Math.sin(t * 0.5) * 0.4; });
    return { ups, holo: (h) => {
      const rs = [0, 1, 2].map((k) => { const ring = new THREE.Group(); ring.position.y = -0.3 + k * 0.3; h.add(ring); for (let i = 0; i < 8; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 6), wire(def.color, 1.8)); const a = (i / 8) * Math.PI * 2; c.position.set(Math.cos(a) * (0.3 + k * 0.12), 0, Math.sin(a) * (0.3 + k * 0.12)); c.rotation.set(0, 0, 0); c.rotation.x = Math.PI / 2; c.rotation.z = -a; ring.add(c); } return ring; });
      return (t) => rs.forEach((r, k) => (r.rotation.y = t * (1.2 - k * 0.3)));
    } };
  },
  green(g, def) {
    const ups = [];
    ups.push(wallScreen(g, def, (ctx, W, Hh, t) => {
      for (let x = 0; x < W; x += 15) for (let y = 0; y < Hh; y += 15) {
        const v = (Math.sin(x * 0.02 + 1) * Math.cos(y * 0.03) + Math.sin((x + y) * 0.011 + t * 0.2)) * 0.25 + 0.5;
        ctx.fillStyle = `rgb(${Math.round(200 - v * 170)},${Math.round(120 + v * 110)},${Math.round(70 + v * 20)})`; ctx.fillRect(x, y, 14, 14);
      }
      ctx.fillStyle = '#fff'; ctx.font = `700 34px ${FONT}`; ctx.fillText('NDVI 0.62', W - 210, 40); ctx.font = `500 15px ${FONT}`; ctx.fillText('tree cover +2.1% this year', W - 230, 72);
    }));
    const pot = std('#e98a5a'), leaf = [std('#4fbf5a'), std('#6fcf55'), std('#2f9f5f')];
    for (let i = 0; i < 3; i++) { const z = -3.6 + i * 1.6; g.add(box(1.0, 0.6, 1.2, pot, -4.5, 0.5, z)); for (let k = 0; k < 3; k++) g.add(sphere(rand(0.3, 0.45), leaf[(i + k) % 3], -4.5 + rand(-0.3, 0.3), 1.0 + rand(0, 0.3), z + rand(-0.3, 0.3), 8)); }
    const tree = new THREE.Group(); tree.position.set(4.2, 0.2, -3.3); g.add(tree);
    tree.add(cyl(0.6, 0.5, 0.6, pot, 18, 0, 0.3, 0), cyl(0.12, 0.18, 1.9, std('#8a5a3a'), 8, 0, 1.4, 0));
    for (const [x, y, z, r] of [[0, 2.6, 0, 0.8], [0.5, 2.3, 0.3, 0.55], [-0.5, 2.4, -0.2, 0.55], [0.1, 3.1, -0.1, 0.5]]) tree.add(sphere(r, leaf[1], x, y, z, 10));
    const caps = [];
    for (const [x, z, s] of [[4.4, 1.6, 1], [4.0, 2.6, 0.7]]) { g.add(cyl(0.08 * s, 0.12 * s, 0.7 * s, std('#f6efe0'), 10, x, 0.2 + 0.35 * s, z)); const c = new THREE.Mesh(new THREE.SphereGeometry(0.42 * s, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#ff6b6b')); c.position.set(x, 0.2 + 0.68 * s, z); g.add(c); for (let k = 0; k < 4; k++) g.add(sphere(0.06 * s, std('#ffffff'), x + Math.cos(k * 1.6) * 0.25 * s, 0.2 + 0.86 * s, z + Math.sin(k * 1.6) * 0.25 * s, 6)); caps.push(c); }
    // watering can on the floor
    g.add(cyl(0.22, 0.25, 0.4, std('#3fa9ff'), 12, -3.2, 0.4, 3.6));
    return { ups, holo: (h) => {
      const grp = new THREE.Group(); h.add(grp);
      const m1 = neon(def.color, 2.4), m2 = neon('#d6ffe0', 2);
      for (let i = 0; i < 16; i++) { const y = -0.45 + i * 0.06, a = i * 0.55; grp.add(sphere(0.035, m1, Math.cos(a) * 0.25, y, Math.sin(a) * 0.25, 6), sphere(0.035, m2, -Math.cos(a) * 0.25, y, -Math.sin(a) * 0.25, 6)); }
      return (t) => { grp.rotation.y = t * 0.7; };
    } };
  },
  flood(g, def) {
    const ups = [];
    ups.push(wallScreen(g, def, (ctx, W, Hh, t) => {
      ctx.fillStyle = '#e8e2cf'; ctx.fillRect(0, 0, W, Hh);
      ctx.fillStyle = '#c9c1aa'; for (let x = 0; x < W; x += 44) for (let y = 0; y < Hh; y += 44) ctx.fillRect(x + 4, y + 4, 34, 34);
      const lvl = 0.5 + Math.sin(t * 0.4) * 0.25;
      for (let x = 0; x < W; x += 11) for (let y = 0; y < Hh; y += 11) { const d = (y / Hh) + Math.sin(x * 0.02) * 0.15 - (1 - lvl); if (d > 0) { ctx.fillStyle = `rgba(30,120,230,${Math.min(0.85, d * 1.6)})`; ctx.fillRect(x, y, 10, 10); } }
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 40; i++) { const x = (i * 53 + t * 120) % W, y = (i * 37 + t * 300) % Hh; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 12); ctx.stroke(); }
      ctx.fillStyle = '#10204a'; ctx.font = `700 34px ${FONT}`; ctx.fillText(`${(lvl * 60).toFixed(0)} cm`, W - 150, 40); ctx.font = `500 15px ${FONT}`; ctx.fillText('rain 82 mm/hr', W - 150, 72);
    }));
    // flood tank model
    const tank = new THREE.Group(); tank.position.set(-4.0, 0.2, -2.6); g.add(tank);
    tank.add(box(2.2, 0.8, 2.6, std('#ffffff'), 0, 0.4, 0));
    for (let i = 0; i < 6; i++) tank.add(box(0.35, rand(0.3, 0.9), 0.35, std(['#ffd27a', '#ff9fc8', '#9fdcff'][i % 3]), -0.6 + (i % 3) * 0.6, 1.0, -0.7 + Math.floor(i / 3) * 1.2));
    const water = box(2.0, 1, 2.4, new THREE.MeshToonMaterial({ color: '#3fa9ff', transparent: true, opacity: 0.55 }), 0, 0.8, 0); tank.add(water);
    tank.add(box(2.24, 1.3, 2.64, new THREE.MeshToonMaterial({ color: '#dff4ff', transparent: true, opacity: 0.18, depthWrite: false }), 0, 1.45, 0));
    // rain gauge + umbrella stand
    g.add(cyl(0.18, 0.18, 1.1, new THREE.MeshToonMaterial({ color: '#dff4ff', transparent: true, opacity: 0.5 }), 14, 4.3, 0.75, -3.4), cyl(0.12, 0.12, 0.6, std('#3fa9ff'), 12, 4.3, 0.5, -3.4));
    const umb = new THREE.Group(); umb.position.set(4.2, 0.2, 2.0); g.add(umb);
    umb.add(cyl(0.3, 0.3, 0.6, std('#ffffff'), 14, 0, 0.3, 0));
    ['#ffd23f', '#ff4d5e', '#33a8ff'].forEach((c, i) => { const u = cyl(0.04, 0.12, 1.2, std(c), 8, -0.1 + i * 0.1, 0.9, 0); u.rotation.z = (i - 1) * 0.12; umb.add(u); });
    ups.push((t) => { const lv = 0.4 + (Math.sin(t * 0.4) * 0.5 + 0.5) * 0.7; water.scale.y = lv; water.position.y = 0.8 + lv / 2 - 0.1; });
    return { ups, holo: (h) => {
      const geo = new THREE.PlaneGeometry(1.2, 1.2, 14, 14); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, wire(def.color, 1.6)); h.add(m);
      const drop = sphere(0.15, neon('#bfefff', 2), 0, 0.45, 0, 12); drop.scale.y = 1.35; h.add(drop);
      const p = geo.attributes.position;
      return (t) => { for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.sin(Math.hypot(x, z) * 7 - t * 3) * 0.06); } p.needsUpdate = true; drop.position.y = 0.45 + Math.sin(t * 2) * 0.1; };
    } };
  },
  sky(g, def) {
    const ups = [];
    ups.push(wallScreen(g, def, (ctx, W, Hh, t) => {
      for (let x = 0; x < W; x += 30) for (let y = 0; y < Hh; y += 30) { const v = (Math.sin(x * 0.03) + Math.cos(y * 0.05 + x * 0.01)) * 0.25 + 0.5; ctx.fillStyle = `rgb(${Math.round(70 + v * 90)},${Math.round(90 + v * 80)},${Math.round(70 + v * 50)})`; ctx.fillRect(x, y, 30, 30); }
      ctx.fillStyle = 'rgba(120,140,255,.22)'; const sx = (t * 60) % (W + 120) - 60; ctx.fillRect(sx - 40, 0, 80, Hh);
      ctx.strokeStyle = '#b8b0ff'; ctx.lineWidth = 2; ctx.strokeRect(sx - 40, 0, 80, Hh);
      ctx.fillStyle = '#fff'; ctx.font = `700 30px ${FONT}`; ctx.fillText('10 m / px', W - 180, 40); ctx.font = `500 15px ${FONT}`; ctx.fillText(`pass ${(t / 10 | 0) % 99 + 1} · cloud 12%`, W - 180, 72);
    }));
    const dish = new THREE.Group(); dish.position.set(-4.0, 0.2, -3.2); g.add(dish);
    dish.add(cyl(0.3, 0.45, 1.4, std('#ffffff'), 14, 0, 0.7, 0));
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.32), std('#f4f6fb', { side: THREE.DoubleSide })); bowl.rotation.x = Math.PI - 0.8; bowl.position.set(0, 2.1, 0.2); dish.add(bowl);
    dish.add(sphere(0.1, neon(def.color, 2.6), 0, 2.2, 0.9, 8));
    const tel = new THREE.Group(); tel.position.set(4.2, 0.2, -3.0); g.add(tel);
    for (const a of [0, 2.1, 4.2]) { const lg = cyl(0.03, 0.03, 1.4, std('#8a93a8'), 6, Math.sin(a) * 0.3, 0.65, Math.cos(a) * 0.3); lg.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25); tel.add(lg); }
    const tube = cyl(0.13, 0.2, 1.5, std(def.color), 16, 0, 1.55, 0); tube.rotation.x = -1.0; tel.add(tube);
    const stars = canvasTex(256, 256, (ctx, w, h) => { ctx.fillStyle = '#141a40'; ctx.beginPath(); ctx.arc(128, 128, 124, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(30 + Math.random() * 196, 30 + Math.random() * 196, Math.random() * 2.5 + 0.5, 0, 7); ctx.fill(); } });
    const chart = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40), new THREE.MeshBasicMaterial({ map: stars.tex, transparent: true })); chart.position.set(-4.9, 2.4, 1.2); chart.rotation.y = Math.PI / 2; g.add(chart);
    return { ups, holo: (h) => {
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), wire('#9fdcff', 1.4)); h.add(globe);
      const pg = new THREE.Group(); pg.rotation.x = 0.4; h.add(pg);
      const sat = new THREE.Group(); sat.position.x = 0.7; pg.add(sat);
      sat.add(box(0.12, 0.12, 0.12, neon('#ffffff', 2)), box(0.4, 0.02, 0.12, neon(def.color, 2)));
      return (t) => { globe.rotation.y = t * 0.4; pg.rotation.y = t * 1.2; };
    } };
  },
  crowd(g, def) {
    const ups = [];
    const flow = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: rand(0.03, 0.08) }));
    ups.push(wallScreen(g, def, (ctx, W, Hh, t) => {
      ctx.fillStyle = '#121a36'; ctx.fillRect(0, 0, W, Hh);
      ctx.fillStyle = '#2b3560'; ctx.fillRect(0, 0, W, 60); ctx.fillRect(0, Hh - 60, W, 60); ctx.fillRect(W * 0.55, 60, 24, 60); ctx.fillRect(W * 0.55, Hh - 120, 24, 60);
      flow.forEach((p) => { p.x += p.s * 0.3; if (p.x > 1) p.x = 0; const bott = Math.abs(p.x - 0.56) < 0.08; const y = 60 + (bott ? 0.35 + p.y * 0.3 : p.y) * (Hh - 120); ctx.fillStyle = bott ? '#ffd23f' : '#ff9fd0'; ctx.beginPath(); ctx.arc(p.x * W, y, 5, 0, 7); ctx.fill(); });
      ctx.fillStyle = '#fff'; ctx.font = `700 30px ${FONT}`; ctx.fillText(`${(1204 + Math.round(Math.sin(t) * 30)).toLocaleString()} people`, W - 260, 100); ctx.font = `500 15px ${FONT}`; ctx.fillText('bottleneck 1.8 p/m/s', W - 260, 128);
    }));
    // evacuation maze table
    const mt = new THREE.Group(); mt.position.set(-4.0, 0.2, -2.4); g.add(mt);
    mt.add(box(2.0, 0.8, 2.8, std('#ffffff'), 0, 0.4, 0), box(1.9, 0.05, 2.7, std('#2b3350'), 0, 0.82, 0));
    for (const [x, z, w, d] of [[-0.5, -0.6, 0.06, 1.2], [0.4, 0.3, 0.06, 1.4], [-0.1, 0.9, 1.0, 0.06], [0.2, -1.0, 1.0, 0.06]]) mt.add(box(w, 0.2, d, std('#ffffff'), x, 0.95, z));
    const dots = particles(36, def.color, 0.07); dots.pts.position.y = 0.9; mt.add(dots.pts);
    const dd = Array.from({ length: 36 }, () => ({ t: Math.random(), lane: rand(-0.8, 0.8) }));
    // turnstile gate
    const gt = new THREE.Group(); gt.position.set(4.2, 0.2, -3.0); g.add(gt);
    gt.add(box(0.4, 1.0, 1.2, std('#ffffff'), -0.5, 0.5, 0), box(0.4, 1.0, 1.2, std('#ffffff'), 0.5, 0.5, 0), box(0.25, 0.1, 0.02, neon('#3fd17a', 2), -0.5, 1.02, 0.4));
    const arm = new THREE.Group(); arm.position.set(-0.3, 0.8, 0); gt.add(arm);
    for (let i = 0; i < 3; i++) { const a = box(0.5, 0.05, 0.05, std('#8a93a8'), 0.25, 0, 0); const p = new THREE.Group(); p.rotation.x = (i / 3) * Math.PI * 2; p.add(a); arm.add(p); }
    g.add(box(0.6, 1.6, 0.04, std(def.color), 4.6, 1.2, 1.8)); // banner flag
    ups.push((t, dt) => {
      arm.rotation.x += dt * 1.5;
      dd.forEach((d, i) => { d.t += dt * 0.15; if (d.t > 1) d.t = 0; dots.pos.set([d.lane * 0.9, 0.08, 1.3 - d.t * 2.6], i * 3); dots.sz[i] = 0.8; dots.al[i] = 1; }); dots.commit();
    });
    return { ups, holo: (h) => {
      const N = 50, P = particles(N, def.color, 0.08); h.add(P.pts);
      return (t) => { for (let i = 0; i < N; i++) { const a = t * 0.8 + i * 0.13, r = 0.35 + Math.sin(i * 1.7 + t) * 0.12; P.pos.set([Math.cos(a) * r, Math.sin(a * 2 + i) * 0.2, Math.sin(a) * r], i * 3); P.sz[i] = 0.8; P.al[i] = 1; } P.commit(); };
    } };
  },
  data(g, def, room) {
    const ups = [];
    const frame = box(10.6, 3.2, 0.16, std('#1d2440'), 0, 2.3, -H + 0.32); g.add(frame);
    const scr = makeOpsScreens();
    for (const [k, x, w] of [['ci', -3.9, 2.4], ['code', -1.3, 2.6], ['term', 1.3, 2.6], ['lat', 3.9, 2.4]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.3), new THREE.MeshBasicMaterial({ map: scr[k].tex, color: new THREE.Color(1.15, 1.15, 1.15) }));
      m.position.set(x, 2.15, -H + 0.41); g.add(m);
    }
    const ticker = new THREE.Mesh(new THREE.PlaneGeometry(10.3, 0.32), new THREE.MeshBasicMaterial({ map: scr.tick.tex })); ticker.position.set(0, 3.62, -H + 0.41); g.add(ticker);
    // three-monitor on-call desk (operator faces the wall)
    g.add(box(3.4, 0.1, 1.2, std('#ffffff'), 0, 0.98, -2.6), box(0.1, 0.76, 1.0, std('#8a93a8'), -1.5, 0.58, -2.6), box(0.1, 0.76, 1.0, std('#8a93a8'), 1.5, 0.58, -2.6));
    g.add(box(3.3, 0.06, 0.06, std(def.color), 0, 0.92, -2.02));
    const mt = [scr.code, scr.topo, scr.term];
    [[-1.1, 0.38], [0, 0], [1.1, -0.38]].forEach(([x, ry], i) => {
      const m = new THREE.Group(); m.position.set(x, 1.5, -2.85 + Math.abs(x) * 0.12); m.rotation.y = ry; g.add(m);
      m.add(box(1.08, 0.66, 0.05, std('#1d2440'), 0, 0, -0.02));
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.58), new THREE.MeshBasicMaterial({ map: mt[i].tex })); s.position.z = 0.01; m.add(s);
      m.add(cyl(0.03, 0.03, 0.45, std('#8a93a8'), 6, 0, -0.4, -0.06));
    });
    const seat = std(def.color);
    g.add(cyl(0.44, 0.44, 0.12, seat, 20, 0, 0.7, -1.35), box(0.84, 0.76, 0.12, seat, 0, 1.15, -0.9), cyl(0.06, 0.06, 0.45, std('#8a93a8'), 8, 0, 0.45, -1.35));
    // server racks on both sides
    const rack = makeRackTex(def.color);
    for (const [x, z] of [[-4.6, -3.4], [-4.8, -2.2], [-4.8, -1.0], [4.6, -3.4], [4.8, -2.2], [4.8, -1.0]]) {
      const r = new THREE.Group(); r.position.set(x, 0.2, z); r.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(r);
      r.add(box(1.0, 2.5, 0.95, std('#2b3350'), 0, 1.25, 0));
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.35), new THREE.MeshBasicMaterial({ map: rack.tex, color: new THREE.Color(1.3, 1.3, 1.3) })); f.position.set(0, 1.25, 0.48); r.add(f);
      r.add(box(1.02, 0.06, 0.06, std(def.color), 0, 2.52, 0.48));
    }
    let acc = 0;
    ups.push((t, dt) => { acc += dt; if (acc > 0.25) { acc = 0; scr.tickAll(t); rack.draw(t); } });
    // topology hologram above the desk
    const holo = new THREE.Group(); holo.position.set(0, 2.45, -2.3); g.add(holo);
    const nodes = [], nm = neon('#9fe8ff', 2.6), nm2 = neon(def.color, 3);
    for (let i = 0; i < 11; i++) { const lv = i === 0 ? 0 : i < 4 ? 1 : 2; const a = i * 2.4, r = [0, 0.45, 0.85][lv]; const p = V(Math.cos(a) * r, 0.5 - lv * 0.25, Math.sin(a) * r); holo.add(sphere(lv ? 0.055 : 0.09, lv ? nm : nm2, p.x, p.y, p.z, 10)); nodes.push(p); }
    const edges = []; for (let i = 1; i < 11; i++) edges.push([i < 4 ? 0 : 1 + ((i - 4) % 3), i]); edges.push([1, 2], [2, 3], [3, 1]);
    holo.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(edges.flatMap(([a, b]) => [nodes[a], nodes[b]])), new THREE.LineBasicMaterial({ color: new THREE.Color('#5fc8ff').multiplyScalar(1.6) })));
    const pulses = particles(edges.length, '#ffffff', 0.12); holo.add(pulses.pts);
    ups.push((t) => { holo.rotation.y = t * 0.25; edges.forEach(([a, b], i) => { const p = nodes[a].clone().lerp(nodes[b], (t * 0.8 + i * 0.37) % 1); pulses.pos.set([p.x, p.y, p.z], i * 3); pulses.sz[i] = 0.6; pulses.al[i] = 1; }); pulses.commit(); });
    room.custom = { seat: V(0, 0.2, -1.35), seatYaw: Math.PI, way: [V(0, 0.2, 3.6), V(0, 0.2, -1.35)] };
    return { ups, holo: null };
  },
};

export function buildLabs(scene) {
  return ROOMS.map((def) => {
    const room = { def, ups: [] };
    const { g, floor, fade, light } = shell(def);
    Object.assign(room, { group: g, floor, fade, light });
    const d = DECOR[def.key](g, def, room);
    room.ups.push(...d.ups);
    if (!room.custom) {
      const cz = desk(g, def.color, -1.0, 1);
      room.custom = { seat: V(0, 0.2, cz), seatYaw: 0, way: [V(2.7, 0.2, 2.4), V(2.7, 0.2, cz), V(0, 0.2, cz)] };
      if (d.holo) { const h = projector(g, def.color, -3.0, 2.6); room.ups.push(d.holo(h)); }
    }
    // sign above the door + a floating type badge
    const sign = textSign(def.room, def.color, 2.4, 0.56, { bright: 1.0, light: true }); sign.mesh.position.set(0, 3.6, H + 0.6); g.add(sign.mesh);
    room.sign = sign;
    scene.add(g);
    return room;
  });
}

export function buildDesk(scene, company) {
  const def = LOBBY;
  const room = { def, ups: [] };
  const { g, floor, fade, light } = shell(def, { noWall: true, glassless: true });
  Object.assign(room, { group: g, floor, fade, light });
  floor.material = std('#fff8ec');
  // rainbow welcome arc on the floor
  COLORS.forEach((c, i) => { const a = new THREE.Mesh(new THREE.RingGeometry(3.4 + i * 0.22, 3.58 + i * 0.22, 48, 1, 0, Math.PI), std(c)); a.rotation.x = -Math.PI / 2; a.rotation.z = Math.PI; a.position.set(0, 0.22, 1.2); g.add(a); });
  // round counter
  const sh = new THREE.Shape(); const r0 = 2.0, r1 = 2.5, a0 = -1.1, a1 = 1.1, cz = -0.8;
  const P = (r, a) => new THREE.Vector2(r * Math.sin(a), -(r * Math.cos(a) + cz));
  sh.moveTo(P(r0, a0).x, P(r0, a0).y); for (let i = 0; i <= 28; i++) { const p = P(r1, a0 + ((a1 - a0) * i) / 28); sh.lineTo(p.x, p.y); } for (let i = 28; i >= 0; i--) { const p = P(r0, a0 + ((a1 - a0) * i) / 28); sh.lineTo(p.x, p.y); }
  const cg = new THREE.ExtrudeGeometry(sh, { depth: 1.1, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }); cg.rotateX(-Math.PI / 2); cg.translate(0, 0.2, 0);
  const counter = new THREE.Mesh(cg, std('#ffffff')); counter.castShadow = true; g.add(counter);
  const band = new THREE.Mesh(cg.clone(), std('#ff4d5e')); band.scale.set(1.01, 0.12, 1.01); band.position.y = 0.55; g.add(band);
  for (const s of [-1, 1]) { const m = new THREE.Group(); m.position.set(s * 0.8, 1.35, 0.9); m.rotation.y = Math.PI + s * 0.3; g.add(m); m.add(box(0.7, 0.42, 0.04, std('#1d2440'), 0, 0.22, 0), box(0.62, 0.35, 0.01, neon(s < 0 ? '#33a8ff' : '#c35bff', 1.2), 0, 0.22, -0.03)); }
  g.add(cyl(0.12, 0.16, 0.3, std('#ffffff'), 12, 0, 1.45, 1.5), sphere(0.24, std('#4fbf5a'), 0, 1.72, 1.5, 8));
  // floating company sign
  const sign = textSign(company, '#c35bff', 5.6, 1.15, { scale: 0.5, bright: 1.0, light: true }); sign.mesh.position.set(0, 4.6, -0.4); g.add(sign.mesh);
  room.sign = sign;
  // sofas + tables
  for (const s of [-1, 1]) {
    const so = new THREE.Group(); so.position.set(s * 3.9, 0.2, 2.4); so.rotation.y = -s * 1.0; g.add(so);
    const sm = std(s < 0 ? '#ffb3c7' : '#9fd6ff'), cm = std('#ffffff');
    so.add(box(2.4, 0.42, 1.0, sm, 0, 0.21, 0), box(2.4, 0.7, 0.25, sm, 0, 0.75, -0.42), box(0.25, 0.6, 1.0, sm, -1.2, 0.45, 0), box(0.25, 0.6, 1.0, sm, 1.2, 0.45, 0));
    so.add(box(1.05, 0.14, 0.8, cm, -0.55, 0.48, 0.05), box(1.05, 0.14, 0.8, cm, 0.55, 0.48, 0.05));
    so.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }
  // NOVA charging pad + kiosk
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.08, 32), std('#ffffff')); pad.position.set(2.4, 0.24, 4.2); g.add(pad);
  { const tr = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.03, 6, 32), neon('#5ff3ff', 2.6)); tr.rotation.x = Math.PI / 2; tr.position.set(2.4, 0.29, 4.2); g.add(tr); }
  const kiosk = new THREE.Group(); kiosk.position.set(-2.6, 0.2, 4.3); g.add(kiosk);
  kiosk.add(cyl(0.3, 0.38, 1.0, std('#ffffff'), 20, 0, 0.5, 0));
  const kh = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), wire('#5ff3ff', 1.6)); kh.position.y = 1.55; kiosk.add(kh);
  for (const x of [-5.0, 5.0]) { g.add(cyl(0.35, 0.3, 0.45, std('#e98a5a'), 14, x, 0.42, -3.8), sphere(0.42, std('#4fbf5a'), x, 0.95, -3.8, 8)); }
  room.custom = { seat: V(0, 0.2, -1.6), seatYaw: Math.PI, way: [] };
  room.sofas = [-1, 1].map((s) => ({ p: V(s * 3.75, 0.2, 2.55), yaw: -s * 1.0 }));
  room.ups.push((t) => { sign.mesh.position.y = 4.6 + Math.sin(t * 0.9) * 0.12; kh.rotation.y = t; });
  scene.add(g);
  return room;
}


// ------------------------------------------------------------ ops screens
function makeOpsScreens() {
  const C = { bg: '#060a16', dim: '#4a5a80', txt: '#cfe0ff', ok: '#3ee07f', run: '#ffd93d', bad: '#ff3d5a', acc: '#2fb6ff', vio: '#b84dff' };
  const head = (ctx, w, title, sub) => {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, 600);
    ctx.fillStyle = '#0c1328'; ctx.fillRect(0, 0, w, 46);
    ctx.fillStyle = C.run; ctx.font = `700 22px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillText(title, 18, 24);
    ctx.fillStyle = C.dim; ctx.font = `500 16px ui-monospace,Menlo,monospace`; ctx.textAlign = 'right'; ctx.fillText(sub, w - 16, 24); ctx.textAlign = 'left';
  };
  const jobs = ['lint', 'typecheck', 'unit · 1,284', 'sim regression', 'tile build', 'build · x86', 'e2e · map ui', 'canary deploy', 'smoke'];
  const st = jobs.map((_, i) => ({ s: i < 5 ? 'ok' : i === 5 ? 'run' : 'q', p: i === 5 ? 0.3 : 0 }));
  let tick = 0;
  const ci = canvasTex(680, 540, (ctx, w, h) => {
    head(ctx, w, 'CI · main #4821', 'pipeline');
    st.forEach((j, i) => {
      const y = 70 + i * 50;
      ctx.fillStyle = j.s === 'ok' ? C.ok : j.s === 'run' ? C.run : j.s === 'bad' ? C.bad : C.dim;
      ctx.beginPath(); ctx.arc(30, y + 14, 9, 0, 7); ctx.fill();
      ctx.fillStyle = C.txt; ctx.font = `500 22px ui-monospace,Menlo,monospace`; ctx.fillText(jobs[i], 52, y + 15);
      ctx.fillStyle = '#121a33'; ctx.fillRect(330, y + 6, 320, 16);
      ctx.fillStyle = j.s === 'ok' ? C.ok : C.run; ctx.fillRect(330, y + 6, 320 * (j.s === 'ok' ? 1 : j.p), 16);
    });
  });
  const code = canvasTex(760, 540, (ctx, w, h, off = 0) => {
    head(ctx, w, 'crowd_sim.py', 'main ● 3 changes');
    const lines = [
      ['k', 'def '], ['f', 'step'], ['t', '(agents, dt):'],
      ['c', '    # social-force model, one tick'],
      ['k', '    for '], ['t', 'a '], ['k', 'in '], ['t', 'agents:'],
      ['t', '        f = goal_force(a) + wall_force(a)'],
      ['t', '        f += sum(repulse(a, b) '], ['k', 'for '], ['t', 'b '], ['k', 'in '], ['t', 'near(a))'],
      ['t', '        a.v = clip(a.v + f*dt, '], ['s', 'v_max'], ['t', ')'],
      ['t', '        a.pos += a.v * dt'],
      ['t', '        a.heat += wbgt(a.pos) * dt'],
      ['k', '    return '], ['t', 'agents'], ['t', ''],
      ['t', 'sim = Sim(grid='], ['s', "'taipei_10m'"], ['t', ', n=5400)'],
    ];
    const col = { k: '#ff79c6', f: '#50fa7b', t: '#cfe0ff', s: '#f1fa8c', c: '#6272a4' };
    let y = 78, x = 70, ln = 1;
    ctx.font = `500 21px ui-monospace,Menlo,monospace`;
    const flat = []; let cur = [];
    for (const l of lines) { cur.push(l); if (/[{};)]$|^\s*\/\//.test(l[1]) || l[1] === '' || l[1].endsWith('{') ) { flat.push(cur); cur = []; } }
    flat.forEach((row, i) => {
      const yy = y + i * 30; if (yy > h - 10) return;
      ctx.fillStyle = C.dim; ctx.fillText(String(ln++).padStart(2), 14, yy);
      let xx = x; row.forEach(([k, s]) => { ctx.fillStyle = col[k]; ctx.fillText(s, xx, yy); xx += ctx.measureText(s).width; });
      if (i === (off % flat.length)) { ctx.fillStyle = 'rgba(47,182,255,.12)'; ctx.fillRect(0, yy - 15, w, 30); ctx.fillStyle = C.acc; ctx.fillRect(xx + 2, yy - 12, 11, 24); }
    });
  });
  const termLines = [];
  const msgs = ['✓ sim step 1200 · 5,400 agents', 'mean speed 1.21 m/s', 'WBGT max 31.6°C @ Ximen', 'PM2.5 tile 25/40 done', 'deploy canary → 5% traffic', 'p95 latency 182ms (slo 250ms)',
    '✓ pods ready 24/24', 'WARN retry upstream geo-db (1/3)', 'GET /api/v2/tiles 200 38ms', 'flood depth raster ✓', 'cache hit 97.4%', '✓ smoke tests passed'];
  const term = canvasTex(760, 540, (ctx, w, h) => {
    head(ctx, w, 'oncall@prod ~ tail -f', 'tty1');
    ctx.font = `500 20px ui-monospace,Menlo,monospace`;
    termLines.slice(-15).forEach((l, i) => { ctx.fillStyle = l.includes('WARN') ? C.run : l.startsWith('✓') ? C.ok : '#9fe8b8'; ctx.fillText(l, 16, 76 + i * 30); });
    ctx.fillStyle = C.ok; ctx.fillText('$ ', 16, 76 + Math.min(termLines.length, 15) * 30); ctx.fillRect(40, 64 + Math.min(termLines.length, 15) * 30, 11, 22);
  });
  const lat = [], lat2 = [];
  for (let i = 0; i < 60; i++) { lat.push(120 + Math.random() * 40); lat2.push(50 + Math.random() * 15); }
  const latC = canvasTex(680, 540, (ctx, w, h) => {
    head(ctx, w, 'Latency · edge', 'p50 / p95 · ms');
    const X0 = 50, Y0 = 470, W = w - 80, H = 360;
    ctx.strokeStyle = '#18213e'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const y = Y0 - (H * i) / 4; ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(X0 + W, y); ctx.stroke(); ctx.fillStyle = C.dim; ctx.font = '15px ui-monospace,monospace'; ctx.fillText(String(i * 75), 8, y); }
    ctx.strokeStyle = C.bad; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(X0, Y0 - H * 250 / 300); ctx.lineTo(X0 + W, Y0 - H * 250 / 300); ctx.stroke(); ctx.setLineDash([]);
    const plot = (arr, c, fill) => {
      ctx.beginPath(); arr.forEach((v, i) => { const x = X0 + (W * i) / (arr.length - 1), y = Y0 - (H * v) / 300; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.stroke();
      if (fill) { ctx.lineTo(X0 + W, Y0); ctx.lineTo(X0, Y0); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
    };
    plot(lat, C.run, 'rgba(255,217,61,.10)'); plot(lat2, C.acc, 'rgba(47,182,255,.12)');
    ctx.fillStyle = C.run; ctx.font = `700 40px ${FONT}`; ctx.fillText(`${lat[lat.length - 1] | 0}`, X0 + 10, 86); ctx.font = '16px ui-monospace,monospace'; ctx.fillStyle = C.dim; ctx.fillText('p95 ms', X0 + 92, 86);
  });
  const topo = canvasTex(520, 300, (ctx, w, h, t = 0) => {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    const n = [[260, 60], [120, 150], [260, 150], [400, 150], [70, 240], [180, 240], [300, 240], [440, 240]];
    const e = [[0, 1], [0, 2], [0, 3], [1, 4], [1, 5], [2, 5], [2, 6], [3, 6], [3, 7]];
    ctx.strokeStyle = '#2fb6ff'; ctx.lineWidth = 2; e.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(...n[a]); ctx.lineTo(...n[b]); ctx.stroke(); });
    n.forEach(([x, y], i) => { ctx.fillStyle = i === 6 && Math.sin(t * 3) > 0 ? C.run : i ? C.ok : C.vio; ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.fill(); });
    ctx.fillStyle = C.txt; ctx.font = `700 18px ${FONT}`; ctx.fillText('svc mesh · 8 nodes', 14, 24);
  });
  const tick2 = canvasTex(2400, 60, (ctx, w, h, t = 0) => {
    ctx.fillStyle = '#05070e'; ctx.fillRect(0, 0, w, h);
    ctx.font = `700 32px ${FONT}`; ctx.textBaseline = 'middle';
    const s = '● ALL SYSTEMS NOMINAL   ▲ deploys today 14   ◆ error rate 0.02%   ● p95 182ms   ▲ uptime 99.99%   ◆ queue 3   ● on-call: Byte   ';
    const sw = ctx.measureText(s).width, off = (t * 90) % sw;
    ctx.fillStyle = '#ffd93d'; ctx.fillText(s + s + s, -off, h / 2);
  });
  return {
    ci, code, term, lat: latC, topo, tick: tick2,
    tickAll(t) {
      tick++;
      const r = st.find((j) => j.s === 'run');
      if (r) { r.p += 0.06; if (r.p >= 1) { r.s = 'ok'; r.p = 1; const nx = st.find((j) => j.s === 'q'); if (nx) nx.s = 'run'; } }
      else if (tick % 20 === 0) st.forEach((j, i) => { j.s = i < 3 ? 'ok' : i === 3 ? 'run' : 'q'; j.p = 0; });
      ci.draw();
      if (tick % 3 === 0) code.draw((tick / 3) | 0);
      if (tick % 2 === 0) { termLines.push(`${new Date().toTimeString().slice(0, 8)}  ${msgs[(Math.random() * msgs.length) | 0]}`); if (termLines.length > 40) termLines.shift(); term.draw(); }
      lat.shift(); lat.push(Math.max(90, Math.min(240, lat[lat.length - 1] + (Math.random() - 0.5) * 30))); lat2.shift(); lat2.push(45 + Math.random() * 20); latC.draw();
      topo.draw(t); tick2.draw(t);
    },
  };
}
function makeRackTex(col) {
  return canvasTex(128, 352, (ctx, w, h, t = 0) => {
    ctx.fillStyle = '#070a14'; ctx.fillRect(0, 0, w, h);
    for (let u = 0; u < 14; u++) {
      const y = 8 + u * 24;
      ctx.fillStyle = '#10162a'; ctx.fillRect(6, y, w - 12, 20);
      for (let k = 0; k < 6; k++) { ctx.fillStyle = '#1c2440'; ctx.fillRect(40 + k * 12, y + 6, 8, 8); }
      for (let k = 0; k < 3; k++) { const on = Math.random() > 0.35; ctx.fillStyle = on ? (k === 2 && Math.random() < 0.15 ? '#ffd93d' : k === 0 ? '#3ee07f' : '#2fb6ff') : '#0f2a1a'; ctx.fillRect(12 + k * 8, y + 7, 5, 6); }
    }
  });
}

