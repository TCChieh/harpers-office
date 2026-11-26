import * as THREE from 'three';
import { COLORS, LAYERS, RING } from './config.js';
import { neon, std, cyl, box, sphere, particles, rand } from './util.js';

const RAIN = COLORS.map((c) => new THREE.Color(c));

/** Centre plaza: a 3D "digital twin" of the city on a map table, cycling GIS layers in rainbow order. */
export function buildTwin(scene, reduced) {
  const g = new THREE.Group(); scene.add(g);
  const TOP = 1.15, R = 5.4;

  // table
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.3, R + 0.7, TOP, 64), std('#eef1fa'));
  base.position.y = TOP / 2; base.castShadow = base.receiveShadow = true; g.add(base);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.72, R + 0.72, 0.22, 64, 1, true), std('#2b3350')); band.position.y = 0.3; g.add(band);
  const rimMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.32, 0.07, 8, 96), rimMat); rim.rotation.x = Math.PI / 2; rim.position.y = TOP; g.add(rim);
  const mapTop = new THREE.Mesh(new THREE.CircleGeometry(R + 0.25, 64), std('#dfe6f5')); mapTop.rotation.x = -Math.PI / 2; mapTop.position.y = TOP + 0.01; g.add(mapTop);

  // mini city: blocks of tiny buildings
  const N = 13, cell = (R * 1.32) / N;
  const cells = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = (i - (N - 1) / 2) * cell, z = (j - (N - 1) / 2) * cell;
    if (Math.hypot(x, z) > R - 0.35) continue;
    if (i % 4 === 2 || j % 4 === 2) continue; // mini streets
    cells.push({ x, z, h: 0.1 + Math.pow(Math.random(), 2.4) * 0.75 * (1 - Math.hypot(x, z) / R * 0.6) });
  }
  const bg = new THREE.BoxGeometry(cell * 0.78, 1, cell * 0.78); bg.translate(0, 0.5, 0);
  const minis = new THREE.InstancedMesh(bg, std('#ffffff'), cells.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  cells.forEach((c, i) => { m4.compose(v.set(c.x, TOP + 0.02, c.z), q, s.set(1, c.h, 1)); minis.setMatrixAt(i, m4); minis.setColorAt(i, new THREE.Color('#f2f4fb')); });
  g.add(minis);

  // layer extras
  const water = new THREE.Mesh(new THREE.CircleGeometry(R - 0.1, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#33a8ff').multiplyScalar(1.2), transparent: true, opacity: 0, depthWrite: false }));
  water.rotation.x = -Math.PI / 2; g.add(water);
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color('#6a63ff').multiplyScalar(3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  scan.rotation.x = -Math.PI / 2; scan.position.y = TOP + 1.2; g.add(scan);
  const dots = particles(140, '#ffffff', 0.09); g.add(dots.pts);
  const dotT = Array.from({ length: 140 }, () => ({ lane: ((Math.random() * 3) | 0) - 1, axis: Math.random() < 0.5, t: Math.random(), sp: rand(0.05, 0.12) * (Math.random() < 0.5 ? -1 : 1) }));
  const netPts = cells.filter((c) => c.h > 0.4).slice(0, 10).map((c) => new THREE.Vector3(c.x, TOP + c.h + 0.1, c.z));
  const netG = new THREE.BufferGeometry().setFromPoints(netPts.flatMap((p, i) => [p, netPts[(i + 3) % netPts.length]]));
  const net = new THREE.LineSegments(netG, new THREE.LineBasicMaterial({ color: new THREE.Color('#ffd23f').multiplyScalar(2.5), transparent: true, opacity: 0 })); g.add(net);
  const plume = particles(90, '#ff9a3c', 0.5); g.add(plume.pts);

  // breathing ring on the plaza floor + projector beam + floating emblem
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(R + 1.3, R + 2.1, 96), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
  const ringCore = new THREE.Mesh(new THREE.TorusGeometry(R + 1.7, 0.06, 6, 96), new THREE.MeshBasicMaterial({ color: 0xffffff })); ringCore.rotation.x = Math.PI / 2; ringCore.position.y = 0.05; g.add(ringCore);
  // compass rose marks around the ring (N E S W)
  for (let k = 0; k < 4; k++) { const tri = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 3), std(k === 0 ? '#ff4d5e' : '#ffffff')); tri.rotation.x = -Math.PI / 2; tri.rotation.z = -k * Math.PI / 2; const a = k * Math.PI / 2; tri.position.set(Math.sin(a) * (R + 2.7), 0.06, -Math.cos(a) * (R + 2.7)); tri.scale.y = 0.15; g.add(tri); }

  const emblem = new THREE.Group(); emblem.position.y = 6.2; g.add(emblem);
  const ER = 1.7;
  for (let i = 0; i < 7; i++) {
    const a0 = (i / 7) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / 7) * Math.PI * 2 - Math.PI / 2;
    const p0 = new THREE.Vector3(Math.cos(a0) * ER, Math.sin(a0) * ER, 0), p1 = new THREE.Vector3(Math.cos(a1) * ER, Math.sin(a1) * ER, 0);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, p0.distanceTo(p1), 8), neon(COLORS[i], 3.4));
    seg.position.copy(p0).add(p1).multiplyScalar(0.5); seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize()); emblem.add(seg);
  }
  const pin = new THREE.Group(); emblem.add(pin); // a map pin in the middle
  pin.add(sphere(0.55, std('#ffffff', { emissive: new THREE.Color('#8fa0ff'), emissiveIntensity: 0.3 }), 0, 0.25, 0, 24));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 24), std('#ffffff', { emissive: new THREE.Color('#8fa0ff'), emissiveIntensity: 0.3 })); tip.rotation.x = Math.PI; tip.position.y = -0.4; pin.add(tip);
  pin.add(sphere(0.22, std('#ff4d5e'), 0, 0.28, 0.42, 12));
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.2, R * 0.9, 4.6, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fb8ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = TOP + 2.4; g.add(beam);
  const light = new THREE.PointLight(0xffffff, 30, 26, 1.6); light.position.y = 4; g.add(light);

  const cur = new THREE.Color(), col = new THREE.Color(), base0 = new THREE.Color('#f2f4fb'), white = new THREE.Color(1, 1, 1);
  const PER = reduced ? 8 : 5;
  const state = { idx: 0, env: 0, color: cur };
  let lastIdx = -1;
  return {
    group: g, emblem, state, TOP,
    update(t, dt) {
      const k = t / PER, idx = Math.floor(k) % 7, f = k - Math.floor(k);
      const env = Math.pow(Math.sin(Math.PI * Math.min(f / 0.94, 1)), 2);
      const c = RAIN[idx]; cur.copy(c);
      ringMat.color.copy(c).multiplyScalar(0.12 + env * 1.2);
      ringCore.material.color.copy(c).multiplyScalar(0.3 + env * 2.6);
      rimMat.color.copy(c).multiplyScalar(0.6 + env * 1.6);
      light.color.copy(c); light.intensity = 10 + env * 40;
      beam.material.color.copy(c).lerp(white, 0.4);
      state.idx = idx; state.env = env;
      if (idx !== lastIdx) { lastIdx = idx; if (state.onLayer) state.onLayer(idx); }
      // colour the mini city by the active layer
      const hot = new THREE.Vector2(Math.sin(t * 0.3) * 2, Math.cos(t * 0.23) * 2);
      cells.forEach((cc, i) => {
        let w = 0;
        switch (idx) {
          case 0: w = Math.max(0, 1 - Math.hypot(cc.x - hot.x, cc.z - hot.y) / 4.5) * 0.7 + cc.h * 0.25; break; // heat island
          case 1: w = Math.max(0, 1 - Math.hypot(cc.x - (t * 0.6 % 12 - 6), cc.z - 1) / 3); break; // smog plume drifting
          case 2: w = cc.h > 0.4 ? 1 : 0.15; break;
          case 3: w = (Math.sin(cc.x * 1.3) * Math.cos(cc.z * 1.1) + 1) * 0.5 < 0.45 ? 1 : 0.1; break;
          case 4: w = cc.z > 1.5 - Math.sin(t) * 0.6 ? 1 : 0.1; break;
          case 5: w = Math.abs(cc.x - (((t * 1.6) % 12) - 6)) < 0.8 ? 1 : 0.25; break;
          default: w = Math.max(0, 1 - (Math.abs(cc.x) < Math.abs(cc.z) ? Math.abs(cc.x) : Math.abs(cc.z)) / 2.2); // crowding near streets
        }
        col.copy(base0).lerp(c, Math.min(1, w) * (0.35 + env * 0.65));
        if (w > 0.6) col.multiplyScalar(1 + env * 0.8);
        minis.setColorAt(i, col);
      });
      minis.instanceColor.needsUpdate = true;
      water.material.opacity = idx === 4 ? env * 0.45 : 0; water.position.y = TOP + 0.05 + env * 0.35;
      scan.material.opacity = idx === 5 ? env : 0; scan.position.x = ((t * 1.6) % 12) - 6; scan.rotation.z = Math.PI / 2;
      net.material.opacity = idx === 2 ? env : 0;
      // crowd dots run along the mini streets
      dotT.forEach((d, i) => {
        d.t += d.sp * dt * (reduced ? 0.3 : 1); if (d.t > 1) d.t -= 1; if (d.t < 0) d.t += 1;
        const along = (d.t * 2 - 1) * (R - 0.5), lane = (d.lane * 4 * cell);
        const x = d.axis ? along : lane, z = d.axis ? lane : along;
        const inside = Math.hypot(x, z) < R - 0.3;
        dots.pos.set([x, TOP + 0.1, z], i * 3); dots.sz[i] = 0.9; dots.al[i] = inside ? (idx === 6 ? 0.4 + env : 0.25) : 0;
      });
      dots.mat.uniforms.uColor.value.copy(idx === 6 ? c : white).multiplyScalar(1.6); dots.commit();
      for (let i = 0; i < 90; i++) {
        const l = ((t * 0.12 + i / 90) % 1);
        plume.pos.set([((t * 0.6) % 12) - 6 + Math.sin(i * 7.3) * 1.2 * l, TOP + 0.4 + l * 2.2, 1 + Math.cos(i * 3.1) * 1.4 * l], i * 3);
        plume.sz[i] = 1.2 + l * 2; plume.al[i] = idx === 1 ? env * (1 - l) * 0.5 : 0;
      }
      plume.commit();
      emblem.rotation.y = t * (reduced ? 0.1 : 0.4);
      emblem.position.y = 6.2 + Math.sin(t * 1.1) * (reduced ? 0.05 : 0.22);
    },
  };
}
export { RING };
