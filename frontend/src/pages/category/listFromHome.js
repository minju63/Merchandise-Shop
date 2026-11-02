// 홈에서 들어온 상품 목록인지 세션에 기억한다.
// 필터·정렬을 바꾸거나 새로고침해도 뒤로가기가 카테고리가 아니라 홈으로 가게 하려는 것.
const KEY = 'goodspick:list-from-home';

export function rememberListFromHome() {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만 기억한다
  }
}

export function forgetListFromHome() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}

export function isListFromHome() {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
