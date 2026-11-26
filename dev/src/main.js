import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ROOMS, LOBBY, COLORS, LAYERS, G, ROOM, RING, DEFAULT_COMPANY, STATUS_TEXT } from './config.js';
import { setNeon, rand, angDiff, easeInOut, sphere, std, box } from './util.js';
import { buildWorld } from './world.js';
import { buildTwin } from './twin.js';
import { buildPaths } from './sculptures.js';
import { buildLabs, buildDesk } from './labs.js';
import { createCreature, createNova } from './creatures.js';

const $ = (s, r = document) => r.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo') || location.hash === '#demo';
const NO_INTRO = params.has('nointro');
const HOUR = params.has('hour') ? Math.max(0, Math.min(23.99, parseFloat(params.get('hour')) || 0)) : null;

// ------------------------------------------------------------------ settings
const SKEY = 'harpers-office:settings:v2';
const defaults = () => ({ company: DEFAULT_COMPANY, rooms: ROOMS.map((r) => r.room).concat(LOBBY.room), names: ROOMS.map((r) => r.name) });
let settings = defaults();
try {
  const s = JSON.parse(localStorage.getItem(SKEY) || 'null');
  if (s) settings = { company: s.company || settings.company, rooms: settings.rooms.map((d, i) => (s.rooms && s.rooms[i]) || d), names: settings.names.map((d, i) => (s.names && s.names[i]) || d) };
} catch (e) { /* storage unavailable */ }
document.getElementById('intro-title').textContent = settings.company;
const saveSettings = () => { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } };

// ------------------------------------------------------------------ renderer
const canvas = $('#scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (e) {
  $('#nogl').hidden = false; throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.5, 2600);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.minDistance = 8; controls.maxDistance = 200;
controls.minPolarAngle = 0.3; controls.maxPolarAngle = 1.25;
controls.screenSpacePanning = false;
controls.rotateSpeed = 0.6; controls.zoomSpeed = 0.8;

const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.32, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ------------------------------------------------------------------ build the city lab
const world = buildWorld(scene, reduced, HOUR);
const twin = buildTwin(scene, reduced);
const paths = buildPaths(scene, reduced);
const rooms = buildLabs(scene);
const lobby = buildDesk(scene, settings.company);
const allRooms = [...rooms, lobby];
scene.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshToonMaterial && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
scene.updateMatrixWorld(true);

const toW = (room, v) => room.group.localToWorld(v.clone());
const inward = (r) => new THREE.Vector3(-r.def.gx, 0, -r.def.gz).normalize();
const roomCenter = (r) => new THREE.Vector3(r.def.gx * G, 0, r.def.gz * G);
const cellRoom = {}; allRooms.forEach((r) => (cellRoom[`${r.def.gx},${r.def.gz}`] = r));
const roomOf = (p) => {
  const gx = Math.round(p.x / G), gz = Math.round(p.z / G);
  const r = cellRoom[`${gx},${gz}`]; if (!r) return null;
  const l = r.group.worldToLocal(p.clone());
  return Math.abs(l.x) < ROOM + 0.1 && Math.abs(l.z) < ROOM + 0.1 ? r : null;
};
const doorOut = (r) => roomCenter(r).addScaledVector(inward(r), ROOM + 1.4);
const doorIn = (r) => roomCenter(r).addScaledVector(inward(r), ROOM - 1.4).setY(0.2);

// square walking loop around the plaza (perimeter param s ∈ [0, 8·RING))
const PER = 8 * RING;
function ringPoint(s) {
  s = ((s % PER) + PER) % PER; const L = 2 * RING;
  if (s < L) return new THREE.Vector3(-RING + s, 0, -RING);
  if (s < 2 * L) return new THREE.Vector3(RING, 0, -RING + (s - L));
  if (s < 3 * L) return new THREE.Vector3(RING - (s - 2 * L), 0, RING);
  return new THREE.Vector3(-RING, 0, RING - (s - 3 * L));
}
function ringParam(p) {
  const L = 2 * RING, x = Math.max(-RING, Math.min(RING, p.x)), z = Math.max(-RING, Math.min(RING, p.z));
  const c = [[Math.abs(p.z + RING), x + RING], [Math.abs(p.x - RING), L + z + RING], [Math.abs(p.z - RING), 2 * L + RING - x], [Math.abs(p.x + RING), 3 * L + RING - z]];
  c.sort((a, b) => a[0] - b[0]); return c[0][1];
}
/** How a lab is reached from the loop: two points that step around its street sculpture. */
function approach(r) {
  const w = inward(r).negate();
  const diag = r.def.gx !== 0 && r.def.gz !== 0;
  const R0 = diag ? new THREE.Vector3(Math.sign(w.x) * RING, 0, Math.sign(w.z) * RING) : w.clone().multiplyScalar(RING);
  const perp = new THREE.Vector3(-w.z, 0, w.x).multiplyScalar(1.8);
  const S = new THREE.Vector3(r.def.gx * 12, 0, r.def.gz * 12);
  if (diag) { // plaza corner → near kerb → zebra over one road → zebra over the other → lab door
    const sx = Math.sign(w.x), sz = Math.sign(w.z), n = 12 - 3.4, f = 12 + 3.4;
    return { s: ringParam(R0), pts: [new THREE.Vector3(sx * n, 0, sz * n), new THREE.Vector3(sx * f, 0, sz * n), new THREE.Vector3(sx * f, 0, sz * f), doorOut(r), doorIn(r)] };
  }
  return { s: ringParam(R0), pts: [R0.clone().add(perp), S.clone().add(perp), doorOut(r), doorIn(r)] };
}

// light sprites floating around the emblem
const sprites = ['#ffc6ec', '#fff1a8'].map((c, i) => {
  const g = new THREE.Group();
  const body = sphere(0.36, std(c, { emissive: new THREE.Color(c), emissiveIntensity: 0.4 }), 0, 0, 0, 20); g.add(body);
  for (const s of [-1, 1]) {
    g.add(sphere(0.05, std('#141826'), s * 0.12, 0.05, 0.32, 8));
    const w = sphere(0.22, new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.4), transparent: true, opacity: 0.6, depthWrite: false }), s * 0.36, 0.12, -0.1, 12);
    w.scale.set(1, 0.4, 0.12); w.userData.s = s; g.add(w);
  }
  twin.group.add(g);
  return { g, ph: i * Math.PI };
});

// ------------------------------------------------------------------ agents
class Agent {
  constructor(c, room, idx) {
    this.c = c; this.room = room; this.idx = idx;
    this.pos = ringPoint(rand(0, PER)); this.pos.x += rand(-0.6, 0.6);
    this.yaw = rand(0, 6); this.yawT = this.yaw;
    this.path = []; this.mode = 'pause'; this.pause = rand(0, 2.5); this.speed = 1.5;
    this.status = 'offline'; this.applied = null; this.session = null; this.atSeat = false; this.arrive = null; this.look = 0;
    c.root.position.copy(this.pos); scene.add(c.root);
  }
  seat() { const cu = this.room.custom; return { p: toW(this.room, cu.seat), yaw: this.room.group.rotation.y + cu.seatYaw }; }
  /** plan a path: leave the current lab → loop around the plaza → enter the target lab (or stop on the plaza) */
  plan(target, troom, interior) {
    const pts = []; const cur = roomOf(this.pos);
    let s0;
    if (cur) {
      if (cur === troom) { if (this.atSeat) pts.push(...this.exitWay(cur)); return pts.concat(interior.length ? interior : [target]); }
      if (this.atSeat) pts.push(...this.exitWay(cur));
      const ap = approach(cur); pts.push(...ap.pts.slice().reverse()); s0 = ap.s;
    } else {
      s0 = ringParam(this.pos); pts.push(ringPoint(s0));
    }
    let s1, tail;
    if (troom) { const ap = approach(troom); s1 = ap.s; tail = [...ap.pts, ...(interior.length ? interior : [target])]; }
    else { s1 = ringParam(target); tail = [target]; }
    let d = s1 - s0; if (d > PER / 2) d -= PER; if (d < -PER / 2) d += PER;
    const steps = Math.ceil(Math.abs(d) / 1.5);
    for (let i = 1; i <= steps; i++) pts.push(ringPoint(s0 + (d * i) / steps));
    return pts.concat(tail);
  }
  exitWay(r) { const w = r.custom.way; return w.slice(0, -1).reverse().map((v) => toW(r, v)); }
  go(pts, speed, onArrive) { this.path = pts; this.speed = speed; this.mode = 'walk'; this.atSeat = false; this.arrive = onArrive; }
  goSeat() {
    if (this.atSeat && roomOf(this.pos) === this.room) { this.mode = 'sit'; return; }
    const s = this.seat();
    const inter = this.room.custom.way.map((v) => toW(this.room, v));
    this.go(this.plan(s.p, this.room, inter), 4.8, () => { this.atSeat = true; this.mode = 'sit'; this.pos.copy(s.p); this.yawT = s.yaw; });
  }
  wander() {
    const r = Math.random();
    let target, troom = null, inter = [], sit = null;
    if (r < 0.55) { // somewhere on the plaza around the digital twin
      const a = rand(0, Math.PI * 2), rr = rand(7.4, 8.4); target = new THREE.Vector3(Math.sin(a) * rr, 0, Math.cos(a) * rr);
      target.x = Math.max(-RING, Math.min(RING, target.x)); target.z = Math.max(-RING, Math.min(RING, target.z));
    } else if (r < 0.75) { // front desk: sofa or counter
      troom = lobby;
      if (Math.random() < 0.55) { const so = lobby.sofas[(Math.random() * 2) | 0]; target = toW(lobby, so.p); inter = [toW(lobby, new THREE.Vector3(so.p.x * 0.6, 0.2, 3.8)), target]; sit = lobby.group.rotation.y + so.yaw; }
      else { target = toW(lobby, new THREE.Vector3(rand(-1.5, 1.5), 0.2, rand(3.0, 4.4))); inter = [target]; }
    } else { // visit a lab (peek in at the door)
      troom = rooms[(Math.random() * rooms.length) | 0];
      target = toW(troom, new THREE.Vector3(rand(-1.0, 1.0), 0.2, rand(3.4, 4.4))); inter = [target];
    }
    const slow = this.status === 'idle' ? 1.75 : 1.35;
    this.go(this.plan(target, troom, inter), slow, () => {
      this.mode = sit != null ? 'lounge' : 'pause'; this.pause = sit != null ? rand(6, 12) : rand(1.8, 5.5);
      if (sit != null) { this.yawT = sit; this.atSeat = true; }
      this.look = rand(0, 6);
    });
  }
  onStatus(s) {
    if (s === 'working') this.goSeat();
    else if (s === 'waiting') { this.path = []; this.mode = this.atSeat ? 'sitwait' : 'wait'; this.yawT = Math.atan2(camera.position.x - this.pos.x, camera.position.z - this.pos.z); }
    else if (['wait', 'sitwait', 'sit', 'walk'].includes(this.mode) || this.atSeat) { this.path = []; this.mode = 'pause'; this.pause = rand(0.4, 1.5); }
  }
  update(t, dt) {
    if (this.status !== this.applied) { this.applied = this.status; this.onStatus(this.status); }
    let anim = 'idle';
    if (this.mode === 'walk') {
      anim = 'walk';
      const tgt = this.path[0];
      if (!tgt) { const f = this.arrive; this.arrive = null; this.mode = 'pause'; this.pause = 2; f && f(); }
      else {
        const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z, d = Math.hypot(dx, dz);
        const step = this.speed * dt;
        const nx = d <= step ? tgt.x : this.pos.x + (dx / d) * step, nz = d <= step ? tgt.z : this.pos.z + (dz / d) * step;
        if (!world.canStep(this.pos.x, this.pos.z, nx, nz, 1.0)) { anim = 'idle'; this.yawT = Math.atan2(dx, dz); } // wait at the kerb
        else if (d <= step) { this.pos.x = tgt.x; this.pos.z = tgt.z; this.path.shift(); }
        else { this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step; this.yawT = Math.atan2(dx, dz); }
      }
    } else if (this.mode === 'sit' || this.mode === 'sitwait' || this.mode === 'lounge') {
      anim = 'sit';
      if (this.mode === 'lounge') { this.pause -= dt; if (this.pause <= 0 && this.status !== 'working' && this.status !== 'waiting') this.wander(); }
    } else if (this.mode === 'wait') {
      anim = 'wait';
    } else if (this.mode === 'pause') {
      this.pause -= dt; this.look += dt;
      this.yawT += Math.sin(this.look * 0.9) * dt * 0.6;
      if (this.pause <= 0) {
        if (this.status === 'working') this.goSeat();
        else if (this.status !== 'waiting') this.wander();
      }
    }
    // step up onto lab floors
    const fy = roomOf(this.pos) ? 0.2 : 0; this.pos.y += (fy - this.pos.y) * Math.min(1, dt * 12);
    this.yaw += angDiff(this.yaw, this.yawT) * Math.min(1, dt * 9);
    this.c.root.position.copy(this.pos);
    this.c.root.rotation.y = this.yaw;
    this.c.animate(t, dt, anim, this.speed, reduced);
  }
}

const agents = ROOMS.map((def, i) => { const c = createCreature(def); c.root.scale.setScalar(1.3); c.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return new Agent(c, rooms[i], i); });
const nova = new Agent(createNova(), lobby, 7);
world.obstacles.push(...agents.map((a) => ({ pos: a.pos, r: 1.0 })), { pos: nova.pos, r: 0.9 }); // cars yield to agents
nova.c.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
nova.wander = function () {
  const r = Math.random(); let target, troom = null, inter = [];
  if (r < 0.5) { const def = ROOMS[(Math.random() * 7) | 0]; target = new THREE.Vector3(def.gx * RING, 0, def.gz * RING); }
  else if (r < 0.8) target = ringPoint(rand(0, PER));
  else { troom = lobby; target = toW(lobby, new THREE.Vector3(2.4, 0.2, 4.2)); inter = [target]; }
  this.go(this.plan(target, troom, inter), 1.25, () => { this.mode = 'pause'; this.pause = rand(2.5, 6); this.yawT = Math.atan2(-this.pos.x, -this.pos.z); });
};

// ------------------------------------------------------------------ name tags
const tagLayer = $('#tags');
const mkTag = (color) => { const el = document.createElement('div'); el.className = 'tag'; el.style.setProperty('--c', color); el.innerHTML = '<b></b><span></span>'; tagLayer.appendChild(el); return el; };
agents.forEach((a) => (a.tag = mkTag(a.room.def.color)));
nova.tag = mkTag('#5ff3ff'); nova.tag.classList.add('npc');

function tagText(a) {
  const s = a.status; const proj = a.session ? a.session.project : '';
  return s === 'offline' ? '待命中' : `${STATUS_TEXT[s]}${proj ? ' · ' + proj : ''}`;
}
const tmpV = new THREE.Vector3();
function updateTags() {
  const w = innerWidth, h = innerHeight;
  const dist = camera.position.distanceTo(controls.target);
  const sc = Math.max(0.72, Math.min(1.15, 70 / dist));
  const placed = [];
  const list = [...agents, nova].map((a) => {
    tmpV.copy(a.pos); tmpV.y += a === nova ? 2.75 : 2.45; tmpV.project(camera);
    return { a, x: ((tmpV.x + 1) / 2) * w, y: ((1 - tmpV.y) / 2) * h, vis: tmpV.z < 1 && Math.abs(tmpV.x) < 1.1 && Math.abs(tmpV.y) < 1.1 };
  }).sort((p, q) => q.y - p.y);
  const TW = 150 * sc, TH = 46 * sc;
  for (const t of list) {
    t.a.tag.style.display = t.vis ? '' : 'none';
    if (!t.vis) continue;
    // nudge upward until this tag no longer overlaps one already placed
    let y = t.y;
    for (let k = 0; k < 6; k++) { const hit = placed.find((p) => Math.abs(p.x - t.x) < TW && Math.abs(p.y - y) < TH); if (!hit) break; y = hit.y - TH; }
    placed.push({ x: t.x, y });
    t.a.tag.style.transform = `translate(${t.x}px, ${y}px) translate(-50%,-100%) scale(${sc})`;
  }
}
function refreshTags() {
  agents.forEach((a, i) => {
    a.tag.querySelector('b').textContent = settings.names[i];
    a.tag.querySelector('span').textContent = tagText(a);
    a.tag.classList.toggle('waiting', a.status === 'waiting');
    a.tag.classList.toggle('working', a.status === 'working');
    a.tag.classList.toggle('offline', a.status === 'offline');
  });
  nova.tag.querySelector('b').textContent = 'NOVA';
  nova.tag.querySelector('span').textContent = '導覽機器人';
}

// ------------------------------------------------------------------ camera
const home = () => {
  const asp = innerWidth / innerHeight;
  const d = asp >= 1 ? 128 * Math.max(1, 1.5 / asp) : 128 * Math.min(2.3, 1.2 / asp);
  const el = 0.84; // radians above horizon
  return { p: new THREE.Vector3(0, Math.sin(el) * d, Math.cos(el) * d), t: new THREE.Vector3(0, 0, -1.5) };
};
let fly = null, follow = null;
function flyTo(p, t, dur = 1.6, lift = 0.25) {
  follow = null;
  if (reduced) { camera.position.copy(p); controls.target.copy(t); controls.update(); return; }
  fly = { fp: camera.position.clone(), ft: controls.target.clone(), tp: p.clone(), tt: t.clone(), t0: performance.now(), dur: dur * 1000, lift: camera.position.distanceTo(p) * lift };
  controls.enabled = false;
}
function viewRoom(r) {
  const L = r === lobby;
  const t = toW(r, new THREE.Vector3(0, L ? 2.0 : 1.3, L ? 0.5 : 0.2));
  const p = t.clone().addScaledVector(inward(r), L ? 15 : 13.5).add(new THREE.Vector3(0, L ? 10 : 12, 0));
  flyTo(p, t);
}
function viewAgent(a) {
  const dir = new THREE.Vector3(Math.sin(a.yaw), 0, Math.cos(a.yaw)).lerp(new THREE.Vector3(0, 0, 1), 0.35).normalize(); // in front of the creature
  const t = a.pos.clone().setY(1.1);
  flyTo(t.clone().addScaledVector(dir, 7.5).setY(6), t, 1.4);
  follow = { a, off: null };
}
function goHome(dur = 1.6) { const h = home(); flyTo(h.p, h.t, dur, 0.1); closeCard(); setActiveNav(-1); }
controls.addEventListener('start', () => { if (!fly) follow = null; });

// ------------------------------------------------------------------ HUD
const nav = $('#nav'), roster = $('#roster-list'), card = $('#card');
const navItems = [{ label: '總覽', color: '#ffffff', go: () => goHome(), key: '0' },
  { label: () => settings.rooms[7], color: LOBBY.color, room: lobby, key: '8' },
  ...rooms.map((r, i) => ({ label: () => settings.rooms[i], color: r.def.color, room: r, key: String(i + 1) }))];
navItems.forEach((it, i) => {
  const b = document.createElement('button');
  b.className = 'nav-btn'; b.type = 'button'; b.style.setProperty('--c', it.color); b.tabIndex = i === 0 ? 0 : -1;
  b.innerHTML = `<i></i><span></span><kbd>${it.key}</kbd>`;
  b.addEventListener('click', () => activateNav(i));
  b.addEventListener('keydown', (e) => {
    const btns = [...nav.children]; let j = null;
    if (e.key === 'ArrowRight') j = (i + 1) % btns.length; else if (e.key === 'ArrowLeft') j = (i - 1 + btns.length) % btns.length;
    else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = btns.length - 1;
    if (j != null) { e.preventDefault(); btns.forEach((x) => (x.tabIndex = -1)); btns[j].tabIndex = 0; btns[j].focus(); }
  });
  nav.appendChild(b); it.el = b;
});
function setActiveNav(i) { navItems.forEach((it, j) => it.el.setAttribute('aria-current', j === i ? 'true' : 'false')); }
function activateNav(i) {
  const it = navItems[i];
  if (!it.room) { goHome(); setActiveNav(0); return; }
  viewRoom(it.room); showRoomCard(it.room); setActiveNav(i);
  it.el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth' });
}

const rosterRows = agents.map((a, i) => {
  const li = document.createElement('li');
  li.innerHTML = `<button type="button" style="--c:${a.room.def.color}"><i class="chip"></i><span class="who"><b></b><small></small></span><span class="st"></span></button>`;
  li.querySelector('button').addEventListener('click', () => { viewAgent(a); showAgentCard(a); });
  roster.appendChild(li); return li;
});

function relTime(sec) {
  if (!sec) return '—';
  const d = Math.max(0, Date.now() / 1000 - sec);
  if (d < 10) return '剛剛'; if (d < 60) return `${d | 0} 秒前`; if (d < 3600) return `${(d / 60) | 0} 分鐘前`; return `${(d / 3600) | 0} 小時前`;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let cardFor = null;
function openCard(html, color, target) {
  card.style.setProperty('--c', color);
  $('#card-body').innerHTML = html;
  card.hidden = false; card.classList.remove('out'); cardFor = target; setCardOffset(true);
  requestAnimationFrame(() => card.classList.add('in'));
  $('#card-body').querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
    const [k, v] = b.dataset.act.split(':');
    if (k === 'agent') { viewAgent(agents[+v]); showAgentCard(agents[+v]); }
    if (k === 'room') { const r = +v === 7 ? lobby : rooms[+v]; viewRoom(r); showRoomCard(r); setActiveNav(+v === 7 ? 1 : +v + 2); }
  }));
}
let vo = 0, voT = 0; // animated projection offset so the subject is not hidden behind the info card
function setCardOffset(on) { voT = on ? 1 : 0; }
function applyViewOffset(dt) {
  vo += (voT - vo) * Math.min(1, dt * (reduced ? 60 : 5));
  const W = innerWidth, H = innerHeight;
  if (vo < 0.001) { if (camera.view && camera.view.enabled) camera.clearViewOffset(); return; }
  if (W <= 900) camera.setViewOffset(W, H, 0, H * 0.2 * vo, W, H);
  else camera.setViewOffset(W, H, -175 * vo, 0, W, H);
}
function closeCard() { setCardOffset(false); if (card.hidden) return; card.classList.remove('in'); cardFor = null; setTimeout(() => { if (!cardFor) card.hidden = true; }, reduced ? 0 : 260); }
$('#card-close').addEventListener('click', () => { closeCard(); goHome(); });

function statusBadge(a) { return `<span class="badge s-${a.status}">${a.status === 'offline' ? '未連線' : STATUS_TEXT[a.status]}</span>`; }
function showAgentCard(a) {
  const i = a.idx, def = a.room.def, s = a.session;
  openCard(`<div class="dex"><span class="no">No.${def.no}</span><span class="type">${def.type}</span></div>
    <h2>${esc(settings.names[i])}</h2>
    <p class="lede">${esc(def.flavor)}</p>
    <dl>
      <div><dt>狀態</dt><dd>${statusBadge(a)}</dd></div>
      <div><dt>Lab</dt><dd>${esc(settings.rooms[i])}</dd></div>
      <div><dt>專長</dt><dd>${esc(def.role)}</dd></div>
      <div><dt>專案</dt><dd>${s ? esc(s.project) : '—'}</dd></div>
      <div><dt>Session</dt><dd class="mono">${s ? esc(s.id.slice(0, 8)) : '—'}</dd></div>
      <div><dt>PID</dt><dd class="mono">${s && s.pid ? s.pid : '—'}</dd></div>
      <div><dt>最後更新</dt><dd data-rel>${s ? relTime(s.updated) : '—'}</dd></div>
    </dl>
    <p class="hint">${s ? '' : `開第 ${i + 1} 個 Claude Code session，${esc(settings.names[i])}就會上班。`}</p>
    <div class="actions"><button type="button" data-act="room:${i}">Go to ${esc(settings.rooms[i])}</button></div>`, def.color, a);
}
function showRoomCard(r) {
  if (r === lobby) {
    const n = agents.filter((a) => a.session).length;
    openCard(`<div class="dex"><span class="no">Main gate</span><span class="type">DESK</span></div><h2>${esc(settings.rooms[7])}</h2><p class="lede">${esc(LOBBY.desc)}</p>
      <dl><div><dt>公司</dt><dd>${esc(settings.company)}</dd></div><div><dt>在線夥伴</dt><dd>${n} / 7</dd></div>
      <div><dt>等你回覆</dt><dd>${agents.filter((a) => a.status === 'waiting').length}</dd></div></dl>`, '#9fb8ff', r);
    return;
  }
  const i = r.def.index, a = agents[i];
  openCard(`<div class="dex"><span class="no">Lab ${r.def.no}</span><span class="type">${r.def.type}</span></div><h2>${esc(settings.rooms[i])}</h2><p class="lede">${esc(r.def.role)} research. ${esc(r.def.flavor)}</p>
    <dl><div><dt>夥伴</dt><dd>${esc(settings.names[i])} ${statusBadge(a)}</dd></div>
    <div><dt>專案</dt><dd>${a.session ? esc(a.session.project) : '—'}</dd></div>
    <div><dt>街口雕塑</dt><dd>${r.def.phen}</dd></div></dl>
    <div class="actions"><button type="button" data-act="agent:${i}">Find ${esc(settings.names[i])}</button></div>`, r.def.color, r);
}
function showNovaCard() {
  openCard(`<p class="eyebrow">NPC · Guide bot</p><h2>NOVA</h2><p class="lede">The guide bot. Greets visitors at the Front Desk and patrols the plaza, checking every street sculpture.</p>`, '#5ff3ff', nova);
}

function refreshHUD() {
  $('#brand-name').textContent = settings.company;
  document.title = settings.company;
  navItems.forEach((it) => (it.el.querySelector('span').textContent = typeof it.label === 'function' ? it.label() : it.label));
  agents.forEach((a, i) => {
    const li = rosterRows[i];
    li.querySelector('b').textContent = settings.names[i];
    li.querySelector('small').textContent = a.session ? a.session.project : settings.rooms[i];
    const st = li.querySelector('.st'); st.className = `st s-${a.status}`; st.textContent = a.status === 'offline' ? '待命' : STATUS_TEXT[a.status];
  });
  rooms.forEach((r, i) => r.sign.set(settings.rooms[i]));
  lobby.sign.set(settings.company);
  refreshTags();
  if (cardFor) { if (cardFor === lobby || rooms.includes(cardFor)) showRoomCard(cardFor); else if (cardFor === nova) showNovaCard(); else showAgentCard(cardFor); }
}

// clock
const clockEl = $('#clock-time'), dateEl = $('#clock-date');
function tickClock() {
  const d = new Date();
  clockEl.innerHTML = `${String(d.getHours()).padStart(2, '0')}<em>:</em>${String(d.getMinutes()).padStart(2, '0')}<small>${String(d.getSeconds()).padStart(2, '0')}</small>`;
  dateEl.textContent = d.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' });
}
tickClock(); setInterval(tickClock, 1000);

// ------------------------------------------------------------------ roster polling
const live = $('#live');
let lastSig = '';
function applyRoster(r, mode) {
  const ss = (r && Array.isArray(r.sessions) ? r.sessions : []).filter((s) => s && s.id)
    .sort((a, b) => (a.started - b.started) || String(a.id).localeCompare(String(b.id)));
  agents.forEach((a, i) => {
    const s = ss[i] || null; a.session = s;
    a.status = s && ['working', 'waiting', 'idle'].includes(s.status) ? s.status : (s ? 'idle' : 'offline');
  });
  const extra = Math.max(0, ss.length - 7);
  const waiting = agents.filter((a) => a.status === 'waiting').length;
  live.className = `live ${mode}`;
  live.querySelector('span').textContent = mode === 'demo' ? `示範模式 · ${ss.length} 個 session` : mode === 'on' ? `LIVE · ${ss.length} 個 session${extra ? `（+${extra} 候補）` : ''}` : '尚未連線 · 在 Claude Code 執行 /office';
  $('#waiting-count').textContent = waiting ? `${waiting} 位等你回覆` : '';
  $('#waiting-count').hidden = !waiting;
  const sig = JSON.stringify(agents.map((a) => [a.status, a.session && a.session.project, a.session && a.session.updated]));
  if (sig !== lastSig) { lastSig = sig; refreshHUD(); }
}
function demoRoster() {
  const t = Date.now() / 1000; const base = Math.floor(t) - 3600;
  const projects = ['geo-flood-model', 'harpers-office', 'thesis-chapter-3', 'soil-moisture-tw', 'notion-sync'];
  const cyc = ['working', 'working', 'waiting', 'idle', 'working', 'idle'];
  return { updated: t, sessions: projects.map((p, i) => ({ id: `demo-${i}-a1b2c3d4`, project: p, pid: 40100 + i, started: base + i * 60, updated: t - i * 7,
    status: cyc[(Math.floor((t + i * 11) / 9) + i) % cyc.length] })) };
}
function poll() {
  if (DEMO) { applyRoster(demoRoster(), 'demo'); return; }
  const s = document.createElement('script');
  s.src = `roster.js?t=${Date.now()}`;
  s.onload = () => { s.remove(); const r = window.LETS_OFFICE_ROSTER; applyRoster(r, r ? 'on' : 'off'); };
  s.onerror = () => { s.remove(); applyRoster(null, 'off'); };
  document.head.appendChild(s);
}
poll(); setInterval(poll, 2000);
setInterval(() => { if (cardFor && agents.includes(cardFor)) { const u = card.querySelector('dd[data-rel]'); if (u && cardFor.session) u.textContent = relTime(cardFor.session.updated); } }, 1000);

// ------------------------------------------------------------------ settings dialog
const dlg = $('#settings');
function fillSettings() {
  const f = $('#settings-form');
  f.company.value = settings.company;
  const rl = $('#set-rooms'); rl.innerHTML = '';
  [...ROOMS, LOBBY].forEach((r, i) => {
    const row = document.createElement('div'); row.className = 'row'; row.style.setProperty('--c', r.color || '#fff');
    const idr = `room-${i}`, idn = `name-${i}`;
    row.innerHTML = `<i></i><label for="${idr}" class="sr">房間 ${i + 1}</label><input id="${idr}" name="room" maxlength="16" value="${esc(settings.rooms[i])}" />` +
      (i < 7 ? `<label for="${idn}" class="sr">主管名字 ${i + 1}</label><input id="${idn}" name="who" maxlength="10" value="${esc(settings.names[i])}" />` : '<span class="na">—</span>');
    rl.appendChild(row);
  });
}
$('#btn-settings').addEventListener('click', () => { fillSettings(); dlg.showModal(); });
$('#settings-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  settings.company = f.company.value.trim().slice(0, 32) || DEFAULT_COMPANY;
  [...f.querySelectorAll('input[name=room]')].forEach((inp, i) => (settings.rooms[i] = inp.value.trim().slice(0, 16) || defaults().rooms[i]));
  [...f.querySelectorAll('input[name=who]')].forEach((inp, i) => (settings.names[i] = inp.value.trim().slice(0, 10) || defaults().names[i]));
  saveSettings(); refreshHUD(); dlg.close(); toast('已儲存在這個瀏覽器');
});
$('#set-reset').addEventListener('click', () => { settings = defaults(); saveSettings(); fillSettings(); refreshHUD(); toast('已恢復預設'); });
$('#set-cancel').addEventListener('click', () => dlg.close());
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2200); }
$('#btn-roster').addEventListener('click', (e) => { const p = $('#roster'); const open = p.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', open); });

// ------------------------------------------------------------------ picking
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
const pickables = () => [...agents.map((a) => a.c.hit), nova.c.hit, ...allRooms.map((r) => r.floor)];
function pick(cx, cy) {
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(pickables(), false);
  const ch = hits.find((h) => agents.some((a) => a.c.hit === h.object) || h.object === nova.c.hit);
  const h = ch || hits[0]; if (!h) return null;
  const ag = agents.find((a) => a.c.hit === h.object); if (ag) return { agent: ag };
  if (h.object === nova.c.hit) return { nova: true };
  const r = allRooms.find((x) => x.floor === h.object); return r ? { room: r } : null;
}
let down = null;
canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return; down = null;
  const p = pick(e.clientX, e.clientY);
  if (!p) return;
  if (p.agent) { viewAgent(p.agent); showAgentCard(p.agent); }
  else if (p.nova) { viewAgent(nova); showNovaCard(); }
  else if (p.room) { viewRoom(p.room); showRoomCard(p.room); setActiveNav(p.room === lobby ? 1 : p.room.def.index + 2); }
});
let hoverT = 0;
canvas.addEventListener('pointermove', (e) => {
  const now = performance.now(); if (now - hoverT < 80) return; hoverT = now;
  canvas.style.cursor = pick(e.clientX, e.clientY) ? 'pointer' : 'grab';
});

// ------------------------------------------------------------------ keyboard
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input,textarea,dialog')) return;
  if (introActive) { endIntro(); return; }
  if (e.key === 'Escape') { goHome(); return; }
  const it = navItems.findIndex((x) => x.key === e.key);
  if (it >= 0 && !e.metaKey && !e.ctrlKey && !e.altKey) { activateNav(it); }
});

// ------------------------------------------------------------------ intro
let introActive = !NO_INTRO;
const intro = $('#intro');
const NEON_FLICKER = [[0, 0], [0.06, 1], [0.12, 0.05], [0.28, 0.8], [0.33, 0.1], [0.46, 1], [0.52, 0.35], [0.62, 1]];
let neonStart = null;
function endIntro() {
  if (!introActive) return; introActive = false;
  intro.classList.add('done'); document.body.classList.add('ready');
  setTimeout(() => (intro.hidden = true), 900);
  setNeon(1); neonStart = null;
  if (!fly) { const h = home(); if (camera.position.distanceTo(h.p) > 5) flyTo(h.p, h.t, 1.2, 0.05); }
}
{
  const h = home();
  if (!introActive) { camera.position.copy(h.p); controls.target.copy(h.t); intro.hidden = true; document.body.classList.add('ready'); }
  else if (reduced) {
    camera.position.copy(h.p); controls.target.copy(h.t); intro.classList.add('reduced');
    setTimeout(endIntro, 1400);
  } else {
    camera.position.set(140, 230, 520); controls.target.set(0, 10, 0); setNeon(0);
    intro.classList.add('play');
    if (!params.has('holdintro')) setTimeout(() => { intro.classList.add('fade'); neonStart = performance.now(); flyTo(h.p, h.t, 3.6, 0.0); }, 2500);
    if (!params.has('holdintro')) setTimeout(endIntro, 6200);
    intro.addEventListener('click', endIntro);
  }
  controls.update();
}

// ------------------------------------------------------------------ loop
const clk = new THREE.Clock(); let T = 0;
const center = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clk.getDelta(), 0.05); T += dt;
  for (const u of world.ups) u(T, dt);
  twin.update(T, dt);
  for (const u of paths.ups) u(T, dt);
  for (const r of allRooms) for (const u of r.ups) u(T, dt);
  agents.forEach((a) => a.update(T, dt)); nova.update(T, dt);
  // soft separation so walkers never merge into one blob
  const crowd = [...agents, nova];
  for (let i = 0; i < crowd.length; i++) for (let j = i + 1; j < crowd.length; j++) {
    const A = crowd[i], B = crowd[j];
    if (A.atSeat || B.atSeat) continue;
    const dx = B.pos.x - A.pos.x, dz = B.pos.z - A.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.001 && d < 1.5) {
      const push = (1.5 - d) * 0.5 * Math.min(1, dt * 6) / d;
      const aM = A.mode === 'walk' || A.mode === 'pause', bM = B.mode === 'walk' || B.mode === 'pause';
      if (aM) { A.pos.x -= dx * push; A.pos.z -= dz * push; }
      if (bM) { B.pos.x += dx * push; B.pos.z += dz * push; }
    }
  }
  sprites.forEach((s, i) => {
    const a = T * (reduced ? 0.15 : 0.6) + s.ph;
    s.g.position.set(Math.cos(a) * 3.4, 6.6 + Math.sin(T * 1.6 + i) * 0.4, Math.sin(a) * 3.4);
    s.g.rotation.y = -a + Math.PI;
    s.g.children.forEach((c) => { if (c.userData.s) c.rotation.z = c.userData.s * Math.sin(T * 14) * 0.5; });
  });
  // path glow follows the owner's status
  agents.forEach((a, i) => { const m = paths.pathMats[i]; const tgt = a.status === 'working' ? 1 : a.status === 'waiting' ? 0.6 : 0; m.uniforms.uHot.value += (tgt - m.uniforms.uHot.value) * Math.min(1, dt * 3); });
  // neon flicker on boot
  if (neonStart != null) {
    const k = (performance.now() - neonStart) / 1000; let lv = 1;
    for (const [tt, v] of NEON_FLICKER) if (k >= tt) lv = v;
    setNeon(lv); if (k > 0.7) { setNeon(1); neonStart = null; }
  }
  // camera
  if (fly) {
    const k = Math.min(1, (performance.now() - fly.t0) / fly.dur), e = easeInOut(k);
    camera.position.lerpVectors(fly.fp, fly.tp, e); camera.position.y += Math.sin(Math.PI * e) * fly.lift;
    controls.target.lerpVectors(fly.ft, fly.tt, e);
    camera.lookAt(controls.target);
    if (k >= 1) { fly = null; controls.enabled = true; }
  } else if (follow) {
    const want = follow.a.pos.clone().setY(1.1);
    const d = want.sub(controls.target).multiplyScalar(Math.min(1, dt * 4));
    controls.target.add(d); camera.position.add(d);
  }
  applyViewOffset(dt);
  if (!fly) controls.update();
  // keep the camera over the floor
  if (controls.target.length() > 40) controls.target.setLength(40);
  // fade back walls that sit between the camera and their room
  for (const r of allRooms) {
    if (!r.fade.length) continue;
    center.copy(inward(r)).negate();
    const cx = camera.position.x - r.group.position.x, cz = camera.position.z - r.group.position.z, l = Math.hypot(cx, cz) || 1;
    const dot = (cx * center.x + cz * center.z) / l;
    const want = dot > 0.12 ? 0.12 : 1;
    for (const f of r.fade) { f.o += (want - f.o) * Math.min(1, dt * 5); f.m.opacity = f.o; f.m.depthWrite = f.o > 0.9; }
  }
  { // bloom eases off as the camera moves in, so close-ups stay crisp
    const dd = camera.position.distanceTo(controls.target);
    const k = Math.min(1, Math.max(0, (dd - 14) / 70)), n = world.state.night;
    bloom.strength = (0.32 + k * 0.42) * (0.25 + 0.75 * n); bloom.radius = 0.18 + k * 0.2;
    bloom.threshold = 0.9 + (1 - n) * 0.25;
    allRooms.forEach((r) => (r.light.intensity = 2 + n * 9));
  }
  composer.render();
  updateTags();
}
// map legend: current digital-twin layer
const legend = $('#legend-layer');
twin.state.onLayer = (i) => { legend.style.setProperty('--c', COLORS[i]); legend.querySelector('b').textContent = LAYERS[i].name; legend.querySelector('small').textContent = LAYERS[i].zh; };
refreshHUD();
frame();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); bloom.setSize(innerWidth, innerHeight);
});
window.__office = { bloom, scene, agents, rooms, lobby, camera, controls, goHome, viewRoom, viewAgent };
