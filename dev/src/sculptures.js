import * as THREE from 'three';
import { ROOMS, G, ROOM } from './config.js';
import { neon, std, cyl, sphere, polar, particles, rand } from './util.js';

/** Light path from the digital twin to each lab door, with a natural-phenomenon sculpture on the street halfway. */
export function buildPaths(scene, reduced) {
  const ups = [];
  const pathMats = [];
  for (const def of ROOMS) {
    const dir = new THREE.Vector3(def.gx, 0, def.gz).normalize();
    const diag = def.gx !== 0 && def.gz !== 0;
    const B = new THREE.Vector3(def.gx * G, 0, def.gz * G).addScaledVector(dir, -(ROOM + 0.6)); // just outside the door
    const S = new THREE.Vector3(def.gx * 12, 0, def.gz * 12);                    // street / intersection centre
    // Data conduit: leaves the twin's bezel, arcs over the street sculpture and lands in a port at the lab door.
    const A = dir.clone().multiplyScalar(5.9).setY(1.25);
    const H = diag ? 7.2 : 6.0;
    const curve = new THREE.CubicBezierCurve3(
      A, A.clone().addScaledVector(dir, 1.2).setY(H),
      B.clone().addScaledVector(dir, -4.5).setY(H * 0.85), B.clone().setY(0.08));
    const u = { uTime: { value: 0 }, uColor: { value: new THREE.Color(def.color).multiplyScalar(2.0) }, uHot: { value: 0 } };
    const vtx = `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`;
    const flow = `float flowAt(float p){ float f = fract(p*5. - uTime*(.25+uHot*.9)); return pow(clamp(f, 0., 1.), 10.)*(1. - smoothstep(.96, 1., f)); }`;
    const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: vtx,
      fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uHot; varying vec2 vUv; varying vec3 vN; varying vec3 vV; ${flow}
        void main(){ float c = abs(dot(vN, vV)); float fl = flowAt(vUv.x);
          vec3 col = uColor*(.5 + .35*uHot)*(.6 + .4*c) + vec3(1.6)*fl*(.35 + .9*uHot);
          gl_FragColor = vec4(col, 1.); }` });
    const halo = new THREE.ShaderMaterial({ uniforms: u, vertexShader: vtx,
      fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uHot; varying vec2 vUv; varying vec3 vN; varying vec3 vV; ${flow}
        void main(){ float c = pow(clamp(abs(dot(vN, vV)), 0., 1.), 2.5);
          float a = c * ((.06 + .08*uHot) + flowAt(vUv.x)*(.15 + .45*uHot));
          gl_FragColor = vec4(uColor * a, 1.); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const ground = new THREE.ShaderMaterial({ uniforms: u, vertexShader: vtx,
      fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uHot; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ float e = 1. - abs(vUv.x - .5)*2.; e = e*e;
          gl_FragColor = vec4(uColor * e * (.05 + .07*uHot), 1.); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    pathMats.push(mat);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.065, 10, false), mat));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.26, 12, false), halo));
    // faint footprint on the ground so the arc reads in depth
    const A0 = A.clone().setY(0), L = A0.distanceTo(B);
    const holder = new THREE.Group(); holder.position.copy(A0); holder.rotation.y = Math.atan2(B.x - A0.x, B.z - A0.z); scene.add(holder);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.4, L), ground);
    strip.rotation.x = -Math.PI / 2; strip.position.set(0, 0.04, L / 2); holder.add(strip);
    // port at the lab door
    const port = new THREE.Group(); port.position.copy(B).setY(0.05); scene.add(port);
    port.add(cyl(0.16, 0.2, 0.12, neon(def.color, 2.4), 16, 0, 0.06, 0));
    // data packets riding the conduit while the lab is busy
    const pk = particles(4, def.color, 0.5); scene.add(pk.pts);
    const tmp = new THREE.Vector3();
    ups.push((t) => {
      const tt = t * (reduced ? 0.3 : 1), hot = u.uHot.value;
      u.uTime.value = tt;
      for (let k = 0; k < 4; k++) {
        const f = ((tt * (0.12 + hot * 0.18)) + k / 4) % 1;
        curve.getPointAt(f, tmp); pk.pos.set([tmp.x, tmp.y, tmp.z], k * 3);
        pk.sz[k] = 0.9; pk.al[k] = hot * Math.sin(Math.PI * f);
      }
      pk.commit();
    });

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
  heat(s, col, reduced) {
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
  air(s, col, reduced) {
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
  data(s, col, reduced) {
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
  sky(s, col, reduced) {
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
  flood(s, col, reduced) {
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
  green(s, col, reduced) { // fireflies dancing around a glowing sapling
    s.add(cyl(0.08, 0.12, 1.4, std('#8a5a3a'), 8, 0, 1.0, 0));
    const crown = sphere(0.7, std('#4fbf5a', { emissive: new THREE.Color(col), emissiveIntensity: 0.25 }), 0, 2.0, 0, 14); s.add(crown);
    const N = 70, P = particles(N, '#e9ff7a', 0.14); s.add(P.pts);
    const seed = Array.from({ length: N }, () => [rand(0, 6.28), rand(0.6, 1.6), rand(0.5, 3.2), rand(0.4, 1.2)]);
    return (t) => {
      const k = reduced ? 0.3 : 1;
      seed.forEach(([a, r, y, sp], i) => { const aa = a + t * sp * 0.5 * k; P.pos.set([Math.cos(aa) * r, y + Math.sin(t * sp * 2 + i) * 0.25, Math.sin(aa) * r], i * 3); P.sz[i] = 0.7; P.al[i] = 0.35 + 0.65 * Math.max(0, Math.sin(t * 3 * sp + i * 1.7)); });
      P.commit(); crown.scale.setScalar(1 + Math.sin(t * 1.5) * 0.03);
    };
  },
  crowd(s, col, reduced) { // a starling murmuration: many birds, one shape
    const N = 160, P = particles(N, col, 0.12); s.add(P.pts);
    const ph = Array.from({ length: N }, () => [rand(0, 6.28), rand(-1, 1), rand(-1, 1)]);
    s.add(cyl(0.05, 0.05, 1.2, std('#8a93a8'), 6, 0, 0.9, 0));
    return (t) => {
      const k = reduced ? 0.25 : 1, T = t * k;
      const cx = Math.sin(T * 0.7) * 0.6, cy = 2.3 + Math.sin(T * 1.1) * 0.3, cz = Math.cos(T * 0.5) * 0.6;
      ph.forEach(([a, u, w], i) => {
        const sq = 0.6 + 0.4 * Math.sin(T * 0.9 + u * 2);
        const x = cx + Math.cos(a + T * 0.8) * 1.1 * sq + u * 0.25, y = cy + w * 0.45 * (1.3 - sq) + Math.sin(a * 3 + T) * 0.15, z = cz + Math.sin(a + T * 0.8) * 0.7 * sq;
        P.pos.set([x, y, z], i * 3); P.sz[i] = 0.55; P.al[i] = 0.9;
      });
      P.commit();
    };
  },
};
