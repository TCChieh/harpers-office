import * as THREE from 'three';
import { COLORS, LAYERS, RING } from './config.js';
import { neon, std, cyl, box, sphere, particles, rand } from './util.js';

const RAIN = COLORS.map((c) => new THREE.Color(c));

/** Centre plaza: a 3D "digital twin" of the city on a map table, cycling GIS layers in rainbow order. */
export function buildTwin(scene, reduced) {
  const g = new THREE.Group(); scene.add(g);
  const TOP = 1.15, R = 5.4;

  // pedestal: dark tiered plinth with glowing bezels
  const dark = std('#1a2142'), darker = std('#10152c');
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.0, R + 1.25, 0.28, 72), darker); plinth.position.y = 0.14; g.add(plinth);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.35, R + 0.75, TOP - 0.28, 72), dark); body.position.y = 0.28 + (TOP - 0.28) / 2; g.add(body);
  const rimMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.33, 0.06, 8, 128), rimMat); rim.rotation.x = Math.PI / 2; rim.position.y = TOP; g.add(rim);
  const bandMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const band = new THREE.Mesh(new THREE.TorusGeometry(R + 0.98, 0.035, 6, 128), bandMat); band.rotation.x = Math.PI / 2; band.position.y = 0.29; g.add(band);
  // vertical light slits around the body
  const slitG = new THREE.BoxGeometry(0.07, 0.42, 0.04), SL = 36;
  const slits = new THREE.InstancedMesh(slitG, bandMat, SL);
  { const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < SL; i++) { const a = (i / SL) * Math.PI * 2, rr = R + 0.58;
      m.compose(new THREE.Vector3(Math.sin(a) * rr, 0.72, Math.cos(a) * rr), qq.setFromAxisAngle(up, a), new THREE.Vector3(1, 1, 1)); slits.setMatrixAt(i, m); } }
  g.add(slits);
  // holographic map surface: grid + radar sweep, tinted by the active layer
  const mapU = { uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uEnv: { value: 0 } };
  const mapTop = new THREE.Mesh(new THREE.CircleGeometry(R + 0.3, 96), new THREE.ShaderMaterial({ uniforms: mapU,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uEnv; varying vec2 vUv;
      float gridLine(vec2 q){ vec2 d = abs(fract(q - .5) - .5) / max(fwidth(q), vec2(1e-3)); return 1. - min(min(d.x, d.y), 1.); }
      void main(){ vec2 p = vUv*2. - 1.; float r = length(p);
        vec3 base = mix(vec3(.05,.08,.18), vec3(.02,.03,.08), r);
        float fine = gridLine(p*16.)*.35, major = gridLine(p*4.);
        float ang = atan(p.y, p.x + 1e-5)/6.28318 + .5;
        float sw = fract(ang - uTime*.12); float sweep = pow(clamp(sw, 0., 1.), 14.) + smoothstep(.997, 1., sw)*2.;
        float rings = 0.; for (int i = 1; i < 4; i++) rings += 1. - smoothstep(0., max(fwidth(r)*1.5, 1e-3), abs(r - float(i)*.25));
        float edge = smoothstep(.86, .985, r) * (1. - smoothstep(.985, 1., r));
        vec3 tint = mix(vec3(.35,.55,1.), uColor, .35 + .65*uEnv);
        vec3 col = base + tint*((fine + major*.6)*.22*(1.-r*.5) + rings*.18 + sweep*.35 + edge*.9);
        gl_FragColor = vec4(clamp(col, 0., 4.), 1.); }` }));
  mapTop.rotation.x = -Math.PI / 2; mapTop.position.y = TOP + 0.01; g.add(mapTop);

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
  const holoMat = new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; varying float vH; varying vec3 vCol; varying vec3 vN;
      void main(){ vUv = uv; vH = position.y; vCol = instanceColor; vN = normal;
        gl_Position = projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; varying float vH; varying vec3 vCol; varying vec3 vN;
      void main(){ float e = min(min(vUv.x, 1.-vUv.x), min(vUv.y, 1.-vUv.y));
        float edge = 1. - smoothstep(.0, .07, e);
        float top = step(.5, vN.y), side = .75 + .25*abs(vN.z);
        vec3 body = mix(vec3(.03,.05,.12), vCol*.5, .15 + .65*vH) * side;
        gl_FragColor = vec4(body + vCol*(edge*1.3 + top*.55), 1.); }` });
  const minis = new THREE.InstancedMesh(bg, holoMat, cells.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  cells.forEach((c, i) => { m4.compose(v.set(c.x, TOP + 0.02, c.z), q, s.set(1, c.h, 1)); minis.setMatrixAt(i, m4); minis.setColorAt(i, new THREE.Color('#6f8cff')); });
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

  // HUD rings: one hugging the map, one on the plaza floor, one floating under the emblem
  const hud = hudTex();
  const hudRing = (size, y, op) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: hud, color: 0xffffff, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; g.add(m); return m; };
  const hudA = hudRing((R + 1.1) * 2, TOP + 0.45, 0.9);
  const ring = hudRing((R + 2.6) * 2, 0.04, 0.55); const ringMat = ring.material;
  const hudB = hudRing(5.2, TOP + 3.3, 0.7);
  const ringCore = new THREE.Mesh(new THREE.TorusGeometry(R + 2.25, 0.03, 6, 128), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })); ringCore.rotation.x = Math.PI / 2; ringCore.position.y = 0.05; g.add(ringCore);
  // compass rose marks around the ring (N E S W)
  for (let k = 0; k < 4; k++) { const tri = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 3), std(k === 0 ? '#ff4d5e' : '#ffffff')); tri.rotation.x = -Math.PI / 2; tri.rotation.z = -k * Math.PI / 2; const a = k * Math.PI / 2; tri.position.set(Math.sin(a) * (R + 2.7), 0.06, -Math.cos(a) * (R + 2.7)); tri.scale.y = 0.15; g.add(tri); }

  const emblem = new THREE.Group(); emblem.position.y = 6.2; g.add(emblem);
  const ER = 1.7;
  for (let i = 0; i < 7; i++) {
    const a0 = (i / 7) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / 7) * Math.PI * 2 - Math.PI / 2;
    const p0 = new THREE.Vector3(Math.cos(a0) * ER, Math.sin(a0) * ER, 0), p1 = new THREE.Vector3(Math.cos(a1) * ER, Math.sin(a1) * ER, 0);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, p0.distanceTo(p1), 8), neon(COLORS[i], 3.4));
    seg.position.copy(p0).add(p1).multiplyScalar(0.5); seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize()); emblem.add(seg);
  }
  const gyro = new THREE.Mesh(new THREE.TorusGeometry(ER + 0.45, 0.018, 6, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.5, 1.8), fog: false })); emblem.add(gyro);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 - Math.PI / 2; emblem.add(sphere(0.13, neon(COLORS[i], 3.2), Math.cos(a) * ER, Math.sin(a) * ER, 0, 12)); }
  const pin = new THREE.Group(); emblem.add(pin); // a map pin in the middle
  pin.add(sphere(0.55, std('#ffffff', { emissive: new THREE.Color('#8fa0ff'), emissiveIntensity: 0.3 }), 0, 0.25, 0, 24));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 24), std('#ffffff', { emissive: new THREE.Color('#8fa0ff'), emissiveIntensity: 0.3 })); tip.rotation.x = Math.PI; tip.position.y = -0.4; pin.add(tip);
  pin.add(sphere(0.22, std('#ff4d5e'), 0, 0.28, 0.42, 12));
  const beamU = { uTime: { value: 0 }, uColor: { value: new THREE.Color() } };
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, R * 0.8, 4.6, 48, 1, true), new THREE.ShaderMaterial({ uniforms: beamU,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){ float s = .5 + .5*sin(vUv.y*60. - uTime*4.); float v = pow(clamp(1. - vUv.y, 0., 1.), 1.6);
        float stripe = .5 + .5*sin(vUv.x*6.2832*24.);
        gl_FragColor = vec4(uColor * v * (.05 + .07*s) * (.6 + .4*stripe), 1.); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = TOP + 2.4; g.add(beam);
  const light = new THREE.PointLight(0xffffff, 30, 26, 1.6); light.position.y = 4; g.add(light);

  const cur = new THREE.Color(), col = new THREE.Color(), base0 = new THREE.Color('#5d78e6'), white = new THREE.Color(1, 1, 1);
  const PER = reduced ? 8 : 5;
  const state = { idx: 0, env: 0, color: cur };
  let lastIdx = -1;
  return {
    group: g, emblem, state, TOP,
    update(t, dt) {
      const k = t / PER, idx = Math.floor(k) % 7, f = k - Math.floor(k);
      const env = Math.pow(Math.sin(Math.PI * Math.min(f / 0.94, 1)), 2);
      const c = RAIN[idx]; cur.copy(c);
      ringMat.color.copy(c).lerp(white, 0.3).multiplyScalar(0.25 + env * 0.45);
      ringCore.material.color.copy(c).multiplyScalar(0.35 + env * 1.1);
      rimMat.color.copy(c).multiplyScalar(0.9 + env * 1.8);
      bandMat.color.copy(c).multiplyScalar(0.5 + env * 1.2);
      hudA.material.color.copy(c).lerp(white, 0.25).multiplyScalar(0.5 + env * 0.9);
      hudB.material.color.copy(c).lerp(white, 0.4).multiplyScalar(0.4 + env * 0.6);
      hudA.rotation.z = t * (reduced ? 0.02 : 0.08); hudB.rotation.z = -t * (reduced ? 0.04 : 0.22); ring.rotation.z = -t * 0.03;
      mapU.uTime.value = t * (reduced ? 0.3 : 1); mapU.uColor.value.copy(c); mapU.uEnv.value = env;
      beamU.uTime.value = t; beamU.uColor.value.copy(c).lerp(white, 0.35).multiplyScalar(1.4);
      gyro.rotation.x = t * (reduced ? 0.15 : 0.6);
      light.color.copy(c); light.intensity = 8 + env * 26;
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
        if (w > 0.6) col.multiplyScalar(1 + env * 1.1);
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

let _hud;
/** Tick-marked HUD ring (white, tinted by material colour). */
function hudTex() {
  if (_hud) return _hud;
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), m = S / 2; x.translate(m, m); x.strokeStyle = '#fff'; x.fillStyle = '#fff';
  const arc = (r, w, a0, a1, al) => { x.globalAlpha = al; x.lineWidth = w; x.beginPath(); x.arc(0, 0, r, a0, a1); x.stroke(); };
  arc(m * 0.97, 3, 0, Math.PI * 2, 0.9);
  for (let i = 0; i < 4; i++) arc(m * 0.92, 7, i * Math.PI / 2 + 0.12, (i + 1) * Math.PI / 2 - 0.12, 0.7);
  for (let i = 0; i < 180; i++) { const a = (i / 180) * Math.PI * 2, L = i % 15 === 0 ? 0.07 : 0.025; x.globalAlpha = i % 15 === 0 ? 0.9 : 0.45;
    x.lineWidth = i % 15 === 0 ? 3 : 1.5; x.beginPath(); x.moveTo(Math.cos(a) * m * 0.88, Math.sin(a) * m * 0.88); x.lineTo(Math.cos(a) * m * (0.88 - L), Math.sin(a) * m * (0.88 - L)); x.stroke(); }
  for (let i = 0; i < 24; i++) arc(m * 0.76, 2, (i / 24) * Math.PI * 2, (i / 24 + 1 / 48) * Math.PI * 2, 0.5);
  _hud = new THREE.CanvasTexture(c); _hud.anisotropy = 4; return _hud;
}
