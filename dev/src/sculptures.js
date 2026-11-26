import * as THREE from 'three';
import { ROOMS, R_SCULPT, R_RING, R_DOOR } from './config.js';
import { neon, std, cyl, sphere, polar, particles, rand } from './util.js';

/** Light path from the fountain to each office door, with a natural-phenomenon sculpture halfway. */
export function buildPaths(scene, reduced) {
  const ups = [];
  const pathMats = [];
  const inner = R_RING + 0.8, outer = R_DOOR - 0.15;
  for (const def of ROOMS) {
    const L = outer - inner;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(def.color).multiplyScalar(2.4) }, uHot: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uHot; varying vec2 vUv;
        void main(){ float edge = smoothstep(.5,.0,abs(vUv.x-.5));
          float dash = smoothstep(.0,.35,fract(vUv.y*7. - uTime*(.5+uHot*1.5)))*smoothstep(1.,.65,fract(vUv.y*7. - uTime*(.5+uHot*1.5)));
          float a = edge*(.35 + .65*dash) * (.7+uHot*.6);
          gl_FragColor = vec4(uColor*a, 1.); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    pathMats.push(mat);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.42, L), mat);
    strip.rotation.x = -Math.PI / 2;
    const holder = new THREE.Group(); holder.rotation.y = def.angle; holder.add(strip);
    strip.position.set(0, 0.035, inner + L / 2);
    // PlaneGeometry's v runs along +y → after rotation along -z; flip so the flow moves outward
    strip.rotation.z = Math.PI;
    scene.add(holder);
    ups.push((t) => { mat.uniforms.uTime.value = t * (reduced ? 0.3 : 1); });

    // pedestal + sculpture
    const s = new THREE.Group(); s.position.copy(polar(R_SCULPT, def.angle)); scene.add(s);
    s.add(cyl(0.95, 1.1, 0.32, std(0x10152a, { metalness: 0.9, roughness: 0.25 }), 40, 0, 0.16, 0));
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.04, 6, 48), neon(def.color, 3)); lip.rotation.x = Math.PI / 2; lip.position.y = 0.33; s.add(lip);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.8, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(def.color).multiplyScalar(0.5), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex() }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.03; s.add(glow);
    const fn = SCULPT[def.key](s, def.color, reduced);
    ups.push(fn);
  }
  return { ups, pathMats };
}

let _gt;
function glowTex() {
  if (_gt) return _gt;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  _gt = new THREE.CanvasTexture(c); return _gt;
}

const SCULPT = {
  fire(s, col, reduced) {
    const N = 220, P = particles(N, col, 0.3); s.add(P.pts);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.4, 16), neon('#ffd27a', 2.6)); core.position.y = 1.0; s.add(core);
    const life = new Float32Array(N).map(() => Math.random()), ang = new Float32Array(N).map(() => rand(0, 6.28)), rad = new Float32Array(N).map(() => rand(0.1, 0.55));
    const P2 = particles(60, '#ffe08a', 0.2); s.add(P2.pts);
    return (t, dt) => {
      const sp = reduced ? 0.3 : 1;
      for (let i = 0; i < N; i++) {
        life[i] += dt * 0.7 * sp; if (life[i] > 1) { life[i] = 0; ang[i] = rand(0, 6.28); rad[i] = rand(0.1, 0.6); }
        const l = life[i], r = rad[i] * (1 - l) * (1 - l);
        P.pos[i * 3] = Math.cos(ang[i] + t * 2) * r + Math.sin(t * 7 + i) * 0.04 * l;
        P.pos[i * 3 + 1] = 0.4 + l * 2.6;
        P.pos[i * 3 + 2] = Math.sin(ang[i] + t * 2) * r;
        P.sz[i] = (1.3 - l) * 1.2; P.al[i] = Math.sin(Math.PI * Math.min(l * 1.4, 1)) * 0.8;
      }
      P.commit();
      for (let i = 0; i < 60; i++) { const l = (t * 0.25 * sp + i / 60) % 1; P2.pos.set([Math.sin(i * 7.1 + t) * 0.8 * l, 0.6 + l * 3.6, Math.cos(i * 3.3 + t) * 0.8 * l], i * 3); P2.sz[i] = 0.5; P2.al[i] = (1 - l) * 0.9; }
      P2.commit();
      core.scale.set(1 + Math.sin(t * 13) * 0.06, 1 + Math.sin(t * 9) * 0.12, 1 + Math.cos(t * 11) * 0.06);
    };
  },
  wind(s, col, reduced) {
    const N = 360, P = particles(N, col, 0.2); s.add(P.pts);
    const h = new Float32Array(N).map(() => Math.random()), a0 = new Float32Array(N).map(() => rand(0, 6.28));
    const dust = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.03, 6, 48), neon(col, 2.4)); dust.rotation.x = Math.PI / 2; dust.position.y = 0.45; s.add(dust);
    return (t, dt) => {
      const sp = reduced ? 0.3 : 1;
      for (let i = 0; i < N; i++) {
        h[i] += dt * 0.28 * sp; if (h[i] > 1) h[i] -= 1;
        const y = h[i], r = 0.12 + Math.pow(y, 1.6) * 1.05, a = a0[i] + t * (5.5 - y * 2.5) * sp;
        const sway = Math.sin(t * 1.3 + y * 3) * 0.18 * y;
        P.pos[i * 3] = Math.cos(a) * r + sway; P.pos[i * 3 + 1] = 0.4 + y * 3.2; P.pos[i * 3 + 2] = Math.sin(a) * r;
        P.sz[i] = 0.5 + y * 0.8; P.al[i] = Math.sin(Math.PI * y) * 0.85;
      }
      P.commit(); dust.rotation.z = t * 3;
    };
  },
  volt(s, col, reduced) {
    const top = sphere(0.28, neon('#fff6c0', 3), 0, 3.1, 0, 16); s.add(top);
    const cage = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.6), wireframe: true, transparent: true, opacity: 0.35 }));
    cage.position.y = 1.85; s.add(cage);
    const coil = cyl(0.12, 0.2, 1.2, std(0x2a2f44, { metalness: 1, roughness: 0.2 }), 12, 0, 0.9, 0); s.add(coil);
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(col).multiplyScalar(4) });
    const bolts = [];
    for (let k = 0; k < 4; k++) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(14 * 3), 3));
      const l = new THREE.Line(g, mat); s.add(l); bolts.push(l);
    }
    let next = 0;
    return (t) => {
      if (t > next) {
        next = t + (reduced ? 0.6 : rand(0.05, 0.16));
        bolts.forEach((l) => {
          const p = l.geometry.attributes.position.array;
          const end = new THREE.Vector3(rand(-1, 1), rand(-0.6, 0.8), rand(-1, 1)).normalize().multiplyScalar(0.98).add(new THREE.Vector3(0, 1.85, 0));
          for (let i = 0; i < 14; i++) {
            const f = i / 13; const j = (i === 0 || i === 13) ? 0 : 0.14;
            p[i * 3] = f * end.x + rand(-j, j); p[i * 3 + 1] = 3.1 + (end.y - 3.1) * f + rand(-j, j); p[i * 3 + 2] = f * end.z + rand(-j, j);
          }
          l.geometry.attributes.position.needsUpdate = true; l.visible = Math.random() > 0.25;
        });
        top.scale.setScalar(rand(0.85, 1.25));
      }
      cage.rotation.y = t * 0.4;
    };
  },
  leaf(s, col, reduced) {
    const mats = [];
    for (let k = 0; k < 3; k++) {
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uK: { value: k }, uA: { value: new THREE.Color(col) }, uB: { value: new THREE.Color('#38e8ff') } },
        vertexShader: `uniform float uTime; uniform float uK; varying vec2 vUv;
          void main(){ vUv = uv; vec3 p = position; p.z += sin(p.x*2.2 + uTime*1.2 + uK*2.)*.35; p.x += sin(p.y*1.5+uTime)*.05;
            gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
        fragmentShader: `uniform float uTime; uniform float uK; uniform vec3 uA; uniform vec3 uB; varying vec2 vUv;
          void main(){ float band = smoothstep(0.,.25,vUv.y)*smoothstep(1.,.35,vUv.y);
            float rays = .55 + .45*sin(vUv.x*38. + uTime*2. + uK*5.);
            float side = smoothstep(0.,.15,vUv.x)*smoothstep(1.,.85,vUv.x);
            vec3 c = mix(uA, uB, vUv.y)*2.6;
            gl_FragColor = vec4(c*band*rays*side*.65, 1.); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      mats.push(m);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.2, 32, 1), m);
      pl.position.set(0, 1.75 + k * 0.12, (k - 1) * 0.35); pl.rotation.y = (k - 1) * 0.5; s.add(pl);
    }
    const sp = particles(40, '#c8ffd8', 0.12); s.add(sp.pts);
    return (t) => {
      mats.forEach((m) => (m.uniforms.uTime.value = t * (reduced ? 0.3 : 1)));
      for (let i = 0; i < 40; i++) { sp.pos.set([Math.sin(i * 1.7 + t * 0.4) * 1.1, 0.6 + ((i * 0.37 + t * 0.15) % 1) * 2.6, Math.cos(i * 2.3 + t * 0.3) * 0.7], i * 3); sp.sz[i] = 0.5; sp.al[i] = 0.5 + 0.5 * Math.sin(t * 3 + i); }
      sp.commit();
    };
  },
  tide(s, col, reduced) {
    const N = 340, P = particles(N, col, 0.17); s.add(P.pts);
    const h = new Float32Array(N).map(() => Math.random()), a0 = new Float32Array(N).map(() => rand(0, 6.28));
    const rings = [0, 1, 2].map((k) => { const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 6, 64), neon('#9fe3ff', 2.4)); r.rotation.x = Math.PI / 2; s.add(r); return r; });
    const orb = sphere(0.22, neon('#e0f7ff', 2.5), 0, 0.75, 0, 16); s.add(orb);
    return (t, dt) => {
      const sp = reduced ? 0.3 : 1;
      for (let i = 0; i < N; i++) {
        h[i] += dt * 0.35 * sp; if (h[i] > 1) h[i] -= 1;
        const y = h[i], r = 1.25 * (1 - y) + 0.08, a = a0[i] - t * (1.5 + y * 6) * sp;
        P.pos[i * 3] = Math.cos(a) * r; P.pos[i * 3 + 1] = 2.9 - y * 2.1 + Math.sin(a * 2) * 0.04; P.pos[i * 3 + 2] = Math.sin(a) * r;
        P.sz[i] = 0.6 + (1 - y) * 0.6; P.al[i] = Math.min(y * 4, 1) * (1 - y * 0.6);
      }
      P.commit();
      rings.forEach((r, k) => { const f = ((t * 0.35 * sp) + k / 3) % 1; r.scale.setScalar(0.4 + f * 1.4); r.position.y = 0.4 + f * 0.05; r.material.opacity = 1 - f; r.visible = f < 0.95; });
    };
  },
  psy(s, col, reduced) {
    const gal = new THREE.Group(); gal.position.y = 1.9; gal.rotation.x = 0.5; s.add(gal);
    const N = 700, P = particles(N, col, 0.13); gal.add(P.pts);
    for (let i = 0; i < N; i++) {
      const arm = i % 2, d = Math.pow(Math.random(), 0.7) * 1.4, a = d * 3.2 + arm * Math.PI + rand(-0.35, 0.35);
      P.pos.set([Math.cos(a) * d, rand(-0.06, 0.06) * (1.5 - d), Math.sin(a) * d], i * 3);
      P.sz[i] = rand(0.3, 0.9); P.al[i] = 1 - d / 1.6;
    }
    P.commit();
    const P2 = particles(90, '#ff9df0', 0.15); gal.add(P2.pts);
    for (let i = 0; i < 90; i++) { const d = rand(0.2, 1.4), a = d * 3.2 + (i % 2) * Math.PI + 0.4; P2.pos.set([Math.cos(a) * d, 0, Math.sin(a) * d], i * 3); P2.sz[i] = rand(0.5, 1.1); P2.al[i] = 0.7; }
    P2.commit();
    const core = sphere(0.2, neon('#ffffff', 2.5), 0, 0, 0, 16); gal.add(core);
    return (t) => { gal.rotation.y = -t * (reduced ? 0.08 : 0.4); };
  },
  frost(s, col, reduced) {
    const flake = new THREE.Group(); flake.position.y = 2.0; s.add(flake);
    const m = neon(col, 2.4), m2 = neon('#e8f4ff', 2.2);
    for (let k = 0; k < 6; k++) {
      const arm = new THREE.Group(); arm.rotation.z = (k / 6) * Math.PI * 2; flake.add(arm);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.1, 0.07), m); b.position.y = 0.55; arm.add(b);
      for (const [y, l] of [[0.45, 0.32], [0.78, 0.22]]) for (const sg of [-1, 1]) {
        const br = new THREE.Mesh(new THREE.BoxGeometry(0.05, l, 0.05), m2); br.position.set(sg * l * 0.35, y + l * 0.3, 0); br.rotation.z = -sg * 0.9; arm.add(br);
      }
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), neon('#ffffff', 2.4)); flake.add(gem);
    const N = 120, P = particles(N, '#e6ecff', 0.12); s.add(P.pts);
    const h = new Float32Array(N).map(() => Math.random()), a0 = new Float32Array(N).map(() => rand(0, 6.28)), r0 = new Float32Array(N).map(() => rand(0.3, 1.3));
    return (t, dt) => {
      const sp = reduced ? 0.25 : 1;
      flake.rotation.y = t * 0.6 * sp; flake.rotation.x = Math.sin(t * 0.5) * 0.25 * sp;
      for (let i = 0; i < N; i++) {
        h[i] -= dt * 0.12 * sp; if (h[i] < 0) h[i] += 1;
        P.pos[i * 3] = Math.cos(a0[i] + t * 0.3) * r0[i]; P.pos[i * 3 + 1] = 0.35 + h[i] * 3.4; P.pos[i * 3 + 2] = Math.sin(a0[i] + t * 0.3) * r0[i];
        P.sz[i] = 0.55; P.al[i] = Math.min(h[i] * 5, 1) * 0.8;
      }
      P.commit();
    };
  },
};
