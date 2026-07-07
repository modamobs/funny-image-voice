const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

router.get('/images', requireAuth, async (req, res) => {
  try { res.json(await db.profileImages(req.userId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/comments', requireAuth, async (req, res) => {
  try { res.json(await db.profileComments(req.userId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/responses', requireAuth, async (req, res) => {
  try { res.json(await db.profileResponses(req.userId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
