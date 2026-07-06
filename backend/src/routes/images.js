const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
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

// 1단계: 이미지 생성 + R2 업로드 (DB 저장 없음) → 미리보기용
router.post('/ai-preview', requireAuth, async (req, res) => {
  try {
    const usage = await db.getAiImageUsageToday(req.userId);
    if (usage >= AI_IMAGE_DAILY_LIMIT) {
      return res.status(429).json({ error: `AI 이미지는 하루 ${AI_IMAGE_DAILY_LIMIT}회까지만 생성할 수 있습니다` });
    }

    const openai = getOpenAI();

    // GPT로 웃긴 프롬프트 생성
    const promptRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You create short, funny, absurd image prompts for image generation.
Style: Korean variety show humor — animals doing human jobs badly, everyday objects in surreal situations, unexpected reversals, cartoon-like exaggeration.
Rules: safe for all ages, visually clear, max 40 words, output only the English prompt.`,
        },
        { role: 'user', content: 'Give me one random funny image prompt.' },
      ],
      max_tokens: 80,
    });

    const imagePrompt = promptRes.choices[0].message.content.trim();

    // gpt-image-1으로 이미지 생성 (base64 반환)
    const imageRes = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
    });

    const imageBuffer = Buffer.from(imageRes.data[0].b64_json, 'base64');
    const r2Url = await uploadToR2(`images/${uuidv4()}.png`, imageBuffer, 'image/png');

    // 사용량 기록 (DB 이미지 저장은 2단계에서)
    await db.incrementAiImageUsage(req.userId);

    res.json({ filename: r2Url, prompt: imagePrompt });
  } catch (err) {
    console.error('AI image preview error:', err);
    res.status(500).json({ error: 'AI 이미지 생성 실패: ' + err.message });
  }
});

// 2단계: 미리보기 확인 후 DB에 저장
router.post('/ai-confirm', requireAuth, async (req, res) => {
  try {
    const { filename, prompt } = req.body;
    if (!filename) return res.status(400).json({ error: '잘못된 요청입니다' });
    const id = uuidv4();
    await db.addImage({ id, filename, original_name: `[AI] ${(prompt ?? '').slice(0, 80)}` });
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
