const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { uploadToR2 } = require('../storage');

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

router.get('/:id', async (req, res) => {
  try {
    const image = await db.getImage(req.params.id);
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

module.exports = router;
