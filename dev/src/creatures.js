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
    const e = sphere(0.075, eyeM, s * 0.19, 0.86, 0.49, 14); e.scale.set(0.9, 1.15, 0.6); bodyG.add(e); eyes.push(e);
    bodyG.add(sphere(0.024, new THREE.MeshBasicMaterial({ color: 0xffffff }), s * 0.19 + 0.025, 0.9, 0.535, 8));
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
    },
  };
}

const ACC = {
  fire(g, def, m) { // round ears, ember curl, goggles
    for (const s of [-1, 1]) g.add(sphere(0.15, m.bodyMat, s * 0.33, 1.2, -0.02, 12));
    for (const s of [-1, 1]) g.add(sphere(0.085, m.outfitMat, s * 0.33, 1.21, 0.06, 10));
    const curl = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 10), neon('#ffb03a', 2.6)); curl.position.set(0.02, 1.36, 0.05); curl.rotation.z = -0.35; g.add(curl);
    // work goggles pushed up on top of the head
    for (const s of [-1, 1]) { const l = cyl(0.1, 0.1, 0.07, std(0x6a4a30, { metalness: 0.7 }), 16, s * 0.14, 1.24, 0.22); l.rotation.x = 0.55; g.add(l); const gl = cyl(0.075, 0.075, 0.075, neon('#ffcf7a', 1.6), 16, s * 0.14, 1.245, 0.225); gl.rotation.x = 0.55; g.add(gl); }
    g.add(box(0.12, 0.03, 0.03, std(0x6a4a30), 0, 1.25, 0.22));
    return { update: (t) => { curl.scale.set(1, 1 + Math.sin(t * 12) * 0.12, 1); } };
  },
  wind(g, def, m) { // long droopy ears + flowing scarf
    const ears = [];
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 6, 12), m.bodyMat); e.position.set(s * 0.42, 1.0, -0.05); e.rotation.z = s * 1.1; g.add(e); ears.push(e); }
    const sc = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.08, 8, 32), m.outfitMat); sc.rotation.x = Math.PI / 2; sc.position.y = 0.5; g.add(sc);
    const tail = box(0.16, 0.5, 0.05, m.outfitMat, 0.22, 0.38, -0.45); g.add(tail);
    const tail2 = box(0.14, 0.4, 0.05, m.outfitMat, 0.38, 0.36, -0.4); g.add(tail2);
    const gog = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 20), neon('#9fdcff', 2)); gog.position.set(0.18, 1.1, 0.42); g.add(gog);
    const gog2 = gog.clone(); gog2.position.x = -0.18; g.add(gog2);
    return { update: (t, mode) => { const w = mode === 'walk' ? 1 : 0.3; ears.forEach((e, i) => (e.rotation.z = (i ? 1 : -1) * (1.1 + Math.sin(t * 6 + i) * 0.12 * w))); tail.rotation.x = -0.4 - Math.sin(t * 7) * 0.3 * w; tail2.rotation.x = -0.5 - Math.sin(t * 7 + 1) * 0.3 * w; } };
  },
  volt(g, def, m) { // antennae + on-call headset
    const tips = [];
    for (const s of [-1, 1]) {
      const a = cyl(0.018, 0.022, 0.38, m.dark, 6, s * 0.18, 1.38, 0); a.rotation.z = -s * 0.25; g.add(a);
      const tip = sphere(0.07, neon('#ffe14a', 3.2), s * 0.23, 1.58, 0, 12); g.add(tip); tips.push(tip);
    }
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 6, 32, Math.PI), m.dark); band.position.y = 0.86; g.add(band);
    for (const s of [-1, 1]) { const cup = cyl(0.13, 0.13, 0.1, std(0x23293d, { metalness: 0.6 }), 16, s * 0.56, 0.86, 0); cup.rotation.z = Math.PI / 2; g.add(cup); const pad = cyl(0.1, 0.1, 0.02, neon(def.color, 2.6), 16, s * 0.615, 0.86, 0); pad.rotation.z = Math.PI / 2; g.add(pad); }
    const boom = cyl(0.015, 0.015, 0.42, m.dark, 6, -0.45, 0.72, 0.28); boom.rotation.set(0.2, 0.9, 1.2); g.add(boom);
    g.add(sphere(0.04, neon('#ff3d5a', 2.4), -0.3, 0.68, 0.45, 8));
    return { update: (t, mode) => tips.forEach((p, i) => p.scale.setScalar(mode === 'sit' ? 1 + (Math.sin(t * 20 + i * 2) > 0.6 ? 0.4 : 0) : 1 + Math.sin(t * 3 + i) * 0.1)) };
  },
  leaf(g, def, m) { // sprout + round glasses
    const stem = cyl(0.02, 0.025, 0.24, std(0x3aa860), 6, 0, 1.38, 0); g.add(stem);
    const lm = std(0x52d47e, { roughness: 0.5, emissive: 0x1a6a32, emissiveIntensity: 0.3 });
    const leaves = [];
    for (const s of [-1, 1]) { const l = sphere(0.16, lm, s * 0.13, 1.5, 0, 12); l.scale.set(1, 0.28, 0.55); l.rotation.z = s * 0.4; g.add(l); leaves.push(l); }
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 6, 24), std(0xc9a56a, { metalness: 0.9, roughness: 0.3 })); r.position.set(s * 0.19, 0.87, 0.52); g.add(r); }
    g.add(box(0.1, 0.02, 0.02, std(0xc9a56a, { metalness: 0.9 }), 0, 0.88, 0.55));
    return { update: (t) => leaves.forEach((l, i) => (l.rotation.z = (i ? 1 : -1) * (0.4 + Math.sin(t * 2.5 + i) * 0.15))) };
  },
  tide(g, def, m) { // fin ears + sailor hat
    for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 8), m.bodyMat); f.position.set(s * 0.56, 0.95, -0.05); f.rotation.z = -s * 1.2; f.scale.z = 0.4; g.add(f); }
    const hat = cyl(0.3, 0.34, 0.16, std(0xf4f7ff, { roughness: 0.5 }), 24, 0, 1.3, -0.02); hat.rotation.x = -0.12; g.add(hat);
    const brim = cyl(0.39, 0.39, 0.03, std(0xf4f7ff), 24, 0, 1.23, -0.01); brim.rotation.x = -0.12; g.add(brim);
    const bandM = cyl(0.342, 0.342, 0.05, m.outfitMat, 24, 0, 1.26, -0.01); bandM.rotation.x = -0.12; g.add(bandM);
    g.add(sphere(0.05, neon('#9fe3ff', 2.4), 0, 1.4, -0.02, 8));
    return {};
  },
  psy(g, def, m) { // crescent mark + starry cape (hovers)
    const cres = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 20, Math.PI * 1.3), neon('#ff9df0', 2.8)); cres.position.set(0, 1.08, 0.48); cres.rotation.z = 0.6; g.add(cres);
    const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.72, 0.9, 24, 1, true, Math.PI * 0.55, Math.PI * 0.9), std(def.color, { side: THREE.DoubleSide, emissive: new THREE.Color(def.color), emissiveIntensity: 0.15 }));
    cape.position.set(0, 0.62, -0.06); cape.rotation.y = Math.PI; g.add(cape);
    for (let i = 0; i < 6; i++) { const a = Math.PI * (0.62 + i * 0.13); g.add(sphere(0.025, neon('#ffffff', 3), Math.sin(a + Math.PI) * 0.64, 0.45 + (i % 2) * 0.25, Math.cos(a + Math.PI) * 0.64 - 0.06, 6)); }
    for (const s of [-1, 1]) g.add(sphere(0.12, m.bodyMat, s * 0.3, 1.22, -0.05, 10));
    return { update: (t) => { cape.rotation.y = Math.PI + Math.sin(t * 2) * 0.08; } };
  },
  frost(g, def, m) { // knit beanie with pompom + scarf + orbiting crystal
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), m.outfitMat); hat.position.y = 0.93; hat.scale.set(1.08, 1.08, 1.06); g.add(hat);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 32), std(0xefeaff, { roughness: 0.9 })); rim.rotation.x = Math.PI / 2; rim.position.y = 1.15; g.add(rim);
    g.add(sphere(0.12, std(0xffffff, { roughness: 1 }), 0, 1.47, 0, 12));
    const sc = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.075, 8, 32), std(0xefeaff, { roughness: 0.9 })); sc.rotation.x = Math.PI / 2; sc.position.y = 0.48; g.add(sc);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), neon('#d8ccff', 2.6)); g.add(gem);
    return { update: (t) => { gem.position.set(Math.cos(t * 1.5) * 0.85, 1.2 + Math.sin(t * 3) * 0.08, Math.sin(t * 1.5) * 0.85); gem.rotation.y = t * 3; } };
  },
};

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
