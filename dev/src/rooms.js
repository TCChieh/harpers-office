import * as THREE from 'three';
import { ROOMS, LOBBY, R_ROOM, ROOM_RAD, COLORS } from './config.js';
import { neon, std, box, cyl, sphere, arcTube, halfDisc, canvasTex, textSign, roundRect, FONT, rand, particles } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DOOR_GAP = 0.15; // radians each side of the door centre

function shell(def, opts = {}) {
  const g = new THREE.Group();
  g.position.set(Math.sin(def.angle) * R_ROOM, 0, Math.cos(def.angle) * R_ROOM);
  g.rotation.y = def.angle + Math.PI; // local +z faces the fountain
  const col = def.color;
  const floorMat = std(new THREE.Color(col).lerp(new THREE.Color('#0a0e1c'), 0.88), { metalness: 0.25, roughness: 0.75 });
  const floor = new THREE.Mesh(halfDisc(ROOM_RAD, 64), floorMat); floor.position.y = 0.025; g.add(floor);
  // floor inlay arcs
  g.add(arcTube(ROOM_RAD - 1.2, -Math.PI / 2, Math.PI / 2, 0.035, 0.012, neon(col, 1.2), 48));

  const fade = [];
  const lc = new THREE.Color(col); const lum = 0.2126 * lc.r + 0.7152 * lc.g + 0.0722 * lc.b;
  const pl = new THREE.PointLight(lc.lerp(new THREE.Color('#ffffff'), 0.25), (opts.noWall ? 8 : 10) * Math.min(1.3, 0.3 / Math.max(lum, 0.12)), 13, 1.7); pl.position.set(0, 3.6, 3.6); g.add(pl);
  if (!opts.noWall) {
    const wallMat = std(0x0d1222, { metalness: 0.5, roughness: 0.55, transparent: true });
    const wall = box(ROOM_RAD * 2 + 0.3, 4.4, 0.35, wallMat, 0, 2.2, -0.18); g.add(wall);
    const panelMat = std(new THREE.Color(col).lerp(new THREE.Color('#0d1222'), 0.85), { metalness: 0.4, roughness: 0.6, transparent: true });
    const panel = box(ROOM_RAD * 2 - 0.6, 3.6, 0.05, panelMat, 0, 2.2, 0.02); g.add(panel);
    const topN = neon(col, 3, { transparent: true });
    g.add(box(ROOM_RAD * 2 + 0.3, 0.08, 0.08, topN, 0, 4.42, 0.02));
    g.add(box(0.08, 4.4, 0.08, topN, -ROOM_RAD - 0.12, 2.2, 0.02));
    g.add(box(0.08, 4.4, 0.08, topN, ROOM_RAD + 0.12, 2.2, 0.02));
    fade.push({ m: wallMat, o: 1 }, { m: panelMat, o: 1 });
  }
  if (!opts.noGlass) {
    const glassMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(col).lerp(new THREE.Color('#bfe0ff'), 0.6), transparent: true, opacity: 0.07,
      roughness: 0.1, metalness: 0.0, envMapIntensity: 0.4, side: THREE.DoubleSide, depthWrite: false });
    const H = 3.0;
    for (const [s, l] of [[-Math.PI / 2, Math.PI / 2 - DOOR_GAP], [DOOR_GAP, Math.PI / 2 - DOOR_GAP]]) {
      const gl = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_RAD, ROOM_RAD, H, 48, 1, true, s, l), glassMat);
      gl.position.y = H / 2; g.add(gl);
    }
    const nm = neon(col, 3.2);
    g.add(arcTube(ROOM_RAD, -Math.PI / 2, -DOOR_GAP, 0.05, 0.05, nm, 40));
    g.add(arcTube(ROOM_RAD, DOOR_GAP, Math.PI / 2, 0.05, 0.05, nm, 40));
    g.add(arcTube(ROOM_RAD, -Math.PI / 2, Math.PI / 2, H, 0.04, nm, 80));
    // mullions
    const mm = neon(col, 1.0);
    for (let a = -Math.PI / 2 + 0.26; a < Math.PI / 2 - 0.1; a += 0.26) {
      if (Math.abs(a) < DOOR_GAP + 0.05) continue;
      g.add(box(0.03, H, 0.03, mm, Math.sin(a) * ROOM_RAD, H / 2, Math.cos(a) * ROOM_RAD));
    }
    // door frame
    const dx = Math.sin(DOOR_GAP) * ROOM_RAD, dz = Math.cos(DOOR_GAP) * ROOM_RAD;
    const fm = neon(col, 4);
    g.add(box(0.1, 2.6, 0.1, fm, -dx, 1.3, dz), box(0.1, 2.6, 0.1, fm, dx, 1.3, dz), box(dx * 2 + 0.1, 0.1, 0.1, fm, 0, 2.6, dz));
    const thresh = new THREE.Mesh(new THREE.PlaneGeometry(dx * 2, 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.5), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    thresh.rotation.x = -Math.PI / 2; thresh.position.set(0, 0.04, dz); g.add(thresh);
  }
  return { g, floor, fade };
}

function deskSet(g, col, z, faceZ = 1, w = 2.8) {
  const top = std(0x1b2238, { metalness: 0.6, roughness: 0.3 });
  const leg = std(0x0f1424, { metalness: 0.8, roughness: 0.3 });
  g.add(box(w, 0.08, 1.1, top, 0, 0.78, z));
  g.add(box(0.08, 0.74, 0.9, leg, -w / 2 + 0.15, 0.37, z), box(0.08, 0.74, 0.9, leg, w / 2 - 0.15, 0.37, z));
  g.add(box(w, 0.03, 0.03, neon(col, 3), 0, 0.76, z + faceZ * 0.56));
  // chair
  const cz = z - faceZ * 1.05;
  const seatMat = std(new THREE.Color(col).lerp(new THREE.Color('#202638'), 0.55), { roughness: 0.7 });
  g.add(cyl(0.42, 0.42, 0.1, seatMat, 24, 0, 0.5, cz));
  g.add(cyl(0.05, 0.05, 0.45, leg, 8, 0, 0.25, cz));
  g.add(cyl(0.32, 0.32, 0.04, leg, 16, 0, 0.03, cz));
  const back = box(0.8, 0.7, 0.08, seatMat, 0, 0.95, cz - faceZ * 0.42); g.add(back);
  return cz;
}

function projector(g, col, x, y, z) {
  const base = new THREE.Group(); base.position.set(x, y, z); g.add(base);
  base.add(cyl(0.35, 0.42, 0.12, std(0x20283f, { metalness: 0.9, roughness: 0.2 }), 24, 0, 0.06, 0));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 6, 32), neon(col, 3)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.13; base.add(ring);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.25, 1.0, 32, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(0.8), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.y = 0.62; base.add(cone);
  const holo = new THREE.Group(); holo.position.y = 1.35; base.add(holo);
  return holo;
}
const wire = (col, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k * 0.5), wireframe: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });

// ---------------------------------------------------------------- per-room decor
const DECOR = {
  fire(g, col) {
    const ups = [];
    // forge
    const forge = new THREE.Group(); forge.position.set(-5.2, 0, 1.6); g.add(forge);
    forge.add(box(2.0, 1.3, 1.3, std(0x2a1c1c, { metalness: 0.7, roughness: 0.4 }), 0, 0.65, 0));
    const mouth = box(1.2, 0.45, 0.05, neon('#ff7a2a', 3.5), 0, 0.75, 0.66); forge.add(mouth);
    forge.add(box(0.6, 2.6, 0.6, std(0x241818, { metalness: 0.7 }), 0, 2.5, -0.2));
    const embers = particles(40, '#ff9a3a', 0.12); embers.pts.position.set(0, 0.9, 0.7); forge.add(embers.pts);
    // anvil
    g.add(box(0.9, 0.3, 0.4, std(0x3a3f50, { metalness: 1, roughness: 0.25 }), -3.0, 0.75, 3.6), cyl(0.18, 0.25, 0.6, std(0x23283a, { metalness: 0.9 }), 12, -3.0, 0.3, 3.6));
    // lava lamps
    const lamps = [];
    for (const [x, z] of [[5.4, 1.2], [6.1, 2.4], [4.7, 0.6]]) {
      g.add(cyl(0.22, 0.28, 0.3, std(0x30202a, { metalness: 0.8 }), 16, x, 0.15, z));
      const glass = cyl(0.2, 0.26, 1.2, new THREE.MeshStandardMaterial({ color: 0xff6a3a, emissive: 0xff3a1a, emissiveIntensity: 0.8, transparent: true, opacity: 0.5 }), 16, x, 0.9, z); g.add(glass);
      const blob = sphere(0.12, neon('#ffb43a', 3), x, 0.6, z, 12); g.add(blob); lamps.push(blob);
    }
    // flame neon on back wall
    const fl = new THREE.Shape(); fl.moveTo(0, 0); fl.bezierCurveTo(-0.9, 0.5, -0.4, 1.4, 0, 2.2); fl.bezierCurveTo(0.2, 1.5, 0.7, 1.4, 0.5, 0.7); fl.bezierCurveTo(0.9, 0.9, 0.8, 0.2, 0, 0);
    const pts = fl.getPoints(40).map((p) => V(p.x, p.y, 0));
    const fline = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 80, 0.04, 6, true), neon(col, 3.2));
    fline.position.set(2.8, 1.0, 0.1); fline.scale.setScalar(0.95); g.add(fline);
    ups.push((t, dt) => {
      lamps.forEach((b, i) => (b.position.y = 0.6 + (Math.sin(t * 0.6 + i * 2) * 0.5 + 0.5) * 0.7));
      mouth.material.color.setRGB(3.5 + Math.sin(t * 9) * 0.6, 1.2 + Math.sin(t * 7) * 0.3, 0.3);
      for (let i = 0; i < 40; i++) { const l = (t * 0.4 + i / 40) % 1; embers.pos.set([Math.sin(i * 9.1) * 0.5 * l, l * 1.6, 0.1 + l * 0.4], i * 3); embers.sz[i] = 0.5; embers.al[i] = 1 - l; }
      embers.commit();
    });
    return { ups, holo: (h) => { // sun with flares
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), wire('#ffb36a', 2.4)); h.add(s);
      const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.012, 4, 48), wire(col, 3)); r1.rotation.x = 1.2; h.add(r1);
      const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.012, 4, 48), wire('#ffd36a', 3)); r2.rotation.x = 1.9; h.add(r2);
      return (t) => { s.rotation.y = t * 0.6; r1.rotation.z = t; r2.rotation.z = -t * 0.7; };
    } };
  },
  wind(g, col) {
    const ups = [];
    // cloud sofa
    const cloud = new THREE.Group(); cloud.position.set(-5.0, 0, 2.2); cloud.rotation.y = 0.6; g.add(cloud);
    const cm = std(0xf2f5ff, { roughness: 0.9 });
    for (const [x, y, z, r] of [[-0.8, 0.35, 0, 0.5], [0, 0.35, 0, 0.55], [0.8, 0.35, 0, 0.5], [-0.5, 0.8, -0.35, 0.45], [0.4, 0.82, -0.35, 0.48], [-1.2, 0.55, -0.1, 0.38], [1.2, 0.55, -0.1, 0.38]]) cloud.add(sphere(r, cm, x, y, z, 16));
    // telescope
    const tel = new THREE.Group(); tel.position.set(5.0, 0, 1.6); g.add(tel);
    const tm = std(0xc9a56a, { metalness: 0.9, roughness: 0.3 });
    for (const a of [0, 2.1, 4.2]) { const l = cyl(0.03, 0.03, 1.4, tm, 6, Math.sin(a) * 0.3, 0.65, Math.cos(a) * 0.3); l.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25); tel.add(l); }
    const tube = cyl(0.12, 0.18, 1.5, std(0x2a3550, { metalness: 0.8, roughness: 0.3 }), 16, 0, 1.55, 0); tube.rotation.x = -1.0; tel.add(tube);
    // windsock pole & chimes
    const chimes = [];
    for (let i = 0; i < 5; i++) { const c = cyl(0.03, 0.03, 0.5 + i * 0.12, neon(col, 2), 6, 3.2 + i * 0.18, 2.9 - i * 0.06, 0.8); g.add(c); chimes.push(c); }
    g.add(box(1.4, 0.04, 0.04, std(0x8a6a3a), 3.55, 3.25, 0.8));
    // wall map with route lines
    const map = canvasTex(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#081024'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(120,170,255,.25)'; for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
      for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(40 + k * 70, 200 - k * 20); ctx.quadraticCurveTo(250, 20 + k * 10, 470 - k * 30, 60 + k * 25); ctx.stroke(); }
      ctx.setLineDash([]); ctx.fillStyle = '#fff'; for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(40 + k * 52, 60 + (k * 73) % 150, 4, 0, 7); ctx.fill(); }
    });
    const mp = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), new THREE.MeshBasicMaterial({ map: map.tex, color: new THREE.Color(1.3, 1.3, 1.3) })); mp.position.set(-2.2, 2.4, 0.08); g.add(mp);
    ups.push((t) => chimes.forEach((c, i) => (c.rotation.z = Math.sin(t * 2 + i) * 0.15)));
    return { ups, holo: (h) => {
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), wire('#9fdcff', 2)); h.add(globe);
      const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.012, 4, 64), wire(col, 3)); orbit.rotation.x = 1.3; h.add(orbit);
      const plane = sphere(0.06, neon('#ffffff', 3), 0.75, 0, 0, 8); const pg = new THREE.Group(); pg.rotation.x = 1.3 - Math.PI / 2; pg.add(plane); h.add(pg);
      return (t) => { globe.rotation.y = t * 0.4; pg.rotation.y = t * 1.2; };
    } };
  },
  volt(g, col, room) {
    const ups = [];
    // ---- monitor wall (CI / code / terminal / latency) ----
    const frame = box(15.2, 3.5, 0.18, std(0x05070e, { metalness: 0.6, roughness: 0.3 }), 0, 2.15, 0.12); g.add(frame);
    g.add(box(15.3, 0.05, 0.05, neon(col, 3), 0, 3.92, 0.22), box(15.3, 0.05, 0.05, neon(col, 3), 0, 0.38, 0.22));
    const scr = makeOpsScreens();
    const layout = [['ci', -5.75, 3.4], ['code', -1.95, 3.9], ['term', 1.95, 3.9], ['lat', 5.75, 3.4]];
    for (const [k, x, w] of layout) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.7), new THREE.MeshBasicMaterial({ map: scr[k].tex, color: new THREE.Color(1.25, 1.25, 1.25) }));
      m.position.set(x, 2.05, 0.22); g.add(m);
    }
    const ticker = new THREE.Mesh(new THREE.PlaneGeometry(15, 0.38), new THREE.MeshBasicMaterial({ map: scr.tick.tex, color: new THREE.Color(1.4, 1.4, 1.4) }));
    ticker.position.set(0, 3.63, 0.22); g.add(ticker);
    // ---- three-monitor on-call desk (operator faces the wall) ----
    const top = std(0x1b2238, { metalness: 0.6, roughness: 0.3 });
    g.add(box(3.6, 0.08, 1.2, top, 0, 0.78, 3.0));
    g.add(box(0.08, 0.74, 1.0, std(0x0f1424), -1.6, 0.37, 3.0), box(0.08, 0.74, 1.0, std(0x0f1424), 1.6, 0.37, 3.0));
    g.add(box(3.6, 0.03, 0.03, neon(col, 3), 0, 0.76, 3.62));
    const monTex = [scr.code, scr.topo, scr.term];
    [[-1.15, 0.38], [0, 0], [1.15, -0.38]].forEach(([x, ry], i) => {
      const mon = new THREE.Group(); mon.position.set(x, 1.32, 2.72 + Math.abs(x) * 0.12); mon.rotation.y = ry; g.add(mon);
      mon.add(box(1.12, 0.68, 0.05, std(0x05070d, { metalness: 0.5 }), 0, 0, -0.02));
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.6), new THREE.MeshBasicMaterial({ map: monTex[i].tex, color: new THREE.Color(1.3, 1.3, 1.3) })); s.position.z = 0.01; mon.add(s);
      mon.add(cyl(0.03, 0.03, 0.5, std(0x2a3048, { metalness: 1 }), 6, 0, -0.42, -0.06));
    });
    g.add(box(0.9, 0.03, 0.3, std(0x101420), 0, 0.84, 3.3)); // keyboard
    const chair = std(new THREE.Color(col).lerp(new THREE.Color('#202638'), 0.6), { roughness: 0.7 });
    g.add(cyl(0.45, 0.45, 0.1, chair, 24, 0, 0.5, 4.25), box(0.85, 0.8, 0.08, chair, 0, 1.0, 4.7), cyl(0.05, 0.05, 0.45, std(0x111), 8, 0, 0.25, 4.25));
    // ---- server racks ----
    const rack = makeRackTex(col);
    const rackMat = std(0x0a0d18, { metalness: 0.8, roughness: 0.35 });
    const racks = [[-6.4, 1.3], [-6.6, 2.5], [-6.3, 3.7], [6.4, 1.3], [6.6, 2.5], [6.3, 3.7]];
    racks.forEach(([x, z]) => {
      const r = new THREE.Group(); r.position.set(x, 0, z); r.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(r);
      r.add(box(1.0, 2.6, 0.95, rackMat, 0, 1.3, 0));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.45), new THREE.MeshBasicMaterial({ map: rack.tex, color: new THREE.Color(1.6, 1.6, 1.6) }));
      face.position.set(0, 1.3, 0.48); r.add(face);
      r.add(box(1.02, 0.04, 0.04, neon(col, 3), 0, 2.62, 0.48));
    });
    // cable trays on the floor
    g.add(box(0.12, 0.02, 3.0, neon('#2fb6ff', 1.6), -5.6, 0.04, 2.6), box(0.12, 0.02, 3.0, neon('#2fb6ff', 1.6), 5.6, 0.04, 2.6));
    let acc = 0;
    ups.push((t, dt) => { acc += dt; if (acc > 0.25) { acc = 0; scr.tickAll(t); rack.draw(t); } });
    // ---- topology hologram above the desk ----
    const holo = new THREE.Group(); holo.position.set(0, 1.95, 3.15); g.add(holo);
    const tpad = new THREE.Mesh(new THREE.CircleGeometry(0.75, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(0.8), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    tpad.rotation.x = -Math.PI / 2; tpad.position.set(0, 0.84, 3.0); g.add(tpad);
    const nodes = [], nm = neon('#9fe8ff', 2.8), nm2 = neon(col, 3);
    const N = 11;
    for (let i = 0; i < N; i++) {
      const lvl = i === 0 ? 0 : i < 4 ? 1 : 2;
      const a = i * 2.4, r = [0, 0.45, 0.85][lvl];
      const p = V(Math.cos(a) * r, 0.5 - lvl * 0.25, Math.sin(a) * r);
      const s = sphere(lvl === 0 ? 0.09 : 0.055, lvl === 0 ? nm2 : nm, p.x, p.y, p.z, 10); holo.add(s); nodes.push(p);
    }
    const edges = [];
    for (let i = 1; i < N; i++) edges.push([i < 4 ? 0 : 1 + ((i - 4) % 3), i]);
    edges.push([1, 2], [2, 3], [3, 1]);
    const lg = new THREE.BufferGeometry().setFromPoints(edges.flatMap(([a, b]) => [nodes[a], nodes[b]]));
    holo.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: new THREE.Color('#7fd8ff').multiplyScalar(2.2), transparent: true, opacity: 0.8 })));
    const pulses = particles(edges.length, '#ffffff', 0.12); holo.add(pulses.pts);
    ups.push((t) => {
      holo.rotation.y = t * 0.25;
      edges.forEach(([a, b], i) => { const f = (t * 0.8 + i * 0.37) % 1; const p = nodes[a].clone().lerp(nodes[b], f); pulses.pos.set([p.x, p.y, p.z], i * 3); pulses.sz[i] = 0.6; pulses.al[i] = 1; });
      pulses.commit();
    });
    room.custom = { seat: V(0, 0, 4.25), seatYaw: Math.PI, way: [V(0, 0, 6.2), V(0, 0, 4.25)] };
    return { ups, holo: null };
  },
  leaf(g, col) {
    const ups = [];
    const pot = std(0x3a2a22, { roughness: 0.8 });
    const leafM = [std(0x2c8a4e, { roughness: 0.7, flatShading: true }), std(0x3fae5e, { roughness: 0.7, flatShading: true }), std(0x1f6a44, { roughness: 0.7, flatShading: true })];
    // planters along the wall
    for (let i = 0; i < 4; i++) {
      const x = -6.3 + i * 1.3;
      g.add(box(1.1, 0.6, 0.8, pot, x, 0.3, 0.75));
      for (let k = 0; k < 3; k++) g.add(sphere(rand(0.28, 0.42), leafM[(i + k) % 3], x + rand(-0.3, 0.3), 0.75 + rand(0, 0.35), 0.75 + rand(-0.2, 0.2), 8));
    }
    // bonsai tree
    const tree = new THREE.Group(); tree.position.set(5.3, 0, 1.6); g.add(tree);
    tree.add(cyl(0.6, 0.5, 0.5, pot, 20, 0, 0.25, 0));
    const trunk = cyl(0.08, 0.16, 1.6, std(0x5a3a26), 8, 0.1, 1.2, 0); trunk.rotation.z = -0.25; tree.add(trunk);
    for (const [x, y, z, r] of [[0.4, 2.0, 0, 0.55], [-0.2, 2.25, 0.2, 0.5], [0.15, 2.5, -0.2, 0.45], [0.7, 1.7, 0.2, 0.35]]) tree.add(sphere(r, leafM[1], x, y, z, 10));
    // hanging vines from the wall top
    const vm = neon(col, 1.6);
    for (let i = 0; i < 9; i++) { const l = rand(0.6, 1.8); g.add(box(0.03, l, 0.03, vm, -7 + i * 1.7, 4.3 - l / 2, 0.15)); g.add(sphere(0.06, neon('#d6ffe0', 2), -7 + i * 1.7, 4.3 - l, 0.15, 6)); }
    // mushroom lamps
    const caps = [];
    for (const [x, z, s] of [[-4.6, 3.2, 1], [-5.4, 3.8, 0.7], [4.6, 3.6, 0.8]]) {
      g.add(cyl(0.08 * s, 0.12 * s, 0.7 * s, std(0xe9e2d0), 10, x, 0.35 * s, z));
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.4 * s, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), neon('#7affb0', 1.6)); c.position.set(x, 0.68 * s, z); g.add(c); caps.push(c);
    }
    ups.push((t) => caps.forEach((c, i) => c.material.color.setRGB(0.6, 2 + Math.sin(t * 1.5 + i) * 0.6, 1.1)));
    return { ups, holo: (h) => { // DNA-like growth helix
      const grp = new THREE.Group(); h.add(grp);
      const m1 = neon(col, 2.6), m2 = neon('#b6ffda', 2.2);
      for (let i = 0; i < 18; i++) { const y = -0.5 + i * 0.06, a = i * 0.55; grp.add(sphere(0.035, m1, Math.cos(a) * 0.25, y, Math.sin(a) * 0.25, 6), sphere(0.035, m2, -Math.cos(a) * 0.25, y, -Math.sin(a) * 0.25, 6)); }
      const lf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 6), wire(col, 2.4)); lf.scale.set(1, 0.25, 0.55); lf.position.y = 0.65; grp.add(lf);
      return (t) => { grp.rotation.y = t * 0.7; };
    } };
  },
  tide(g, col) {
    const ups = [];
    // aquarium
    const aq = new THREE.Group(); aq.position.set(-4.6, 0, 0.9); g.add(aq);
    aq.add(box(5.0, 0.6, 1.2, std(0x101828, { metalness: 0.7 }), 0, 0.3, 0));
    aq.add(box(5.0, 2.4, 1.15, new THREE.MeshStandardMaterial({ color: 0x2a8fd8, emissive: 0x0a4a8a, emissiveIntensity: 0.45, transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false }), 0, 1.8, 0));
    aq.add(box(5.05, 0.05, 1.2, neon(col, 3), 0, 3.02, 0));
    const fish = [];
    const fc = ['#ff9a3a', '#ffd93d', '#ff6fb5', '#7affd8', '#ffffff'];
    for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 6), neon(fc[i % 5], 1.8)); f.rotation.z = Math.PI / 2; aq.add(f); fish.push({ f, y: rand(1.0, 2.6), s: rand(0.3, 0.7), p: rand(0, 6) }); }
    const bub = particles(40, '#bfeaff', 0.1); aq.add(bub.pts);
    // water cooler
    g.add(box(0.5, 1.0, 0.5, std(0xdfe8f5), 5.4, 0.5, 1.0), cyl(0.22, 0.22, 0.6, new THREE.MeshStandardMaterial({ color: 0x66c8ff, transparent: true, opacity: 0.6, emissive: 0x1a6aaa }), 16, 5.4, 1.3, 1.0));
    // wave neon on wall
    const pts = []; for (let i = 0; i <= 60; i++) pts.push(V(-2.5 + i * 0.1, Math.sin(i * 0.35) * 0.25, 0));
    const wv = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.035, 6), neon(col, 3)); wv.position.set(3.6, 2.9, 0.1); g.add(wv);
    const wv2 = wv.clone(); wv2.position.y = 2.45; wv2.material = neon('#9fe3ff', 2.4); g.add(wv2);
    ups.push((t) => {
      fish.forEach((o, i) => { const x = Math.sin(t * o.s + o.p) * 2.2; o.f.position.set(x, o.y + Math.sin(t * 1.3 + i) * 0.1, Math.cos(t * o.s + o.p) * 0.35); o.f.rotation.y = Math.cos(t * o.s + o.p) > 0 ? 0 : Math.PI; });
      for (let i = 0; i < 40; i++) { const l = (t * 0.25 + i / 40) % 1; bub.pos.set([-2.2 + (i % 8) * 0.6, 0.7 + l * 2.2, Math.sin(i) * 0.4], i * 3); bub.sz[i] = 0.4; bub.al[i] = 0.8; }
      bub.commit();
    });
    return { ups, holo: (h) => {
      const geo = new THREE.PlaneGeometry(1.3, 1.3, 16, 16); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, wire(col, 2.4)); h.add(m);
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), neon('#bfefff', 2.2)); drop.scale.y = 1.35; h.add(drop);
      const p = geo.attributes.position;
      return (t) => { for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.sin(Math.hypot(x, z) * 7 - t * 3) * 0.06); } p.needsUpdate = true; drop.position.y = 0.45 + Math.sin(t * 2) * 0.1; };
    } };
  },
  psy(g, col) {
    const ups = [];
    // bookshelf wall
    const shelf = new THREE.Group(); shelf.position.set(-4.2, 0, 0.45); g.add(shelf);
    shelf.add(box(5.4, 3.6, 0.12, std(0x1a1630, { roughness: 0.6 }), 0, 1.8, -0.25), box(0.12, 3.6, 0.6, std(0x1a1630), -2.7, 1.8, 0), box(0.12, 3.6, 0.6, std(0x1a1630), 2.7, 1.8, 0));
    const bc = ['#5d5cff', '#b84dff', '#2fb6ff', '#ff6fb5', '#e8e2ff', '#3a3aa0'];
    for (let r = 0; r < 4; r++) {
      shelf.add(box(5.2, 0.05, 0.55, neon(col, 1.2), 0, 0.45 + r * 0.85, 0.05));
      let x = -2.5;
      while (x < 2.4) { const w = rand(0.1, 0.2), h = rand(0.45, 0.7); shelf.add(box(w, h, 0.4, std(bc[(Math.random() * 6) | 0], { roughness: 0.7 }), x + w / 2, 0.48 + r * 0.85 + h / 2, 0.05)); x += w + 0.02; }
    }
    // crystal ball
    g.add(cyl(0.3, 0.45, 0.9, std(0x241c40, { metalness: 0.8 }), 16, 4.6, 0.45, 2.0));
    const ball = sphere(0.42, new THREE.MeshStandardMaterial({ color: 0xb8a8ff, emissive: 0x6a4aff, emissiveIntensity: 0.45, transparent: true, opacity: 0.75, roughness: 0.05 }), 4.6, 1.3, 2.0, 24); g.add(ball);
    // floating orbs
    const orbs = [];
    for (let i = 0; i < 6; i++) { const o = sphere(0.1, neon(i % 2 ? col : '#ff9df0', 2.6), 0, 0, 0, 10); g.add(o); orbs.push(o); }
    // star chart
    const sc = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#0b0a20'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(160,150,255,.35)'; ctx.beginPath(); ctx.arc(128, 128, 110, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(128, 128, 70, 0, 7); ctx.stroke();
      const s = []; for (let i = 0; i < 14; i++) s.push([30 + Math.random() * 196, 30 + Math.random() * 196]);
      ctx.strokeStyle = '#a99cff'; ctx.lineWidth = 1.5; ctx.beginPath(); s.slice(0, 7).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.fillStyle = '#fff'; s.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); });
    });
    const chart = new THREE.Mesh(new THREE.CircleGeometry(1.2, 48), new THREE.MeshBasicMaterial({ map: sc.tex, color: new THREE.Color(1.4, 1.4, 1.6) })); chart.position.set(3.6, 2.6, 0.08); g.add(chart);
    ups.push((t) => orbs.forEach((o, i) => o.position.set(4.6 + Math.cos(t * 0.8 + i) * 0.85, 1.6 + Math.sin(t * 1.2 + i * 2) * 0.35, 2.0 + Math.sin(t * 0.8 + i) * 0.85)));
    return { ups, holo: (h) => {
      const k = new THREE.Mesh(new THREE.TorusKnotGeometry(0.3, 0.08, 80, 8, 2, 3), wire(col, 2.6)); h.add(k);
      return (t) => { k.rotation.y = t * 0.6; k.rotation.x = t * 0.3; };
    } };
  },
  frost(g, col) {
    const ups = [];
    const ice = new THREE.MeshStandardMaterial({ color: 0xcfe6ff, emissive: 0x6a6aff, emissiveIntensity: 0.5, transparent: true, opacity: 0.7, roughness: 0.05, metalness: 0.1, flatShading: true });
    const crystals = new THREE.Group(); g.add(crystals);
    for (const [x, z] of [[-5.6, 1.2], [-6.2, 2.3], [-4.8, 0.8], [5.6, 1.0], [6.3, 2.2]]) {
      for (let k = 0; k < 4; k++) {
        const h = rand(0.6, 1.9), c = new THREE.Mesh(new THREE.ConeGeometry(rand(0.12, 0.25), h, 6), ice);
        c.position.set(x + rand(-0.35, 0.35), h / 2, z + rand(-0.3, 0.3)); c.rotation.set(rand(-0.3, 0.3), 0, rand(-0.3, 0.3)); crystals.add(c);
      }
    }
    // snow globe
    g.add(cyl(0.35, 0.45, 0.4, std(0x2a2440, { metalness: 0.8 }), 20, -3.4, 0.2, 3.6));
    g.add(sphere(0.5, new THREE.MeshStandardMaterial({ color: 0xe6e0ff, transparent: true, opacity: 0.25, roughness: 0.02 }), -3.4, 0.85, 3.6, 24));
    const snow = particles(30, '#ffffff', 0.08); snow.pts.position.set(-3.4, 0.85, 3.6); g.add(snow.pts);
    // snowflake neon on the wall
    const sf = new THREE.Group(); sf.position.set(3.0, 2.6, 0.12); g.add(sf);
    for (let k = 0; k < 6; k++) { const b = box(0.04, 1.4, 0.04, neon(col, 3)); b.rotation.z = (k / 6) * Math.PI; sf.add(b); }
    ups.push((t) => {
      for (let i = 0; i < 30; i++) { const l = (t * 0.2 + i / 30) % 1; snow.pos.set([Math.sin(i * 3.1 + t) * 0.32, 0.38 - l * 0.7, Math.cos(i * 1.7) * 0.3], i * 3); snow.sz[i] = 0.4; snow.al[i] = 0.9; }
      snow.commit(); sf.rotation.z = t * 0.15;
    });
    return { ups, holo: (h) => {
      const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), wire(col, 2.6)); h.add(a);
      const b = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), wire('#e8f4ff', 2.6)); h.add(b);
      return (t) => { a.rotation.y = t * 0.5; a.rotation.x = t * 0.2; b.rotation.y = -t; };
    } };
  },
};

// ------------------------------------------------------------ ops screens
function makeOpsScreens() {
  const C = { bg: '#060a16', dim: '#4a5a80', txt: '#cfe0ff', ok: '#3ee07f', run: '#ffd93d', bad: '#ff3d5a', acc: '#2fb6ff', vio: '#b84dff' };
  const head = (ctx, w, title, sub) => {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, 600);
    ctx.fillStyle = '#0c1328'; ctx.fillRect(0, 0, w, 46);
    ctx.fillStyle = C.run; ctx.font = `700 22px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillText(title, 18, 24);
    ctx.fillStyle = C.dim; ctx.font = `500 16px ui-monospace,Menlo,monospace`; ctx.textAlign = 'right'; ctx.fillText(sub, w - 16, 24); ctx.textAlign = 'left';
  };
  const jobs = ['lint', 'typecheck', 'unit · 1,284', 'integration', 'build · arm64', 'build · x86', 'e2e · chromium', 'canary deploy', 'smoke'];
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
    head(ctx, w, 'router.ts', 'main ● 3 changes');
    const lines = [
      ['k', 'export async function '], ['f', 'route'], ['t', '(req: Request) {'],
      ['t', '  const span = tracer.start('], ['s', "'edge.route'"], ['t', ');'],
      ['k', '  const '], ['t', 'region = pickRegion(req.geo);'],
      ['k', '  if '], ['t', '(!healthy(region)) {'],
      ['c', '    // fail over to the nearest warm pool'],
      ['t', '    region = failover(region);'], ['t', '  }'],
      ['k', '  return '], ['t', 'pools[region].handle(req)'],
      ['t', '    .finally(() => span.end());'], ['t', '}'], ['t', ''],
      ['k', 'export const '], ['t', 'config = { runtime: '], ['s', "'edge'"], ['t', ' };'],
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
  const msgs = ['✓ pods ready 24/24', 'GET /api/v2/health 200 4ms', 'deploy canary → 5% traffic', 'p95 latency 182ms (slo 250ms)', 'queue depth 12 → 3', 'cache hit 97.4%',
    'autoscale web 8 → 10', '✓ smoke tests passed', 'WARN retry upstream geo-db (1/3)', 'GET /api/v2/route 200 38ms', 'gc pause 3.1ms', 'promote canary → 25%'];
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
    const s = '● ALL SYSTEMS NOMINAL   ▲ deploys today 14   ◆ error rate 0.02%   ● p95 182ms   ▲ uptime 99.99%   ◆ queue 3   ● on-call: 伏特   ';
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

// ------------------------------------------------------------ public builders
export function buildRooms(scene) {
  const rooms = [];
  for (const def of ROOMS) {
    const room = { def, slot: def.index, angle: def.angle, ups: [] };
    const { g, floor, fade } = shell(def);
    room.group = g; room.floor = floor; room.fade = fade;
    let seatZ;
    const d = DECOR[def.key](g, def.color, room);
    room.ups.push(...d.ups);
    if (!room.custom) {
      seatZ = deskSet(g, def.color, 3.6, 1);
      room.custom = { seat: V(0, 0, seatZ), seatYaw: 0, way: [V(2.6, 0, 5.0), V(2.6, 0, seatZ), V(0, 0, seatZ)] };
      // desk props
      g.add(box(0.7, 0.04, 0.45, std(0x0d1020), 0.6, 0.83, 3.5));
      const scr = box(0.7, 0.42, 0.03, neon(def.color, 0.9), 0.6, 1.08, 3.72); scr.rotation.x = -0.15; g.add(scr);
      if (d.holo) { const h = projector(g, def.color, -2.6, 0, 4.6); room.ups.push(d.holo(h)); }
    }
    // room sign above the door
    const sign = textSign(def.room, def.color, 2.8, 0.62);
    sign.mesh.position.set(0, 3.35, ROOM_RAD + 0.05); g.add(sign.mesh);
    room.sign = sign;
    scene.add(g);
    rooms.push(room);
  }
  return rooms;
}

export function buildLobby(scene, company) {
  const def = LOBBY;
  const room = { def, slot: 7, angle: 0, ups: [] };
  const { g, floor, fade } = shell(def, { noWall: true, noGlass: true });
  room.group = g; room.floor = floor; room.fade = fade;
  // marble-ish floor overlay
  const mtex = canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#101626'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(180,200,255,.08)'; ctx.lineWidth = 2;
    for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.moveTo(Math.random() * w, 0); ctx.bezierCurveTo(Math.random() * w, h * 0.3, Math.random() * w, h * 0.6, Math.random() * w, h); ctx.stroke(); }
  });
  floor.material = std(0xffffff, { map: mtex.tex, metalness: 0.5, roughness: 0.25 });
  // rainbow arc inlay
  COLORS.forEach((c, i) => g.add(arcTube(ROOM_RAD - 0.3 - i * 0.18, -Math.PI / 2, Math.PI / 2, 0.04, 0.03, neon(c, 1.8), 60)));
  // curved counter (extruded annular sector)
  const sh = new THREE.Shape();
  const r0 = 2.6, r1 = 3.2, a0 = -1.05, a1 = 1.05, cz = 1.4;
  const P = (r, a) => new THREE.Vector2(r * Math.sin(a), -(r * Math.cos(a) + cz));
  sh.moveTo(P(r0, a0).x, P(r0, a0).y);
  for (let i = 0; i <= 32; i++) { const a = a0 + (a1 - a0) * (i / 32); const p = P(r1, a); sh.lineTo(p.x, p.y); }
  for (let i = 32; i >= 0; i--) { const a = a0 + (a1 - a0) * (i / 32); const p = P(r0, a); sh.lineTo(p.x, p.y); }
  const cg = new THREE.ExtrudeGeometry(sh, { depth: 1.1, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2, curveSegments: 32 });
  cg.rotateX(-Math.PI / 2);
  const counter = new THREE.Mesh(cg, std(0xe8ecf8, { metalness: 0.3, roughness: 0.25 })); g.add(counter);
  const topG = new THREE.Mesh(cg.clone(), std(0x1a2036, { metalness: 0.8, roughness: 0.15 })); topG.scale.set(1.02, 0.06, 1.02); topG.position.y = 1.12; g.add(topG);
  const band = arcTube(r1 + 0.05, a0, a1, 0.55, 0.035, neon('#ffffff', 2.6), 48); band.position.z = cz; g.add(band);
  COLORS.forEach((c, i) => { const s = arcTube(r1 + 0.06, a0 + (i / 7) * (a1 - a0), a0 + ((i + 1) / 7) * (a1 - a0) - 0.02, 0.2, 0.05, neon(c, 3), 8); s.position.z = cz; g.add(s); });
  // floating company sign
  const sign = textSign(company, '#b84dff', 7.4, 1.5, { scale: 0.56, bright: 1.6 });
  sign.mesh.position.set(0, 5.0, 1.5); g.add(sign.mesh);
  const halo = arcTube(3.3, -0.95, 0.95, 0, 0.035, neon('#9fc0ff', 2.4), 40); halo.position.set(0, 3.7, -1.9); g.add(halo);
  room.sign = sign;
  // sofas
  const sofaM = std(0x2a2f5a, { roughness: 0.85 }), cushion = std(0x3a4280, { roughness: 0.9 });
  for (const s of [-1, 1]) {
    const so = new THREE.Group(); so.position.set(s * 5.6, 0, 3.2); so.rotation.y = -s * 0.95; g.add(so);
    so.add(box(2.6, 0.42, 1.0, sofaM, 0, 0.21, 0), box(2.6, 0.7, 0.25, sofaM, 0, 0.75, -0.42), box(0.25, 0.6, 1.0, sofaM, -1.3, 0.45, 0), box(0.25, 0.6, 1.0, sofaM, 1.3, 0.45, 0));
    so.add(box(1.15, 0.14, 0.8, cushion, -0.6, 0.48, 0.05), box(1.15, 0.14, 0.8, cushion, 0.6, 0.48, 0.05));
    so.add(box(2.6, 0.03, 0.03, neon('#7ab8ff', 2), 0, 0.03, 0.5));
    const tbl = new THREE.Group(); tbl.position.set(s * 4.4, 0, 4.9); g.add(tbl);
    tbl.add(cyl(0.5, 0.5, 0.05, std(0x1a2036, { metalness: 0.8 }), 24, 0, 0.45, 0), cyl(0.05, 0.05, 0.45, std(0x111), 8, 0, 0.22, 0));
    tbl.add(sphere(0.12, neon(COLORS[s < 0 ? 6 : 0], 2.4), 0, 0.58, 0, 10));
  }
  // planters (low)
  for (const x of [-7.2, -6.2, 6.2, 7.2]) { g.add(cyl(0.35, 0.3, 0.45, std(0x1a1f30), 16, x, 0.22, 0.8)); g.add(sphere(0.38, std(0x2a8a55, { flatShading: true }), x, 0.65, 0.8, 8)); }
  // counter-top props: two screens, a lamp and a hologram kiosk
  for (const s of [-1, 1]) {
    const m = new THREE.Group(); m.position.set(s * 1.1, 1.18, 3.75); m.rotation.y = s * 0.35 + Math.PI; g.add(m);
    m.add(box(0.75, 0.45, 0.04, std(0x05070d), 0, 0.25, 0), box(0.68, 0.38, 0.01, neon(s < 0 ? '#2fb6ff' : '#b84dff', 1.3), 0, 0.25, -0.03));
  }
  g.add(cyl(0.12, 0.16, 0.3, std(0xe8ecf8), 12, 0, 1.3, 4.25), sphere(0.24, std(0x3fae5e, { flatShading: true }), 0, 1.58, 4.25, 8));
  const kiosk = new THREE.Group(); kiosk.position.set(-3.4, 0, 6.6); g.add(kiosk);
  kiosk.add(cyl(0.3, 0.38, 1.0, std(0x1a2036, { metalness: 0.8 }), 20, 0, 0.5, 0));
  const kr = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 32), neon('#5ff3ff', 3)); kr.rotation.x = Math.PI / 2; kr.position.y = 1.02; kiosk.add(kr);
  const kh = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshBasicMaterial({ color: new THREE.Color('#5ff3ff').multiplyScalar(1.2), wireframe: true })); kh.position.y = 1.55; kiosk.add(kh);
  room.ups.push((t) => { kh.rotation.y = t; kh.position.y = 1.55 + Math.sin(t * 2) * 0.08; });
  room.custom = { seat: V(0, 0, 0.6), seatYaw: 0, way: [] };
  room.ups.push((t) => { sign.mesh.position.y = 5.0 + Math.sin(t * 0.9) * 0.12; });
  scene.add(g);
  return room;
}
