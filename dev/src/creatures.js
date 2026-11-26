import * as THREE from 'three';
import { neon, std, sphere, cyl, box } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Original chubby "elemental sprite" creature. All parts are primitives. */
export function createCreature(def) {
  const root = new THREE.Group();
  const rig = new THREE.Group(); root.add(rig);      // bob / sit offsets
  const bodyG = new THREE.Group(); rig.add(bodyG);   // squash & stretch
  const bodyMat = std(def.body, { roughness: 0.5, metalness: 0.0 });
  const outfitMat = std(def.color, { roughness: 0.6, metalness: 0.05, emissive: new THREE.Color(def.color), emissiveIntensity: 0.12 });
  const dark = std(0x141826, { roughness: 0.35 });

  const body = sphere(0.56, bodyMat, 0, 0.74, 0, 32); body.scale.set(1, 0.94, 0.96); bodyG.add(body);
  // outfit: lower body garment + collar trim
  // open-front jacket: covers back and sides, the belly stays visible
  const open = 1.05;
  const jacket = new THREE.Mesh(new THREE.SphereGeometry(0.59, 32, 16, Math.PI / 2 + open, Math.PI * 2 - open * 2, Math.PI * 0.4, Math.PI * 0.5), outfitMat);
  jacket.position.y = 0.74; jacket.scale.set(1, 0.94, 0.96); bodyG.add(jacket);
  outfitMat.side = THREE.DoubleSide;
  const pipe = neon(def.color, 2.6);
  for (const s of [-1, 1]) {
    const a = Math.PI / 2 + s * open; const pts = [];
    for (let k = 0; k <= 10; k++) { const th = Math.PI * 0.4 + (Math.PI * 0.5 * k) / 10; pts.push(new THREE.Vector3(-Math.cos(a) * Math.sin(th) * 0.6, Math.cos(th) * 0.6 * 0.94 + 0.74, Math.sin(a) * Math.sin(th) * 0.6 * 0.96)); }
    bodyG.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.022, 5), pipe));
  }
  const belly = sphere(0.3, std(new THREE.Color(def.body).lerp(new THREE.Color('#ffffff'), 0.55), { roughness: 0.6 }), 0, 0.56, 0.36, 20); belly.scale.set(1, 0.85, 0.5); bodyG.add(belly);
  // face
  const eyeM = std(0x10131f, { roughness: 0.2 });
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = sphere(0.092, eyeM, s * 0.2, 0.86, 0.48, 16); e.scale.set(0.9, 1.2, 0.55); bodyG.add(e); eyes.push(e);
    bodyG.add(sphere(0.034, new THREE.MeshBasicMaterial({ color: 0xffffff }), s * 0.2 + 0.03, 0.91, 0.53, 8), sphere(0.016, new THREE.MeshBasicMaterial({ color: 0xffffff }), s * 0.2 - 0.025, 0.82, 0.53, 6));
    const bl = sphere(0.07, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8fb0'), transparent: true, opacity: 0.75 }), s * 0.33, 0.75, 0.42, 10); bl.scale.set(1, 0.55, 0.3); bodyG.add(bl);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 16, Math.PI), eyeM); mouth.position.set(0, 0.76, 0.535); mouth.rotation.z = Math.PI; bodyG.add(mouth);
  // limbs
  const feet = [], arms = [];
  for (const s of [-1, 1]) {
    const f = sphere(0.16, bodyMat, s * 0.23, 0.1, 0.06, 14); f.scale.set(1, 0.62, 1.3); rig.add(f); feet.push(f);
    const a = sphere(0.13, bodyMat, s * 0.56, 0.62, 0.05, 12); a.scale.set(0.8, 1.1, 0.8); bodyG.add(a); arms.push(a);
  }
  const extra = ACC[def.key] ? ACC[def.key](bodyG, def, { bodyMat, outfitMat, dark }) : {};
  if (extra.gadget) { extra.gadget.position.set(0.08, 0.05, 0.08); arms[1].add(extra.gadget); extra.gadget.scale.setScalar(1 / 0.9); }
  // invisible hit target
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.95, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.8; root.add(hit);

  let blinkT = Math.random() * 4;
  return {
    root, hit, def,
    /** mode: walk | sit | wait | idle ; speed m/s */
    animate(t, dt, mode, speed, reduced) {
      const k = reduced ? 0.35 : 1;
      blinkT -= dt;
      const blink = blinkT < 0.12;
      if (blinkT < 0) blinkT = 2.5 + Math.random() * 3;
      eyes.forEach((e) => (e.scale.y = blink ? 0.12 : 1.15));
      let bob = 0, sq = 1, footA = 0, armA = 0;
      if (mode === 'walk') {
        const f = t * (4 + speed * 2.2);
        bob = Math.abs(Math.sin(f)) * 0.09 * k; footA = Math.sin(f); armA = Math.sin(f) * 0.6;
        sq = 1 + Math.sin(f * 2) * 0.03 * k;
      } else if (mode === 'wait') {
        bob = Math.abs(Math.sin(t * 5)) * 0.12 * k; armA = 1.4;
      } else if (mode === 'sit') {
        bob = Math.sin(t * 2) * 0.01; armA = Math.sin(t * 18) * 0.12 * k;
      } else {
        bob = Math.sin(t * 2.1) * 0.015; sq = 1 + Math.sin(t * 2.1) * 0.015;
      }
      const hover = def.key === 'psy' ? 0.14 + Math.sin(t * 2) * 0.05 : 0;
      rig.position.y = bob + hover + (mode === 'sit' ? 0.28 : 0);
      bodyG.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      feet.forEach((f, i) => {
        const s = i ? 1 : -1;
        if (mode === 'sit') { f.position.set(s * 0.23, 0.18, 0.38); }
        else { f.position.set(s * 0.23, 0.1 + Math.max(0, footA * s) * 0.08, 0.06 + footA * s * 0.16); }
      });
      arms.forEach((a, i) => {
        const s = i ? 1 : -1;
        if (mode === 'wait') { a.position.set(s * 0.5, 0.95 + Math.sin(t * 8 + i) * 0.05, 0.12); }
        else if (mode === 'sit') { a.position.set(s * 0.42, 0.62 + (i ? armA : -armA) * 0.3, 0.38); }
        else { a.position.set(s * 0.56, 0.62, 0.05 - armA * s * 0.15); }
      });
      if (extra.update) extra.update(t, mode);
      if (extra.gadget && extra.gadget.userData.spin) extra.gadget.userData.spin.rotation.z += dt * (mode === 'walk' ? 12 : 3);
      if (extra.gadget && extra.gadget.userData.flag) extra.gadget.userData.flag.rotation.y = Math.sin(t * 6) * 0.3;
    },
  };
}

const ACC = {
  heat(g, def, m) { // flame tuft, round ears, big thermometer
    for (const sx of [-1, 1]) { g.add(sphere(0.15, m.bodyMat, sx * 0.34, 1.18, -0.02, 12)); g.add(sphere(0.08, std('#ff8a5a'), sx * 0.34, 1.19, 0.06, 10)); }
    const tuft = new THREE.Group(); tuft.position.set(0, 1.28, 0.05); g.add(tuft);
    const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 10), std('#ff7a3c', { emissive: new THREE.Color('#ff5a2a'), emissiveIntensity: 0.5 })); f1.position.y = 0.16; tuft.add(f1);
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 10), std('#ffd23f', { emissive: new THREE.Color('#ffb020'), emissiveIntensity: 0.6 })); f2.position.set(0.02, 0.12, 0.08); tuft.add(f2);
    return { gadget: thermometer(), update: (t) => { tuft.scale.set(1, 1 + Math.sin(t * 10) * 0.1, 1); } };
  },
  air(g, def, m) { // a little cloud: puffs all around + pinwheel
    for (const [x, y, z, r] of [[-0.42, 1.02, -0.1, 0.24], [0.42, 1.02, -0.1, 0.24], [0, 1.22, -0.05, 0.28], [-0.22, 1.2, -0.2, 0.22], [0.22, 1.2, -0.2, 0.22], [0, 0.95, -0.42, 0.28]]) g.add(sphere(r, m.bodyMat, x, y, z, 14));
    return { gadget: pinwheel(def.color), update: (t) => {} };
  },
  data(g, def, m) { // antennae + on-call headset + laptop
    const tips = [];
    for (const sx of [-1, 1]) { const a = cyl(0.018, 0.022, 0.38, m.dark, 6, sx * 0.18, 1.38, 0); a.rotation.z = -sx * 0.25; g.add(a); const tip = sphere(0.075, neon('#ffe14a', 3), sx * 0.23, 1.58, 0, 12); g.add(tip); tips.push(tip); }
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 6, 32, Math.PI), m.dark); band.position.y = 0.86; g.add(band);
    for (const sx of [-1, 1]) { const cup = cyl(0.13, 0.13, 0.1, std('#2b3350'), 16, sx * 0.56, 0.86, 0); cup.rotation.z = Math.PI / 2; g.add(cup); }
    const boom = cyl(0.015, 0.015, 0.42, m.dark, 6, -0.45, 0.72, 0.28); boom.rotation.set(0.2, 0.9, 1.2); g.add(boom);
    return { gadget: laptop(def.color), update: (t, mode) => tips.forEach((p, i) => p.scale.setScalar(mode === 'sit' ? 1 + (Math.sin(t * 20 + i * 2) > 0.6 ? 0.4 : 0) : 1 + Math.sin(t * 3 + i) * 0.1)) };
  },
  green(g, def, m) { // leaf ears + sprout + watering can
    const leaves = [];
    const lm = std('#5fcf6a');
    for (const sx of [-1, 1]) { const l = sphere(0.22, lm, sx * 0.42, 1.12, -0.02, 12); l.scale.set(0.4, 1, 0.22); l.rotation.z = -sx * 0.6; g.add(l); leaves.push(l); }
    g.add(cyl(0.02, 0.025, 0.22, std('#3aa860'), 6, 0, 1.36, 0));
    const sp = sphere(0.14, lm, 0.08, 1.48, 0, 10); sp.scale.set(1, 0.3, 0.55); sp.rotation.z = -0.4; g.add(sp);
    return { gadget: wateringCan(), update: (t) => leaves.forEach((l, i) => (l.rotation.z = (i ? -1 : 1) * (0.6 + Math.sin(t * 2.5 + i) * 0.12))) };
  },
  flood(g, def, m) { // a raindrop: pointed top + umbrella
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.62, 24), m.bodyMat); top.position.y = 1.36; g.add(top);
    g.add(sphere(0.07, std('#ffffff'), 0.22, 1.08, 0.4, 8));
    return { gadget: umbrella(def.color), update: () => {} };
  },
  sky(g, def, m) { // planet ring + star antenna + tiny satellite friend
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.045, 8, 48), std('#ffd23f', { emissive: new THREE.Color('#ffb020'), emissiveIntensity: 0.3 })); ring.rotation.x = Math.PI / 2 - 0.35; ring.position.y = 0.78; g.add(ring);
    g.add(cyl(0.02, 0.02, 0.3, m.dark, 6, 0, 1.4, 0));
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), neon('#fff3a0', 2.6)); star.position.y = 1.6; g.add(star);
    const sat = new THREE.Group(); g.add(sat);
    sat.add(box(0.12, 0.12, 0.12, std('#ffffff')), box(0.42, 0.02, 0.14, std(def.color)));
    return { gadget: null, update: (t) => { sat.position.set(Math.cos(t * 1.6) * 0.95, 1.4 + Math.sin(t * 3) * 0.08, Math.sin(t * 1.6) * 0.95); sat.rotation.y = -t * 1.6; star.rotation.y = t * 2; } };
  },
  crowd(g, def, m) { // long bunny-ish ears, sneakers, a guide flag
    const ears = [];
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.42, 6, 12), m.bodyMat); e.position.set(sx * 0.2, 1.4, -0.05); e.rotation.z = -sx * 0.18; g.add(e); ears.push(e); const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.3, 4, 8), std('#ff8fb8')); inner.position.set(sx * 0.2, 1.42, 0.03); inner.rotation.z = -sx * 0.18; g.add(inner); }
    return { gadget: flag(def.color), update: (t, mode) => { const w = mode === 'walk' ? 0.3 : 0.08; ears.forEach((e, i) => (e.rotation.z = (i ? -1 : 1) * 0.18 + Math.sin(t * 9 + i) * w)); } };
  },
};

function thermometer() { const g = new THREE.Group(); g.add(cyl(0.035, 0.035, 0.45, std('#ffffff'), 8, 0, 0.22, 0), sphere(0.07, std('#ff4d5e'), 0, 0, 0, 10), cyl(0.018, 0.018, 0.3, std('#ff4d5e'), 6, 0, 0.18, 0.02)); return g; }
function pinwheel(col) { const g = new THREE.Group(); g.add(cyl(0.02, 0.02, 0.55, std('#ffffff'), 6, 0, 0.27, 0)); const h = new THREE.Group(); h.position.set(0, 0.55, 0.04); g.add(h); for (let i = 0; i < 4; i++) { const b = box(0.08, 0.24, 0.01, std(i % 2 ? col : '#ffffff'), 0, 0.12, 0); const p = new THREE.Group(); p.rotation.z = (i / 4) * Math.PI * 2; p.add(b); h.add(p); } g.userData.spin = h; return g; }
function laptop(col) { const g = new THREE.Group(); g.add(box(0.42, 0.03, 0.3, std('#c9ced8'), 0, 0, 0)); const s = box(0.42, 0.28, 0.02, std('#c9ced8'), 0, 0.14, -0.15); g.add(s); g.add(box(0.36, 0.22, 0.01, neon(col, 1.2), 0, 0.14, -0.135)); return g; }
function wateringCan() { const g = new THREE.Group(); g.add(cyl(0.12, 0.14, 0.22, std('#3fa9ff'), 12, 0, 0, 0)); const sp = cyl(0.02, 0.03, 0.25, std('#3fa9ff'), 6, 0, 0.05, 0.15); sp.rotation.x = 1.0; g.add(sp); return g; }
function umbrella(col) { const g = new THREE.Group(); g.add(cyl(0.015, 0.015, 0.9, std('#ffffff'), 6, 0, 0.45, 0)); const c = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), std('#ffd23f', { side: THREE.DoubleSide })); c.position.y = 0.82; c.scale.y = 0.55; g.add(c); g.add(sphere(0.04, std('#ffffff'), 0, 1.13, 0, 6)); return g; }
function flag(col) { const g = new THREE.Group(); g.add(cyl(0.015, 0.015, 0.9, std('#ffffff'), 6, 0, 0.45, 0)); const f = box(0.36, 0.24, 0.01, std(col), 0.18, 0.78, 0); g.add(f); g.userData.flag = f; return g; }

/** NOVA — the wandering hologram guide bot (NPC). */
export function createNova() {
  const root = new THREE.Group();
  const rig = new THREE.Group(); root.add(rig);
  const shell = std(0xeef2ff, { metalness: 0.4, roughness: 0.25 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.35, 8, 24), shell); body.position.y = 1.35; rig.add(body);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 12, -0.9, 1.8, 1.0, 0.9), std(0x070a14, { metalness: 0.9, roughness: 0.1 }));
  visor.position.set(0, 1.45, 0.06); rig.add(visor);
  const eyeM = neon('#5ff3ff', 3.4);
  const eyes = [-1, 1].map((s) => { const e = box(0.08, 0.1, 0.02, eyeM, s * 0.12, 1.55, 0.44); rig.add(e); return e; });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 8, 32), neon('#5ff3ff', 3)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.72; rig.add(ring);
  const ant = cyl(0.015, 0.015, 0.3, shell, 6, 0, 2.05, 0); rig.add(ant);
  const tip = sphere(0.05, neon('#ff6fb5', 3), 0, 2.22, 0, 8); rig.add(tip);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.05, 0.7, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#5ff3ff').multiplyScalar(0.8), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
  beam.position.y = 0.35; rig.add(beam);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.3; root.add(hit);
  return {
    root, hit,
    animate(t, dt, mode, speed, reduced) {
      rig.position.y = Math.sin(t * 2) * (reduced ? 0.03 : 0.12);
      rig.rotation.z = mode === 'walk' ? Math.sin(t * 3) * 0.05 : 0;
      eyes.forEach((e) => (e.scale.y = (t % 4) < 0.12 ? 0.15 : 1));
      tip.visible = Math.sin(t * 4) > -0.3;
    },
  };
}
