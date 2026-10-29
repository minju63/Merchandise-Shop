# 홈 화면 DB 연동 정리

`GET /api/v1/home` 이 아래 테이블에서 데이터를 읽어 홈 화면 6개 섹션을 만든다.
(코드: `backend/src/repositories/home.repository.js`, `backend/src/services/home.service.js`)

## 1. 이번에 DB에 새로 넣은 테스트 데이터

### banners (3행)

| 제목 | link_type | is_sponsored | sponsor_store_id | 기간 |
|---|---|---|---|---|
| 내 주변 굿즈샵 재고, 픽업까지 한 번에 | NONE | false | - | 어제 ~ +30일 |
| 포카 바인더 전 품목 20% 할인 | STORE | true | 모모굿즈 (`10000000-...0001`) | 어제 ~ +30일 |
| 최애 포토카드 최대 20% 할인 | CATEGORY | false | - | 어제 ~ +30일 |

공통: `slot = HOME_TOP`, `sort_order` 1·2·3, `is_active = true`.
`image_url`은 필수 컬럼이라 기존 상품 이미지 주소를 임시로 넣었다 (화면에서는 아직 사용 안 함).

### products (4행)

| id 끝자리 | name | status | base_price | open_at | alert_count | popularity_score |
|---|---|---|---|---|---|---|
| 101 | 별빛소녀 한정판 피규어 | UPCOMING | 39,000 | 입력 시점 +42분 | 1284 | 0 |
| 102 | 컴백 기념 포토카드 세트 | UPCOMING | 19,000 | +2일 | 862 | 0 |
| 103 | 콘서트 공식 응원봉 | UPCOMING | 39,000 | +5일 | 512 | 0 |
| 104 | 루미나 랜덤 포토카드 2탄 | ON_SALE | 5,000 | - | 640 | 60 |

id 형식: `20000000-0000-4000-8000-000000000101` ~ `...104`

### store_products (4행)

| product | 굿즈샵 | price | stock | status | restock_expected_at |
|---|---|---|---|---|---|
| 101 | 모모굿즈 | 39,000 | 0 | UPCOMING | - |
| 102 | 모모굿즈 | 19,000 | 0 | UPCOMING | - |
| 103 | 굿즈플래닛 | 39,000 | 0 | UPCOMING | - |
| 104 | 모모굿즈 | 5,000 | 0 | SOLD_OUT | +3일 |

### product_categories (4행)

| product | 카테고리 |
|---|---|
| 101 | 피규어 |
| 102 | 포토카드 |
| 103 | 아이돌 |
| 104 | 포토카드 |

기존 데이터는 수정·삭제하지 않았다. 지울 때는 상품 id 끝자리 101~104와 `banners` 3행(`slot = HOME_TOP`)을 기준으로 삭제한다.

## 2. 홈 화면 섹션별로 읽어오는 데이터

| 섹션 | 읽는 테이블 · 컬럼 | 조건 / 정렬 |
|---|---|---|
| 배너 | `banners` (title, image_url, link_type, link_id, is_sponsored, sponsor_store_id, starts_at, ends_at, click_count) + `stores.name` (광고 배너의 광고주명) | `slot = HOME_TOP`, `is_active = true`, 노출 기간 안, `sort_order` 오름차순 |
| 지금 뜨는 굿즈 · 인기 | `products` (name, thumbnail_url, popularity_score) + `store_products` (price, discount_rate, stock, pickup/delivery_available) + `stores.name` + `product_categories` → `categories.name` | `products.status = ON_SALE`, 판매 가능한 샵 상품이 있는 것, `popularity_score` 내림차순, 10개 |
| 지금 뜨는 굿즈 · 신상품 | 위와 동일 | `released_at` (없으면 `created_at`) 내림차순, 10개 |
| 회원님을 위한 추천 | 위와 동일 + `categories.code` | `popularity_score` 내림차순, 30개. 카테고리 코드를 `CONTENT_IDOL` → `idol` 처럼 바꿔 관심 카테고리와 매칭 |
| 입고 예정 (출시) | `products` (status = UPCOMING, open_at, alert_count) + 대표 `store_products` / `stores.name` | `open_at` 오름차순, `alert_count` 내림차순, 10개 |
| 입고 예정 (재입고) | `store_products` (status = SOLD_OUT, restock_expected_at > 현재) + `products` (alert_count) | 위 출시 예정과 합쳐서 정렬 |
| 재고 얼마 안 남은 상품 | `store_products` (stock 1~10, status = ON_SALE) + `products` + `stores.name` | `stock` 오름차순, 10개. 같은 상품도 샵마다 따로 표시 |

### 공통 규칙
- 굿즈샵은 `stores.status = ACTIVE` 인 곳만 사용.
- 대표 판매 상품: 판매 중이고 재고가 있는 샵 상품 중 할인 적용가가 가장 싼 것.
- 가격 = `store_products.price` × (100 − `discount_rate`) / 100.
- 카드 재고 문구: 재고 5개 이하면 `재고 N개`(빨간색), 그 외 `재고 있음`.

## 3. 아직 DB와 연결하지 않은 것 (목업 유지)

| 항목 | 현재 | 연결 시 사용할 테이블 |
|---|---|---|
| 알림·장바구니 배지 숫자 | `homeMockData.badges` | `notifications`, `cart_items` |
| 카테고리 바로가기 | `homeMockData.categories` (`categories.is_home_shortcut`이 전부 false) | `categories` |
| 로그인 상태 · 관심 카테고리 | `homeMockUserState` | `users`, `user_interest_categories` |
| 입고 알림 신청 | 버튼 비활성 | `open_alerts` (신출시), `restock_alerts` (재입고) |
