const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const db = require('../db');

const router = express.Router();

let _openai = null;
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is missing or empty');
  }
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const audioStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads', 'audio'),
  filename: (req, file, cb) => cb(null, `${uuidv4()}.webm`),
});
const uploadAudio = multer({ storage: audioStorage, limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/images/:imageId/ai-response', async (req, res) => {
  try {
    const image = await db.getImage(req.params.imageId);
    if (!image) return res.status(404).json({ error: '이미지를 찾을 수 없습니다' });

    const imagePath = path.join(__dirname, '..', '..', 'uploads', 'images', image.filename);
    const base64Image = fs.readFileSync(imagePath).toString('base64');
    const ext = path.extname(image.filename).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `당신은 일본 예능 프로그램의 개그맨입니다. 이미지를 보고 즉흥적으로 웃긴 한국어 멘트를 한 문장으로 만들어주세요.
- 말투는 자연스럽고 구어체로
- 반전, 과장, 엉뚱함을 활용
- 반드시 한 문장으로만 (30자 이내)
- 멘트만 출력, 설명 없이`,
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
            { type: 'text', text: '이 이미지에 웃긴 멘트를 달아주세요!' },
          ],
        },
      ],
      max_tokens: 100,
    });

    const funnyText = completion.choices[0].message.content.trim();

    const ttsResponse = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'onyx',
      input: funnyText,
      speed: 1.1,
    });

    const audioFilename = `${uuidv4()}.mp3`;
    const audioPath = path.join(__dirname, '..', '..', 'uploads', 'audio', audioFilename);
    fs.writeFileSync(audioPath, Buffer.from(await ttsResponse.arrayBuffer()));

    const responseId = uuidv4();
    await db.addResponse({ id: responseId, image_id: req.params.imageId, type: 'ai', audio_filename: audioFilename, ai_text: funnyText });

    res.json({ id: responseId, type: 'ai', ai_text: funnyText, audio_filename: audioFilename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI 응답 생성 실패: ' + err.message });
  }
});

router.post('/images/:imageId/user-response', uploadAudio.single('audio'), async (req, res) => {
  try {
    const image = await db.getImage(req.params.imageId);
    if (!image) return res.status(404).json({ error: '이미지를 찾을 수 없습니다' });
    if (!req.file) return res.status(400).json({ error: '오디오 파일이 없습니다' });

    const responseId = uuidv4();
    await db.addResponse({ id: responseId, image_id: req.params.imageId, type: 'user', audio_filename: req.file.filename });

    res.json({ id: responseId, type: 'user', audio_filename: req.file.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/responses/:responseId/vote', async (req, res) => {
  try {
    const votes = await db.vote(req.params.responseId);
    if (votes === null) return res.status(404).json({ error: '응답을 찾을 수 없습니다' });
    res.json({ votes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
