# 홈·검색 화면 구현 인수인계

## 기본 정보

- 작업 브랜치: `feature/home-layout`
- 작성일: 2026-10-09
- 패키지 추가: 없음
- 데이터 연결 상태: 프런트 화면은 목업 데이터 중심
- 커밋 및 push: 아직 수행하지 않음

## 구현 범위

### 1. 홈 화면

- 서비스명 `굿즈픽`과 검색·알림·장바구니 아이콘
- 알림·장바구니 임시 개수 배지
- 이벤트·프로모션·광고 배너
  - 노출 기간에 포함되는 배너만 표시
  - 광고 배너 `AD` 라벨 표시
  - 자동 전환 및 마우스/터치 드래그 전환
  - 배너 노출·클릭 콜백 자리 마련
- 홈 카테고리 바로가기
  - 아이돌, 애니메이션, 포토카드, 키링, 전체
  - `isHomeShortcut`, `sortOrder` 기준으로 노출
- 지금 뜨는 굿즈
  - 인기/신상품 탭
  - 인기 탭 순위 표시
  - 신상품 `NEW` 라벨 표시
- 회원님을 위한 추천
  - 임시 로그인 상태와 관심 카테고리 ID를 기준으로 조건부 표시
  - 로그인 + 관심사 있음: 카테고리 칩과 매칭 상품 표시
  - 로그인 + 관심사 없음: 관심사 설정 안내 카드
  - 비로그인: 로그인 안내 카드
  - 매칭 상품 없음: `관심 카테고리의 상품을 준비 중이에요` 표시
  - 로그인·관심사 설정·상품 상세 경로가 없어 관련 동작은 비활성 상태
- 입고 예정 상품
  - 현재 이후 14일 이내 상품을 오픈 시각 오름차순, 알림 수 내림차순 정렬
  - 출시 예정/재입고 예정 라벨
  - 한국 시간 기준 오늘 오픈이면 검은 영역에 실시간 `HH:mm:ss 후 오픈` 표시
  - 모든 카드에 `오늘 HH:mm 오픈` 또는 `MM.DD (요일) HH:mm 오픈` 표시
  - 예시 확인을 위해 첫 상품은 페이지 로드 시점에서 42분 뒤 오픈하도록 설정
  - 오픈 시각이 지나면 입고 예정 목록에서 제외하고 신상품 목록에 포함
- 재고 얼마 안 남은 상품
  - 재고 1~10개만 표시
  - 남은 수량 오름차순 정렬
- 상품 목록 가로 스크롤 및 마우스 드래그
- 모바일 최대 폭 480px 중앙 정렬
- safe area를 반영한 고정 하단 탭바

현재 홈 섹션 순서:

1. 지금 뜨는 굿즈
2. 회원님을 위한 추천
3. 입고 예정 상품
4. 재고 얼마 안 남은 상품

### 2. 검색 화면

- 검색 입력 전 화면
  - 최근 검색어 최대 10개
  - 개별 삭제 및 전체 삭제
  - 비로그인 사용자는 `localStorage` 이용
  - 인기 검색어 1~10위와 순위 변동 표시
- 자동완성
  - 한 글자 이상 입력 후 300ms debounce
  - 최대 8개
  - 굿즈, 작품, 캐릭터, 굿즈샵, 지역 태그
  - 검색어 일치 부분 보라색 강조
- 지역 검색
  - 시/도, 시/군/구, 상권 별칭 처리
  - 공백 단위 지역 분리 및 붙여 쓴 지역 접두어 처리
  - 지역 결과가 없으면 전국 결과로 대체
  - 적용 지역 칩 및 전국에서 보기 제공
- 검색 결과 없음
  - 결과 없음 안내
  - 인기 검색어 5개 재검색 칩
  - 검색 로그 콜백 제공
- 검색 결과에서 상품·굿즈샵 분리 표시
- 굿즈샵 상세 화면은 담당 범위가 아니어서 삭제
  - `/shops/:shopId` 라우트 없음
  - 굿즈샵 자동완성과 결과 카드는 표시만 하며 클릭 비활성
- 검색 화면 하단 탭의 홈 버튼은 `/`로 이동

### 3. 재사용 컴포넌트

- `ProductCard.jsx`
  - 일반 상품, 순위, NEW, 재고 부족 라벨 지원
  - 이미지가 없으면 파스텔 자리표시자 표시
  - 향후 상품 상세 콜백을 받을 수 있도록 선택적 `onClick` 지원
- `UpcomingProductCard.jsx`
  - 출시/재입고 구분
  - 한국 시간 오픈 시각과 오늘 카운트다운
  - 알림 신청 버튼 상태 지원

### 4. 백엔드 초안

계층형 구조를 사용한다.

```text
backend/src/
├─ routes/          URL 등록
├─ controllers/     HTTP 요청·응답
├─ services/        비즈니스 규칙
├─ repositories/    Supabase 조회·저장
├─ middlewares/     인증 검사
├─ jobs/            예약 작업
└─ lib/             Supabase 클라이언트
```

추가된 API 초안:

- `GET /api/v1/home/sections/upcoming`
- `POST /api/v1/products/:id/open-alert`
- `DELETE /api/v1/products/:id/open-alert`
- `POST /api/v1/search/logs`

인증 미들웨어:

- `requireAuth`: 유효한 Bearer 토큰 필수
- `optionalAuth`: 토큰이 있으면 사용자 정보 설정, 없어도 요청 허용

예약 작업:

- 오픈 시각이 지난 입고 예정 상품을 `ON_SALE`로 변경하는 작업 초안

## 임시 데이터 변경 방법

홈 사용자 상태는 `frontend/src/pages/home/homeMockData.js`의 다음 값으로 전환한다.

```js
export const homeMockUserState = {
  isAuthenticated: true,
  interestCategoryIds: ['idol', 'photocard'],
};
```

상태별 예시:

```js
// 로그인 + 관심사 있음
{ isAuthenticated: true, interestCategoryIds: ['idol', 'photocard'] }

// 로그인 + 관심사 없음
{ isAuthenticated: true, interestCategoryIds: [] }

// 비로그인
{ isAuthenticated: false, interestCategoryIds: [] }
```

## 주요 파일

### 프런트엔드

- `frontend/src/App.jsx`
- `frontend/src/components/ProductCard.jsx`
- `frontend/src/components/UpcomingProductCard.jsx`
- `frontend/src/pages/home/HomePage.jsx`
- `frontend/src/pages/home/HomePage.css`
- `frontend/src/pages/home/homeMockData.js`
- `frontend/src/pages/search/SearchPage.jsx`
- `frontend/src/pages/search/SearchPage.css`
- `frontend/src/pages/search/searchMockData.js`

### 백엔드

- `backend/src/app.js`
- `backend/src/lib/supabase.js`
- `backend/src/middlewares/auth.middleware.js`
- `backend/src/routes/upcoming.routes.js`
- `backend/src/controllers/upcoming.controller.js`
- `backend/src/services/upcoming.service.js`
- `backend/src/repositories/upcoming.repository.js`
- `backend/src/jobs/upcoming-products.job.js`
- `backend/src/routes/search.routes.js`
- `backend/src/controllers/search.controller.js`
- `backend/src/services/search.service.js`
- `backend/src/repositories/search.repository.js`

## 실행 방법

프런트엔드:

```bash
cd frontend
npm install
npm run dev
```

백엔드:

```bash
cd backend
npm install
npm run dev
```

Windows PowerShell 실행 정책으로 `npm.ps1`이 차단되면 `npm.cmd`를 사용한다.

```powershell
npm.cmd run dev
```

## 환경변수

실제 값은 `.env`에만 저장하고 Git에 올리지 않는다.

프런트엔드:

```env
VITE_API_BASE_URL=http://localhost:4000/api/v1
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

백엔드:

```env
PORT=4000
CLIENT_URL=http://localhost:5173
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY`, Secret Key, DB 비밀번호는 프런트엔드에 넣지 않는다.

## 검증 결과

2026-10-09 기준:

```text
frontend: npm.cmd run lint  통과
frontend: npm.cmd run build 통과
backend:  npm.cmd run lint  통과
```

## 아직 연결하지 않은 기능

- 실제 로그인 및 사용자 인증 상태
- 관심 카테고리 조회·저장
- 실제 추천 API와 추천 점수 계산
- 상품 상세 화면 및 상품 카드 이동
- 찜 저장
- 알림·장바구니 화면과 실제 개수 조회
- 카테고리 및 전체보기 화면 이동
- 배너 링크별 실제 화면 이동
- 입고 알림 푸시 발송
- 굿즈샵 상세 화면
- 홈 목업 데이터의 Supabase 저장 및 실제 조회

## Supabase 주의사항

- 현재 홈과 검색 화면은 목업 데이터를 사용한다.
- `backend/supabase/upcoming_products.sql`, `search_logs.sql`은 실제 운영 DB에 실행하지 않은 초안이다.
- 해당 SQL은 현재 Supabase 스키마와 타입·컬럼 차이가 있을 수 있으므로 그대로 실행하지 않는다.
- DB 작업은 담당자와 실제 스키마를 다시 확인한 뒤 진행한다.

## 커밋 전 확인

- `.env`와 Supabase 비밀 키가 stage에 포함되지 않았는지 확인
- `frontend/.env.example` 삭제가 의도한 변경인지 확인
- 본인 담당이 아닌 파일 변경이 섞이지 않았는지 확인
- 공통 파일인 `frontend/src/App.jsx`, `backend/src/app.js`는 담당자와 충돌 여부 확인
- `backend/supabase/*.sql`을 이번 커밋에 포함할지 담당자와 결정

## 이슈 번호 및 커밋 메시지

현재 브랜치명과 로컬 커밋 기록에서는 연결된 이슈 번호를 확인할 수 없다.

- 현재 브랜치: `feature/home-layout`
- 이슈 번호: 미확정

이슈가 이미 있다면 GitHub Issues에서 해당 작업 카드의 `#번호`를 사용한다. 없다면 팀 규칙에 따라 이슈를 먼저 생성한 뒤 번호를 사용한다.

예시:

```text
feat: #이슈번호 홈 및 검색 화면 구현
```

작업을 나누어 커밋한다면:

```text
feat: #이슈번호 홈 화면 및 사용자 추천 UI 구현
feat: #이슈번호 검색 및 자동완성 화면 구현
feat: #이슈번호 입고 예정·검색 로그 API 초안 구현
```

팀에서 `#번호`를 제목 뒤에 붙이는 규칙이라면 다음처럼 맞춘다.

```text
feat: 홈 및 검색 화면 구현 (#이슈번호)
```
