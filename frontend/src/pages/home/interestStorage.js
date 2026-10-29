// 관심사 설정은 로그인 기능이 붙기 전까지 이 기기(localStorage)에 저장한다.
// 로그인이 연결되면 user_interest_categories 테이블에 같은 값을 저장하도록 바꾼다.
const KEY = 'goodspick.interestCategoryIds';

// 저장된 값이 없으면 null(기본값 사용), 있으면 id 배열(비어 있어도 사용자가 고른 값)
export function loadInterestIds() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY));
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : null;
  } catch {
    return null;
  }
}

export function saveInterestIds(ids) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // 저장소를 쓸 수 없는 환경에서도 화면은 계속 동작한다.
  }
}

// 관심 브랜드(관심 작품 분류 안에서 고른 브랜드)도 같은 방식으로 저장한다.
const BRAND_KEY = 'goodspick.interestBrands';

export function loadInterestBrands() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(BRAND_KEY));
    return Array.isArray(saved) ? saved.filter((name) => typeof name === 'string') : [];
  } catch {
    return [];
  }
}

export function saveInterestBrands(names) {
  try {
    window.localStorage.setItem(BRAND_KEY, JSON.stringify(names));
  } catch {
    // 저장소를 쓸 수 없는 환경에서도 화면은 계속 동작한다.
  }
}
