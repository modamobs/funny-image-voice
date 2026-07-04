const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads', 'images'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
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
    const id = uuidv4();
    await db.addImage({ id, filename: req.file.filename, original_name: req.file.originalname });
    res.json({ id, filename: req.file.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
