const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/images/:imageId/comments', async (req, res) => {
  try {
    const image = await db.getImage(req.params.imageId);
    if (!image) return res.status(404).json({ error: '이미지를 찾을 수 없습니다' });
    res.json(await db.getComments(req.params.imageId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/images/:imageId/comments', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: '댓글 내용을 입력해주세요' });

    const image = await db.getImage(req.params.imageId);
    if (!image) return res.status(404).json({ error: '이미지를 찾을 수 없습니다' });

    const user = await db.getUserById(req.userId);
    const comment = await db.addComment({
      id: uuidv4(),
      image_id: req.params.imageId,
      nickname: user?.name ?? '익명',
      text: text.trim(),
    });
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
