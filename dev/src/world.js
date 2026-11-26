import * as THREE from 'three';
import { COLORS, R_FLOOR, R_RING, R_ROOM, ROOMS } from './config.js';
import { neon, std, box, cyl, sphere, polar, arcTube, canvasTex, rand, particles } from './util.js';

const RAINBOW = COLORS.map((c) => new THREE.Color(c));

export function buildWorld(scene, reduced) {
  const updaters = [];

  // ---------- Sky dome ----------
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vW;
      void main(){ float h = vW.y;
        vec3 top = vec3(.006,.008,.03), mid = vec3(.03,.025,.09), hor = vec3(.20,.07,.22);
        vec3 c = mix(hor, mid, smoothstep(.0,.2,h)); c = mix(c, top, smoothstep(.18,.7,h));
        c = mix(c, vec3(.03,.025,.07), smoothstep(.0,-.12,h));
        c += vec3(.25,.08,.3)*exp(-abs(h-.01)*30.)*.5;
        gl_FragColor = vec4(c,1.); }`,
  }));
  scene.add(sky);

  // stars
  {
    const n = 1400, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2, v = rand(0.12, 1);
      const r = 820, y = v * v;
      const k = Math.sqrt(1 - y * y);
      p.set([Math.cos(u) * k * r, y * r, Math.sin(u) * k * r], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfd0ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
    scene.add(stars);
  }
  // moon
  {
    const moon = sphere(26, new THREE.MeshBasicMaterial({ color: new THREE.Color('#e9e6ff').multiplyScalar(1.3), fog: false }), -330, 260, -620, 32);
    scene.add(moon);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('#9fb4ff'), color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(220, 220, 1); halo.position.copy(moon.position); scene.add(halo);
  }

  // ---------- City ----------
  const winTex = windowTexture();
  const cityGroup = new THREE.Group(); scene.add(cityGroup);
  const tops = [];
  for (let i = 0; i < 190; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = rand(62, 300);
    // keep the camera side lower so nothing hides the floor
    const camSide = Math.cos(a) > 0.2;
    let top = rand(-95, -22) + (r - 60) * rand(0.05, 0.32);
    if (camSide) top = Math.min(top, -34 + (r - 60) * 0.12);
    if (!camSide && r > 120 && Math.random() < 0.3) top = rand(0, 45);
    const h = top + 320, w = rand(10, 26), d = rand(10, 26);
    const tex = winTex.clone(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, Math.round(w / 11)), Math.max(1, Math.round(h / 14)));
    tex.offset.set(Math.random(), Math.random());
    const hue = Math.random();
    const mat = new THREE.MeshStandardMaterial({ color: 0x03040a, roughness: 0.85, metalness: 0.3,
      emissive: hue < 0.75 ? 0xffd9a0 : (hue < 0.9 ? 0x8fd8ff : 0xff9de8), emissiveMap: tex, emissiveIntensity: rand(0.22, 0.55) });
    const b = box(w, h, d, mat, Math.sin(a) * r, top - h / 2, Math.cos(a) * r);
    b.rotation.y = rand(0, Math.PI);
    cityGroup.add(b);
    if (top > -15 && Math.random() < 0.6) tops.push(b.position.clone().setY(top + 0.6));
    if (Math.random() < 0.25) { // neon crown
      const crown = box(w + 0.2, 0.35, d + 0.2, neon(COLORS[i % 7], 1.6), b.position.x, top - 2, b.position.z);
      crown.rotation.y = b.rotation.y; cityGroup.add(crown);
    }
  }
  const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 48), new THREE.MeshBasicMaterial({ color: 0x07061a }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -300; scene.add(ground);
  // aviation lights
  const avMat = neon('#ff2a3a', 3);
  const avs = tops.slice(0, 40).map((p) => { const s = sphere(0.7, avMat, p.x, p.y, p.z, 8); cityGroup.add(s); return s; });
  updaters.push((t) => { const on = (Math.sin(t * 2.4) > 0.6); avs.forEach((s) => (s.visible = on)); });

  // flying traffic
  {
    const n = 48;
    const geo = new THREE.BoxGeometry(1.6, 0.35, 0.5);
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true }), n);
    const lanes = [];
    for (let i = 0; i < n; i++) {
      lanes.push({ r: rand(70, 200), y: rand(-25, 28), a: rand(0, 6.28), s: rand(0.03, 0.08) * (i % 2 ? 1 : -1) });
      inst.setColorAt(i, new THREE.Color(i % 2 ? '#fff3d6' : '#ff4058').multiplyScalar(3));
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    updaters.push((t, dt) => {
      lanes.forEach((L, i) => {
        L.a += L.s * dt * (reduced ? 0.3 : 1);
        p.set(Math.sin(L.a) * L.r, L.y, Math.cos(L.a) * L.r);
        e.set(0, L.a + Math.PI / 2, 0); q.setFromEuler(e);
        m4.compose(p, q, s); inst.setMatrixAt(i, m4);
      });
      inst.instanceMatrix.needsUpdate = true;
    });
    scene.add(inst);
  }

  // ---------- Our tower ----------
  {
    const t2 = winTex.clone(); t2.wrapS = t2.wrapT = THREE.RepeatWrapping; t2.repeat.set(30, 22);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(R_FLOOR + 0.4, R_FLOOR + 2, 220, 72, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x060812, metalness: 0.8, roughness: 0.35, emissive: 0xbfd6ff, emissiveMap: t2, emissiveIntensity: 0.3 }));
    core.position.y = -110.4; scene.add(core);
    const slab = cyl(R_FLOOR + 0.4, R_FLOOR + 0.4, 0.8, std(0x0b0f1d, { metalness: 0.7, roughness: 0.3 }), 96, 0, -0.42, 0);
    scene.add(slab);
    // floor edge neon + lower edge
    const edge = new THREE.Mesh(new THREE.TorusGeometry(R_FLOOR + 0.42, 0.07, 6, 160), neon('#7ab8ff', 2.6));
    edge.rotation.x = Math.PI / 2; edge.position.y = 0.02; scene.add(edge);
    const edge2 = new THREE.Mesh(new THREE.TorusGeometry(R_FLOOR + 0.42, 0.05, 6, 160), neon('#b84dff', 2));
    edge2.rotation.x = Math.PI / 2; edge2.position.y = -0.8; scene.add(edge2);
  }

  // ---------- Floor with glowing grid ----------
  const floorMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTint: { value: new THREE.Color('#2fb6ff') }, uI: { value: 0.5 } },
    vertexShader: `varying vec2 vP; void main(){ vec4 w = modelMatrix*vec4(position,1.); vP = w.xz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uTint; uniform float uI; varying vec2 vP;
      float grid(vec2 p, float s, float w){ vec2 q = p/s; vec2 g = abs(fract(q-.5)-.5)/fwidth(q); return 1.-min(min(g.x,g.y)/w,1.); }
      void main(){
        float r = length(vP);
        vec3 base = mix(vec3(.018,.022,.045), vec3(.006,.008,.018), smoothstep(4.,36.,r));
        float g1 = grid(vP, 1.5, 1.), g2 = grid(vP, 9., 1.6);
        float wave = smoothstep(2.5, 0., abs(r - mod(uTime*5., 70.)));
        float fade = 1. - smoothstep(31., 36., r);
        vec3 gc = vec3(.12,.36,1.);
        vec3 c = base + gc*(g1*.10 + g2*.28)*(.7 + wave*1.8)*fade;
        float q = r/3.; float ring = 1.-min(abs(fract(q-.5)-.5)/fwidth(q),1.);
        c += vec3(.45,.2,1.)*ring*.05*fade;
        c += uTint * uI * .22 * exp(-max(r-6.,0.)*.22);
        gl_FragColor = vec4(c,1.);
      }`,
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R_FLOOR, 128), floorMat);
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  updaters.push((t) => { floorMat.uniforms.uTime.value = t; });

  // ---------- Glass curtain (far half only, so the camera side stays open) ----------
  {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(R_FLOOR, R_FLOOR, 10, 96, 1, true, Math.PI * 0.55, Math.PI * 0.9),
      new THREE.MeshStandardMaterial({ color: 0x6f8cff, transparent: true, opacity: 0.07, roughness: 0.05, metalness: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    glass.position.y = 5; scene.add(glass);
    const mul = neon('#5d7cff', 1.2);
    for (let a = Math.PI * 0.55; a <= Math.PI * 1.45 + 0.001; a += Math.PI / 30) {
      const m = box(0.08, 10, 0.08, mul); m.position.copy(polar(R_FLOOR, a, 5)); scene.add(m);
    }
    scene.add(arcTube(R_FLOOR, Math.PI * 0.55, Math.PI * 1.45, 10, 0.06, neon('#8fb0ff', 2.2), 90));
    scene.add(arcTube(R_FLOOR - 0.1, Math.PI * 0.55, Math.PI * 1.45, 0.08, 0.05, neon('#b84dff', 2.2), 90));
    // low glass rail on the near half
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(R_FLOOR, R_FLOOR, 1.1, 96, 1, true, -Math.PI * 0.45, Math.PI * 0.9),
      new THREE.MeshStandardMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false }));
    rail.position.y = 0.55; scene.add(rail);
    scene.add(arcTube(R_FLOOR, -Math.PI * 0.45, Math.PI * 0.45, 1.1, 0.04, neon('#7ab8ff', 2.4), 90));
  }

  // ---------- Low planting around the outside of the offices ----------
  buildPlants(scene);

  // ---------- Fountain ----------
  const fountain = buildFountain(scene, reduced);
  updaters.push(fountain.update);

  return { updaters, floorMat, fountain };
}

function radialTex(color) {
  return canvasTex(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, color); g.addColorStop(0.25, color + '88'); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }).tex;
}

function windowTexture() {
  return canvasTex(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    for (let y = 4; y < h; y += 16) for (let x = 4; x < w; x += 12) {
      const r = Math.random();
      if (r < 0.2) { ctx.fillStyle = `rgba(255,${200 + Math.random() * 55 | 0},${140 + Math.random() * 80 | 0},${0.35 + Math.random() * 0.65})`; ctx.fillRect(x, y, 8, 10); }
      else if (r < 0.36) { ctx.fillStyle = 'rgba(150,220,255,.8)'; ctx.fillRect(x, y, 8, 10); }
      else { ctx.fillStyle = 'rgba(40,60,110,.25)'; ctx.fillRect(x, y, 8, 10); }
    }
  }).tex;
}

function buildPlants(scene) {
  const soil = new THREE.Mesh(new THREE.RingGeometry(R_ROOM + 1.4, R_FLOOR - 0.8, 128, 1), std(0x0a0f0c, { roughness: 0.95 }));
  soil.rotation.x = -Math.PI / 2; soil.position.y = 0.03; scene.add(soil);
  scene.add(arcTube(R_ROOM + 1.4, 0, Math.PI * 2, 0.06, 0.035, neon('#3ee07f', 1.4), 160));
  scene.add(arcTube(R_FLOOR - 0.8, 0, Math.PI * 2, 0.06, 0.035, neon('#3ee07f', 1.4), 160));

  const bushGeo = new THREE.IcosahedronGeometry(0.5, 1);
  const nB = 230;
  const bushes = new THREE.InstancedMesh(bushGeo, std(0xffffff, { roughness: 0.8, flatShading: true }), nB);
  const flowerGeo = new THREE.SphereGeometry(0.09, 8, 6);
  const nF = 700;
  const flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), nF);
  const grassGeo = new THREE.ConeGeometry(0.06, 0.55, 4); grassGeo.translate(0, 0.27, 0);
  const nG = 600;
  const grass = new THREE.InstancedMesh(grassGeo, std(0xffffff, { roughness: 0.9 }), nG);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const greens = ['#1f6b45', '#2a8a55', '#17553a', '#2f7a3d', '#1d5f5a'];
  const blooms = ['#ff6fb5', '#ffd93d', '#b84dff', '#7ad7ff', '#ff8c2b', '#ffffff'];
  const bushPos = [];
  const ringPoint = () => {
    // outer planting band + pockets between offices
    if (Math.random() < 0.8) return polar(rand(R_ROOM + 2, R_FLOOR - 1.5), rand(0, Math.PI * 2));
    const k = (Math.random() * 8) | 0; return polar(rand(19.5, 25.5), (k * 45 + 22.5 + rand(-3, 3)) * Math.PI / 180);
  };
  for (let i = 0; i < nB; i++) {
    const pt = ringPoint(); bushPos.push(pt);
    const sc = rand(0.55, 1.15);
    p.set(pt.x, 0.12 * sc, pt.z); e.set(0, rand(0, 6), 0); q.setFromEuler(e); s.set(sc * rand(0.9, 1.4), sc * rand(0.45, 0.7), sc * rand(0.9, 1.4));
    m.compose(p, q, s); bushes.setMatrixAt(i, m); bushes.setColorAt(i, new THREE.Color(greens[i % 5]));
  }
  for (let i = 0; i < nF; i++) {
    const b = bushPos[i % nB];
    p.set(b.x + rand(-0.6, 0.6), rand(0.2, 0.42), b.z + rand(-0.6, 0.6)); s.setScalar(rand(0.6, 1.3)); q.identity();
    m.compose(p, q, s); flowers.setMatrixAt(i, m); flowers.setColorAt(i, new THREE.Color(blooms[i % blooms.length]).multiplyScalar(rand(1.2, 2.4)));
  }
  for (let i = 0; i < nG; i++) {
    const pt = ringPoint();
    p.set(pt.x, 0.03, pt.z); e.set(rand(-0.3, 0.3), 0, rand(-0.3, 0.3)); q.setFromEuler(e); s.set(1, rand(0.6, 1.3), 1);
    m.compose(p, q, s); grass.setMatrixAt(i, m); grass.setColorAt(i, new THREE.Color(greens[(i + 2) % 5]).multiplyScalar(1.2));
  }
  scene.add(bushes, flowers, grass);
}

function buildFountain(scene, reduced) {
  const g = new THREE.Group(); scene.add(g);
  // basin
  const prof = [[5.0, 0], [5.9, 0], [6.0, 0.55], [5.75, 0.72], [5.3, 0.7], [5.25, 0.45]].map(([x, y]) => new THREE.Vector2(x, y));
  const basin = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), std(0x141a2e, { metalness: 0.85, roughness: 0.25 }));
  g.add(basin);
  const rimMat = neon('#ffffff', 2.2);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(5.95, 0.05, 6, 128), rimMat); rim.rotation.x = Math.PI / 2; rim.position.y = 0.62; g.add(rim);
  // water
  const waterMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#2fb6ff') }, uI: { value: 1 } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uI; varying vec2 vP;
      void main(){ float r = length(vP);
        float rip = sin(r*5. - uTime*3.)*.5+.5; rip *= sin(r*2.3 + uTime*1.3)*.5+.5;
        float caust = pow(rip, 3.);
        vec3 deep = vec3(.01,.03,.08);
        vec3 c = deep + uColor*(.18 + .55*caust)*(.4 + .9*uI) + vec3(.6,.8,1.)*caust*.06;
        c += uColor * smoothstep(1.4, .9, r) * .4 * uI;
        gl_FragColor = vec4(c, 1.); }`,
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(5.3, 96), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.y = 0.5; g.add(water);
  // pedestal tiers
  const ped = std(0x1a2238, { metalness: 0.9, roughness: 0.2 });
  g.add(cyl(1.25, 1.45, 0.7, ped, 48, 0, 0.6, 0));
  g.add(cyl(0.55, 0.8, 1.6, ped, 48, 0, 1.7, 0));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [1.4, 0.3], [1.55, 0.55], [1.35, 0.5], [0, 0.25]].map(([x, y]) => new THREE.Vector2(x, y)), 64), ped);
  bowl.position.y = 2.45; g.add(bowl);
  const bowlRim = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.04, 6, 64), rimMat); bowlRim.rotation.x = Math.PI / 2; bowlRim.position.y = 3.0; g.add(bowlRim);

  // breathing ring on the floor
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(R_RING - 0.45, R_RING + 0.45, 160, 1), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring);
  const ringCore = new THREE.Mesh(new THREE.TorusGeometry(R_RING, 0.07, 8, 160), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  ringCore.rotation.x = Math.PI / 2; ringCore.position.y = 0.06; g.add(ringCore);
  // faint guide rings
  g.add(Object.assign(arcTube(R_RING + 0.9, 0, Math.PI * 2, 0.04, 0.02, neon('#8fb0ff', 1), 160)));

  // jets: GPU-animated particles, from the rim arcing toward the centre
  const JETS = 28, PER = 46;
  const n = JETS * PER;
  const aJet = new Float32Array(n), aPh = new Float32Array(n), aRnd = new Float32Array(n);
  for (let j = 0; j < JETS; j++) for (let k = 0; k < PER; k++) {
    const i = j * PER + k; aJet[i] = (j / JETS) * Math.PI * 2; aPh[i] = k / PER + Math.random() * 0.02; aRnd[i] = Math.random();
  }
  const jg = new THREE.BufferGeometry();
  jg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  jg.setAttribute('aJet', new THREE.BufferAttribute(aJet, 1));
  jg.setAttribute('aPh', new THREE.BufferAttribute(aPh, 1));
  jg.setAttribute('aRnd', new THREE.BufferAttribute(aRnd, 1));
  const jetMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#7fd0ff') }, uSpeed: { value: reduced ? 0.15 : 0.42 } },
    vertexShader: `attribute float aJet; attribute float aPh; attribute float aRnd; uniform float uTime; uniform float uSpeed; varying float vT;
      void main(){ float t = fract(uTime*uSpeed + aPh); vT = t;
        vec2 d = vec2(sin(aJet), cos(aJet));
        vec2 xz = mix(d*5.6, d*1.25, t);
        float y = mix(.75, 3.05, t) + 3.4*4.*t*(1.-t);
        xz += vec2(cos(aRnd*40.), sin(aRnd*40.))*.05*t;
        vec4 mv = modelViewMatrix*vec4(xz.x, y, xz.y, 1.);
        gl_PointSize = (2.6 - t*1.2) * 18. / -mv.z * 10.;
        gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; varying float vT;
      void main(){ vec2 d = gl_PointCoord-.5; float r = length(d); if(r>.5) discard;
        float a = smoothstep(.5,.0,r); float fade = smoothstep(0.,.08,vT)*smoothstep(1.,.85,vT);
        gl_FragColor = vec4(mix(uColor*1.6, vec3(2.), .35)*a*fade*.55, 1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const jets = new THREE.Points(jg, jetMat); jets.frustumCulled = false; g.add(jets);

  // centre plume
  const plume = particles(160, '#bfe6ff', 0.16);
  const pl = plume; const plT = new Float32Array(160).map(() => Math.random()); const plA = new Float32Array(160).map(() => Math.random() * 6.28);
  g.add(pl.pts);

  // emblem: seven-colour heptagon crystal floating above
  const emblem = new THREE.Group(); emblem.position.set(0, 8.6, 0); g.add(emblem);
  const R = 2.8;
  for (let i = 0; i < 7; i++) {
    const a0 = (i / 7) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / 7) * Math.PI * 2 - Math.PI / 2;
    const p0 = new THREE.Vector3(Math.cos(a0) * R, Math.sin(a0) * R, 0), p1 = new THREE.Vector3(Math.cos(a1) * R, Math.sin(a1) * R, 0);
    const len = p0.distanceTo(p1);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, len, 8), neon(COLORS[i], 3.6));
    seg.position.copy(p0).add(p1).multiplyScalar(0.5);
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
    emblem.add(seg);
  }
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), new THREE.MeshPhysicalMaterial({
    color: 0xcfe0ff, emissive: 0x6a7dff, emissiveIntensity: 0.6, roughness: 0.05, metalness: 0.1, transmission: 0.0, transparent: true, opacity: 0.85, flatShading: true }));
  crystal.scale.set(1.5, 2.2, 1.5); emblem.add(crystal);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1.3, 4.1, 32, 1, true), new THREE.MeshBasicMaterial({
    color: new THREE.Color('#7fb0ff'), transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 5.8; beam.scale.y = 1.35; g.add(beam);

  const light = new THREE.PointLight(0x7fd0ff, 60, 34, 1.6); light.position.set(0, 4, 0); g.add(light);

  const cur = new THREE.Color();
  const base = new THREE.Color('#5fc8ff');
  const PER_COLOR = reduced ? 7 : 4.2;
  const state = { idx: 0, env: 0, color: cur };
  return {
    group: g, emblem, light,
    state,
    update(t, dt) {
      const k = t / PER_COLOR; const idx = Math.floor(k) % 7; const f = k - Math.floor(k);
      // in 45%, out 45%, tiny gap -> breathing
      const env = Math.pow(Math.sin(Math.PI * Math.min(f / 0.94, 1)), 2);
      const c = RAINBOW[idx];
      ringMat.color.copy(c).multiplyScalar(0.15 + env * 1.4);
      ringCore.material.color.copy(c).multiplyScalar(0.3 + env * 3.2);
      cur.copy(base).lerp(c, 0.25 + env * 0.75);
      waterMat.uniforms.uColor.value.copy(cur); waterMat.uniforms.uI.value = 0.35 + env * 0.65; waterMat.uniforms.uTime.value = t;
      jetMat.uniforms.uColor.value.copy(cur).lerp(new THREE.Color(1, 1, 1), 0.35); jetMat.uniforms.uTime.value = t;
      rimMat.color.copy(cur).multiplyScalar(1.2 + env * 1.6);
      bowlRim.material = rimMat;
      light.color.copy(cur); light.intensity = 30 + env * 70;
      state.idx = idx; state.env = env;
      // plume
      for (let i = 0; i < 160; i++) {
        plT[i] += dt * (reduced ? 0.15 : 0.5); if (plT[i] > 1) { plT[i] -= 1; plA[i] = Math.random() * 6.28; }
        const tt = plT[i], rr = 0.15 + tt * 1.2;
        pl.pos[i * 3] = Math.cos(plA[i]) * rr; pl.pos[i * 3 + 1] = 3.1 + 5.2 * tt - 4.6 * tt * tt; pl.pos[i * 3 + 2] = Math.sin(plA[i]) * rr;
        pl.sz[i] = 0.9 - tt * 0.4; pl.al[i] = Math.sin(Math.PI * tt) * 0.7;
      }
      pl.mat.uniforms.uColor.value.copy(cur).lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(1.8);
      pl.commit();
      emblem.rotation.y = t * (reduced ? 0.1 : 0.35);
      emblem.position.y = 8.6 + Math.sin(t * 1.1) * (reduced ? 0.05 : 0.25);
      crystal.rotation.y = -t * 0.8;
    },
  };
}
