// "오늘 기념일인 최애" 화면과 홈 배너 칩이 같이 쓰는 날짜·문구 도우미

// 한국 날짜 기준 오늘(YYYY-MM-DD)
export const kstToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

export const dayParts = (date) => {
  const [year, month, day] = String(date).split('-').map(Number);
  return { year, month, day };
};

// 기념일이 전부 생일이면 "생일", 아니면 "기념일"
export const eventWord = (birthdayOnly) => (birthdayOnly ? '생일' : '기념일');

// 축하 한마디 작성 시각을 서비스 기준 시간대(한국)로 표시한다.
export function congratsTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// "오늘의 생일 최애 3명" / 오늘이 아니면 "12.7 생일 최애 3명"
export function dayChipLabel(date, count, birthdayOnly) {
  const { month, day } = dayParts(date);
  const when = date === kstToday() ? '오늘의' : `${month}.${day}`;
  return `${when} ${eventWord(birthdayOnly)} 최애 ${count}명`;
}

// 화면 제목: "오늘 생일인 최애" / "12월 7일 생일인 최애"
export function dayTitle(date, birthdayOnly) {
  const { month, day } = dayParts(date);
  const when = date === kstToday() ? '오늘' : `${month}월 ${day}일`;
  return `${when} ${eventWord(birthdayOnly)}인 최애`;
}
