// 담당: 연수
// 쿠지 화면에서 같이 쓰는 상수 · 포맷 함수
export const GRADES = ['A', 'B', 'C', 'D', 'E', 'F'];

// 등급별 색: bg/fg 는 등급 뱃지, hi 는 티켓 속 큰 글자
export const GRADE_COLORS = {
  A: { bg: '#6c4adf', fg: '#fff', hi: '#ffd34d' },
  B: { bg: '#b4a5f8', fg: '#231a4f', hi: '#d4c6ff' },
  C: { bg: '#efebfe', fg: '#5b45d6', hi: '#e6e0ff' },
  D: { bg: '#f5e8ef', fg: '#8a3d63', hi: '#ffd6e8' },
  E: { bg: '#fbf2df', fg: '#8a6417', hi: '#ffe8b3' },
  F: { bg: '#e8f1f8', fg: '#2f6486', hi: '#cfe6f7' },
};

// 목록 썸네일 색 (쿠지 순서대로 돌려 쓴다)
export const TILE_COLORS = [
  { bg: '#eee8fa', fg: 'rgb(108 74 223 / 45%)' },
  { bg: '#fbf2df', fg: 'rgb(190 140 40 / 55%)' },
  { bg: '#e8f1f8', fg: 'rgb(60 120 170 / 50%)' },
];

export const SWAP_FEE = 1990;

export const gradeStyle = (grade) => ({
  background: GRADE_COLORS[grade]?.bg,
  color: GRADE_COLORS[grade]?.fg,
});

export const cx = (...names) => names.filter(Boolean).join(' ');
export const won = (value) => `${Number(value ?? 0).toLocaleString('ko-KR')}원`;
export const pad = (value) => String(value).padStart(2, '0');
export const serialOf = (number) => `${pad(number)}-${(number * 7919) % 9000 + 1000}`;

export function formatOpenAt(value) {
  if (!value) return '';
  const date = new Date(value);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${time}`;
}

export function agoText(value) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}시간 전` : `${Math.round(hours / 24)}일 전`;
}
