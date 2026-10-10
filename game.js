// ============================================================
// === СЧЁТЧИК ПОЙМАНО (в начале скрипта) ===
// ============================================================

let totalCaughtGlobal = 0;
let manualRollsCount = 0;

// ============================================================
// === ЛОГ ОБНОВЛЕНИЙ ===
// ============================================================

const CURRENT_VERSION = 'v1.5';
const UPDATE_LOG_KEY = 'fih-game-last-seen-version';

const UPDATE_LOG_CONTENT = `
  <ul>
    <li>🎲 <strong>Угадай число</strong> — теперь 1-5 (было 1-10)</li>
    <li>⚡ <strong>Реакция</strong> — исправлен баг: экран не заканчивался</li>
    <li>🚫 <strong>Реакция</strong> — теперь запрещено кликать до зелёного</li>
    <li>⏱ <strong>Реакция</strong> — всего 1.5 сек на реакцию</li>
    <li>💰 <strong>Мини-игры</strong> дают +10% к цене продажи (30 сек)</li>
    <li>🐀 <strong>Крыса</strong> даёт +2% к цене продажи (5 мин)</li>
  </ul>
  <div class="ul-hint">Следующие обновления — скоро!</div>
`;

function showUpdateLog() {
  const lastSeen = localStorage.getItem(UPDATE_LOG_KEY);
  if (lastSeen === CURRENT_VERSION) return;

  const logEl = document.getElementById('updateLog');
  const bodyEl = document.getElementById('updateLogBody');
  bodyEl.innerHTML = `<div class="ul-version">${CURRENT_VERSION}</div>${UPDATE_LOG_CONTENT}`;
  logEl.classList.remove('hidden');
  logEl.classList.remove('closing');

  // Автоскрытие через 15 секунд
  clearTimeout(logEl._timer);
  logEl._timer = setTimeout(() => {
    hideUpdateLog();
  }, 15000);
}

function hideUpdateLog() {
  const logEl = document.getElementById('updateLog');
  logEl.classList.add('closing');
  setTimeout(() => {
    logEl.classList.add('hidden');
    logEl.classList.remove('closing');
  }, 400);
  localStorage.setItem(UPDATE_LOG_KEY, CURRENT_VERSION);
}

document.getElementById('updateLogClose').addEventListener('click', hideUpdateLog);

// ============================================================
// === МУЛЬТИВКЛАДОЧНАЯ ЗАЩИТА ===
// ============================================================

const TAB_KEY = 'fih-game-active-tab';
const TAB_ID = 'tab_' + Date.now() + '_' + Math.random().toString(36).slice(2);

function checkMultitab() {
  const activeTab = localStorage.getItem(TAB_KEY);
  if (activeTab && activeTab !== TAB_ID) {
    const hb = localStorage.getItem(TAB_KEY + '_hb');
    const now = Date.now();
    if (hb && (now - parseInt(hb)) < 3000) {
      document.getElementById('multitabOverlay').classList.add('active');
      return false;
    }
  }
  claimTab();
  return true;
}
function claimTab() {
  localStorage.setItem(TAB_KEY, TAB_ID);
  localStorage.setItem(TAB_KEY + '_hb', Date.now().toString());
}
function releaseTab() {
  if (localStorage.getItem(TAB_KEY) === TAB_ID) {
    localStorage.removeItem(TAB_KEY);
    localStorage.removeItem(TAB_KEY + '_hb');
  }
}
let heartbeatInterval = null;
function startHeartbeat() {
  heartbeatInterval = setInterval(() => {
    if (localStorage.getItem(TAB_KEY) === TAB_ID) {
      localStorage.setItem(TAB_KEY + '_hb', Date.now().toString());
    } else {
      document.getElementById('multitabOverlay').classList.add('active');
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    }
  }, 1500);
}
window.addEventListener('beforeunload', releaseTab);

// ============================================================
// === СОХРАНЕНИЕ ===
// ============================================================

const SAVE_KEY = 'fih-game-save-v1';

function saveGame() {
  try {
    const data = {
      totalCaught: gameState.totalCaught,
      coins: gameState.coins,
      inventory: gameState.inventory,
      caughtSpecies: gameState.caughtSpecies,
      aquarium: gameState.aquarium,
      upgrades: gameState.upgrades,
      autorollFilters: gameState.autorollFilters,
      bestValue: gameState.bestValue,
      minigameTokens: gameState.minigameTokens,
      rod2Enabled: gameState.rod2Enabled,
      lastMinigameTime: gameState.lastMinigameTime,
      ratState: gameState.rat.state,
      ratVisible: gameState.rat.visible,
      ratFedUntil: gameState.rat.fedUntil,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Save error', e);
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    Object.assign(gameState, {
      totalCaught: data.totalCaught || 0,
      coins: data.coins || 0,
      inventory: data.inventory || {},
      caughtSpecies: data.caughtSpecies || {},
      aquarium: data.aquarium || [],
      upgrades: Object.assign({
        luck: 0,
        autoroll: false,
        customAutoroll: false,
        aqLevel: 0,
        fastRod: 0,
        minigames: false,
        extraRod: 0,
        casino: false,
        rat: false,
      }, data.upgrades || {}),
      autorollFilters: Object.assign({
        rarities: [], species: [], minPrice: 0
      }, data.autorollFilters || {}),
      bestValue: data.bestValue || 0,
      minigameTokens: data.minigameTokens || 0,
      rod2Enabled: data.rod2Enabled !== false,
      lastMinigameTime: data.lastMinigameTime || 0,
      rat: {
        state: data.ratState || 'hungry',
        visible: data.ratVisible !== false,
        fedUntil: data.ratFedUntil || 0,
      },
    });
    return true;
  } catch (e) {
    console.warn('Load error', e);
    return false;
  }
}

setInterval(saveGame, 5000);
window.addEventListener('beforeunload', saveGame);

// ============================================================
// === КОНСТАНТЫ ===
// ============================================================

const rarityMultiplier = {
  common: 1,
  uncommon: 2.2,
  rare: 6,
  epic: 14,
  legendary: 45,
  exotic: 120,
  mythic: 300,
  ultimate: 900
};

const rarityNames = {
  common: 'Обычная',
  uncommon: 'Необычная',
  rare: 'Редкая',
  epic: 'Эпическая',
  legendary: 'Легендарная',
  exotic: 'Экзотическая',
  mythic: 'Мифическая',
  ultimate: 'УЛЬТИМАТИВНАЯ'
};

const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'exotic', 'mythic', 'ultimate'];

const fishList = [
  { id: 'perch',      name: 'Окунь',              emoji: '🐟', rarity: 'common',    chance: 34,    price: 5 },
  { id: 'crucian',    name: 'Карась',             emoji: '🐠', rarity: 'common',    chance: 28,    price: 4 },
  { id: 'roach',      name: 'Плотва',             emoji: '🐟', rarity: 'common',    chance: 22,    price: 3 },

  { id: 'pike',       name: 'Щука',               emoji: '🐡', rarity: 'uncommon',  chance: 7,     price: 15 },
  { id: 'zander',     name: 'Судак',              emoji: '🐟', rarity: 'uncommon',  chance: 5,     price: 18 },
  { id: 'carp',       name: 'Карп',               emoji: '🐠', rarity: 'uncommon',  chance: 3.5,   price: 20 },

  { id: 'catfish',    name: 'Сом',                emoji: '🐋', rarity: 'rare',      chance: 1.5,   price: 60 },
  { id: 'trout',      name: 'Форель',             emoji: '🐟', rarity: 'rare',      chance: 1.0,   price: 80 },
  { id: 'octopus',    name: 'Осьминог',           emoji: '🐙', rarity: 'rare',      chance: 0.7,   price: 100 },

  { id: 'shark',      name: 'Акула',              emoji: '🦈', rarity: 'epic',      chance: 0.3,   price: 250 },
  { id: 'swordfish',  name: 'Меч-рыба',           emoji: '🗡️', rarity: 'epic',      chance: 0.2,   price: 300 },
  { id: 'sturgeon',   name: 'Осётр',              emoji: '🐟', rarity: 'epic',      chance: 0.15,  price: 400 },

  { id: 'whale',      name: 'Кит',                emoji: '🐳', rarity: 'legendary', chance: 0.08,  price: 500 },
  { id: 'crab',       name: 'Камчатский Краб',    emoji: '🦀', rarity: 'legendary', chance: 0.05,  price: 800 },
  { id: 'manta',      name: 'Манта',              emoji: '🐟', rarity: 'legendary', chance: 0.04,  price: 900 },

  { id: 'searabbit',  name: 'Морской Кролик',     emoji: '🐰', rarity: 'exotic',    chance: 0.020, price: 6000 },
  { id: 'seaurchin',  name: 'Морской Ёж',         emoji: '🦔', rarity: 'exotic',    chance: 0.015, price: 7000 },

  { id: 'coelacanth', name: 'Латимерия',          emoji: '🐟', rarity: 'mythic',    chance: 0.015, price: 1500 },
  { id: 'giantsquid', name: 'Гигантский Кальмар', emoji: '🦑', rarity: 'mythic',    chance: 0.008, price: 2000 },

  { id: 'bluewhale',  name: 'Синий Кит',          emoji: '🌈', rarity: 'ultimate',  chance: 0.02,  price: 10000 },
  { id: 'megamouth',  name: 'Большерот',          emoji: '🌈', rarity: 'ultimate',  chance: 0.012, price: 8000 },
  { id: 'greenland',  name: 'Гренландская Акула', emoji: '🌈', rarity: 'ultimate',  chance: 0.008, price: 12000 },
];

const AQUARIUM_LEVELS = [
  { level: 0, slots: 1 },
  { level: 1, slots: 2 },
  { level: 2, slots: 3 },
  { level: 3, slots: 4 },
  { level: 4, slots: 5 },
];

function getAqSlots() {
  const lvl = gameState.upgrades.aqLevel || 0;
  const entry = AQUARIUM_LEVELS.find(x => x.level === lvl) || AQUARIUM_LEVELS[0];
  return entry.slots;
}

const MINIGAME_TOKEN_MAX = 15;
const MINIGAME_COOLDOWN = 60 * 1000;
const MINIGAME_BUFF_DURATION = 30 * 1000;
const MINIGAME_BUFF_LUCK = 10;
const MINIGAME_BUFF_SPEED = 5;
const MINIGAME_BUFF_SELL = 10;
const MINIGAME_REWARD = 2000;

const RAT_FEED_DURATION = 5 * 60 * 1000;
const RAT_LUCK_BONUS = 1;
const RAT_SELL_BONUS = 2;

// ============================================================
// === СОСТОЯНИЕ ===
// ============================================================

const gameState = {
  totalCaught: 0,
  coins: 0,
  inventory: {},
  caughtSpecies: {},
  aquarium: [],
  bestValue: 0,
  minigameTokens: 0,

  buff: {
    luckBoost: 0,
    speedBoost: 0,
    sellBoost: 0,
    expiresAt: 0,
  },

  rod2Enabled: true,
  lastMinigameTime: 0,

  rat: {
    state: 'hungry',
    visible: true,
    fedUntil: 0,
  },

  upgrades: {
    luck: 0,
    autoroll: false,
    customAutoroll: false,
    aqLevel: 0,
    fastRod: 0,
    minigames: false,
    extraRod: 0,
    casino: false,
    rat: false,
  },

  autorollFilters: {
    rarities: [],
    species: [],
    minPrice: 0
  },

  autorollActive: false,
};

// ============================================================
// === МАГАЗИН ===
// ============================================================

const upgradesList = [
  {
    id: 'luck', icon: '🍀', name: 'Улучшенная удача',
    desc: 'Повышает шанс выпадения редких рыб',
    maxLevel: 10, baseCost: 300, costMult: 1.6,
    isUnlocked: () => true,
    getLevel: () => gameState.upgrades.luck,
    onBuy: () => { gameState.upgrades.luck++; }
  },
  {
    id: 'autoroll', icon: '🔄', name: 'Автопрокат',
    desc: 'Автоматически забрасывает удочку. Включает автопродажу (фильтры по шестерёнке)',
    maxLevel: 1, baseCost: 1500, costMult: 1,
    isUnlocked: () => gameState.upgrades.luck >= 2,
    getLevel: () => gameState.upgrades.autoroll ? 1 : 0,
    onBuy: () => { gameState.upgrades.autoroll = true; },
    lockedHint: 'Требуется удача 2/10'
  },
  {
    id: 'fastRod', icon: '🎣', name: 'Быстрая удочка',
    desc: 'Ускоряет ручной ролл и автопрокат (по 10% за уровень)',
    maxLevel: 5, baseCost: 5000, costMult: 1.9,
    isUnlocked: () => gameState.upgrades.autoroll,
    getLevel: () => gameState.upgrades.fastRod,
    onBuy: () => { gameState.upgrades.fastRod++; },
    lockedHint: 'Требуется Автопрокат 1/1'
  },
  {
    id: 'extraRod', icon: '🎏', name: 'Вторая удочка',
    desc: 'Шанс поймать 2 рыбы за заброс (+8%/ур). Переключатель на главном экране',
    maxLevel: 5, baseCost: 12000, costMult: 2.0,
    isUnlocked: () => gameState.upgrades.fastRod >= 2,
    getLevel: () => gameState.upgrades.extraRod,
    onBuy: () => { gameState.upgrades.extraRod++; },
    lockedHint: 'Требуется Быстрая удочка 2/5'
  },
  {
    id: 'minigames', icon: '🎯', name: 'Мини-игры',
    desc: 'Мини-игры: 2000 монет + буст на 30с (+10% удача, +5% скорость, +10% цена)',
    maxLevel: 1, baseCost: 25000, costMult: 1,
    isUnlocked: () => gameState.upgrades.extraRod >= 1,
    getLevel: () => gameState.upgrades.minigames ? 1 : 0,
    onBuy: () => { gameState.upgrades.minigames = true; },
    lockedHint: 'Требуется Вторая удочка 1/5'
  },
  {
    id: 'casino', icon: '🎰', name: 'Казино',
    desc: 'Открывает казино — попытайся продать рыбу в 2/3/4/5 раз дороже!',
    maxLevel: 1, baseCost: 35000, costMult: 1,
    isUnlocked: () => gameState.upgrades.minigames,
    getLevel: () => gameState.upgrades.casino ? 1 : 0,
    onBuy: () => { gameState.upgrades.casino = true; },
    lockedHint: 'Требуется Мини-игры'
  },
  {
    id: 'aqLevel', icon: '🐠', name: 'Аквариум',
    desc: 'Расширяет аквариум: 1 слот → 2 → 3 → 4 → 5. Буст к цене продажи',
    maxLevel: 4, baseCost: 40000, costMult: 2.2,
    isUnlocked: () => gameState.upgrades.luck >= 10,
    getLevel: () => gameState.upgrades.aqLevel,
    onBuy: () => { gameState.upgrades.aqLevel++; },
    lockedHint: 'Требуется удача 10/10'
  },
  {
    id: 'rat', icon: '🐀', name: 'Крыса',
    desc: 'Скорми рыбу → на 5 мин: +1% удача, +2% цена. Отсылка на другую игру создателя 🐀💰',
    maxLevel: 1, baseCost: 15000, costMult: 1,
    isUnlocked: () => gameState.upgrades.casino,
    getLevel: () => gameState.upgrades.rat ? 1 : 0,
    onBuy: () => { gameState.upgrades.rat = true; },
    lockedHint: 'Требуется Казино',
    link: 'https://astral228777.github.io/rat-coin-game/',
    linkText: '🐀 Rat Coin Game'
  },
];

const minigamesList = [
  { id: 'clicker', icon: '👆', name: 'Точный клик', desc: 'Кликни 10 раз за 3 секунды. +2000 монет', run: runClickGame },
  { id: 'guess', icon: '🎲', name: 'Угадай число', desc: 'Угадай число 1-5. Правильно = 2000 монет', run: runGuessGame },
  { id: 'reaction', icon: '⚡', name: 'Реакция', desc: 'Жди зелёного и кликай. +2000 монет', run: runReactionGame },
];

const casinoChances = {
  common:    { 2: 90, 3: 60, 4: 30, 5: 12 },
  uncommon:  { 2: 80, 3: 50, 4: 22, 5: 8 },
  rare:      { 2: 70, 3: 40, 4: 16, 5: 6 },
  epic:      { 2: 60, 3: 30, 4: 12, 5: 4 },
  legendary: { 2: 50, 3: 22, 4: 8,  5: 3 },
  exotic:    { 2: 40, 3: 18, 4: 6,  5: 2 },
  mythic:    { 2: 30, 3: 12, 4: 5,  5: 1.5 },
  ultimate:  { 2: 25, 3: 10, 4: 4,  5: 1 },
};

// ============================================================
// === DOM ===
// ============================================================

const $ = id => document.getElementById(id);

const rollBtn         = $('rollBtn');
const fishEmoji       = $('fishEmoji');
const fishName        = $('fishName');
const fishRarity      = $('fishRarity');
const fishValue       = $('fishValue');
const catchDisplay    = $('catchDisplay');
const coinsDisplay    = $('coinsDisplay');
const shopCoins       = $('shopCoins');
const inventoryCoins  = $('inventoryCoins');
const notificationEl  = $('notification');
const autorollToggle  = $('autorollToggle');
const autorollIcon    = $('autorollIcon');
const autorollSettingsBtn = $('autorollSettingsBtn');
const aqBadge         = $('aqBadge');
const aqBoostValue    = $('aqBoostValue');
const aqCount         = $('aqCount');
const decisionRow     = $('decisionRow');
const keepBtn         = $('keepBtn');
const sellBtn         = $('sellBtn');
const decPrice        = $('decPrice');
const extraBar        = $('extraBar');
const minigameBadge   = $('minigameBadge');
const rod2ToggleRow   = $('rod2ToggleRow');
const rod2Toggle      = $('rod2Toggle');
const rod2State       = $('rod2State');
const buffBar         = $('buffBar');

// ============================================================
// === УТИЛИТЫ ===
// ============================================================

function formatNumber(n) {
  if (n >= 1e9) return (n/1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(2) + 'K';
  return Math.floor(n).toString();
}

function notify(msg, type = '') {
  notificationEl.textContent = msg;
  notificationEl.className = 'notification show ' + type;
  clearTimeout(notificationEl._timer);
  notificationEl._timer = setTimeout(() => {
    notificationEl.className = 'notification ' + type;
  }, 2200);
}

function getRarityColor(rarity) {
  return {
    common: '#b0b0b0', uncommon: '#4ade80', rare: '#38bdf8',
    epic: '#c084fc', legendary: '#fbbf24', exotic: '#999',
    mythic: '#f43f5e', ultimate: '#ffffff'
  }[rarity] || '#fff';
}

// ============================================================
// === БАФЫ ===
// ============================================================

function isBuffActive() { return gameState.buff.expiresAt > Date.now(); }
function isRatFed() {
  return gameState.upgrades.rat &&
         gameState.rat.state === 'happy' &&
         gameState.rat.fedUntil > Date.now();
}

function getBuffLuckBonus() {
  let bonus = isBuffActive() ? MINIGAME_BUFF_LUCK : 0;
  if (isRatFed()) bonus += RAT_LUCK_BONUS;
  return bonus;
}
function getBuffSpeedBonus() { return isBuffActive() ? MINIGAME_BUFF_SPEED : 0; }
function getBuffSellBonus() {
  let bonus = isBuffActive() ? MINIGAME_BUFF_SELL : 0;
  if (isRatFed()) bonus += RAT_SELL_BONUS;
  return bonus;
}

function applyMinigameBuff() {
  gameState.buff.luckBoost = MINIGAME_BUFF_LUCK;
  gameState.buff.speedBoost = MINIGAME_BUFF_SPEED;
  gameState.buff.sellBoost = MINIGAME_BUFF_SELL;
  gameState.buff.expiresAt = Date.now() + MINIGAME_BUFF_DURATION;
  updateBuffBar();
  saveGame();
}

function updateBuffBar() {
  if (isBuffActive()) {
    buffBar.classList.remove('hidden');
    const left = Math.max(0, Math.ceil((gameState.buff.expiresAt - Date.now()) / 1000));
    $('buffTimer').textContent = left + 's';
    $('buffLuckValue').textContent = '+' + gameState.buff.luckBoost + '%';
    $('buffSpeedValue').textContent = '+' + gameState.buff.speedBoost + '%';
    const sellEl = $('buffSellValue');
    if (sellEl) sellEl.textContent = '+' + gameState.buff.sellBoost + '%';
  } else {
    buffBar.classList.add('hidden');
  }
}
setInterval(updateBuffBar, 1000);

// ============================================================
// === RNG ===
// ============================================================

function rollFish() {
  const luckLevel = gameState.upgrades.luck;
  const buffLuck = getBuffLuckBonus() / 100;
  const luckBoost = 1 + luckLevel * 0.12 + buffLuck;

  const weighted = fishList.map(f => {
    let weight = f.chance;
    const rarityIdx = rarityOrder.indexOf(f.rarity);
    if (rarityIdx >= 4) weight *= luckBoost;
    else if (rarityIdx === 3) weight *= (1 + luckLevel * 0.08);
    return { fish: f, weight };
  });

  const total = weighted.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const x of weighted) {
    r -= x.weight;
    if (r <= 0) return x.fish;
  }
  return fishList[0];
}

function calcFishValue(fish) {
  return Math.floor(fish.price * rarityMultiplier[fish.rarity]);
}

function applyAquariumBoost(value) {
  const aquariumBoost = getAquariumBonus();
  const buffSellBoost = getBuffSellBonus() / 100;
  return Math.floor(value * (1 + aquariumBoost + buffSellBoost));
}

function getAquariumBonus() {
  let bonus = 0;
  for (const aq of gameState.aquarium) {
    const fish = fishList.find(f => f.id === aq.fishId);
    if (!fish) continue;
    if (fish.rarity === 'ultimate') bonus += 0.10;
    if (fish.rarity === 'exotic')   bonus += 0.25;
  }
  return bonus;
}

// ============================================================
// === РОЛЛ ===
// ============================================================

let isRolling = false;
let pendingCatch = null;

async function castRod(silent = false) {
  if (isRolling) return;
  isRolling = true;

  decisionRow.classList.remove('active');
  pendingCatch = null;

  const fastRodBonus = (gameState.upgrades.fastRod || 0) * 0.10;
  const buffSpeed = getBuffSpeedBonus() / 100;
  const rodSpeed = Math.max(0.25, 1 - fastRodBonus - buffSpeed);

  if (!silent) rollBtn.disabled = true;

  catchDisplay.classList.remove('glow-epic','glow-legendary','glow-exotic','glow-mythic','glow-ultimate');
  catchDisplay.classList.add('rolling');
  fishEmoji.classList.remove('pop');
  fishEmoji.classList.add('spinning');
  fishName.textContent = 'Клюёт...';
  fishName.style.color = '#fff';
  fishRarity.textContent = '';
  fishRarity.className = 'fish-rarity';
  fishValue.textContent = '';

  const spinEmojis = ['🐟', '🐠', '🐡', '🦈', '🐙', '🦑', '🐳', '🦀', '🌈', '🐰', '🦔'];
  const spinInterval = setInterval(() => {
    fishEmoji.textContent = spinEmojis[Math.floor(Math.random() * spinEmojis.length)];
  }, 70);

  const baseDelay = silent ? 4000 : 2200;
  const delay = Math.floor(baseDelay * rodSpeed);
  await new Promise(r => setTimeout(r, delay));

  clearInterval(spinInterval);
  catchDisplay.classList.remove('rolling');
  fishEmoji.classList.remove('spinning');

  const fish = rollFish();
  const value = applyAquariumBoost(calcFishValue(fish));

  fishEmoji.textContent = fish.emoji;
  fishEmoji.classList.add('pop');
  fishName.textContent = fish.name;
  fishName.style.color = getRarityColor(fish.rarity);
  fishRarity.textContent = rarityNames[fish.rarity];
  fishRarity.className = 'fish-rarity rarity-' + fish.rarity;
  fishValue.textContent = `💰 ${formatNumber(value)} монет`;

  if (fish.rarity === 'epic')      catchDisplay.classList.add('glow-epic');
  if (fish.rarity === 'legendary') catchDisplay.classList.add('glow-legendary');
  if (fish.rarity === 'exotic')    catchDisplay.classList.add('glow-exotic');
  if (fish.rarity === 'mythic')    catchDisplay.classList.add('glow-mythic');
  if (fish.rarity === 'ultimate')  catchDisplay.classList.add('glow-ultimate');

  gameState.totalCaught++;
  totalCaughtGlobal++;
  if (value > gameState.bestValue) gameState.bestValue = value;
  if (!gameState.caughtSpecies[fish.id]) gameState.caughtSpecies[fish.id] = true;

  if (!silent) {
    manualRollsCount++;
    if (gameState.upgrades.minigames && manualRollsCount % 15 === 0) {
      if (gameState.minigameTokens < MINIGAME_TOKEN_MAX) {
        gameState.minigameTokens++;
        notify('🎯 Получен жетон мини-игры!', 'gold');
      } else {
        notify('🎯 Лимит жетонов (15)', 'error');
      }
    }

    const extraChance = gameState.rod2Enabled ? (gameState.upgrades.extraRod || 0) * 0.08 : 0;
    if (extraChance > 0 && Math.random() < extraChance) {
      const f2 = rollFish();
      const v2 = applyAquariumBoost(calcFishValue(f2));
      gameState.totalCaught++;
      if (v2 > gameState.bestValue) gameState.bestValue = v2;
      if (!gameState.caughtSpecies[f2.id]) gameState.caughtSpecies[f2.id] = true;
      notify(`🎏 Двойной улов: +${f2.name}!`, 'gold');
      pendingCatch = { fish, value, bonusFish: f2, bonusValue: v2 };
    } else {
      pendingCatch = { fish, value };
    }

    decPrice.textContent = `+💰${formatNumber(value)}`;
    decisionRow.classList.add('active');
    rollBtn.disabled = true;
    isRolling = false;
    updateAllUI();
    return;
  }

  handleFishCatch(fish, value);

  const extraChance = gameState.rod2Enabled ? (gameState.upgrades.extraRod || 0) * 0.08 : 0;
  if (extraChance > 0 && Math.random() < extraChance) {
    const f2 = rollFish();
    const v2 = applyAquariumBoost(calcFishValue(f2));
    handleFishCatch(f2, v2);
    gameState.totalCaught++;
    if (v2 > gameState.bestValue) gameState.bestValue = v2;
    if (!gameState.caughtSpecies[f2.id]) gameState.caughtSpecies[f2.id] = true;
  }

  updateAllUI();
  saveGame();
  isRolling = false;
}

function decideKeep() {
  if (!pendingCatch) return;
  const { fish, bonusFish } = pendingCatch;
  gameState.inventory[fish.id] = (gameState.inventory[fish.id] || 0) + 1;
  let msg = `🎒 ${fish.name}`;
  if (bonusFish) {
    gameState.inventory[bonusFish.id] = (gameState.inventory[bonusFish.id] || 0) + 1;
    msg += ` + ${bonusFish.name}`;
  }
  notify(msg + ' — в инвентарь');
  finishDecision();
}

function decideSell() {
  if (!pendingCatch) return;
  const { fish, value, bonusFish, bonusValue } = pendingCatch;
  let total = value;
  let msg = `💰 ${fish.name}`;
  if (bonusFish) { total += bonusValue; msg += ` + ${bonusFish.name}`; }
  gameState.coins += total;
  notify(`${msg} — продано за ${formatNumber(total)}`, 'gold');
  finishDecision();
}

function finishDecision() {
  pendingCatch = null;
  decisionRow.classList.remove('active');
  rollBtn.disabled = false;
  updateAllUI();
  saveGame();
}

// ============================================================
// === ОБРАБОТКА УЛОВА ===
// ============================================================

function handleFishCatch(fish, value) {
  if (gameState.autorollActive) {
    if (shouldAutorollKeep(fish, value)) {
      gameState.inventory[fish.id] = (gameState.inventory[fish.id] || 0) + 1;
    } else {
      gameState.coins += value;
    }
  } else {
    gameState.inventory[fish.id] = (gameState.inventory[fish.id] || 0) + 1;
  }
}

function shouldAutorollKeep(fish, value) {
  const f = gameState.autorollFilters;
  const hasRarityFilter = f.rarities.length > 0;
  const hasSpeciesFilter = f.species.length > 0;
  const hasPriceFilter = f.minPrice > 0;
  if (!hasRarityFilter && !hasSpeciesFilter && !hasPriceFilter) return false;
  const rarityMatch = !hasRarityFilter || f.rarities.includes(fish.rarity);
  const speciesMatch = !hasSpeciesFilter || f.species.includes(fish.id);
  const priceMatch = !hasPriceFilter || value >= f.minPrice;
  return rarityMatch && speciesMatch && priceMatch;
}

// ============================================================
// === ПРОДАЖА ===
// ============================================================

function sellFishQty(fishId, qty) {
  const have = gameState.inventory[fishId] || 0;
  const n = Math.min(qty, have);
  if (n < 1) return;
  const fish = fishList.find(f => f.id === fishId);
  const unitValue = applyAquariumBoost(calcFishValue(fish));
  const totalValue = unitValue * n;
  gameState.inventory[fishId] -= n;
  if (gameState.inventory[fishId] <= 0) delete gameState.inventory[fishId];
  gameState.coins += totalValue;
  notify(`Продано ${n}x ${fish.name} за 💰${formatNumber(totalValue)}`, 'gold');
  updateAllUI();
  saveGame();
}

function sellAll() {
  let total = 0, count = 0;
  for (const [fishId, num] of Object.entries(gameState.inventory)) {
    const fish = fishList.find(f => f.id === fishId);
    if (!fish) continue;
    total += applyAquariumBoost(calcFishValue(fish)) * num;
    count += num;
  }
  if (count === 0) { notify('Инвентарь пуст', 'error'); return; }
  gameState.inventory = {};
  gameState.coins += total;
  notify(`Продано ${count} рыб за 💰${formatNumber(total)}`, 'gold');
  updateAllUI();
  saveGame();
}

// ============================================================
// === АКВАРИУМ ===
// ============================================================

function addToAquarium(fishId) {
  const slots = getAqSlots();
  if (gameState.aquarium.length >= slots) { notify('Аквариум заполнен!', 'error'); return; }
  const have = gameState.inventory[fishId] || 0;
  if (have < 1) return;
  const fish = fishList.find(f => f.id === fishId);
  if (fish.rarity !== 'ultimate' && fish.rarity !== 'exotic') {
    notify('Только ультимативные и экзотические рыбы!', 'error');
    return;
  }
  const value = applyAquariumBoost(calcFishValue(fish));
  gameState.inventory[fishId]--;
  if (gameState.inventory[fishId] <= 0) delete gameState.inventory[fishId];
  gameState.aquarium.push({ fishId, value });
  notify(`${fish.emoji} ${fish.name} добавлен в аквариум!`);
  updateAllUI();
  saveGame();
}

function removeFromAquarium(idx) {
  if (idx < 0 || idx >= gameState.aquarium.length) return;
  const aq = gameState.aquarium[idx];
  const fish = fishList.find(f => f.id === aq.fishId);
  gameState.inventory[aq.fishId] = (gameState.inventory[aq.fishId] || 0) + 1;
  gameState.aquarium.splice(idx, 1);
  notify(`${fish.name} возвращён в инвентарь`);
  updateAllUI();
  saveGame();
}

// ============================================================
// === КРЫСА ===
// ============================================================

function updateRatUI() {
  const ratBar = $('ratBar');
  const ratMini = $('ratMini');

  if (!gameState.upgrades.rat) {
    ratBar.classList.add('hidden');
    ratMini.classList.add('hidden');
    return;
  }

  if (gameState.rat.state === 'happy' && gameState.rat.fedUntil <= Date.now()) {
    gameState.rat.state = 'hungry';
  }

  if (gameState.rat.visible) {
    ratBar.classList.remove('hidden');
    ratMini.classList.add('hidden');
  } else {
    ratBar.classList.add('hidden');
    ratMini.classList.remove('hidden');
  }

  const stateEl = $('ratState');
  const emojiEl = $('ratEmoji');

  if (isRatFed()) {
    const left = Math.max(0, Math.ceil((gameState.rat.fedUntil - Date.now()) / 1000));
    const m = Math.floor(left / 60);
    const s = left % 60;
    const timeStr = m > 0 ? `${m}м ${s}с` : `${s}с`;
    stateEl.textContent = `довольна 😊 +1% удача, +2% цена · ${timeStr}`;
    stateEl.style.color = '#4ade80';
    emojiEl.textContent = '🐀';
  } else {
    stateEl.textContent = 'голодна';
    stateEl.style.color = '#fbbf24';
    emojiEl.textContent = '🐀';
  }
}

setInterval(updateRatUI, 1000);

function openRatFeedModal() {
  const container = $('ratFishList');
  container.innerHTML = '';

  const keys = Object.keys(gameState.inventory);
  if (keys.length === 0) {
    container.innerHTML = `<div class="empty-msg">Инвентарь пуст.<br>Нечего кормить!</div>`;
    $('ratFeedModal').classList.add('active');
    return;
  }

  const sorted = keys.sort((a, b) => {
    const fa = fishList.find(f => f.id === a);
    const fb = fishList.find(f => f.id === b);
    return rarityOrder.indexOf(fa.rarity) - rarityOrder.indexOf(fb.rarity);
  });

  sorted.forEach(fishId => {
    const fish = fishList.find(f => f.id === fishId);
    const count = gameState.inventory[fishId];
    const card = document.createElement('div');
    card.className = 'fish-card rat-feed-pick';
    card.innerHTML = `
      <div class="fc-emoji">${fish.emoji}</div>
      <div class="fc-info">
        <div class="fc-name" style="color: ${getRarityColor(fish.rarity)}">${fish.name}</div>
        <div class="fc-meta">${rarityNames[fish.rarity]} · x${count}</div>
      </div>
      <div class="fc-actions">
        <button class="btn-sell">🍽 Скормить</button>
      </div>
    `;
    card.querySelector('.btn-sell').addEventListener('click', () => {
      feedRat(fishId);
    });
    container.appendChild(card);
  });

  $('ratFeedModal').classList.add('active');
}

function feedRat(fishId) {
  const have = gameState.inventory[fishId] || 0;
  if (have < 1) return;
  const fish = fishList.find(f => f.id === fishId);

  gameState.inventory[fishId]--;
  if (gameState.inventory[fishId] <= 0) delete gameState.inventory[fishId];

  gameState.rat.state = 'happy';
  gameState.rat.fedUntil = Date.now() + RAT_FEED_DURATION;
  notify(`🐀 Крыса довольна! +1% удача, +2% цена (5 мин)`, 'green');
  updateRatUI();
  updateAllUI();
  saveGame();

  $('ratFeedModal').classList.remove('active');
}

// ============================================================
// === UI ===
// ============================================================

function updateAllUI() {
  coinsDisplay.textContent = formatNumber(gameState.coins);
  shopCoins.textContent = formatNumber(gameState.coins);
  inventoryCoins.textContent = formatNumber(gameState.coins);

  const slots = getAqSlots();
  const aqBonus = getAquariumBonus();
  aqBadge.textContent = `${gameState.aquarium.length}/${slots}`;
  aqBoostValue.textContent = '+' + Math.floor(aqBonus * 100) + '%';
  aqCount.textContent = `${gameState.aquarium.length}/${slots}`;

  const showMinigame = gameState.upgrades.minigames;
  const showCasino = gameState.upgrades.casino;
  if (showMinigame || showCasino) {
    extraBar.classList.remove('hidden');
  } else {
    extraBar.classList.add('hidden');
  }
  $('minigameBtn').classList.toggle('hidden', !showMinigame);
  $('casinoBtn').classList.toggle('hidden', !showCasino);
  minigameBadge.textContent = gameState.minigameTokens;

  if (gameState.upgrades.extraRod > 0) {
    rod2ToggleRow.classList.remove('hidden');
    if (gameState.rod2Enabled) {
      rod2Toggle.classList.add('active');
      rod2State.textContent = 'ВКЛ';
    } else {
      rod2Toggle.classList.remove('active');
      rod2State.textContent = 'ВЫКЛ';
    }
  } else {
    rod2ToggleRow.classList.add('hidden');
  }

  if (gameState.upgrades.customAutoroll) {
    autorollSettingsBtn.classList.remove('locked');
  } else {
    autorollSettingsBtn.classList.add('locked');
  }

  renderShop();
  renderAquarium();
  renderInventoryModal();
  updateAutorollVisual();
  updateBuffBar();
  updateRatUI();
}

function updateAutorollVisual() {
  if (!gameState.upgrades.autoroll) {
    autorollToggle.classList.add('locked');
    autorollToggle.classList.remove('active');
    autorollIcon.textContent = '🔒';
    return;
  }
  autorollToggle.classList.remove('locked');
  if (gameState.autorollActive) {
    autorollToggle.classList.add('active');
    autorollIcon.textContent = '⏸️';
  } else {
    autorollToggle.classList.remove('active');
    autorollIcon.textContent = '▶️';
  }
}

function getUpgradeCost(u) {
  const lvl = u.getLevel();
  return Math.floor(u.baseCost * Math.pow(u.costMult, lvl));
}

function renderShop() {
  const container = $('shopItems');
  container.innerHTML = '';

  const visible = [];
  let blockedShown = false;

  for (const u of upgradesList) {
    if (u.isUnlocked()) {
      visible.push({ u, locked: false });
    } else if (!blockedShown && u.lockedHint) {
      visible.push({ u, locked: true });
      blockedShown = true;
    }
  }

  visible.forEach(({ u, locked }) => {
    const lvl = u.getLevel();
    const maxed = lvl >= u.maxLevel;
    const cost = getUpgradeCost(u);
    const canAfford = gameState.coins >= cost;

    const item = document.createElement('div');
    item.className = 'shop-item' + (locked ? ' locked-item' : '');

    let btnClass = 'btn-buy';
    let btnText = `💰 ${formatNumber(cost)}`;
    let disabled = false;

    if (locked) { btnClass += ' max'; btnText = '🔒'; disabled = true; }
    else if (maxed) { btnClass += ' max'; btnText = 'МАКС'; disabled = true; }
    else if (!canAfford) { disabled = true; }

    item.innerHTML = `
      <div class="si-icon">${u.icon}</div>
      <div class="si-info">
        <div class="si-name">${u.name}</div>
        <div class="si-desc">${u.desc}</div>
        <div class="si-level">Уровень: ${lvl} / ${u.maxLevel}</div>
        ${locked ? `<div class="si-lock">🔒 ${u.lockedHint}</div>` : ''}
        ${u.link ? `<a class="si-link" href="${u.link}" target="_blank">🔗 ${u.linkText}</a>` : ''}
      </div>
      <button class="${btnClass}" ${disabled ? 'disabled' : ''}>${btnText}</button>
    `;

    const btn = item.querySelector('button');
    if (!locked && !maxed && canAfford) {
      btn.addEventListener('click', () => {
        if (gameState.coins >= cost) {
          gameState.coins -= cost;
          u.onBuy();
          notify(`${u.icon} Куплено: ${u.name}!`);
          updateAllUI();
          saveGame();
        }
      });
    }
    container.appendChild(item);
  });
}

function formatChancePercent(rawPercent) {
  if (rawPercent === 0) return '0%';
  if (rawPercent < 0.001) return rawPercent.toFixed(5) + '%';
  if (rawPercent < 0.01)  return rawPercent.toFixed(4) + '%';
  if (rawPercent < 0.1)   return rawPercent.toFixed(3) + '%';
  if (rawPercent < 1)     return rawPercent.toFixed(2) + '%';
  return rawPercent.toFixed(1) + '%';
}

function renderBook() {
  const container = $('bookList');
  if (!container) return;
  container.innerHTML = '';

  const sorted = [...fishList].sort((a, b) =>
    rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity)
  );
  const totalChance = fishList.reduce((s, f) => s + f.chance, 0);

  sorted.forEach(fish => {
    const isCaught = !!gameState.caughtSpecies[fish.id];
    const rawPercent = fish.chance / totalChance * 100;
    const chancePercent = formatChancePercent(rawPercent);
    const oneIn = Math.round(1 / (fish.chance / totalChance));

    const card = document.createElement('div');
    card.className = 'fish-card';

    if (isCaught) {
      card.innerHTML = `
        <div class="fc-emoji">${fish.emoji}</div>
        <div class="fc-info">
          <div class="fc-name" style="color: ${getRarityColor(fish.rarity)}">${fish.name}</div>
          <div class="fc-meta">${rarityNames[fish.rarity]} · 💰 ${formatNumber(applyAquariumBoost(calcFishValue(fish)))}</div>
          <div class="fc-meta">🎲 Шанс: <strong style="color:#fff;">${chancePercent}</strong> · 1 из ${formatNumber(oneIn)}</div>
        </div>
      `;
    } else {
      card.innerHTML = `
        <div class="fc-emoji" style="filter: brightness(0.2);">❓</div>
        <div class="fc-info">
          <div class="fc-name" style="color: rgba(150,220,255,0.4)">???</div>
          <div class="fc-meta">${rarityNames[fish.rarity]}</div>
          <div class="fc-meta">🎲 Шанс: <strong style="color:#fff;">${chancePercent}</strong> · 1 из ${formatNumber(oneIn)}</div>
        </div>
      `;
    }
    container.appendChild(card);
  });
}

function renderAquarium() {
  const slotsContainer = $('aquariumSlots');
  if (!slotsContainer) return;
  slotsContainer.innerHTML = '';

  const maxSlots = 5;
  const activeSlots = getAqSlots();

  for (let i = 0; i < maxSlots; i++) {
    const aq = gameState.aquarium[i];
    const locked = i >= activeSlots;
    const slot = document.createElement('div');
    slot.className = 'aq-slot' + (aq ? ' filled' : '') + (locked && !aq ? ' locked-slot' : '');

    if (aq) {
      const fish = fishList.find(f => f.id === aq.fishId);
      const bonus = fish.rarity === 'exotic' ? '25' : '10';
      slot.innerHTML = `
        <div>${fish.emoji}</div>
        <div class="aq-name">${fish.name}</div>
        <div class="aq-bonus">+${bonus}%</div>
      `;
      slot.addEventListener('click', () => removeFromAquarium(i));
      slot.title = 'Нажмите чтобы убрать';
    } else if (locked) {
      slot.innerHTML = `<div style="opacity:0.3">🔒</div>`;
      slot.title = 'Улучшите аквариум в магазине';
    } else {
      slot.innerHTML = `<div style="opacity:0.3">➕</div>`;
    }
    slotsContainer.appendChild(slot);
  }

  const bonus = getAquariumBonus();
  $('boostValue').textContent = `+${Math.floor(bonus * 100)}%`;

  const avail = $('aquariumAvailable');
  avail.innerHTML = '';

  const special = fishList.filter(f => f.rarity === 'ultimate' || f.rarity === 'exotic');
  let hasAny = false;

  special.forEach(fish => {
    const count = gameState.inventory[fish.id] || 0;
    if (count < 1) return;
    hasAny = true;

    const card = document.createElement('div');
    card.className = 'fish-card';
    card.innerHTML = `
      <div class="fc-emoji">${fish.emoji}</div>
      <div class="fc-info">
        <div class="fc-name" style="color: ${getRarityColor(fish.rarity)}">${fish.name}</div>
        <div class="fc-meta">${rarityNames[fish.rarity]} · x${count}</div>
      </div>
      <div class="fc-actions">
        <button class="btn-aquarium">🐠 Поместить</button>
      </div>
    `;
    card.querySelector('.btn-aquarium').addEventListener('click', () => {
      addToAquarium(fish.id);
    });
    avail.appendChild(card);
  });

  if (!hasAny) {
    avail.innerHTML = `<div class="empty-msg">Нет доступных ультимативных или экзотических рыб.<br>Ловите больше!</div>`;
  }
}

const qtyState = {};

function renderInventoryModal() {
  const container = $('inventoryList');
  if (!container) return;
  container.innerHTML = '';

  const keys = Object.keys(gameState.inventory);
  if (keys.length === 0) {
    container.innerHTML = `<div class="empty-msg">Инвентарь пуст.<br>Ловите рыб!</div>`;
    return;
  }

  const sorted = keys.sort((a, b) => {
    const fa = fishList.find(f => f.id === a);
    const fb = fishList.find(f => f.id === b);
    return rarityOrder.indexOf(fa.rarity) - rarityOrder.indexOf(fb.rarity);
  });

  let totalAll = 0;

  sorted.forEach(fishId => {
    const fish = fishList.find(f => f.id === fishId);
    const count = gameState.inventory[fishId];
    const unitValue = applyAquariumBoost(calcFishValue(fish));
    totalAll += unitValue * count;

    if (!qtyState[fishId] || qtyState[fishId] > count) qtyState[fishId] = count;
    const qty = qtyState[fishId];

    const card = document.createElement('div');
    card.className = 'fish-card';
    card.innerHTML = `
      <div class="fc-emoji">${fish.emoji}</div>
      <div class="fc-info">
        <div class="fc-name" style="color: ${getRarityColor(fish.rarity)}">${fish.name}</div>
        <div class="fc-meta">${rarityNames[fish.rarity]} · x${count}</div>
        <div class="fc-value">≈ 💰${formatNumber(unitValue)} за шт.</div>
      </div>
      <div class="fc-actions">
        <div class="qty-control">
          <button class="qty-minus" data-fish="${fishId}">−</button>
          <span class="qty-value">${qty}</span>
          <button class="qty-plus" data-fish="${fishId}">+</button>
        </div>
        <button class="btn-sell" data-fish="${fishId}">Продать</button>
      </div>
    `;
    container.appendChild(card);
  });

  const sellAllBtn = document.createElement('button');
  sellAllBtn.className = 'btn-sell-all';
  sellAllBtn.textContent = `💰 Продать всё (${formatNumber(totalAll)})`;
  sellAllBtn.addEventListener('click', sellAll);
  container.appendChild(sellAllBtn);

  container.querySelectorAll('.qty-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const fishId = btn.dataset.fish;
      const max = gameState.inventory[fishId] || 0;
      qtyState[fishId] = Math.max(1, (qtyState[fishId] || max) - 1);
      renderInventoryModal();
    });
  });
  container.querySelectorAll('.qty-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const fishId = btn.dataset.fish;
      const max = gameState.inventory[fishId] || 0;
      qtyState[fishId] = Math.min(max, (qtyState[fishId] || max) + 1);
      renderInventoryModal();
    });
  });
  container.querySelectorAll('.btn-sell').forEach(btn => {
    btn.addEventListener('click', () => {
      const fishId = btn.dataset.fish;
      const qty = qtyState[fishId] || 1;
      sellFishQty(fishId, qty);
      delete qtyState[fishId];
      renderInventoryModal();
    });
  });
}

// ============================================================
// === АВТОРОЛЛ ===
// ============================================================

let autorollInterval = null;
function startAutoroll() {
  if (autorollInterval) return;
  autorollInterval = setInterval(() => {
    if (!gameState.autorollActive) return;
    if (pendingCatch) return;
    castRod(true);
  }, 100);
}
function stopAutoroll() {
  if (autorollInterval) {
    clearInterval(autorollInterval);
    autorollInterval = null;
  }
}

function renderAutorollSettings() {
  const rf = $('rarityFilters');
  rf.innerHTML = '';
  rarityOrder.forEach(r => {
    const chip = document.createElement('div');
    const active = gameState.autorollFilters.rarities.includes(r);
    chip.className = 'filter-chip' + (active ? ' active' : '');
    chip.textContent = rarityNames[r];
    chip.addEventListener('click', () => {
      const arr = gameState.autorollFilters.rarities;
      const idx = arr.indexOf(r);
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push(r);
      renderAutorollSettings();
      saveGame();
    });
    rf.appendChild(chip);
  });

  const sf = $('speciesFilters');
  sf.innerHTML = '';
  const caughtList = fishList.filter(f => gameState.caughtSpecies[f.id]);
  if (caughtList.length === 0) {
    sf.innerHTML = `<div class="empty-msg" style="padding: 10px;">Поймайте рыб чтобы настраивать фильтр</div>`;
  } else {
    caughtList.forEach(fish => {
      const active = gameState.autorollFilters.species.includes(fish.id);
      const chip = document.createElement('div');
      chip.className = 'filter-chip' + (active ? ' active' : '');
      chip.textContent = `${fish.emoji} ${fish.name}`;
      chip.addEventListener('click', () => {
        const arr = gameState.autorollFilters.species;
        const idx = arr.indexOf(fish.id);
        if (idx >= 0) arr.splice(idx, 1);
        else arr.push(fish.id);
        renderAutorollSettings();
        saveGame();
      });
      sf.appendChild(chip);
    });
  }

  const slider = $('minPriceSlider');
  slider.value = gameState.autorollFilters.minPrice;
  $('minPriceValue').textContent = formatNumber(gameState.autorollFilters.minPrice);
}

// ============================================================
// === МИНИ-ИГРЫ ===
// ============================================================

function canPlayMinigame() {
  return Date.now() - gameState.lastMinigameTime >= MINIGAME_COOLDOWN;
}

function getMinigameCooldownLeft() {
  const left = MINIGAME_COOLDOWN - (Date.now() - gameState.lastMinigameTime);
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

setInterval(() => {
  const buyBtn = $('buyTokenBtn');
  if (buyBtn) {
    buyBtn.disabled = gameState.coins < 1000 || gameState.minigameTokens >= MINIGAME_TOKEN_MAX;
  }

  const modal = $('minigameModal');
  if (modal && modal.classList.contains('active')) {
    const cooldownBar = $('minigameCooldownBar');
    const left = getMinigameCooldownLeft();
    if (left > 0) {
      cooldownBar.classList.remove('hidden');
      $('minigameCooldownValue').textContent = left;
    } else {
      cooldownBar.classList.add('hidden');
    }

    const canPlay = canPlayMinigame();
    const buttons = document.querySelectorAll('#minigameList .mg-card button');
    buttons.forEach((btn, i) => {
      const mg = minigamesList[i];
      if (!mg) return;
      const hasTokens = gameState.minigameTokens >= 1;
      btn.disabled = !hasTokens || !canPlay;
    });
  }
}, 1000);

function renderMinigames() {
  const container = $('minigameList');
  if (!container) return;
  container.innerHTML = '';
  $('minigameTokens').textContent = gameState.minigameTokens;

  const buyBtn = $('buyTokenBtn');
  buyBtn.disabled = gameState.coins < 1000 || gameState.minigameTokens >= MINIGAME_TOKEN_MAX;

  const cooldownBar = $('minigameCooldownBar');
  const left = getMinigameCooldownLeft();
  if (left > 0) {
    cooldownBar.classList.remove('hidden');
    $('minigameCooldownValue').textContent = left;
  } else {
    cooldownBar.classList.add('hidden');
  }

  const canPlay = canPlayMinigame();

  minigamesList.forEach(mg => {
    const hasTokens = gameState.minigameTokens >= 1;
    const isDisabled = !hasTokens || !canPlay;
    const card = document.createElement('div');
    card.className = 'mg-card';
    card.innerHTML = `
      <div class="mg-icon">${mg.icon}</div>
      <div class="mg-info">
        <div class="mg-name">${mg.name}</div>
        <div class="mg-desc">${mg.desc}</div>
        <div class="mg-desc" style="color: #fbbf24;">Буст: +10% удача, +5% скорость, +10% цена (30 сек)</div>
      </div>
      <button ${isDisabled ? 'disabled' : ''}>Играть (1 🎯)</button>
    `;
    card.querySelector('button').addEventListener('click', () => {
      if (!canPlayMinigame()) {
        notify(`⏱ Подожди ${getMinigameCooldownLeft()} сек`, 'error');
        return;
      }
      if (gameState.minigameTokens < 1) {
        notify('Нужен жетон!', 'error');
        return;
      }
      gameState.minigameTokens -= 1;
      gameState.lastMinigameTime = Date.now();
      $('minigameModal').classList.remove('active');
      mg.run();
    });
    container.appendChild(card);
  });
}

function runClickGame() {
  const clicksNeeded = 10;
  const timeLimit = 3000;
  let clicks = 0;
  let finished = false;

  const overlay = document.createElement('div');
  overlay.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.95); display: flex; align-items: center; justify-content: center; z-index: 5000; flex-direction: column; gap: 20px; cursor: pointer; user-select: none; text-align: center; padding: 20px;`;
  const timer = document.createElement('div');
  timer.style.cssText = 'font-size: 20px; color: #38bdf8; font-weight: 700;';
  const counter = document.createElement('div');
  counter.style.cssText = 'font-size: 80px; color: #fff; font-weight: 700; text-shadow: 0 0 30px rgba(56,189,248,0.8);';
  const hint = document.createElement('div');
  hint.style.cssText = 'font-size: 16px; color: rgba(255,255,255,0.7);';
  hint.textContent = 'Кликай быстро!';

  overlay.appendChild(timer);
  overlay.appendChild(counter);
  overlay.appendChild(hint);
  document.body.appendChild(overlay);

  counter.textContent = '0 / ' + clicksNeeded;
  const startTime = Date.now();

  function updateTimer() {
    if (finished) return;
    const left = Math.max(0, timeLimit - (Date.now() - startTime));
    timer.textContent = '⏱ ' + (left/1000).toFixed(1) + ' сек';
    if (left <= 0) endGame(false);
    else requestAnimationFrame(updateTimer);
  }
  updateTimer();

  overlay.addEventListener('click', () => {
    if (finished) return;
    clicks++;
    counter.textContent = clicks + ' / ' + clicksNeeded;
    if (clicks >= clicksNeeded) endGame(true);
  });

  function endGame(success) {
    if (finished) return;
    finished = true;
    overlay.remove();
    if (success) {
      gameState.coins += MINIGAME_REWARD;
      applyMinigameBuff();
      notify(`👆 Победа! +${MINIGAME_REWARD} монет и буст`, 'gold');
    } else {
      notify('👆 Не успел!', 'error');
    }
    updateAllUI();
    saveGame();
  }
}

function runGuessGame() {
  const target = Math.floor(Math.random() * 5) + 1; // 1-5

  const overlay = document.createElement('div');
  overlay.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.95); display: flex; align-items: center; justify-content: center; z-index: 5000; flex-direction: column; gap: 20px; user-select: none; text-align: center; padding: 20px;`;
  const title = document.createElement('div');
  title.style.cssText = 'font-size: 24px; color: #fff; font-weight: 700;';
  title.textContent = '🎲 Угадай число 1-5';

  const grid = document.createElement('div');
  grid.style.cssText = 'display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; max-width: 420px;';

  let guessed = false;

  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.style.cssText = `width: 70px; height: 70px; border-radius: 14px; background: rgba(56,189,248,0.15); border: 2px solid rgba(56,189,248,0.5); color: #fff; font-size: 26px; font-weight: 700; cursor: pointer; transition: all 0.2s;`;
    btn.addEventListener('click', () => {
      if (guessed) return;
      guessed = true;
      if (i === target) {
        btn.style.background = 'rgba(74,222,128,0.4)';
        btn.style.borderColor = '#4ade80';
        setTimeout(() => {
          overlay.remove();
          gameState.coins += MINIGAME_REWARD;
          applyMinigameBuff();
          notify(`🎲 Угадал! +${MINIGAME_REWARD} монет и буст`, 'gold');
          updateAllUI();
          saveGame();
        }, 700);
      } else {
        btn.style.background = 'rgba(244,63,94,0.4)';
        btn.style.borderColor = '#f43f5e';
        setTimeout(() => {
          overlay.remove();
          notify(`🎲 Мимо! Было число ${target}`, 'error');
          updateAllUI();
          saveGame();
        }, 700);
      }
    });
    grid.appendChild(btn);
  }

  overlay.appendChild(title);
  overlay.appendChild(grid);
  document.body.appendChild(overlay);
}

function runReactionGame() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `position: fixed; inset: 0; background: #7f1d1d; display: flex; align-items: center; justify-content: center; z-index: 5000; user-select: none; font-size: 24px; color: #fff; font-weight: 700; flex-direction: column; gap: 20px; text-align: center; padding: 20px; cursor: not-allowed;`;
  overlay.innerHTML = `
    <div style="font-size: 60px;">✋</div>
    <div>Жди зелёного...</div>
    <div style="font-size: 14px; color: rgba(255,255,255,0.6);">Кликать сейчас НЕЛЬЗЯ!</div>
  `;
  document.body.appendChild(overlay);

  let ready = false;
  let finished = false;

  const delay = 2000 + Math.random() * 3000;

  let reactionTimer = null;

  setTimeout(() => {
    if (finished) return;
    ready = true;
    overlay.style.background = '#16a34a';
    overlay.style.cursor = 'pointer';
    overlay.innerHTML = `
      <div style="font-size: 80px;">👆</div>
      <div>ЖМИ!!!</div>
    `;

    reactionTimer = setTimeout(() => {
      if (finished) return;
      finished = true;
      overlay.remove();
      notify('⚡ Слишком медленно!', 'error');
      updateAllUI();
      saveGame();
    }, 1500);
  }, delay);

  overlay.addEventListener('click', () => {
    if (finished) return;

    if (!ready) {
      finished = true;
      overlay.remove();
      notify('⚡ Рано! Жди зелёного', 'error');
      updateAllUI();
      saveGame();
      return;
    }

    finished = true;
    if (reactionTimer) clearTimeout(reactionTimer);
    overlay.remove();
    gameState.coins += MINIGAME_REWARD;
    applyMinigameBuff();
    notify(`⚡ Отлично! +${MINIGAME_REWARD} монет и буст`, 'gold');
    updateAllUI();
    saveGame();
  });
}

// ============================================================
// === КАЗИНО ===
// ============================================================

let casinoSelectedFishId = null;

function renderCasino() {
  casinoSelectedFishId = null;
  $('casinoStep1').classList.remove('hidden');
  $('casinoStep2').classList.add('hidden');
  renderCasinoFishList();
}

function renderCasinoFishList() {
  const container = $('casinoFishList');
  container.innerHTML = '';

  const keys = Object.keys(gameState.inventory);
  if (keys.length === 0) {
    container.innerHTML = `<div class="empty-msg">Инвентарь пуст.<br>Ловите рыб для игры в казино!</div>`;
    return;
  }

  const sorted = keys.sort((a, b) => {
    const fa = fishList.find(f => f.id === a);
    const fb = fishList.find(f => f.id === b);
    return rarityOrder.indexOf(fb.rarity) - rarityOrder.indexOf(fa.rarity);
  });

  sorted.forEach(fishId => {
    const fish = fishList.find(f => f.id === fishId);
    const count = gameState.inventory[fishId];
    const baseValue = applyAquariumBoost(calcFishValue(fish));

    const card = document.createElement('div');
    card.className = 'fish-card casino-fish-pick';
    card.innerHTML = `
      <div class="fc-emoji">${fish.emoji}</div>
      <div class="fc-info">
        <div class="fc-name" style="color: ${getRarityColor(fish.rarity)}">${fish.name}</div>
        <div class="fc-meta">${rarityNames[fish.rarity]} · x${count}</div>
        <div class="fc-value">База: 💰${formatNumber(baseValue)}</div>
      </div>
      <div class="fc-actions">
        <button class="btn-aquarium">🎰 Выбрать</button>
      </div>
    `;
    card.addEventListener('click', () => {
      casinoSelectedFishId = fishId;
      renderCasinoMultipliers();
    });
    container.appendChild(card);
  });
}

function renderCasinoMultipliers() {
  const fishId = casinoSelectedFishId;
  if (!fishId) return;
  const fish = fishList.find(f => f.id === fishId);
  const count = gameState.inventory[fishId] || 0;
  if (count < 1) { renderCasino(); return; }

  const baseValue = applyAquariumBoost(calcFishValue(fish));
  const chances = casinoChances[fish.rarity];

  const sel = $('casinoSelected');
  sel.innerHTML = `
    <div class="fc-emoji">${fish.emoji}</div>
    <div class="fc-info">
      <div class="fc-name" style="color: ${getRarityColor(fish.rarity)}">${fish.name}</div>
      <div class="fc-meta">${rarityNames[fish.rarity]} · x${count}</div>
      <div class="fc-value">База: 💰${formatNumber(baseValue)}</div>
    </div>
  `;

  const container = $('casinoMultipliers');
  container.innerHTML = '';
  [2, 3, 4, 5].forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'casino-mult-btn';
    btn.innerHTML = `
      x${m}
      <span class="cm-chance">${chances[m]}% шанс</span>
      <span class="cm-reward">💰${formatNumber(baseValue * m)}</span>
    `;
    btn.addEventListener('click', () => playCasino(fishId, m));
    container.appendChild(btn);
  });

  $('casinoStep1').classList.add('hidden');
  $('casinoStep2').classList.remove('hidden');
}

function playCasino(fishId, mult) {
  const have = gameState.inventory[fishId] || 0;
  if (have < 1) { notify('Нет такой рыбы', 'error'); renderCasino(); return; }

  const fish = fishList.find(f => f.id === fishId);
  const baseValue = applyAquariumBoost(calcFishValue(fish));
  const chance = casinoChances[fish.rarity][mult];

  gameState.inventory[fishId] -= 1;
  if (gameState.inventory[fishId] <= 0) delete gameState.inventory[fishId];

  const success = Math.random() * 100 < chance;

  if (success) {
    const reward = baseValue * mult;
    gameState.coins += reward;
    notify(`🎰 УСПЕХ! ${fish.name} x${mult} → 💰${formatNumber(reward)}`, 'gold');
  } else {
    notify(`🎰 Провал! ${fish.name} потеряна`, 'error');
  }

  updateAllUI();
  saveGame();
  renderCasino();
}

// ============================================================
// === СБРОС ===
// ============================================================

let resetCode = null;

function generateResetCode() {
  let code = '';
  for (let i = 0; i < 7; i++) {
    if (i === 0) code += Math.floor(Math.random() * 9) + 1;
    else code += Math.floor(Math.random() * 10);
  }
  return code;
}

function openResetModal() {
  resetCode = generateResetCode();
  $('resetCode1').textContent = resetCode;
  $('resetCode2').textContent = resetCode;
  const input1 = $('resetInput1');
  const input2 = $('resetInput2');
  input1.value = '';
  input2.value = '';
  input1.classList.remove('error');
  input2.classList.remove('error');
  $('resetError1').textContent = '';
  $('resetError2').textContent = '';
  $('resetStep1').classList.remove('hidden');
  $('resetStep2').classList.add('hidden');
  $('resetModal').classList.add('active');
  setTimeout(() => input1.focus(), 100);
}

function confirmResetStep1() {
  const input = $('resetInput1');
  const err = $('resetError1');
  const value = input.value.trim();
  if (value.length !== 7) {
    input.classList.add('error');
    err.textContent = 'Нужно ровно 7 цифр';
    setTimeout(() => input.classList.remove('error'), 500);
    return;
  }
  if (value !== resetCode) {
    input.classList.add('error');
    err.textContent = '❌ Неверный код';
    setTimeout(() => input.classList.remove('error'), 500);
    return;
  }
  err.textContent = '';
  $('resetStep1').classList.add('hidden');
  $('resetStep2').classList.remove('hidden');
  setTimeout(() => $('resetInput2').focus(), 100);
}

function confirmResetStep2() {
  const input = $('resetInput2');
  const err = $('resetError2');
  const value = input.value.trim();
  if (value.length !== 7) {
    input.classList.add('error');
    err.textContent = 'Нужно ровно 7 цифр';
    setTimeout(() => input.classList.remove('error'), 500);
    return;
  }
  if (value !== resetCode) {
    input.classList.add('error');
    err.textContent = '❌ Неверный код';
    setTimeout(() => input.classList.remove('error'), 500);
    return;
  }
  performFullReset();
}

function performFullReset() {
  localStorage.removeItem(SAVE_KEY);
  gameState.totalCaught = 0;
  gameState.coins = 0;
  gameState.inventory = {};
  gameState.caughtSpecies = {};
  gameState.aquarium = [];
  gameState.bestValue = 0;
  gameState.minigameTokens = 0;
  gameState.rod2Enabled = true;
  gameState.lastMinigameTime = 0;
  gameState.buff = { luckBoost: 0, speedBoost: 0, sellBoost: 0, expiresAt: 0 };
  gameState.rat = { state: 'hungry', visible: true, fedUntil: 0 };
  gameState.upgrades = {
    luck: 0, autoroll: false, customAutoroll: false, aqLevel: 0,
    fastRod: 0, minigames: false, extraRod: 0, casino: false, rat: false,
  };
  gameState.autorollFilters = { rarities: [], species: [], minPrice: 0 };
  gameState.autorollActive = false;
  manualRollsCount = 0;
  pendingCatch = null;
  for (const k in qtyState) delete qtyState[k];
  stopAutoroll();
  decisionRow.classList.remove('active');
  $('resetModal').classList.remove('active');
  saveGame();
  updateAllUI();
  notify('💀 Прогресс полностью сброшен!', 'error');
}

// ============================================================
// === СОБЫТИЯ ===
// ============================================================

rollBtn.addEventListener('click', () => castRod(false));
keepBtn.addEventListener('click', decideKeep);
sellBtn.addEventListener('click', decideSell);

rod2Toggle.addEventListener('click', () => {
  gameState.rod2Enabled = !gameState.rod2Enabled;
  notify(gameState.rod2Enabled ? '🎏 Вторая удочка ВКЛ' : '🎏 Вторая удочка ВЫКЛ');
  updateAllUI();
  saveGame();
});

autorollToggle.addEventListener('click', () => {
  if (!gameState.upgrades.autoroll) { notify('Купите Автопрокат', 'error'); return; }
  if (!gameState.autorollActive) {
    gameState.autorollActive = true;
    notify('Авторолл ВКЛЮЧЁН');
    startAutoroll();
  } else {
    gameState.autorollActive = false;
    notify('Авторолл ВЫКЛЮЧЕН');
    stopAutoroll();
  }
  updateAutorollVisual();
});

autorollSettingsBtn.addEventListener('click', () => {
  if (!gameState.upgrades.customAutoroll) { notify('Купите "Настраиваемый авторолл"', 'error'); return; }
  renderAutorollSettings();
  $('autorollModal').classList.add('active');
});

$('shopBtn').addEventListener('click', () => {
  renderShop();
  $('shopModal').classList.add('active');
});
$('bookBtn').addEventListener('click', () => {
  const total = fishList.length;
  const caught = Object.keys(gameState.caughtSpecies).length;
  $('bookProgress').textContent = `${caught} / ${total}`;
  $('bookTotalCaught').textContent = gameState.totalCaught;
  $('bookBestValue').textContent = formatNumber(gameState.bestValue);
  renderBook();
  $('bookModal').classList.add('active');
});
$('inventoryBtn').addEventListener('click', () => {
  renderInventoryModal();
  $('inventoryModal').classList.add('active');
});
$('aquariumBtn').addEventListener('click', () => {
  renderAquarium();
  $('aquariumModal').classList.add('active');
});
$('minigameBtn').addEventListener('click', () => {
  renderMinigames();
  $('minigameModal').classList.add('active');
});
$('casinoBtn').addEventListener('click', () => {
  renderCasino();
  $('casinoModal').classList.add('active');
});

$('buyTokenBtn').addEventListener('click', () => {
  if (gameState.coins < 1000) { notify('Недостаточно монет!', 'error'); return; }
  if (gameState.minigameTokens >= MINIGAME_TOKEN_MAX) {
    notify('🎯 Лимит жетонов (15)', 'error');
    return;
  }
  gameState.coins -= 1000;
  gameState.minigameTokens += 1;
  notify('🎯 Куплен жетон!', 'gold');
  updateAllUI();
  saveGame();
  renderMinigames();
});

$('minPriceSlider').addEventListener('input', e => {
  gameState.autorollFilters.minPrice = parseInt(e.target.value) || 0;
  $('minPriceValue').textContent = formatNumber(gameState.autorollFilters.minPrice);
  saveGame();
});

$('casinoBackBtn').addEventListener('click', () => {
  casinoSelectedFishId = null;
  $('casinoStep1').classList.remove('hidden');
  $('casinoStep2').classList.add('hidden');
  renderCasinoFishList();
});

$('ratFeedBtn').addEventListener('click', openRatFeedModal);
$('ratMiniBtn').addEventListener('click', () => {
  gameState.rat.visible = true;
  updateRatUI();
  saveGame();
});
$('ratToggleBtn').addEventListener('click', () => {
  gameState.rat.visible = false;
  updateRatUI();
  saveGame();
});

$('resetBtn').addEventListener('click', openResetModal);
$('resetConfirm1').addEventListener('click', confirmResetStep1);
$('resetConfirm2').addEventListener('click', confirmResetStep2);
$('resetInput1').addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmResetStep1();
});
$('resetInput2').addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmResetStep2();
});

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-close');
    $(id).classList.remove('active');
  });
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('active');
  });
});

// ============================================================
// === ПУЗЫРИ ===
// ============================================================

function createBubbles() {
  for (let i = 0; i < 25; i++) {
    const bubble = document.createElement('div');
    bubble.classList.add('bubble');
    const size = Math.random() * 30 + 8;
    bubble.style.width = size + 'px';
    bubble.style.height = size + 'px';
    bubble.style.left = Math.random() * 100 + 'vw';
    bubble.style.animationDuration = (Math.random() * 12 + 10) + 's';
    bubble.style.animationDelay = Math.random() * 12 + 's';
    document.body.appendChild(bubble);
  }
}
createBubbles();

// ============================================================
// === ИНИЦИАЛИЗАЦИЯ ===
// ============================================================

const ok = checkMultitab();
if (ok) {
  startHeartbeat();
  loadGame();
  updateAllUI();
  setTimeout(updateAllUI, 100);
  // Показ лога обновлений
  setTimeout(showUpdateLog, 400);
}