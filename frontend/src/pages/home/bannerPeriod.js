const formatDate = (value) => new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(value)).replace(/\.\s*$/, '');

export function formatPeriod({ startAt, endAt }) {
  if (!startAt && !endAt) return '상시 진행';
  return `${startAt ? formatDate(startAt) : ''} ~ ${endAt ? formatDate(endAt) : ''}`;
}
