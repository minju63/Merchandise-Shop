import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import showcaseRoutes from '../src/routes/showcase.routes.js';
import { errorHandler } from '../src/middlewares/errorHandler.middleware.js';

async function request(path, method = 'GET') {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/showcases', showcaseRoutes);
  app.use(errorHandler);
  const server = app.listen(0);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/showcases${path}`, { method });
    return { status: response.status, body: await response.json() };
  } finally { server.close(); }
}

test('진열장 쓰기와 좋아요는 토큰 없으면 거절한다', async () => {
  for (const [path, method] of [
    ['', 'POST'], ['/abc', 'PUT'], ['/abc', 'DELETE'], ['/abc/like', 'PUT'],
    ['/abc/images', 'POST'], ['/abc/remove-background', 'POST'],
  ]) {
    const result = await request(path, method);
    assert.equal(result.status, 401);
    assert.equal(result.body.code, 'AUTH_REQUIRED');
  }
});

test('공개 목록과 상세의 잘못된 입력은 DB 조회 전에 거절한다', async () => {
  for (const path of ['?type=UNKNOWN', '?page=0', '?type=PERSONAL&categoryId=x', '/invalid-id']) {
    const result = await request(path);
    assert.equal(result.status, 400);
  }
});
