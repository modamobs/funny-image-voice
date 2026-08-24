const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

async function requireAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: '로그인이 필요합니다' });
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.userId = payload.userId;
  } catch {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다' });
  }
  const user = await db.getUserById(req.userId);
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);
  if (!adminEmails.includes(user?.email)) {
    return res.status(403).json({ error: '관리자 권한이 없습니다' });
  }
  next();
}

router.get('/stats', requireAdmin, async (req, res) => {
  try { res.json(await db.adminStats()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/images', requireAdmin, async (req, res) => {
  try { res.json(await db.adminGetImages()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/images/:id', requireAdmin, async (req, res) => {
  try {
    const ok = await db.adminDeleteImage(req.params.id);
    if (!ok) return res.status(404).json({ error: '이미지를 찾을 수 없습니다' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users', requireAdmin, async (req, res) => {
  try { res.json(await db.adminGetUsers()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/comments', requireAdmin, async (req, res) => {
  try { res.json(await db.adminGetComments()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/comments/:id', requireAdmin, async (req, res) => {
  try {
    await db.adminDeleteComment(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/responses', requireAdmin, async (req, res) => {
  try { res.json(await db.adminGetResponses()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/responses/:id', requireAdmin, async (req, res) => {
  try {
    await db.adminDeleteResponse(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- 일일 라운드 ----------

router.get('/rounds', requireAdmin, async (req, res) => {
  try {
    await db.syncRounds();
    res.json(await db.adminListRounds());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 오늘의 짤 예약. 시간을 안 주면 기본 스케줄(09:00~21:00)을 쓴다.
// day_offset=1 이면 내일 라운드.
router.post('/rounds', requireAdmin, async (req, res) => {
  try {
    const { image_id, day_offset, opens_at, closes_at } = req.body;
    if (!image_id) return res.status(400).json({ error: '이미지를 선택해주세요' });

    const image = await db.getImage(image_id);
    if (!image) return res.status(404).json({ error: '이미지를 찾을 수 없습니다' });

    const window = (opens_at && closes_at)
      ? { opens_at, closes_at }
      : await db.roundWindow(Number(day_offset) || 0);

    if (new Date(window.closes_at) <= new Date(window.opens_at)) {
      return res.status(400).json({ error: '마감 시각이 시작 시각보다 빠릅니다' });
    }

    const round = await db.createRound({ id: uuidv4(), image_id, ...window });
    res.json(round);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 마감 시각 전에 강제로 닫고 우승자를 확정한다
router.post('/rounds/:id/close', requireAdmin, async (req, res) => {
  try {
    const round = await db.closeRound(req.params.id);
    if (!round) return res.status(404).json({ error: '닫을 수 있는 라운드가 아닙니다' });
    res.json(round);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/rounds/:id', requireAdmin, async (req, res) => {
  try {
    const ok = await db.deleteScheduledRound(req.params.id);
    if (!ok) return res.status(400).json({ error: '아직 시작하지 않은 라운드만 삭제할 수 있습니다' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
