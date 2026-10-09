import test from 'node:test';
import assert from 'node:assert/strict';
import { businessStatus, seoulNow } from '../src/services/storeBusinessHours.service.js';

const row = (day_of_week, open_time, close_time, extra = {}) => ({
  day_of_week,
  open_time,
  close_time,
  is_closed: false,
  break_start: null,
  break_end: null,
  ...extra,
});

test('서울 시간대 요일과 시각을 읽는다', () => {
  assert.deepEqual(seoulNow(new Date('2026-10-10T00:30:00Z')), { day: 6, minute: 570 });
});

test('영업 중, 영업 종료, 휴무, 정보 없음, 임시 휴무를 구분한다', () => {
  const hours = [row(6, '10:00:00', '20:00:00'), row(0, null, null, { is_closed: true })];
  assert.equal(businessStatus(hours, false, { day: 6, minute: 600 }).status, '영업 중');
  assert.equal(businessStatus(hours, false, { day: 6, minute: 1200 }).status, '영업 종료');
  assert.equal(businessStatus(hours, false, { day: 0, minute: 600 }).status, '휴무');
  assert.equal(businessStatus([], false, { day: 6, minute: 600 }).status, '확인 불가');
  assert.equal(businessStatus([row(6, '10:00:00', '10:00:00')], false, { day: 6, minute: 600 }).status, '확인 불가');
  assert.equal(businessStatus(hours, true, { day: 6, minute: 600 }).status, '임시 휴무');
  assert.equal(businessStatus(hours, false, { day: 6, minute: 600 }, 'INACTIVE').openNow, false);
});

test('브레이크타임과 자정 이후 전날 영업을 구분한다', () => {
  const hours = [
    row(6, '20:00:00', '02:00:00', { break_start: '23:30:00', break_end: '00:30:00' }),
    row(0, null, null, { is_closed: true }),
  ];
  assert.equal(businessStatus(hours, false, { day: 6, minute: 21 * 60 }).status, '영업 중');
  assert.equal(businessStatus(hours, false, { day: 0, minute: 10 }).status, '브레이크타임');
  assert.equal(businessStatus(hours, false, { day: 0, minute: 60 }).status, '영업 중');
  assert.equal(businessStatus(hours, false, { day: 0, minute: 120 }).status, '휴무');
});
