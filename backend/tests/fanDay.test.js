import assert from 'node:assert/strict';
import test from 'node:test';
import { addDayCongrats, getDayBoard, toggleDayLike } from '../src/services/fan.service.js';

// 날짜·최애 값이 잘못되면 DB를 부르기 전에 막는다
test('기념일 모아보기: 날짜 형식이 잘못되면 400', async () => {
  await assert.rejects(() => getDayBoard('내일', null), { status: 400, code: 'FAN_INVALID_DATE' });
  await assert.rejects(() => getDayBoard('2026-13-45x', null), { status: 400, code: 'FAN_INVALID_DATE' });
});

test('축하하기·축하 한마디: 날짜나 최애가 없으면 막는다', async () => {
  await assert.rejects(() => toggleDayLike('u', 'abc', { characterId: 'c' }), { status: 400, code: 'FAN_INVALID_DATE' });
  await assert.rejects(() => toggleDayLike('u', '2026-12-07', {}), { status: 404, code: 'FAN_DAY_CHARACTER_NOT_FOUND' });
  await assert.rejects(() => addDayCongrats('u', '2026-12-07', { message: '축하해' }), { status: 404, code: 'FAN_DAY_CHARACTER_NOT_FOUND' });
});
