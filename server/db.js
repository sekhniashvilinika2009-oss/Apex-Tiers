const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

// ---- Configure your kits here ----
// key = internal id (used in commands), label = shown on site
const KITS = [
  { key: 'vanilla', label: 'Vanilla' },
  { key: 'uhc',      label: 'UHC' },
  { key: 'pot',      label: 'Pot' },
  { key: 'nethop',   label: 'NethOP' },
  { key: 'smp',      label: 'SMP' },
  { key: 'sword',    label: 'Sword' },
  { key: 'axe',      label: 'Axe' },
  { key: 'mace',     label: 'Mace' },
];

// ---- Tier point values (edit freely) ----
const TIER_ORDER = ['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5'];
const TIER_POINTS = {
  HT1: 10, LT1: 9,
  HT2: 8,  LT2: 7,
  HT3: 6,  LT3: 5,
  HT4: 4,  LT4: 3,
  HT5: 2,  LT5: 1,
};

// ---- Titles by total points (edit freely) ----
const TITLES = [
  { min: 400, name: 'Combat Grandmaster' },
  { min: 250, name: 'Combat Master' },
  { min: 100, name: 'Combat Ace' },
  { min: 50,  name: 'Combat Specialist' },
  { min: 0,   name: 'Combat Rookie' },
];

const REGIONS = ['NA', 'EU', 'AS', 'OC', 'SA'];

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ players: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function key(ign) {
  return ign.trim().toLowerCase();
}

function computePoints(tiers) {
  return Object.values(tiers || {}).reduce((sum, t) => sum + (TIER_POINTS[t] || 0), 0);
}

function computeTitle(points) {
  for (const t of TITLES) {
    if (points >= t.min) return t.name;
  }
  return TITLES[TITLES.length - 1].name;
}

function getPlayer(ign) {
  const data = loadData();
  return data.players[key(ign)] || null;
}

function getAllPlayers() {
  const data = loadData();
  return Object.values(data.players).map(p => {
    const points = computePoints(p.tiers);
    return { ...p, points, title: computeTitle(points) };
  }).sort((a, b) => b.points - a.points);
}

function setTier(ign, kit, tier, region, updatedBy) {
  if (!KITS.some(k => k.key === kit)) throw new Error(`Unknown kit: ${kit}`);
  if (!TIER_ORDER.includes(tier)) throw new Error(`Unknown tier: ${tier}`);
  const data = loadData();
  const k = key(ign);
  if (!data.players[k]) {
    data.players[k] = { ign, region: region || 'NA', tiers: {}, updatedAt: null, updatedBy: null };
  }
  data.players[k].ign = ign; // preserve display casing from most recent update
  if (region) data.players[k].region = region;
  data.players[k].tiers[kit] = tier;
  data.players[k].updatedAt = new Date().toISOString();
  data.players[k].updatedBy = updatedBy || null;
  saveData(data);
  return data.players[k];
}

function removeTier(ign, kit) {
  const data = loadData();
  const k = key(ign);
  if (!data.players[k]) return null;
  delete data.players[k].tiers[kit];
  data.players[k].updatedAt = new Date().toISOString();
  saveData(data);
  return data.players[k];
}

module.exports = {
  KITS, TIER_ORDER, TIER_POINTS, TITLES, REGIONS,
  loadData, saveData, getPlayer, getAllPlayers,
  setTier, removeTier, computePoints, computeTitle,
};
