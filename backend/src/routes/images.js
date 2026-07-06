const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const OpenAI = require('openai');
const db = require('../db');
const { uploadToR2 } = require('../storage');
const { optionalAuth, requireAuth } = require('../middleware/auth');

const AI_IMAGE_DAILY_LIMIT = 3;

let _openai = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60000 });
  return _openai;
}

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('이미지 파일만 업로드 가능합니다'));
  },
});

router.get('/', async (req, res) => {
  try {
    res.json(await db.getImages());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const image = await db.getImage(req.params.id, req.userId ?? null);
    if (!image) return res.status(404).json({ error: '이미지를 찾을 수 없습니다' });
    res.json(image);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '이미지를 선택해주세요' });
  try {
    const ext = path.extname(req.file.originalname);
    const filename = `images/${uuidv4()}${ext}`;
    const url = await uploadToR2(filename, req.file.buffer, req.file.mimetype);

    const id = uuidv4();
    await db.addImage({ id, filename: url, original_name: req.file.originalname });
    res.json({ id, filename: url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai-generate', requireAuth, async (req, res) => {
  try {
    const usage = await db.getAiImageUsageToday(req.userId);
    if (usage >= AI_IMAGE_DAILY_LIMIT) {
      return res.status(429).json({ error: `AI 이미지는 하루 ${AI_IMAGE_DAILY_LIMIT}회까지만 생성할 수 있습니다` });
    }

    const openai = getOpenAI();

    // 1. GPT로 웃긴 이미지 프롬프트 생성
    const promptRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You create short, funny, absurd image prompts for DALL-E.
Style: Korean variety show humor — animals doing human jobs badly, everyday objects in surreal situations, unexpected reversals, cartoon-like exaggeration.
Rules: safe for all ages, visually clear, max 40 words, output only the English prompt.`,
        },
        { role: 'user', content: 'Give me one random funny image prompt.' },
      ],
      max_tokens: 80,
    });

    const imagePrompt = promptRes.choices[0].message.content.trim();

    // 2. Pollinations.ai로 이미지 생성 (API 키 불필요)
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;

    // 3. 이미지 다운로드 후 R2 업로드
    const { data: imageData } = await axios.get(pollinationsUrl, { responseType: 'arraybuffer', timeout: 60000 });
    const imageBuffer = Buffer.from(imageData);
    const r2Url = await uploadToR2(`images/${uuidv4()}.png`, imageBuffer, 'image/png');

    // 4. DB 저장 + 사용량 기록
    await db.incrementAiImageUsage(req.userId);
    const id = uuidv4();
    await db.addImage({ id, filename: r2Url, original_name: `[AI] ${imagePrompt.slice(0, 80)}` });

    res.json({ id, filename: r2Url, prompt: imagePrompt });
  } catch (err) {
    console.error('AI image generation error:', err);
    res.status(500).json({ error: 'AI 이미지 생성 실패: ' + err.message });
  }
});

module.exports = router;
