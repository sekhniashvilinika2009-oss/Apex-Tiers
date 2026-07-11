const { MongoClient } = require('mongodb');

let client = null;
let playersCol = null;

async function connect() {
  if (playersCol) return playersCol;
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('apextiers');
  playersCol = db.collection('players');
  return playersCol;
}

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
  { key: 'spearmace', label: 'SpearMace' },
];

// ---- Tier point values (edit freely) ----
const TIER_ORDER = ['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5'];
const TIER_POINTS = {
  HT1: 60, LT1: 45,
  HT2: 30, LT2: 20,
  HT3: 10, LT3: 6,
  HT4: 4,  LT4: 3,
  HT5: 2,  LT5: 1,
};

// ---- Titles by total points (edit freely) ----
// icon = which built-in icon shape the site draws (see public/index.html TITLE_ICONS)
const TITLES = [
  { min: 400, name: 'Combat Grandmaster', icon: 'grandmaster' },
  { min: 250, name: 'Combat Master',       icon: 'master' },
  { min: 100, name: 'Combat Ace',          icon: 'ace' },
  { min: 50,  name: 'Combat Specialist',   icon: 'specialist' },
  { min: 20,  name: 'Combat Cadet',        icon: 'cadet' },
  { min: 10,  name: 'Combat Novice',       icon: 'novice' },
  { min: 0,   name: 'Rookie',              icon: 'rookie' },
];

const REGIONS = ['NA', 'EU', 'AS', 'OC', 'SA'];

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

function computeTitleInfo(points) {
  for (const t of TITLES) {
    if (points >= t.min) return t;
  }
  return TITLES[TITLES.length - 1];
}

async function getPlayer(ign) {
  const col = await connect();
  return col.findOne({ _id: key(ign) });
}

async function getAllPlayers() {
  const col = await connect();
  const docs = await col.find({}).toArray();
  return docs.map(p => {
    const points = computePoints(p.tiers);
    const titleInfo = computeTitleInfo(points);
    return { ...p, points, title: titleInfo.name, titleIcon: titleInfo.icon };
  }).sort((a, b) => b.points - a.points);
}

async function setTier(ign, kit, tier, region, updatedBy) {
  if (!KITS.some(k => k.key === kit)) throw new Error(`Unknown kit: ${kit}`);
  if (!TIER_ORDER.includes(tier)) throw new Error(`Unknown tier: ${tier}`);
  const col = await connect();
  const k = key(ign);

  let doc = await col.findOne({ _id: k });
  if (!doc) doc = { _id: k, ign, region: region || 'NA', tiers: {}, updatedAt: null, updatedBy: null };

  doc.ign = ign; // preserve display casing from most recent update
  if (region) doc.region = region;
  doc.tiers = doc.tiers || {};
  doc.tiers[kit] = tier;
  doc.updatedAt = new Date().toISOString();
  doc.updatedBy = updatedBy || null;

  await col.replaceOne({ _id: k }, doc, { upsert: true });
  return doc;
}

async function removeTier(ign, kit) {
  const col = await connect();
  const k = key(ign);
  const doc = await col.findOne({ _id: k });
  if (!doc) return null;
  if (doc.tiers) delete doc.tiers[kit];
  doc.updatedAt = new Date().toISOString();
  await col.replaceOne({ _id: k }, doc, { upsert: true });
  return doc;
}

module.exports = {
  KITS, TIER_ORDER, TIER_POINTS, TITLES, REGIONS,
  connect, getPlayer, getAllPlayers,
  setTier, removeTier, computePoints, computeTitle, computeTitleInfo,
};
