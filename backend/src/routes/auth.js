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
  const ua = req.headers['user-agent'] ?? '';
  const isInApp = /KAKAOTALK|NAVER|Line\/|FBAN|FBAV|FB_IAB|Instagram|Twitter|Snapchat/i.test(ua)
    || (/Android/i.test(ua) && /wv/.test(ua));

  if (isInApp) {
    return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>브라우저에서 열기</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:60px 24px;background:#f9fafb">
        <p style="font-size:48px;margin:0">🌐</p>
        <h2 style="color:#111827;margin:16px 0 8px">외부 브라우저에서 열어주세요</h2>
        <p style="color:#6b7280;line-height:1.6;margin:0 0 24px">
          카카오톡·인스타그램 등 앱 내 브라우저에서는<br>구글 로그인이 차단됩니다.
        </p>
        <a href="${process.env.FRONTEND_URL}" style="display:inline-block;padding:12px 28px;background:#4338ca;color:#fff;border-radius:24px;text-decoration:none;font-weight:700;font-size:15px">
          크롬/사파리로 열기
        </a>
        <p style="margin-top:20px;color:#9ca3af;font-size:13px">
          주소: ${process.env.FRONTEND_URL}
        </p>
      </body></html>`);
  }

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
    const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);
    res.json({ ...user, ai_usage_today: aiUsage, is_admin: adminEmails.includes(user.email) });
  } catch {
    res.json(null);
  }
});

module.exports = router;
