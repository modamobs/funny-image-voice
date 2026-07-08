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
    const frontendUrl = process.env.FRONTEND_URL ?? '';
    const host = frontendUrl.replace(/^https?:\/\//, '');
    return res.send(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>브라우저에서 열기</title>
      <style>
        body{font-family:-apple-system,sans-serif;text-align:center;padding:60px 24px;background:#f9fafb;margin:0}
        h2{color:#111827;margin:16px 0 8px;font-size:20px}
        p{color:#6b7280;line-height:1.6;margin:0}
        .btn{display:inline-block;margin-top:24px;padding:14px 32px;background:#4338ca;color:#fff;border-radius:24px;text-decoration:none;font-weight:700;font-size:16px}
        .url-box{margin-top:24px;background:#fff;border:1.5px solid #e5e7eb;border-radius:12px;padding:12px 16px;word-break:break-all;font-size:14px;color:#374151}
        .copy-btn{margin-top:12px;padding:10px 24px;background:#6366f1;color:#fff;border:none;border-radius:20px;font-size:14px;font-weight:700;cursor:pointer}
        .tip{margin-top:16px;font-size:12px;color:#9ca3af}
      </style>
    </head>
    <body>
      <p style="font-size:52px;margin:0">🌐</p>
      <h2>외부 브라우저에서 열어주세요</h2>
      <p>카카오톡·인스타그램 등 앱 내 브라우저에서는<br>구글 로그인이 차단됩니다.</p>

      <div id="android-section" style="display:none">
        <a id="intent-btn" class="btn" href="intent://${host}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.android.chrome;end">
          크롬으로 열기
        </a>
        <p class="tip">버튼이 작동하지 않으면 아래 주소를 복사해 크롬에 붙여넣으세요</p>
      </div>

      <div id="ios-section" style="display:none">
        <p style="margin-top:20px;font-weight:600;color:#374151">아래 주소를 복사 후 사파리에서 열어주세요</p>
      </div>

      <div class="url-box" id="url-text">${frontendUrl}</div>
      <button class="copy-btn" onclick="copyUrl()">📋 주소 복사</button>
      <p class="tip" id="copy-done" style="display:none;color:#10b981;font-weight:600">복사됐어요!</p>

      <script>
        const ua = navigator.userAgent;
        if (/Android/i.test(ua)) {
          document.getElementById('android-section').style.display = 'block';
        } else if (/iPhone|iPad|iPod/i.test(ua)) {
          document.getElementById('ios-section').style.display = 'block';
        }
        function copyUrl() {
          navigator.clipboard.writeText('${frontendUrl}').then(function() {
            document.getElementById('copy-done').style.display = 'block';
          }).catch(function() {
            const el = document.getElementById('url-text');
            const range = document.createRange();
            range.selectNode(el);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            document.execCommand('copy');
            document.getElementById('copy-done').style.display = 'block';
          });
        }
      </script>
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
