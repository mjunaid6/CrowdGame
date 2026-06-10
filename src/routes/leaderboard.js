/**
 * Leaderboard API Routes
 * GET /api/leaderboard          — top 20 all-time scores (public)
 * GET /api/leaderboard/stats    — global aggregate stats   (public)
 * GET /api/leaderboard/player?name=<name>  — personal best (public)
 * DELETE /api/leaderboard/reset — wipe all records (admin only)
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const lb = require('../services/leaderboard');

const router = express.Router();

// ── Auth helper ────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const auth = req.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Auth required' });
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('Not admin');
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// GET /api/leaderboard?limit=20
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const scores = await lb.getTopScores(limit);
    res.json({ success: true, scores });
  } catch (err) {
    console.error('Leaderboard fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// GET /api/leaderboard/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await lb.getGlobalStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/leaderboard/player?name=Maverick
router.get('/player', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'name query param required' });
  try {
    const best = await lb.getPlayerBest(name);
    res.json({ success: true, best });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch player best' });
  }
});

// DELETE /api/leaderboard/reset  (admin-protected)
router.delete('/reset', requireAdmin, async (req, res) => {
  try {
    const { db } = require('../services/db');
    await db('global_leaderboard').del();
    res.json({ success: true, message: 'Leaderboard cleared.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset leaderboard' });
  }
});

module.exports = router;
