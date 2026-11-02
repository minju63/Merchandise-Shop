import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDayCongrats,
  applyDayLikeMocks,
  deleteDayCongrats,
  getDayBoard,
  toggleDayLike,
  updateDayCongrats,
} from '../src/services/fan.service.js';

test('목업 축하 수는 DB 시드가 없을 때만 실제 하트 수에 더한다', () => {
  const unseeded = applyDayLikeMocks({
    ranked: [],
    others: [{ name: '고죠 사토루', likeCount: 1 }, { name: '쿠기사키 노바라', likeCount: 0 }],
  });
  assert.equal(unseeded.others[0].likeCount, 3285);
  assert.equal(unseeded.others[1].likeCount, 1092);

  const seeded = applyDayLikeMocks({
    ranked: [{ name: '후시구로 메구미', likeCount: 1437 }],
    others: [],
  });
  assert.equal(seeded.ranked[0].likeCount, 1437);
});

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

test('축하 한마디 수정·삭제: 날짜나 글 ID가 없으면 DB 호출 전에 막는다', async () => {
  await assert.rejects(() => updateDayCongrats('u', 'abc', 'congrats-id', { message: '수정' }), { status: 400, code: 'FAN_INVALID_DATE' });
  await assert.rejects(() => updateDayCongrats('u', '2026-12-07', '', { message: '수정' }), { status: 404, code: 'FAN_DAY_CONGRATS_NOT_FOUND' });
  await assert.rejects(() => deleteDayCongrats('u', '2026-12-07', ''), { status: 404, code: 'FAN_DAY_CONGRATS_NOT_FOUND' });
});
