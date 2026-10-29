// 담당: 연수
import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import authRoutes from '../src/routes/auth.routes.js';
import { errorHandler } from '../src/middlewares/errorHandler.middleware.js';
import { buildRegistrationState } from '../src/services/auth.service.js';

async function request(path, init) {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.use(errorHandler);
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/auth${path}`, init);
    return { status: response.status, body: await response.json() };
  } finally {
    server.close();
  }
}

test('토큰 없이 가입 여부를 조회하면 401 AUTH_REQUIRED', async () => {
  const { status, body } = await request('/me/exists');
  assert.equal(status, 401);
  assert.deepEqual(body, {
    success: false,
    data: null,
    message: '로그인이 필요합니다.',
    code: 'AUTH_REQUIRED',
  });
});

test('토큰 없이 가입 완료를 호출하면 401 AUTH_REQUIRED', async () => {
  const { status, body } = await request('/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(status, 401);
  assert.equal(body.code, 'AUTH_REQUIRED');
});

test('형식이 틀린 이메일은 400 INVALID_EMAIL', async () => {
  const { status, body } = await request('/email-check?email=not-an-email');
  assert.equal(status, 400);
  assert.equal(body.success, false);
  assert.equal(body.code, 'INVALID_EMAIL');
});

test('형식이 틀린 닉네임은 400 INVALID_NICKNAME', async () => {
  const { status, body } = await request('/nickname-check?nickname=a');
  assert.equal(status, 400);
  assert.equal(body.code, 'INVALID_NICKNAME');
});

const agreement = (terms_type, agreed = true) => ({ terms_type, agreed });

test('users 행이 없으면 PROFILE부터 채워야 한다', () => {
  const state = buildRegistrationState({ user: null, agreements: [], notificationSettings: null });
  assert.equal(state.exists, false);
  assert.equal(state.registrationComplete, false);
  assert.deepEqual(state.missingSteps, ['PROFILE', 'REQUIRED_AGREEMENTS', 'NOTIFICATION_SETTINGS']);
});

test('필수 약관과 알림 설정이 모두 있으면 가입 완료', () => {
  const state = buildRegistrationState({
    user: { id: 'u1', status: 'ACTIVE' },
    agreements: [agreement('SERVICE'), agreement('PRIVACY')],
    notificationSettings: { user_id: 'u1' },
  });
  assert.equal(state.registrationComplete, true);
  assert.deepEqual(state.missingSteps, []);
});

test('필수 약관을 철회한 최신 기록이 있으면 가입 미완료', () => {
  const state = buildRegistrationState({
    user: { id: 'u1', status: 'ACTIVE' },
    agreements: [agreement('SERVICE', false), agreement('SERVICE'), agreement('PRIVACY')],
    notificationSettings: { user_id: 'u1' },
  });
  assert.equal(state.registrationComplete, false);
  assert.deepEqual(state.missingSteps, ['REQUIRED_AGREEMENTS']);
});
