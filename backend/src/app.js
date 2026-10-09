import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiRoutes from './routes/index.js';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use('/api/v1/reviews', express.json({ limit: '36mb' }));
app.use(express.json());

app.get('/api/v1/health', (req, res) => {
  res.json({ success: true, data: { ok: true }, message: null });
});

app.use('/api/v1', apiRoutes);

// 404 — Express 5에서는 app.get('*') 대신 app.use() 사용
app.use((req, res) => {
  res
    .status(404)
    .json({
      success: false,
      data: null,
      message: '요청한 API를 찾을 수 없습니다.',
      code: 'NOT_FOUND',
    });
});

// 에러 핸들러 — 반드시 맨 마지막, 인자 4개 고정
// Express 5는 async 핸들러에서 throw된 에러도 여기로 자동 전달됨
app.use((err, req, res, next) => {
  if (!err.status || err.status >= 500) console.error(err);
  res
    .status(err.status || 500)
    .json({
      success: false,
      data: null,
      message: err.status ? err.message : '서버 오류가 발생했습니다.',
      code: err.code || 'INTERNAL_SERVER_ERROR',
    });
});

const PORT = process.env.PORT || 4000;
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  app.listen(PORT, () => console.log(`server on :${PORT}`));
}

export default app;
