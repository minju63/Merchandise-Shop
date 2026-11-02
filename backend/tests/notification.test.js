import assert from 'node:assert/strict';
import test from 'node:test';
import { NOTIFICATION_RETENTION_DAYS, retentionCutoff } from '../src/services/notification.service.js';

test('알림 보관 기한은 생성 시각 기준 30일이다', () => {
  const now = new Date('2026-11-02T15:00:00.000Z');
  assert.equal(NOTIFICATION_RETENTION_DAYS, 30);
  assert.equal(retentionCutoff(now), '2026-10-03T15:00:00.000Z');
});
