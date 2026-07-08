require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const API_SECRET = process.env.API_SECRET;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// GET /api/players — full leaderboard, sorted by points desc
app.get('/api/players', (req, res) => {
  res.json({
    kits: db.KITS,
    players: db.getAllPlayers(),
    titles: db.TITLES,
    tierPoints: db.TIER_POINTS,
    tierOrder: db.TIER_ORDER,
  });
});

// GET /api/players/:ign — single player lookup
app.get('/api/players/:ign', (req, res) => {
  const player = db.getPlayer(req.params.ign);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  const points = db.computePoints(player.tiers);
  res.json({ ...player, points, title: db.computeTitle(points) });
});

// POST /api/submit — called by your BotGhost /result command's "Send an API Request" action.
// Body (JSON): { "secret": "...", "player": "Steve123", "kit": "sword", "tier": "HT1", "region": "NA" }
app.post('/api/submit', (req, res) => {
  console.log('SUBMIT HIT:', JSON.stringify(req.body));
  const { secret, player, kit, tier, region } = req.body || {};
  console.log('ENV SECRET:', API_SECRET, '| RECEIVED:', secret, '| MATCH:', secret === API_SECRET);
  if (!API_SECRET || secret !== API_SECRET) {
    return res.status(401).json({ ok: false, error: 'Invalid or missing secret' });
  }
  if (!player || !kit || !tier) {
    return res.status(400).json({ ok: false, error: 'player, kit and tier are required' });
  }

  try {
    const updated = db.setTier(player, kit.toLowerCase(), tier.toUpperCase(), region ? region.toUpperCase() : undefined, 'botghost');
    const points = db.computePoints(updated.tiers);
    res.json({ ok: true, player: updated.ign, kit, tier, points, title: db.computeTitle(points) });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Apex Tiers API running on port ${PORT}`);
});
