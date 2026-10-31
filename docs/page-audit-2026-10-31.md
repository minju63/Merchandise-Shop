# 페이지별 미구현 · 보완 · 피드백 조사 (2026-10-31)

조사 방법: `feature/wishlist` 브랜치 코드 스캔(501 · TODO · mock · 비활성 버튼) + 로컬 실행 화면 확인(비로그인) + Supabase 행 수 확인.
로그인이 필요한 화면(찜 · 장바구니 · 마이 · 결제)은 코드 기준으로만 봤다.

## 우선순위 높음 — 핵심 흐름이 끊김

| # | 페이지 | 내용 | 근거 | 담당 |
|---|---|---|---|---|
| 1 | 장바구니 | **주문하기 버튼이 "준비 중입니다" 토스트만 띄움.** 결제 API는 `mode: CART` + `cartItemIds`를 이미 지원 | `pages/cart/CartPage.jsx` `onOrder` | 동균 · 연수 |
| 2 | 상품 상세 | **지금 구매 · 재입고 알림 · 예약하기 버튼이 항상 비활성.** 라우트가 `wishlist` · `cart` 액션만 넘김 (`buy` · `restock` · `preorder` 없음). 찜 목록에는 같은 기능이 이미 있음 | `App.jsx` `ProductDetailRoute`, `ProductActionBar.jsx` | 은혜 · 동균 · 연수 |
| 3 | 공통(가격) | **할인 가격 기준이 화면마다 다름.** 장바구니 · 찜은 `price × (1 - 할인율)`로 계산하는데, 결제는 `price`를 최종가로 보고 할인율을 다시 빼지 않음 → 장바구니에서 본 금액과 결제 금액이 달라질 수 있음 (핸드오프 문서 IF-016 미확정) | `cart.service.js`, `wishlist.service.js`, `checkout.service.js calculateSalePrice` | 은혜 · 동균 · 연수 |

## 페이지별

### 홈 (민주)
- **알림 벨**: 비활성("알림 목록 화면 준비 중"). 알림 API(`/notifications`)는 전부 501이고 담당도 미정.
- **헤더 배지(알림 · 장바구니)**: `/home` 응답에 `badges`가 없어서 mock 값 0만 표시. 공용 `CartIconBadge.jsx`도 빈 컴포넌트.
- **입고 예정 "오픈 알림" 버튼**: `HomeRoute`가 `onToggleOpenAlert`를 넘기지 않아 동작 안 함. 백엔드 `/open-alerts`도 501.
- **배너**: `GET /banners` 501 (클릭 기록은 구현됨).
- **섹션 더보기 API** `GET /home/sections/:type` 501 — 현재 전체보기는 카테고리 목록으로 보내서 우회 중. API를 쓸지 지울지 결정 필요.
- 인기도 점수 계산 잡(`popularity.job.js`) 미구현 → "인기순" 정렬 근거가 고정값.

### 검색 (민주)
- **처음 쓰는 사람에게도 최근 검색어 5개가 보임** (토끼 키링, 모모굿즈 …). mock 기본값을 fallback으로 씀 → 빈 목록이어야 함.
- 최근 검색어는 브라우저 localStorage에만 저장. 서버 API(`GET/DELETE /search/recent`)는 501 → 기기 바꾸면 사라짐. 어느 쪽으로 갈지 결정.
- **지역 목록이 mock 4개(부산 · 서면 · 홍대 · 성수)로 하드코딩.** "서울 강남 키링" 같은 검색은 지역으로 인식 못 함. DB `regions`도 2행뿐.
- 자동완성 `GET /search/suggest`, 통합검색 `GET /search` 501. 자동완성 판단에 mock `autocompleteItems` 사용 중.

### 카테고리 · 상품 (은혜)
- 상품 상세 **리뷰 탭**: "상품 리뷰는 아직 연결되지 않았습니다." 공개 리뷰 목록 API가 없음 (DB `reviews` 0행).
- 상품 상세 **신고 버튼 없음** — 백엔드 `POST /reports`(PRODUCT · STORE · REVIEW)는 준비됨.
- 상품 상세에 공유 기능 없음 (필요 여부 기획 확인).
- 품절 상품 상세에서 "20% 6,000원"처럼 할인율만 있고 원가 표시가 없음 → 위 #3 가격 기준 확정 후 같이 정리.
- 빈 CSS 파일 정리: `CategoryPage.css`, `ProductDetailPage.css`, `ProductListPage.css`.
- `CategoryPreview.jsx`(mock 데모 화면)가 아직 남아 있음 — 배포 전 제거 여부.

### 굿즈샵 (여경)
- 헤더 알림 버튼 비활성("알림 화면 준비 중") — 알림 담당 미정 문제와 같음.
- 매장 신고 버튼 없음 (`POST /reports` STORE).
- `pages/stores/components/Icon.jsx` 빈 파일.
- 배송비 계산용 `regions` 2행 · `store_delivery_areas` 1행 → 대부분 매장에서 배달 결제 불가(`canSubmit=false`) 예상.

### 찜 · 장바구니 (동균)
- 찜 카드: 입고 예정(`UPCOMING`) 상품을 민주님 오픈 알림으로 분기해야 함 (코드 TODO, 팀 협의 필요).
- 재입고 알림 신청 **목록 · 해제 화면 없음** — 마이 알림 설정(M-10)에서 진입해야 함 (IF-011).
- `restockAlert.api.js`는 TODO 빈 파일 — 실제 호출은 `wishlist.api.js` 안에 있음. 정리 필요.
- 오늘 반영: 품절 삭제 버튼, 장바구니 담기 후 이동 대신 토스트, 찜 목록 정렬.

### 결제 · 마이 (연수)
- **판매자 센터**: 내 매장 이름 · 주소만 보여줌 (주문 관리 · 상품 관리 없음).
- **픽업 QR 수령 확인**: 고객 쪽 QR은 있음. 판매자가 스캔해서 `COMPLETED`로 바꾸는 API가 없음.
- 주문 상태 `PREPARING` · `READY_FOR_PICKUP` · `SHIPPING`으로 바꾸는 판매자 기능 없음 → 주문이 `PAID`에서 멈춤.
- 고객센터: `notices` · `faqs` 0행 → 공지 · FAQ 화면이 비어 있음.
- `OrdersPage.jsx` 재구매 실패 시 `window.alert` 사용 — 다른 화면처럼 토스트로 통일.
- 닉네임 금칙어 필터 미구현.

### 공통 · 알림 (담당 미정)
- 알림 기능 전체(목록 · 읽음 · 배지) 미구현, **담당자부터 정해야 함.**
- 알림을 누가 만들지(주문 · 취소 · 문의 답변 · 쿠폰 만료) 미정 (IF-023). `notifications` 0행.
- `Header.jsx` 빈 컴포넌트 — 화면마다 헤더를 따로 구현 중.
- 핸드오프 문서(`team-handoff-specs.md`)의 전달 상태가 전부 "미전달"로 남아 있음 → 실제 진행 상황으로 갱신 필요.

## 데이터 현황 (Supabase 행 수)

| 테이블 | 행 수 | 영향 |
|---|---|---|
| products / store_products | 175 / 177 | 충분 |
| stores | 6 | |
| regions / store_delivery_areas | 2 / 1 | 배달 결제 · 지역 검색 대부분 불가 |
| coupons / membership_plans | 4 / 3 | |
| notices / faqs | 0 / 0 | 고객센터 빈 화면 |
| reviews | 0 | 리뷰 화면 확인 불가 |
| notifications / open_alerts | 0 / 0 | 기능 미구현 |
| banners | 7 | |

## 회의에서 정해야 할 것
1. 알림 담당자
2. `price`가 원가인지 최종가인지 (IF-016) — 장바구니 · 찜 · 상품 상세 · 결제 한 기준으로
3. 최근 검색어 저장 위치 (localStorage vs 서버)
4. `GET /home/sections/:type` 사용 여부
5. 판매자 기능(주문 상태 변경 · QR 수령 확인) 범위와 담당
