const pad = (value) => String(value).padStart(2, '0');

export function getTimeParts(date) {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

// 한국 시간 기준 오픈 문구. 오늘 오픈이면 남은 시간(countdownText)도 함께 돌려준다.
export function formatOpenTime(openAt, currentTimestamp) {
  const openTimestamp = new Date(openAt).getTime();
  const remaining = openTimestamp - currentTimestamp;
  const parts = getTimeParts(new Date(openAt));
  const currentParts = getTimeParts(new Date(currentTimestamp));
  const isToday = parts.year === currentParts.year
    && parts.month === currentParts.month
    && parts.day === currentParts.day;
  const text = isToday
    ? `오늘 ${parts.hour}:${parts.minute} 오픈`
    : `${parts.month}.${parts.day} (${parts.weekday}) ${parts.hour}:${parts.minute} 오픈`;

  if (isToday) {
    const totalSeconds = Math.max(0, Math.floor(remaining / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { text, countdownText: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` };
  }

  return { text, countdownText: null };
}
