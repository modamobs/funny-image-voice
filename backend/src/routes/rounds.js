const express = require('express');
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// 오늘의 짤. 진행 중인 라운드가 없으면 가장 최근에 끝난 라운드를 대신 준다.
router.get('/today', optionalAuth, async (req, res) => {
  try {
    const round = await db.getCurrentRound(req.userId ?? null);
    if (!round) {
      return res.status(404).json({ error: '아직 등록된 라운드가 없습니다', code: 'NO_ROUND' });
    }
    res.json(round);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 명예의 전당 — 끝난 라운드 목록
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    res.json(await db.listRounds(limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const round = await db.getRound(req.params.id, req.userId ?? null);
    if (!round) return res.status(404).json({ error: '라운드를 찾을 수 없습니다' });
    res.json(round);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 순위표만 필요할 때 (이미지 없이 가볍게)
router.get('/:id/leaderboard', optionalAuth, async (req, res) => {
  try {
    const round = await db.getRound(req.params.id, req.userId ?? null);
    if (!round) return res.status(404).json({ error: '라운드를 찾을 수 없습니다' });
    res.json({
      round_id: round.id,
      status: round.status,
      closes_at: round.closes_at,
      entry_count: round.entry_count,
      my_entry_id: round.my_entry_id,
      winner: round.winner,
      entries: round.entries,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
