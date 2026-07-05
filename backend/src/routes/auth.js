const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// Google 로그인 시작
router.get('/google', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
  });
  res.redirect(`${GOOGLE_AUTH_URL}?${params}`);
});

// Google 콜백
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`);

  try {
    // 코드 → 토큰 교환
    const tokenRes = await axios.post(GOOGLE_TOKEN_URL, {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code',
    });

    // 유저 정보 가져오기
    const userRes = await axios.get(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });

    const { sub: google_id, email, name, picture } = userRes.data;

    // DB에 저장/업데이트
    const user = await db.upsertUser({ id: uuidv4(), google_id, email, name, picture });

    // JWT 발급
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    // 프론트엔드로 리다이렉트
    res.redirect(`${process.env.FRONTEND_URL}?token=${token}`);
  } catch (err) {
    console.error('Auth error:', err.message);
    res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`);
  }
});

// 내 정보
router.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.json(null);
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const user = await db.getUserById(payload.userId);
    if (!user) return res.json(null);
    const aiUsage = await db.getAiUsageToday(user.id);
    res.json({ ...user, ai_usage_today: aiUsage });
  } catch {
    res.json(null);
  }
});

module.exports = router;
