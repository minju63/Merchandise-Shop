import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

app.get('/api/v1/health', (req, res) => {
  res.json({ ok: true });
});

// 라우터는 이 아래에 추가 (예: app.use('/api/v1/wishlist', wishlistRoutes))

// 404 — Express 5에서는 app.get('*') 대신 app.use() 사용
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl });
});

// 에러 핸들러 — 반드시 맨 마지막, 인자 4개 고정
// Express 5는 async 핸들러에서 throw된 에러도 여기로 자동 전달됨
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`server on :${PORT}`));
