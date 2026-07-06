require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const imagesRouter = require('./routes/images');
const responsesRouter = require('./routes/responses');
const commentsRouter = require('./routes/comments');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:5173',
  'https://funny-image-voice.vercel.app',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/auth', authRouter);
app.use('/api/images', imagesRouter);
app.use('/api', responsesRouter);
app.use('/api', commentsRouter);
app.use('/api/admin', adminRouter);

db.init().then(() => {
  app.listen(PORT, () => console.log(`서버 실행 중: http://localhost:${PORT}`));
}).catch((err) => {
  console.error('DB 초기화 실패:', err);
  process.exit(1);
});
