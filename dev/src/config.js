// Harper's Office — static configuration
export const COLORS = ['#ff3d5a', '#ff8c2b', '#ffd93d', '#3ee07f', '#2fb6ff', '#5d5cff', '#b84dff'];
export const COLOR_NAMES = ['紅', '橙', '黃', '綠', '藍', '靛', '紫'];

// Ring layout (radians, 0 = toward default camera / +z)
const D = Math.PI / 180;
export const R_ROOM = 27;      // flat back wall line of every office
export const ROOM_RAD = 8.5;   // half-disc radius
export const R_DOOR = R_ROOM - ROOM_RAD; // 18.5
export const R_WALK = 15.8;
export const R_SCULPT = 12.9;
export const R_RING = 7.2;
export const R_FLOOR = 36;

export const ROOMS = [
  { key: 'fire',  el: '火', angle: 90 * D,  name: '焰焰', room: '熔爐工坊',   phen: '火焰',   body: '#ffbfa3',
    outfit: '鍛造皮圍裙＋護目鏡', role: '產品設計', desc: '鍛爐、熔岩燈與火紋霓虹牆。焰焰把每個點子都先丟進爐子裡燒一次。' },
  { key: 'wind',  el: '風', angle: 135 * D, name: '嵐嵐', room: '天穹航站',   phen: '龍捲風', body: '#ffe2b8',
    outfit: '飛行員圍巾', role: '專案協調', desc: '雲朵沙發、望遠鏡與航線地球儀。嵐嵐負責讓所有東西準時起飛。' },
  { key: 'volt',  el: '電', angle: 180 * D, name: '伏特', room: '伏特戰情室', phen: '閃電',   body: '#bcd2ff',
    outfit: '值班耳機＋連帽衫', role: '平台工程', desc: '整面監控牆、三螢幕值班桌、機櫃列與系統拓撲投影。全公司的心跳都在這裡。' },
  { key: 'leaf',  el: '草', angle: 225 * D, name: '芽芽', room: '森息溫室',   phen: '極光',   body: '#bff0cc',
    outfit: '園藝圍裙＋圓框眼鏡', role: '研究與資料', desc: '植栽牆、盆景與蘑菇燈。芽芽相信所有好系統都是長出來的。' },
  { key: 'tide',  el: '水', angle: 270 * D, name: '波波', room: '潮汐實驗室', phen: '漩渦',   body: '#b5e6ff',
    outfit: '水手帽＋雨衣', role: '資料管線', desc: '巨型水族箱與波浪投影。資料從這裡流向每一間辦公室。' },
  { key: 'psy',   el: '超能', angle: 315 * D, name: '夢夢', room: '星夢研究所', phen: '星雲', body: '#d4c8ff',
    outfit: '星紋披風', role: 'AI 研究', desc: '水晶球、漂浮光球與星圖書牆。夢夢總是比大家早一步看到答案。' },
  { key: 'frost', el: '冰', angle: 45 * D,  name: '晶晶', room: '霜晶工作室', phen: '冰晶',   body: '#ece6ff',
    outfit: '毛線帽＋圍巾', role: '品質與安全', desc: '冰晶叢、雪花球與冷光工作台。晶晶讓每一行程式都冷靜下來。' },
];
ROOMS.forEach((r, i) => { r.index = i; r.color = COLORS[i]; });

export const LOBBY = { key: 'lobby', angle: 0, room: '接待大廳', color: '#e8f1ff', index: 7,
  desc: '弧形櫃台、等候沙發與漂浮招牌。導覽機器人 NOVA 會在這裡迎接訪客。' };

export const DEFAULT_COMPANY = "Harper's Office";
export const STATUS_TEXT = { working: '工作中', waiting: '等你回覆', idle: '閒置', offline: '待命' };
