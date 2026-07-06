const express = require('express');
const jwt = require('jsonwebtoken');
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

module.exports = router;
