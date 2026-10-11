// 담당: 공용 — 라우터는 여기 추가하지 말고 routes/index.js에 등록
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './routes/index.js';
import { notFound } from './middlewares/notFound.middleware.js';
import { errorHandler } from './middlewares/errorHandler.middleware.js';
import { startUpcomingProductsJob } from './jobs/upcoming-products.job.js';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use('/api/v1/reviews', express.json({ limit: '36mb' }));
app.use(express.json());

app.get('/api/v1/health', (req, res) => {
  res.json({ success: true, data: { ok: true }, message: null });
});

app.use('/api/v1', routes);
app.use(notFound);
app.use(errorHandler);

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  startUpcomingProductsJob();
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`server on :${PORT}`));
}

export default app;
