// Harper's Office — City Lab theme
export const COLORS = ['#ff4d5e', '#ff9a3c', '#ffd23f', '#3fd17a', '#33a8ff', '#6a63ff', '#c35bff'];
export const COLOR_NAMES = ['紅', '橙', '黃', '綠', '藍', '靛', '紫'];

// 3×3 city grid. Block centres at -G, 0, +G. Centre block = Digital Twin plaza.
export const G = 24;          // block pitch
export const BLOCK = 18;      // block size (street = G - BLOCK = 6)
export const ROOM = 6;        // half-size of a lab footprint (12×12, rounded)
export const RING = 10.5;     // square walking loop around the plaza (half-size)
export const CAMPUS = 40;     // half-size of the campus ground

// order = seat order (1st session → Heat, …). gx/gz = grid cell (-1..1)
export const ROOMS = [
  { key: 'heat',  type: 'HEAT',  name: 'Toasty', room: 'Heat Lab',  gx: 1,  gz: 0,  phen: 'Flame',
    body: '#ffd27a', role: 'Heat stress', gadget: 'thermometer',
    flavor: 'Loves sunny days. Checks the heat index every hour and reminds everyone to drink water.' },
  { key: 'air',   type: 'AIR',   name: 'Puff',   room: 'Air Lab',   gx: 1,  gz: -1, phen: 'Tornado',
    body: '#f2f6ff', role: 'Air quality', gadget: 'pinwheel',
    flavor: 'A small cloud that can smell PM2.5. Gets grumpy when the sky turns grey.' },
  { key: 'data',  type: 'DATA',  name: 'Byte',   room: 'Data Lab',  gx: 0,  gz: -1, phen: 'Lightning',
    body: '#9cc3ff', role: 'Platform & on-call', gadget: 'laptop',
    flavor: 'Never sleeps. Watches every server, every build and every graph at the same time.' },
  { key: 'green', type: 'GREEN', name: 'Leafy',  room: 'Green Lab', gx: -1, gz: 1,  phen: 'Fireflies',
    body: '#f3d9b1', role: 'Urban greening', gadget: 'watering can',
    flavor: 'Plants a tree wherever it walks. Believes every hot street needs more shade.' },
  { key: 'flood', type: 'FLOOD', name: 'Drip',   room: 'Flood Lab', gx: 1,  gz: 1,  phen: 'Whirlpool',
    body: '#9fe4ff', role: 'Flood & rain', gadget: 'umbrella',
    flavor: 'Made of rain. Knows how deep every street gets when the typhoon comes.' },
  { key: 'sky',   type: 'SKY',   name: 'Orbit',  room: 'Sky Lab',   gx: -1, gz: -1, phen: 'Aurora',
    body: '#d9d0ff', role: 'Remote sensing', gadget: 'satellite',
    flavor: 'Has a tiny satellite that follows it around and takes photos of the city from above.' },
  { key: 'crowd', type: 'CROWD', name: 'Dash',   room: 'Crowd Lab', gx: -1, gz: 0,  phen: 'Bird flock',
    body: '#ffc6e0', role: 'Crowd simulation', gadget: 'flag',
    flavor: 'Always in a hurry. Can predict where a thousand people will walk next.' },
];
ROOMS.forEach((r, i) => { r.index = i; r.color = COLORS[i]; r.no = String(i + 1).padStart(3, '0'); });

export const LOBBY = { key: 'lobby', type: 'DESK', room: 'Front Desk', gx: 0, gz: 1, color: '#eaf2ff', index: 7,
  desc: 'The way in. Sofas, a round counter and NOVA the guide bot welcome every visitor.' };

export const LAYERS = [ // digital-twin layers, cycled in rainbow order
  { name: 'Heat', zh: '地表溫度' }, { name: 'Air', zh: '空氣品質' }, { name: 'Network', zh: '感測網路' },
  { name: 'Green', zh: '綠覆率' }, { name: 'Flood', zh: '淹水深度' }, { name: 'Satellite', zh: '衛星影像' }, { name: 'Crowd', zh: '人流密度' },
];

export const DEFAULT_COMPANY = "Harper's City Lab";
export const STATUS_TEXT = { working: '工作中', waiting: '等你回覆', idle: '閒置', offline: '待命' };
