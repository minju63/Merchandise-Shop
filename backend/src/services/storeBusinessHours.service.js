const DAY_INDEX = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

export function weekday(row) {
  const value = row?.day_of_week;
  if (value != null && value !== '' && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 6)
    return Number(value);
  return (
    DAY_INDEX[
      String(value ?? '')
        .slice(0, 3)
        .toUpperCase()
    ] ?? -1
  );
}

function minutes(value) {
  if (typeof value !== 'string' || !/^\d{1,2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

export function seoulNow(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  return {
    day: DAY_INDEX[parts.weekday.toUpperCase()],
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function activity(row, minute) {
  if (!row || row.is_closed === true) return null;
  const open = minutes(row.open_time);
  const close = minutes(row.close_time);
  if (open === null || close === null || open === close) return null;
  const end = close < open ? close + 1440 : close;
  if (minute < open || minute >= end) return null;
  const breakStart = minutes(row.break_start);
  const breakEnd = minutes(row.break_end);
  if (breakStart !== null && breakEnd !== null && breakStart !== breakEnd) {
    const start = breakStart < open ? breakStart + 1440 : breakStart;
    let finish = breakEnd <= breakStart ? breakEnd + 1440 : breakEnd;
    if (finish < open) finish += 1440;
    if (minute >= start && minute < finish) return '브레이크타임';
  }
  return '영업 중';
}

export function businessStatus(hours, temporarilyClosed, now = seoulNow(), storeStatus = 'ACTIVE') {
  const todayHours = hours.find((row) => weekday(row) === now.day) ?? null;
  const result = {
    todayDay: now.day,
    todayHours,
    openNow: false,
    status: '확인 불가',
    reason: '영업시간 정보 없음',
  };
  if (storeStatus !== 'ACTIVE') return { ...result, status: '영업 종료', reason: '운영 중지' };
  if (temporarilyClosed === true) return { ...result, status: '임시 휴무', reason: '임시 휴무' };
  const yesterday = hours.find((row) => weekday(row) === (now.day + 6) % 7);
  const active = activity(yesterday, now.minute + 1440) ?? activity(todayHours, now.minute);
  if (active) return { ...result, openNow: active === '영업 중', status: active, reason: active };
  if (todayHours?.is_closed === true) return { ...result, status: '휴무', reason: '정기 휴무' };
  if (
    todayHours &&
    minutes(todayHours.open_time) !== null &&
    minutes(todayHours.close_time) !== null &&
    minutes(todayHours.open_time) !== minutes(todayHours.close_time)
  )
    return { ...result, status: '영업 종료', reason: '영업 종료' };
  return result;
}
