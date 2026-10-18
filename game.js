// ============================================================
// === СЧЁТЧИК ПОЙМАНО (в начале скрипта) ===
// ============================================================

let totalCaughtGlobal = 0;
let manualRollsCount = 0;

// ============================================================
// === ЛОГ ОБНОВЛЕНИЙ ===
// ============================================================

const CURRENT_VERSION = 'v1.8';
const UPDATE_LOG_KEY = 'fih-game-last-seen-version';

const UPDATE_LOG_CONTENT = `
  <ul>
    <li>🏦 <strong>Банк</strong> — новый апгрейд! Храните деньги под проценты (до 25%/час). Открывается после Крысы</li>
    <li>💳 <strong>Кредит</strong> — на 5 уровне банка можно взять кредит под 20%. Не вернёте вовремя — ждите последствий!</li>
    <li>⚖️ <strong>Казино</strong> — шансы повышены, но при проигрыше теперь списывается и стоимость рыбы</li>
    <li>🐠 <strong>Аквариум</strong> — теперь даёт буст к удаче (экзотика лучше ультимативов!)</li>
    <li>📖 <strong>Индекс</strong> — показывает текущие шансы с учётом всех бафов и улучшений</li>
    <li>⚖️ <strong>Баланс</strong> — каждая следующая редкость строго реже предыдущей</li>
  </ul>
  <div class="ul-hint">Удачи на рыбалке!</div>
`;

function showUpdateLog() {
  const lastSeen = localStorage.getItem(UPDATE_LOG_KEY);
  if (lastSeen === CURRENT_VERSION) return;

  const logEl = document.getElementById('updateLog');
  const bodyEl = document.getElementById('updateLogBody');
  if (!logEl || !bodyEl) return;

  bodyEl.innerHTML = `<div class="ul-version">${CURRENT_VERSION}</div>${UPDATE_LOG_CONTENT}`;
  logEl.classList.remove('hidden');
  logEl.classList.remove('closing');

  clearTimeout(logEl._timer);
  logEl._timer = setTimeout(() => {
    hideUpdateLog();
  }, 15000);
}

function hideUpdateLog() {
  const logEl = document.getElementById('updateLog');
  if (!logEl) return;
  logEl.classList.add('closing');
  setTimeout(() => {
    logEl.classList.add('hidden');
    logEl.classList.remove('closing');
  }, 400);
  localStorage.setItem(UPDATE_LOG_KEY, CURRENT_VERSION);
}

const updateLogCloseBtn = document.getElementById('updateLogClose');
if (updateLogCloseBtn) updateLogCloseBtn.addEventListener('click', hideUpdateLog);

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
      bank: gameState.bank,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Save error', e);
  }
}

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveGame, 1000);
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
        luck: 0, autoroll: false, customAutoroll: false, aqLevel: 0,
        fastRod: 0, minigames: false, extraRod: 0, casino: false, rat: false,
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
      bank: Object.assign({
        level: 0, balance: 0, lastTick: Date.now(),
        credit: { active: false, amount: 0, owed: 0, dueAt: 0 },
        debt: 0, penaltyLevel: 0,
      }, data.bank || {}),
    });
    
    // Оффлайн проценты не начисляются
    gameState.bank.lastTick = Date.now();
    return true;
  } catch (e) {
    console.warn('Load error', e);
    return false;
  }
}

setInterval(saveGame, 15000);
window.addEventListener('beforeunload', saveGame);

// ============================================================
// === КОНСТАНТЫ ===
// ============================================================

const rarityMultiplier = {
  common: 1, uncommon: 2.2, rare: 6, epic: 14,
  legendary: 45, exotic: 120, mythic: 300, ultimate: 900
};

const rarityNames = {
  common: 'Обычная', uncommon: 'Необычная', rare: 'Редкая',
  epic: 'Эпическая', legendary: 'Легендарная', exotic: 'Экзотическая',
  mythic: 'Мифическая', ultimate: 'УЛЬТИМАТИВНАЯ'
};

const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'exotic', 'mythic', 'ultimate'];

const fishList = [
  { id: 'perch',      name: 'Окунь',              emoji: '🐟', rarity: 'common',    chance: 33.0,   price: 5 },
  { id: 'crucian',    name: 'Карась',             emoji: '🐠', rarity: 'common',    chance: 27.0,   price: 4 },
  { id: 'roach',      name: 'Плотва',             emoji: '🐟', rarity: 'common',    chance: 21.0,   price: 3 },
  { id: 'pike',       name: 'Щука',               emoji: '🐡', rarity: 'uncommon',  chance: 7.0,    price: 15 },
  { id: 'zander',     name: 'Судак',              emoji: '🐟', rarity: 'uncommon',  chance: 5.0,    price: 18 },
  { id: 'carp',       name: 'Карп',               emoji: '🐠', rarity: 'uncommon',  chance: 3.5,    price: 20 },
  { id: 'catfish',    name: 'Сом',                emoji: '🐋', rarity: 'rare',      chance: 1.5,    price: 60 },
  { id: 'trout',      name: 'Форель',             emoji: '🐟', rarity: 'rare',      chance: 1.0,    price: 80 },
  { id: 'octopus',    name: 'Осьминог',           emoji: '🐙', rarity: 'rare',      chance: 0.7,    price: 100 },
  { id: 'shark',      name: 'Акула',              emoji: '🦈', rarity: 'epic',      chance: 0.3,    price: 250 },
  { id: 'swordfish',  name: 'Меч-рыба',           emoji: '🗡️', rarity: 'epic',      chance: 0.2,    price: 300 },
  { id: 'sturgeon',   name: 'Осётр',              emoji: '🐟', rarity: 'epic',      chance: 0.15,   price: 400 },
  { id: 'whale',      name: 'Кит',                emoji: '🐳', rarity: 'legendary', chance: 0.08,   price: 500 },
  { id: 'crab',       name: 'Камчатский Краб',    emoji: '🦀', rarity: 'legendary', chance: 0.05,   price: 800 },
  { id: 'manta',      name: 'Манта',              emoji: '🐟', rarity: 'legendary', chance: 0.04,   price: 900 },
  { id: 'searabbit',  name: 'Морской Кролик',     emoji: '🐰', rarity: 'exotic',    chance: 0.020,  price: 6000 },
  { id: 'seaurchin',  name: 'Морской Ёж',         emoji: '🦔', rarity: 'exotic',    chance: 0.015,  price: 7000 },
  { id: 'coelacanth', name: 'Латимерия',          emoji: '🐟', rarity: 'mythic',    chance: 0.012,  price: 1500 },
  { id: 'giantsquid', name: 'Гигантский Кальмар', emoji: '🦑', rarity: 'mythic',    chance: 0.008,  price: 2000 },
  { id: 'bluewhale',  name: 'Синий Кит',          emoji: '🌈', rarity: 'ultimate',  chance: 0.006,  price: 10000 },
  { id: 'megamouth',  name: 'Большерот',          emoji: '🌈', rarity: 'ultimate',  chance: 0.004,  price: 8000 },
  { id: 'greenland',  name: 'Гренландская Акула', emoji: '🌈', rarity: 'ultimate',  chance: 0.003,  price: 12000 },
];

const AQUARIUM_LEVELS = [
  { level: 0, slots: 1 }, { level: 1, slots: 2 }, { level: 2, slots: 3 },
  { level: 3, slots: 4 }, { level: 4, slots: 5 },
];

const BANK_LEVELS = [
  { level: 0, limit: 0, rate: 0 },
  { level: 1, limit: 100000, rate: 5 },
  { level: 2, limit: 1000000, rate: 8 },
  { level: 3, limit: 10000000, rate: 12 },
  { level: 4, limit: 100000000, rate: 18 },
  { level: 5, limit: 1000000000, rate: 25 },
];

function getAqSlots() {
  const lvl = Math.max(0, Math.min(gameState.upgrades.aqLevel || 0, AQUARIUM_LEVELS.length - 1));
  return AQUARIUM_LEVELS[lvl].slots;
}

function getBankInfo() {
  return BANK_LEVELS[Math.max(0, Math.min(gameState.bank.level || 0, 5))];
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
  totalCaught: 0, coins: 0, inventory: {}, caughtSpecies: {},
  aquarium: [], bestValue: 0, minigameTokens: 0,
  buff: { luckBoost: 0, speedBoost: 0, sellBoost: 0, expiresAt: 0 },
  rod2Enabled: true, lastMinigameTime: 0,
  rat: { state: 'hungry', visible: true, fedUntil: 0 },
  upgrades: {
    luck: 0, autoroll: false, customAutoroll: false, aqLevel: 0,
    fastRod: 0, minigames: false, extraRod: 0, casino: false, rat: false,
  },
  autorollFilters: { rarities: [], species: [], minPrice: 0 },
  autorollActive: false,
  bank: {
    level: 0, balance: 0, lastTick: Date.now(),
    credit: { active: false, amount: 0, owed: 0, dueAt: 0 },
    debt: 0, penaltyLevel: 0,
  }
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
    id: 'customAutoroll', icon: '⚙️', name: 'Настраиваемый авторолл',
    desc: 'Открывает фильтры авторолла: редкости, виды рыб, мин. цена продажи',
    maxLevel: 1, baseCost: 8000, costMult: 1,
    isUnlocked: () => gameState.upgrades.autoroll,
    getLevel: () => gameState.upgrades.customAutoroll ? 1 : 0,
    onBuy: () => { gameState.upgrades.customAutoroll = true; },
    lockedHint: 'Требуется Автопрокат'
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
    desc: 'Расширяет аквариум: 1 слот → 2 → 3 → 4 → 5. Буст к цене и удаче',
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
  {
    id: 'bank', icon: '🏦', name: 'Банк',
    desc: 'Храните деньги под проценты (до 25%/час). На 5 уровне — кредиты',
    maxLevel: 5, baseCost: 50000, costMult: 2.5,
    isUnlocked: () => gameState.upgrades.rat,
    getLevel: () => gameState.bank.level,
    onBuy: () => { gameState.bank.level++; },
    lockedHint: 'Требуется Крыса'
  }
];

const minigamesList = [
  { id: 'clicker', icon: '👆', name: 'Точный клик', desc: 'Кликни 10 раз за 3 секунды. +2000 монет', run: runClickGame },
  { id: 'guess', icon: '🎲', name: 'Угадай число', desc: 'Угадай число 1-5. Правильно = 2000 монет', run: runGuessGame },
  { id: 'reaction', icon: '⚡', name: 'Реакция', desc: 'Жди зелёного и кликай. +2000 монет', run: runReactionGame },
];

const casinoChances = {
  common:    { 2: 92, 3: 65, 4: 35, 5: 15 },
  uncommon:  { 2: 84, 3: 55, 4: 27, 5: 11 },
  rare:      { 2: 75, 3: 45, 4: 20, 5: 9 },
  epic:      { 2: 65, 3: 35, 4: 15, 5: 6 },
  legendary: { 2: 55, 3: 27, 4: 11, 5: 5 },
  exotic:    { 2: 45, 3: 22, 4: 9,  5: 4 },
  mythic:    { 2: 35, 3: 16, 4: 7,  5: 3 },
  ultimate:  { 2: 30, 3: 14, 4: 6,  5: 2.5 },
};

// ============================================================
// === DOM ===
// ============================================================

const $ = id => document.getElementById(id);

const rollBtn = $('rollBtn');
const fishEmoji = $('fishEmoji');
const fishName = $('fishName');
const fishRarity = $('fishRarity');
const fishValue = $('fishValue');
const catchDisplay = $('catchDisplay');
const coinsDisplay = $('coinsDisplay');
const shopCoins = $('shopCoins');
const inventoryCoins = $('inventoryCoins');
const notificationEl = $('notification');
const autorollToggle = $('autorollToggle');
const autorollIcon = $('autorollIcon');
const autorollSettingsBtn = $('autorollSettingsBtn');
const aqBadge = $('aqBadge');
const aqBoostValue = $('aqBoostValue');
const aqCount = $('aqCount');
const decisionRow = $('decisionRow');
const keepBtn = $('keepBtn');
const sellBtn = $('sellBtn');
const decPrice = $('decPrice');
const extraBar = $('extraBar');
const minigameBadge = $('minigameBadge');
const rod2ToggleRow = $('rod2ToggleRow');
const rod2Toggle = $('rod2Toggle');
const rod2State = $('rod2State');
const buffBar = $('buffBar');

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
// === БАФЫ И УДАЧА ===
// ============================================================

function isBuffActive() { return gameState.buff.expiresAt > Date.now(); }
function isRatFed() {
  return gameState.upgrades.rat && gameState.rat.state === 'happy' && gameState.rat.fedUntil > Date.now();
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
  scheduleSave();
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
// === RNG И ЦЕНЫ ===
// ============================================================

function getAquariumLuckBonus() {
  let bonus = 0;
  for (const aq of gameState.aquarium) {
    const fish = fishList.find(f => f.id === aq.fishId);
    if (!fish) continue;
    if (fish.rarity === 'ultimate') bonus += 0.005; // +0.5%
    if (fish.rarity === 'exotic')   bonus += 0.015; // +1.5%
  }
  return bonus;
}

function rollFish() {
  const luckLevel = gameState.upgrades.luck;
  const buffLuck = getBuffLuckBonus() / 100;
  const baseLuckBoost = 1 + luckLevel * 0.12 + buffLuck;
  const aqLuckBonus = getAquariumLuckBonus();

  const weighted = fishList.map(f => {
    let weight = f.chance;
    const rarityIdx = rarityOrder.indexOf(f.rarity);
    if (rarityIdx >= 4) {
      weight *= baseLuckBoost;
      weight *= (1 + aqLuckBonus);
    } else if (rarityIdx === 3) {
      weight *= (1 + luckLevel * 0.08);
    }
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

function calcCurrentChances() {
  const luckLevel = gameState.upgrades.luck;
  const buffLuck = getBuffLuckBonus() / 100;
  const baseLuckBoost = 1 + luckLevel * 0.12 + buffLuck;
  const aqLuckBonus = getAquariumLuckBonus();

  let totalWeight = 0;
  const weights = fishList.map(f => {
    let weight = f.chance;
    const rarityIdx = rarityOrder.indexOf(f.rarity);
    if (rarityIdx >= 4) {
      weight *= baseLuckBoost;
      weight *= (1 + aqLuckBonus);
    } else if (rarityIdx === 3) {
      weight *= (1 + luckLevel * 0.08);
    }
    totalWeight += weight;
    return { fish: f, weight };
  });

  const result = {};
  weights.forEach(({ fish, weight }) => {
    result[fish.id] = {
      percent: (weight / totalWeight) * 100,
      oneIn: weight > 0 ? Math.round(totalWeight / weight) : Infinity,
    };
  });
  return result;
}

function calcFishValue(fish) {
  return Math.floor(fish.price * rarityMultiplier[fish.rarity]);
}

function getAquariumSellBonus() {
  let bonus = 0;
  for (const aq of gameState.aquarium) {
    const fish = fishList.find(f => f.id === aq.fishId);
    if (!fish) continue;
    if (fish.rarity === 'ultimate') bonus += 0.10;
    if (fish.rarity === 'exotic')   bonus += 0.25;
  }
  return bonus;
}

function applyAquariumBoost(value) {
  const aquariumBoost = getAquariumSellBonus();
  const buffSellBoost = getBuffSellBonus() / 100;
  return Math.floor(value * (1 + aquariumBoost + buffSellBoost));
}

// ============================================================
// === УЧЁТ УЛОВА ===
// ============================================================

function registerCatch(fish, value) {
  gameState.totalCaught++;
  totalCaughtGlobal++;
  if (value > gameState.bestValue) gameState.bestValue = value;
  if (!gameState.caughtSpecies[fish.id]) gameState.caughtSpecies[fish.id] = true;
}

// ============================================================
// === РОЛЛ ===
// ============================================================

let isRolling = false;
let pendingCatch = null;

async function castRod(silent = false) {
  if (isRolling) return;
  if (pendingCatch) return;

  isRolling = true;
  decisionRow.classList.remove('active');
  let spinInterval = null;

  try {
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
    spinInterval = setInterval(() => {
      fishEmoji.textContent = spinEmojis[Math.floor(Math.random() * spinEmojis.length)];
    }, 70);

    const baseDelay = silent ? 4000 : 2200;
    const delay = Math.floor(baseDelay * rodSpeed);
    await new Promise(r => setTimeout(r, delay));

    clearInterval(spinInterval);
    spinInterval = null;
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

    registerCatch(fish, value);

    const extraChance = gameState.rod2Enabled ? (gameState.upgrades.extraRod || 0) * 0.08 : 0;
    let bonusFish = null, bonusValue = 0;
    if (extraChance > 0 && Math.random() < extraChance) {
      bonusFish = rollFish();
      bonusValue = applyAquariumBoost(calcFishValue(bonusFish));
      registerCatch(bonusFish, bonusValue);
    }

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

      if (bonusFish) {
        notify(`🎏 Двойной улов: +${bonusFish.name}!`, 'gold');
        pendingCatch = { fish, value, bonusFish, bonusValue };
      } else {
        pendingCatch = { fish, value };
      }

      decPrice.textContent = `+💰${formatNumber(value)}`;
      decisionRow.classList.add('active');
      rollBtn.disabled = true;
      updateAllUI();
      scheduleSave();
      return;
    }

    handleFishCatch(fish, value);
    if (bonusFish) handleFishCatch(bonusFish, bonusValue);

    updateAllUI();
    scheduleSave();
  } catch (e) {
    console.error('castRod error', e);
    notify('Ошибка ролла. Попробуйте ещё раз.', 'error');
    catchDisplay.classList.remove('rolling');
    fishEmoji.classList.remove('spinning');
    if (!silent) rollBtn.disabled = false;
  } finally {
    if (spinInterval) clearInterval(spinInterval);
    isRolling = false;
  }
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
  scheduleSave();
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
  scheduleSave();
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
  scheduleSave();
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
  scheduleSave();
}

function removeFromAquarium(idx) {
  if (idx < 0 || idx >= gameState.aquarium.length) return;
  const aq = gameState.aquarium[idx];
  const fish = fishList.find(f => f.id === aq.fishId);
  gameState.inventory[aq.fishId] = (gameState.inventory[aq.fishId] || 0) + 1;
  gameState.aquarium.splice(idx, 1);
  notify(`${fish.name} возвращён в инвентарь`);
  updateAllUI();
  scheduleSave();
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
  } else {
    stateEl.textContent = 'голодна';
    stateEl.style.color = '#fbbf24';
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
    card.querySelector('.btn-sell').addEventListener('click', () => feedRat(fishId));
    container.appendChild(card);
  });

  $('ratFeedModal').classList.add('active');
}

function feedRat(fishId) {
  if (!gameState.upgrades.rat) return;
  const have = gameState.inventory[fishId] || 0;
  if (have < 1) return;
  const fish = fishList.find(f => f.id === fishId);
  if (!fish) return;

  gameState.inventory[fishId]--;
  if (gameState.inventory[fishId] <= 0) delete gameState.inventory[fishId];

  gameState.rat.state = 'happy';
  gameState.rat.fedUntil = Date.now() + RAT_FEED_DURATION;
  notify(`🐀 Крыса довольна! +1% удача, +2% цена (5 мин)`, 'green');
  updateRatUI();
  updateAllUI();
  scheduleSave();
  $('ratFeedModal').classList.remove('active');
}

// ============================================================
// === БАНК ===
// ============================================================

let bankTickInterval = null;

function startBankTick() {
  if (bankTickInterval) clearInterval(bankTickInterval);
  bankTickInterval = setInterval(() => {
    if (gameState.bank.level === 0) return;
    if (gameState.bank.debt > 0) return;
    if (gameState.bank.credit.active && Date.now() > gameState.bank.credit.dueAt) return;
    if (gameState.bank.balance <= 0) return;

    const now = Date.now();
    const elapsed = now - gameState.bank.lastTick;
    // Начисляем только если прошло >= 10 сек и вкладка активна (не оффлайн)
    if (elapsed >= 10000 && document.visibilityState === 'visible') {
      const info = getBankInfo();
      const ratePerSec = (info.rate / 100) / 3600;
      const seconds = elapsed / 1000;
      const gain = Math.floor(gameState.bank.balance * ratePerSec * seconds);
      
      if (gain > 0) {
        gameState.bank.balance += gain;
        // Не превышаем лимит
        if (gameState.bank.balance > info.limit) {
          const overflow = gameState.bank.balance - info.limit;
          gameState.bank.balance = info.limit;
          // Возвращаем излишек в кошелёк
          gameState.coins += overflow;
          notify(`🏦 Лимит банка достигнут. Излишек (${formatNumber(overflow)}) переведён в кошелёк`, 'gold');
        }
        scheduleSave();
        if ($('bankModal').classList.contains('active')) renderBankModal();
      }
      gameState.bank.lastTick = now;
    }
  }, 5000);
}

function getTotalCapital() {
  let fishValue = 0;
  for (const [fishId, count] of Object.entries(gameState.inventory)) {
    const fish = fishList.find(f => f.id === fishId);
    if (!fish) continue;
    fishValue += calcFishValue(fish) * count;
  }
  return gameState.coins + gameState.bank.balance + fishValue;
}

function openBankModal() {
  if (gameState.bank.level === 0) {
    notify('Купите Банк в магазине!', 'error');
    return;
  }
  renderBankModal();
  $('bankModal').classList.add('active');
}

function renderBankModal() {
  const modal = $('bankModal');
  if (!modal) return;
  const info = getBankInfo();
  const bank = gameState.bank;
  
  $('bankLevelInfo').textContent = `Уровень ${bank.level}/5 · ${info.rate}% в час · Лимит: ${formatNumber(info.limit)}`;
  $('bankBalance').textContent = formatNumber(bank.balance);
  $('bankLimit').textContent = formatNumber(info.limit);
  $('bankCoins').textContent = formatNumber(gameState.coins);

  const creditBlock = $('bankCreditBlock');
  if (bank.credit.active) {
    const leftMs = Math.max(0, bank.credit.dueAt - Date.now());
    const leftSec = Math.ceil(leftMs / 1000);
    const m = Math.floor(leftSec / 60);
    const s = leftSec % 60;
    const timeStr = `${m}:${s.toString().padStart(2, '0')}`;
    creditBlock.innerHTML = `
      <div class="credit-info urgent">
        <div>💳 Кредит: <strong>${formatNumber(bank.credit.owed)}</strong> (взято ${formatNumber(bank.credit.amount)})</div>
        <div class="credit-timer">⏳ Вернуть через: <strong>${timeStr}</strong></div>
        <button class="bank-btn repay" id="repayCreditBtn">Выплатить кредит</button>
      </div>
    `;
    $('repayCreditBtn').addEventListener('click', repayCredit);
  } else if (bank.debt > 0) {
    creditBlock.innerHTML = `
      <div class="credit-info danger">
        <div>🚨 Долг: <strong>${formatNumber(bank.debt)}</strong></div>
        <div style="font-size:12px;margin-top:4px;">Банк заблокирован. Погасите долг.</div>
        <button class="bank-btn repay" id="repayDebtBtn">Погасить долг</button>
      </div>
    `;
    $('repayDebtBtn').addEventListener('click', repayDebt);
  } else if (bank.level === 5) {
    const maxCredit = Math.floor(getTotalCapital() * 0.5);
    creditBlock.innerHTML = `
      <div class="credit-info">
        <div>Доступный кредит: <strong>${formatNumber(maxCredit)}</strong></div>
        <div style="font-size:12px;opacity:0.7;">Процент: 20% · Срок: 10 минут</div>
        <input type="number" id="creditAmountInput" placeholder="Сумма кредита" min="1000" max="${maxCredit}" step="1000">
        <button class="bank-btn credit" id="takeCreditBtn">Взять кредит</button>
      </div>
    `;
    $('takeCreditBtn').addEventListener('click', () => {
      const val = parseInt($('creditAmountInput').value) || 0;
      takeCredit(val, maxCredit);
    });
  } else {
    creditBlock.innerHTML = `<div class="credit-info"><div style="opacity:0.7;">Кредит доступен на 5 уровне банка.</div></div>`;
  }

  const penaltyBlock = $('bankPenaltyBlock');
  if (bank.penaltyLevel > 0) {
    const levelNames = ['', '⚠️ Предупреждение', '🚫 Блокировка + Штраф', '💀 Конфискация'];
    const levelColors = ['', '#fbbf24', '#f97316', '#f43f5e'];
    penaltyBlock.innerHTML = `
      <div class="penalty-banner" style="border-color:${levelColors[bank.penaltyLevel]};">
        <div style="color:${levelColors[bank.penaltyLevel]};font-weight:700;">${levelNames[bank.penaltyLevel]}</div>
        <div style="font-size:12px;margin-top:4px;">Нарушение кредита. Погасите долг для снятия ограничений.</div>
      </div>
    `;
  } else {
    penaltyBlock.innerHTML = '';
  }

  // Кнопки вклада/снятия
  $('depositBtn').disabled = gameState.coins <= 0 || bank.balance >= info.limit || bank.debt > 0;
  $('withdrawBtn').disabled = bank.balance <= 0 || bank.debt > 0;

  $('depositInput').value = '';
  $('withdrawInput').value = '';
}

function depositToBank(amount) {
  const info = getBankInfo();
  if (amount <= 0) return;
  if (amount > gameState.coins) amount = gameState.coins;
  if (gameState.bank.balance + amount > info.limit) {
    amount = info.limit - gameState.bank.balance;
  }
  if (amount <= 0) { notify('Лимит банка достигнут', 'error'); return; }
  gameState.coins -= amount;
  gameState.bank.balance += amount;
  notify(`🏦 Положено ${formatNumber(amount)} в банк`, 'gold');
  gameState.bank.lastTick = Date.now();
  updateAllUI();
  renderBankModal();
  scheduleSave();
}

function withdrawFromBank(amount) {
  if (amount <= 0) return;
  if (amount > gameState.bank.balance) amount = gameState.bank.balance;
  gameState.bank.balance -= amount;
  gameState.coins += amount;
  notify(`🏦 Снято ${formatNumber(amount)} из банка`, 'gold');
  updateAllUI();
  renderBankModal();
  scheduleSave();
}

function takeCredit(amount, maxCredit) {
  if (gameState.bank.credit.active || gameState.bank.debt > 0) return;
  if (amount <= 0 || amount > maxCredit) {
    notify(`Сумма должна быть от 1 до ${formatNumber(maxCredit)}`, 'error');
    return;
  }
  gameState.coins += amount;
  gameState.bank.credit = {
    active: true,
    amount: amount,
    owed: Math.floor(amount * 1.2),
    dueAt: Date.now() + 10 * 60 * 1000,
  };
  notify(`💳 Взят кредит ${formatNumber(amount)}. Вернуть ${formatNumber(gameState.bank.credit.owed)} за 10 минут`, 'gold');
  updateAllUI();
  renderBankModal();
  scheduleSave();
}

function repayCredit() {
  const credit = gameState.bank.credit;
  if (!credit.active) return;
  const owed = credit.owed;
  if (gameState.coins + gameState.bank.balance < owed) {
    notify('Недостаточно средств для выплаты кредита!', 'error');
    return;
  }
  // Сначала из кошелька, потом из банка
  let remaining = owed;
  if (gameState.coins >= remaining) {
    gameState.coins -= remaining;
    remaining = 0;
  } else {
    remaining -= gameState.coins;
    gameState.coins = 0;
    gameState.bank.balance -= remaining;
    remaining = 0;
  }
  gameState.bank.credit = { active: false, amount: 0, owed: 0, dueAt: 0 };
  gameState.bank.penaltyLevel = 0;
  notify('✅ Кредит выплачен!', 'green');
  updateAllUI();
  renderBankModal();
  scheduleSave();
}

function repayDebt() {
  const debt = gameState.bank.debt;
  if (debt <= 0) return;
  const available = gameState.coins + gameState.bank.balance;
  if (available <= 0) {
    notify('Нечем платить!', 'error');
    return;
  }
  const pay = Math.min(debt, available);
  let remaining = pay;
  if (gameState.coins >= remaining) {
    gameState.coins -= remaining;
    remaining = 0;
  } else {
    remaining -= gameState.coins;
    gameState.coins = 0;
    gameState.bank.balance -= remaining;
  }
  gameState.bank.debt -= pay;
  notify(`💸 Выплачено ${formatNumber(pay)} в счёт долга`, 'gold');
  if (gameState.bank.debt <= 0) {
    gameState.bank.debt = 0;
    gameState.bank.penaltyLevel = 0;
    notify('✅ Долг полностью погашен!', 'green');
  }
  updateAllUI();
  renderBankModal();
  scheduleSave();
}

function checkCreditOverdue() {
  const bank = gameState.bank;
  const credit = bank.credit;
  if (!credit.active) return;
  if (Date.now() < credit.dueAt) return;

  // Кредит просрочен — считаем недостачу
  const owed = credit.owed;
  const available = gameState.coins + bank.balance;
  const deficit = Math.max(0, owed - available);
  const deficitPercent = deficit / owed;

  let penaltyLevel = 0;
  if (deficitPercent <= 0) {
    // Всё есть — просто забираем
    repayCreditFromAll();
    return;
  } else if (deficitPercent < 0.10) {
    penaltyLevel = 1;
  } else if (deficitPercent < 0.50) {
    penaltyLevel = 2;
  } else {
    penaltyLevel = 3;
  }

  bank.penaltyLevel = penaltyLevel;

  // Применяем наказание
  if (penaltyLevel >= 3) {
    applySeverePenalty(owed, deficit);
  } else {
    // Для уровней 1-2 просто блокируем банк и оставляем долг
    bank.credit = { active: false, amount: 0, owed: 0, dueAt: 0 };
    bank.debt = deficit;
    showCreditViolationModal(penaltyLevel, owed, deficit);
    notify(`🚨 Нарушение кредита (уровень ${penaltyLevel})! Долг: ${formatNumber(deficit)}`, 'error');
  }

  updateAllUI();
  scheduleSave();
}

function repayCreditFromAll() {
  const bank = gameState.bank;
  let remaining = bank.credit.owed;
  if (gameState.coins >= remaining) {
    gameState.coins -= remaining;
    remaining = 0;
  } else {
    remaining -= gameState.coins;
    gameState.coins = 0;
    bank.balance -= remaining;
    remaining = 0;
  }
  bank.credit = { active: false, amount: 0, owed: 0, dueAt: 0 };
  bank.debt = 0;
  bank.penaltyLevel = 0;
  notify('✅ Кредит автоматически погашен', 'green');
}

function applySeverePenalty(owed, deficit) {
  const bank = gameState.bank;
  let remaining = owed;

  // 1. Кошелёк
  const fromCoins = Math.min(gameState.coins, remaining);
  gameState.coins -= fromCoins;
  remaining -= fromCoins;

  // 2. Банк
  if (remaining > 0) {
    const fromBank = Math.min(bank.balance, remaining);
    bank.balance -= fromBank;
    remaining -= fromBank;
  }

  // 3. Рыбы (с самых дешёвых!)
  if (remaining > 0) {
    const fishEntries = Object.entries(gameState.inventory)
      .map(([id, count]) => {
        const fish = fishList.find(f => f.id === id);
        return { id, count, fish, value: calcFishValue(fish), total: calcFishValue(fish) * count };
      })
      .filter(e => e.fish)
      .sort((a, b) => a.value - b.value); // Сначала дешёвые

    for (const entry of fishEntries) {
      if (remaining <= 0) break;
      while (entry.count > 0 && remaining > 0) {
        const val = entry.value;
        if (remaining >= val) {
          remaining -= val;
          entry.count--;
          gameState.inventory[entry.id]--;
          if (gameState.inventory[entry.id] <= 0) delete gameState.inventory[entry.id];
        } else {
          // Не хватает на целую рыбу — забираем и учитываем остаток как прощённый
          remaining = 0;
          entry.count--;
          gameState.inventory[entry.id]--;
          if (gameState.inventory[entry.id] <= 0) delete gameState.inventory[entry.id];
        }
      }
    }
  }

  // 4. Если всё ещё осталось — записываем остаток как долг
  if (remaining > 0) {
    bank.debt = remaining;
  } else {
    bank.debt = 0;
    bank.penaltyLevel = 0;
  }

  bank.credit = { active: false, amount: 0, owed: 0, dueAt: 0 };
  showCreditViolationModal(3, owed, remaining);
  notify(`💀 Конфискация! Остаток долга: ${formatNumber(remaining)}`, 'error');
}

function showCreditViolationModal(level, owed, deficit) {
  const titles = ['', '⚠️ Предупреждение', '🚫 Блокировка банка', '💀 КОНФИСКАЦИЯ'];
  const messages = [
    '',
    `Вы не выплатили кредит вовремя.\nНедостача: ${formatNumber(deficit)}\nПожалуйста, выплатите долг как можно скорее. Банк продолжает работать.`,
    `Вы не выплатили кредит вовремя.\nНедостача: ${formatNumber(deficit)}\nБанк заблокирован, проценты не начисляются. Деньги не списываются принудительно. Погасите долг для разблокировки.`,
    `Вы не выплатили кредит вовремя.\nНедостача: ${formatNumber(deficit)}\nВСЕ ваши средства (кошелёк, банк, рыбы) конфискованы в счёт долга. Остаток: ${formatNumber(deficit)}. Все будущие доходы будут идти в счёт долга.`
  ];

  const modal = $('creditViolationModal');
  if (!modal) return;
  $('cvmTitle').textContent = titles[level];
  $('cvmMessage').textContent = messages[level];
  $('cvmTitle').style.color = ['', '#fbbf24', '#f97316', '#f43f5e'][level];
  modal.classList.add('active');
}

// ============================================================
// === UI ===
// ============================================================

function updateAllUI() {
  coinsDisplay.textContent = formatNumber(gameState.coins);
  shopCoins.textContent = formatNumber(gameState.coins);
  inventoryCoins.textContent = formatNumber(gameState.coins);

  // Плашка аквариума — скрыта, пока не куплен
  const aqBar = document.querySelector('.aquarium-boost-bar');
  if (aqBar) {
    if (gameState.upgrades.aqLevel === 0 && gameState.aquarium.length === 0) {
      aqBar.style.display = 'none';
    } else {
      aqBar.style.display = 'flex';
    }
  }

  const slots = getAqSlots();
  const aqSellBonus = getAquariumSellBonus();
  const aqLuckBonus = getAquariumLuckBonus();
  aqBadge.textContent = `${gameState.aquarium.length}/${slots}`;
  aqBoostValue.textContent = '+' + Math.floor(aqSellBonus * 100) + '%';
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

  // Плашка банка на главном экране
  const bankBar = $('bankMainBar');
  if (bankBar) {
    if (gameState.bank.level > 0) {
      bankBar.classList.remove('hidden');
      const info = getBankInfo();
      $('bankMainBalance').textContent = formatNumber(gameState.bank.balance);
      $('bankMainRate').textContent = `+${info.rate}%/час`;
    } else {
      bankBar.classList.add('hidden');
    }
  }

  // Таймер кредита на главном экране
  const creditBar = $('creditMainBar');
  if (creditBar) {
    if (gameState.bank.credit.active) {
      creditBar.classList.remove('hidden');
      const left = Math.max(0, gameState.bank.credit.dueAt - Date.now());
      const sec = Math.ceil(left / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      $('creditMainAmount').textContent = formatNumber(gameState.bank.credit.owed);
      $('creditMainTimer').textContent = `${m}:${s.toString().padStart(2, '0')}`;
    } else if (gameState.bank.debt > 0) {
      creditBar.classList.remove('hidden');
      $('creditMainAmount').textContent = formatNumber(gameState.bank.debt);
      $('creditMainTimer').textContent = 'ДОЛГ';
    } else {
      creditBar.classList.add('hidden');
    }
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
          scheduleSave();
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

  renderRaritySummary();

  const sorted = [...fishList].sort((a, b) =>
    rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity)
  );
  const totalChance = fishList.reduce((s, f) => s + f.chance, 0);
  const currentChances = calcCurrentChances();

  sorted.forEach(fish => {
    const isCaught = !!gameState.caughtSpecies[fish.id];
    const basePercent = fish.chance / totalChance * 100;
    const baseStr = formatChancePercent(basePercent);
    const baseOneIn = fish.chance > 0 ? Math.round(totalChance / fish.chance) : '∞';
    
    const cur = currentChances[fish.id];
    const curStr = formatChancePercent(cur.percent);
    const curOneIn = isFinite(cur.oneIn) ? formatNumber(cur.oneIn) : '∞';

    const card = document.createElement('div');
    card.className = 'fish-card';

    const chanceHtml = isCaught ? `
      <div class="fc-meta">🎲 Базовый: <strong>${baseStr}</strong> · 1 из ${formatNumber(baseOneIn)}</div>
      <div class="fc-meta" style="color:#4ade80;">✨ Текущий: <strong>${curStr}</strong> · 1 из ${curOneIn}</div>
    ` : `
      <div class="fc-meta">🎲 Базовый: <strong>${baseStr}</strong> · 1 из ${formatNumber(baseOneIn)}</div>
      <div class="fc-meta" style="color:#4ade80;">✨ Текущий: <strong>${curStr}</strong> · 1 из ${curOneIn}</div>
    `;

    if (isCaught) {
      card.innerHTML = `
        <div class="fc-emoji">${fish.emoji}</div>
        <div class="fc-info">
          <div class="fc-name" style="color: ${getRarityColor(fish.rarity)}">${fish.name}</div>
          <div class="fc-meta">${rarityNames[fish.rarity]} · 💰 ${formatNumber(applyAquariumBoost(calcFishValue(fish)))}</div>
          ${chanceHtml}
        </div>
      `;
    } else {
      card.innerHTML = `
        <div class="fc-emoji" style="filter: brightness(0.2);">❓</div>
        <div class="fc-info">
          <div class="fc-name" style="color: rgba(150,220,255,0.4)">???</div>
          <div class="fc-meta">${rarityNames[fish.rarity]}</div>
          ${chanceHtml}
        </div>
      `;
    }
    container.appendChild(card);
  });
}

function renderRaritySummary() {
  const container = $('raritySummary');
  if (!container) return;
  container.innerHTML = '';

  const totalChance = fishList.reduce((s, f) => s + f.chance, 0);
  const maxChance = Math.max(...rarityOrder.map(r =>
    fishList.filter(f => f.rarity === r).reduce((s, f) => s + f.chance, 0)
  ));

  rarityOrder.forEach(rarity => {
    const fishInRarity = fishList.filter(f => f.rarity === rarity);
    if (fishInRarity.length === 0) return;

    const sum = fishInRarity.reduce((s, f) => s + f.chance, 0);
    const percent = sum / totalChance * 100;
    const color = getRarityColor(rarity);
    const barWidth = maxChance > 0 ? (sum / maxChance) * 100 : 0;

    const row = document.createElement('div');
    row.className = 'rs-row';
    row.innerHTML = `
      <div class="rs-dot" style="background:${color}; color:${color};"></div>
      <div class="rs-label" style="color:${color};">${rarityNames[rarity]}</div>
      <div class="rs-bar-wrap">
        <div class="rs-bar" style="width:${barWidth}%; background:${color};"></div>
      </div>
      <div class="rs-chance">${formatChancePercent(percent)}</div>
    `;
    container.appendChild(row);
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
      const sellBonus = fish.rarity === 'exotic' ? '25' : '10';
      const luckBonus = fish.rarity === 'exotic' ? '1.5' : '0.5';
      slot.innerHTML = `
        <div>${fish.emoji}</div>
        <div class="aq-name">${fish.name}</div>
        <div class="aq-bonus">+${sellBonus}% 💰 · +${luckBonus}% 🍀</div>
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

  const sellBonus = getAquariumSellBonus();
  const luckBonus = getAquariumLuckBonus();
  $('boostValue').textContent = `+${Math.floor(sellBonus * 100)}% 💰 / +${(luckBonus * 100).toFixed(1)}% 🍀`;

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
    card.querySelector('.btn-aquarium').addEventListener('click', () => addToAquarium(fish.id));
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
          <button class="qty-minus" data-fish="${fishId}" ${qty <= 1 ? 'disabled' : ''}>−</button>
          <span class="qty-value" data-fish="${fishId}">${qty}</span>
          <button class="qty-plus" data-fish="${fishId}" ${qty >= count ? 'disabled' : ''}>+</button>
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
      updateQtyControls(fishId);
    });
  });
  container.querySelectorAll('.qty-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const fishId = btn.dataset.fish;
      const max = gameState.inventory[fishId] || 0;
      qtyState[fishId] = Math.min(max, (qtyState[fishId] || max) + 1);
      updateQtyControls(fishId);
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

function updateQtyControls(fishId) {
  const container = $('inventoryList');
  if (!container) return;
  const valueEl = container.querySelector(`.qty-value[data-fish="${fishId}"]`);
  if (valueEl) valueEl.textContent = qtyState[fishId] || 1;
  const minusBtn = container.querySelector(`.qty-minus[data-fish="${fishId}"]`);
  const plusBtn  = container.querySelector(`.qty-plus[data-fish="${fishId}"]`);
  const max = gameState.inventory[fishId] || 0;
  const qty = qtyState[fishId] || 1;
  if (minusBtn) minusBtn.disabled = qty <= 1;
  if (plusBtn)  plusBtn.disabled  = qty >= max;
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
    if (isRolling) return;
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
      scheduleSave();
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
        scheduleSave();
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
      try {
        mg.run();
      } catch (e) {
        console.error('Minigame error', e);
        gameState.minigameTokens += 1;
        notify('Ошибка мини-игры. Жетон возвращён.', 'error');
        updateAllUI();
        scheduleSave();
      }
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
    scheduleSave();
  }
}

function runGuessGame() {
  const target = Math.floor(Math.random() * 5) + 1;

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
          scheduleSave();
        }, 700);
      } else {
        btn.style.background = 'rgba(244,63,94,0.4)';
        btn.style.borderColor = '#f43f5e';
        setTimeout(() => {
          overlay.remove();
          notify(`🎲 Мимо! Было число ${target}`, 'error');
          updateAllUI();
          scheduleSave();
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
  let delayTimer = null;

  delayTimer = setTimeout(() => {
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
      scheduleSave();
    }, 1500);
  }, delay);

  overlay.addEventListener('click', () => {
    if (finished) return;

    if (!ready) {
      finished = true;
      if (delayTimer) clearTimeout(delayTimer);
      overlay.remove();
      notify('⚡ Рано! Жди зелёного', 'error');
      updateAllUI();
      scheduleSave();
      return;
    }

    finished = true;
    if (reactionTimer) clearTimeout(reactionTimer);
    overlay.remove();
    gameState.coins += MINIGAME_REWARD;
    applyMinigameBuff();
    notify(`⚡ Отлично! +${MINIGAME_REWARD} монет и буст`, 'gold');
    updateAllUI();
    scheduleSave();
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
    return rarityOrder.indexOf(fa.rarity) - rarityOrder.indexOf(fb.rarity);
  });

  sorted.forEach(fishId => {
    const fish = fishList.find(f => f.id === fishId);
    const count = gameState.inventory[fishId];
    const baseValue = calcFishValue(fish);

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

  const baseValue = calcFishValue(fish);
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
      <span class="cm-penalty">-${formatNumber(baseValue)} при провале</span>
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
  const baseValue = calcFishValue(fish);
  const chance = casinoChances[fish.rarity][mult];

  gameState.inventory[fishId] -= 1;
  if (gameState.inventory[fishId] <= 0) delete gameState.inventory[fishId];

  const success = Math.random() * 100 < chance;

  if (success) {
    const reward = baseValue * mult;
    gameState.coins += reward;
    notify(`🎰 УСПЕХ! ${fish.name} x${mult} → 💰${formatNumber(reward)}`, 'gold');
  } else {
    // Списываем стоимость рыбы из кошелька (до 0), банк защищён
    const lost = Math.min(baseValue, gameState.coins);
    gameState.coins -= lost;
    const forgiven = baseValue - lost;
    if (forgiven > 0) {
      notify(`🎰 Провал! ${fish.name} потеряна. Списано 💰${formatNumber(lost)} (остаток ${formatNumber(forgiven)} прощён)`, 'error');
    } else {
      notify(`🎰 Провал! ${fish.name} потеряна. Списано 💰${formatNumber(lost)}`, 'error');
    }
  }

  updateAllUI();
  scheduleSave();

  if ((gameState.inventory[fishId] || 0) > 0) {
    casinoSelectedFishId = fishId;
    renderCasinoMultipliers();
  } else {
    renderCasino();
  }
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
  gameState.bank = {
    level: 0, balance: 0, lastTick: Date.now(),
    credit: { active: false, amount: 0, owed: 0, dueAt: 0 },
    debt: 0, penaltyLevel: 0,
  };
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
  scheduleSave();
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

// Банк
const bankBtn = $('bankBtn');
if (bankBtn) bankBtn.addEventListener('click', openBankModal);
const bankMainBar = $('bankMainBar');
if (bankMainBar) bankMainBar.addEventListener('click', openBankModal);

// Депозит / снятие
const depositBtn = $('depositBtn');
if (depositBtn) {
  depositBtn.addEventListener('click', () => {
    const val = parseInt($('depositInput').value) || 0;
    depositToBank(val);
  });
}
const withdrawBtn = $('withdrawBtn');
if (withdrawBtn) {
  withdrawBtn.addEventListener('click', () => {
    const val = parseInt($('withdrawInput').value) || 0;
    withdrawFromBank(val);
  });
}
const depositAllBtn = $('depositAllBtn');
if (depositAllBtn) {
  depositAllBtn.addEventListener('click', () => {
    depositToBank(gameState.coins);
  });
}
const withdrawAllBtn = $('withdrawAllBtn');
if (withdrawAllBtn) {
  withdrawAllBtn.addEventListener('click', () => {
    withdrawFromBank(gameState.bank.balance);
  });
}

// Закрытие модалки нарушения
const cvmOkBtn = $('cvmOkBtn');
if (cvmOkBtn) {
  cvmOkBtn.addEventListener('click', () => {
    $('creditViolationModal').classList.remove('active');
  });
}

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
  scheduleSave();
  renderMinigames();
});

$('minPriceSlider').addEventListener('input', e => {
  gameState.autorollFilters.minPrice = parseInt(e.target.value) || 0;
  $('minPriceValue').textContent = formatNumber(gameState.autorollFilters.minPrice);
  scheduleSave();
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
  scheduleSave();
});
$('ratToggleBtn').addEventListener('click', () => {
  gameState.rat.visible = false;
  updateRatUI();
  scheduleSave();
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

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }
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
// === ПРОВЕРКА КРЕДИТА ===
// ============================================================

setInterval(() => {
  // Обновляем таймер кредита в модалке банка
  if ($('bankModal').classList.contains('active')) {
    const credit = gameState.bank.credit;
    if (credit.active) {
      const creditTimerEl = document.querySelector('.credit-timer');
      if (creditTimerEl) {
        const leftMs = Math.max(0, credit.dueAt - Date.now());
        const leftSec = Math.ceil(leftMs / 1000);
        const m = Math.floor(leftSec / 60);
        const s = leftSec % 60;
        creditTimerEl.innerHTML = `⏳ Вернуть через: <strong>${m}:${s.toString().padStart(2, '0')}</strong>`;
      }
    }
  }
  // Обновляем таймер на главном экране
  const creditMainBar = $('creditMainBar');
  if (creditMainBar && !creditMainBar.classList.contains('hidden')) {
    if (gameState.bank.credit.active) {
      const left = Math.max(0, gameState.bank.credit.dueAt - Date.now());
      const sec = Math.ceil(left / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      $('creditMainTimer').textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }
  }
  // Проверяем просрочку
  checkCreditOverdue();
}, 1000);

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
  setTimeout(showUpdateLog, 400);
  startBankTick();
}
