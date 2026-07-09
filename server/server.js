require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const API_SECRET = process.env.API_SECRET;

app.set('trust proxy', 1); // needed so rate-limit sees the real visitor IP behind Render's proxy

// General limiter: protects the whole site/API from request floods
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,             // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

// Stricter limiter just for the write endpoints (submit/delete)
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests, please slow down.' },
});

app.use(generalLimiter);
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// GET /api/players — full leaderboard, sorted by points desc
app.get('/api/players', async (req, res) => {
  try {
    const players = await db.getAllPlayers();
    res.json({
      kits: db.KITS,
      players,
      titles: db.TITLES,
      tierPoints: db.TIER_POINTS,
      tierOrder: db.TIER_ORDER,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// GET /api/players/:ign — single player lookup
app.get('/api/players/:ign', async (req, res) => {
  try {
    const player = await db.getPlayer(req.params.ign);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    const points = db.computePoints(player.tiers);
    const titleInfo = db.computeTitleInfo(points);
    res.json({ ...player, points, title: titleInfo.name, titleIcon: titleInfo.icon });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// POST /api/submit — called by your BotGhost /result command's "Send an API Request" action.
// Body (JSON): { "secret": "...", "player": "Steve123", "kit": "sword", "tier": "HT1", "region": "NA" }
app.post('/api/submit', writeLimiter, async (req, res) => {
  const { secret, player, kit, tier, region } = req.body || {};

  if (!API_SECRET || secret !== API_SECRET) {
    return res.status(401).json({ ok: false, error: 'Invalid or missing secret' });
  }
  if (!player || !kit || !tier) {
    return res.status(400).json({ ok: false, error: 'player, kit and tier are required' });
  }

  try {
    const updated = await db.setTier(player, kit.toLowerCase(), tier.toUpperCase(), region ? region.toUpperCase() : undefined, 'botghost');
    const points = db.computePoints(updated.tiers);
    res.json({ ok: true, player: updated.ign, kit, tier, points, title: db.computeTitle(points) });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/remove — called by your BotGhost /tier remove command's "Send an API Request" action.
// Body (JSON): { "secret": "...", "player": "Steve123", "kit": "sword" }
// Does the same thing as DELETE /api/players/:ign/:kit, just as a POST so BotGhost can call it easily.
app.post('/api/remove', writeLimiter, async (req, res) => {
  const { secret, player, kit } = req.body || {};
  if (!API_SECRET || secret !== API_SECRET) {
    return res.status(401).json({ ok: false, error: 'Invalid or missing secret' });
  }
  if (!player || !kit) {
    return res.status(400).json({ ok: false, error: 'player and kit are required' });
  }
  try {
    const updated = await db.removeTier(player, kit.toLowerCase());
    if (!updated) return res.status(404).json({ ok: false, error: 'Player not found' });
    const points = db.computePoints(updated.tiers);
    const titleInfo = db.computeTitleInfo(points);
    res.json({ ok: true, ign: updated.ign, points, title: titleInfo.name, titleIcon: titleInfo.icon, tiers: updated.tiers });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/players/:ign/:kit — removes one kit's tier from a player. Used by the
// site's own "cancel a result" button. Requires the same secret as /api/submit.
// Body (JSON): { "secret": "..." }
app.delete('/api/players/:ign/:kit', writeLimiter, async (req, res) => {
  const { secret } = req.body || {};
  if (!API_SECRET || secret !== API_SECRET) {
    return res.status(401).json({ ok: false, error: 'Invalid or missing secret' });
  }
  try {
    const updated = await db.removeTier(req.params.ign, req.params.kit.toLowerCase());
    if (!updated) return res.status(404).json({ ok: false, error: 'Player not found' });
    const points = db.computePoints(updated.tiers);
    const titleInfo = db.computeTitleInfo(points);
    res.json({ ok: true, ign: updated.ign, points, title: titleInfo.name, titleIcon: titleInfo.icon, tiers: updated.tiers });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

async function start() {
  try {
    await db.connect();
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
  }
  app.listen(PORT, () => {
    console.log(`Apex Tiers API running on port ${PORT}`);
  });
}

start();
