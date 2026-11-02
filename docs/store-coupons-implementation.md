# 매장별 쿠폰 구현·검증 보고서

작성일: 2026-11-02 (KST). 작업 브랜치: `feature/M`.

이 문서는 최초 구현 시점의 기록입니다. 이후 추가된 예외처리·현재 검증 결과는 [쿠폰 안정성 후속 보고서](./store-coupons-safety.md)를 확인하세요.

## 프로젝트 확인 및 구현 범위

실제 제공된 작업 폴더는 React/Vite 웹 프론트엔드와 Express/Supabase 백엔드다. React Native/Expo 의존성은 없다. `stores`가 요구사항의 shop, `store_products`가 매장별 판매상품이다. 기존 `coupons.store_id`와 `user_coupons`, 마이페이지 쿠폰 메뉴, 매장별 장바구니 쿠폰 선택 및 주문 견적을 확장했다. 상품별 쿠폰 테이블이나 별도 결제 서비스, 판매자 발행 화면은 만들지 않았다.

- 매장명 오른쪽에 쿠폰 아이콘·화이트 버튼을 추가했다. 긴 이름은 줄바꿈하며 버튼 영역을 침범하지 않는다.
- 로그인 확인 후 현재 매장의 발급 가능한 쿠폰을 조회한다. 유효한 미발급 쿠폰이 없으면 바텀시트를 열지 않고 2초 토스트를 표시한다. 조회/발급 오류는 별도 오류 토스트로 처리한다.
- 기존 `Sheet`와 `CartAddedToast`를 재사용한다. 개별/모두 받기, 발급 완료·소진 표시, 닫기·배경·그립 아래 스와이프, Escape·포커스 이동, Safe Area를 처리한다.
- 마이페이지는 사용 가능/사용 완료/기간 만료 탭, 매장 이동 및 사용 주문 상세 연결을 제공한다. 발급·사용·취소 이벤트는 목록과 요약을 갱신한다.
- 장바구니는 선택된 상품의 매장별 소계를 사용한다. 수량/선택 변경 후 서버의 새 할인액을 반영하고 조건 미달 쿠폰을 제외한다. 계정별로 조회 캐시를 분리한다.
- 주문 서버는 금액을 클라이언트에서 받지 않고 기존 견적 로직으로 재조회한다. 최종 DB 트랜잭션에서 가격·재고·소유권·매장·기간·미사용·최소 금액·할인액을 다시 검증한다.
- 주문/상품 스냅샷/재고/쿠폰 사용/적립금/시연 결제/장바구니 정리를 한 트랜잭션에 저장한다. 실패하면 전부 롤백된다. 사용자 및 판매상품 행 잠금, 요청 ID와 본문 해시로 재사용·중복 주문을 막는다.
- 취소도 기존 PAID 상태·실제 결제 차단 정책을 유지하면서 한 트랜잭션으로 처리한다. 남은 유효기간에 따라 AVAILABLE/EXPIRED로 복원한다. 기존 전체매장 쿠폰 흐름도 유지한다.

## DB 변경

신규 테이블은 없다.

| 대상 | 변경 |
|---|---|
| `coupons` | 기존 `store_id` 재사용. 할인·최소 금액·기간·발급 한도 CHECK, 매장/기간 인덱스, RLS 조회 정책 |
| `user_coupons` | `used_order_id` FK/인덱스 추가. 기존 UNIQUE(user_id,coupon_id) 재사용. 본인 SELECT만 허용 |
| `orders` | `coupon_snapshot`, `checkout_request_id`, `checkout_request_hash` 추가. 사용자/요청/매장 유일 인덱스. 기존 `used_coupon_id`, `discount_amount`, `total_amount` 유지 |
| 기존 주문 관련 테이블 | 스키마는 유지하며 새 원자적 RPC가 기존 주문·상품·결제·재고·적립금 기록에 저장 |

프로젝트의 `RATE`는 요구사항의 PERCENT와 같다. `created_at`은 발급시각이며 `total_quantity`/`issued_count`는 발급 한도/누적 발급 수다.

RPC: `list_store_coupons`, `issue_coupon_atomic`, `issue_store_coupons`, `consume_checkout_coupon`, `commit_coupon_checkout`, `cancel_coupon_order`.

모두 SECURITY INVOKER이고 EXECUTE는 service_role에만 허용한다. Express가 Supabase Auth 토큰을 검증하여 전달한 사용자 ID를 DB가 다시 소유권/활성 계정과 대조한다. 클라이언트의 테이블 직접 발급·상태 변경과 RPC 호출은 차단하고, 보유 쿠폰 SELECT에는 auth.uid() RLS를 적용한다. 서버 전용 키를 프론트에 추가하지 않았다.

## 실제 매장과 테스트 쿠폰

연결 프로젝트 `twjqulccljimqwggzrpf`에서 매장 6곳을 확인했다. 아래 4개는 목업 응답이 아니라 실제 `coupons` 행으로 저장했다. 모두 픽업/배달 사용 가능하고 발급 한도는 각 1,000장이다.

| 매장 | 실제 store_id | 쿠폰 코드 및 혜택 |
|---|---|---|
| 모모굿즈 (A) | `10000000-0000-4000-8000-000000000001` | `SHOP_MOMO_1000`: 10,000원 이상 1,000원 할인 |
| 굿즈플래닛 (B) | `10000000-0000-4000-8000-000000000002` | `SHOP_PLANET_3000`: 20,000원 이상 3,000원 할인 |
| 굿즈플래닛 (B) | 동일 | `SHOP_PLANET_10`: 30,000원 이상 10%, 최대 5,000원 |
| 덕질상점 (C) | `10000000-0000-4000-8000-000000000003` | `SHOP_DEOK_2000`: 15,000원 이상 2,000원 할인 |
| 서면굿즈샵 (D) | `10000000-0000-4000-8000-000000000004` | 쿠폰 없음 |
| 집에서면 (E) | `6d903525-8dee-4ea4-af78-2963c0434014` | 쿠폰 없음 |
| 별빛응원샵 | `d101e327-d58c-4850-938f-386d775c07fb` | 쿠폰 없음 |

유효기간은 실행 시점 기준 전일~90일 뒤로 생성하며 실제 이번 만료일은 **2027-01-31 14:17:03 KST**다. `ON CONFLICT(code) DO NOTHING`으로 재실행 중복을 막는다. 기존 쿠폰·상품·매장·회원·주문·찜 데이터는 초기화하지 않았다. 과거 만료된 기존 쿠폰도 보존했다.

## SQL 파일과 실행 여부

아래 마이그레이션 3개를 해당 원격 Supabase에 **실제로 적용**하고 migration history를 확인했다. 로컬 파일 버전은 원격 적용 기록과 일치한다.

1. `backend/supabase/migrations/20261102051653_store_coupons.sql`: 테이블 확장, RLS, 원자적 발급/주문/취소 RPC.
2. `backend/supabase/migrations/20261102051936_store_coupon_zero_points_fix.sql`: 기존 음수 적립금 계정의 0원 적립금 주문 허용, 선택 장바구니 잠금/수량 재검증.
3. `backend/supabase/migrations/20261102052039_store_coupon_order_number_fix.sql`: 기존 varchar(30) 주문번호와 6자리 픽업 코드 규격 유지.

- `backend/supabase/store_coupons_seed.sql`: **원격 실행 완료**. 실행 후 매장별 유효 쿠폰 수 1/2/1/0/0/0을 확인했다. 로컬 PostgreSQL 테스트에서는 두 번 실행하여 중복이 없음을 확인했다.
- `backend/supabase/store_coupons_verify.sql`: **원격 실행 통과**. 발급·주문·취소·만료·authenticated RLS 검증 후 전체 ROLLBACK. 검증용 `TX_` 쿠폰 잔여 0개, 실제 테스트 시드 보유 쿠폰 잔여 0개를 확인했다. 사용자에게 임의의 영구 테스트 주문을 남기지 않았다.

초기 원격 검증에서 음수 적립금 및 주문번호 길이 경계가 발견되었으며, 위 후속 마이그레이션으로 수정한 최종 상태에서 재검증을 통과했다.

## 검증 결과

- 백엔드 `npm.cmd test`: **81/81 통과**. 새 쿠폰 테스트 14개 포함. PGlite PostgreSQL에서 실제 마이그레이션/시드/PLpgSQL/RLS를 실행한다. 프론트/백엔드 모의 계산만 검증한 테스트가 아니다.
- 백엔드 `npm.cmd run lint`: 통과.
- 프론트 새 `tests/storeCoupons.test.js`: **4/4 통과**. 소계·최소 금액·변경 후 재계산·상한·픽업/배달·배송비 범위를 검증했다.
- 변경한 프론트 JS/JSX 전체 대상 ESLint: 통과.
- 프론트 프로덕션 빌드: 통과. 기존 크기 초과 청크 경고 있음.
- 프론트 전체 테스트: 11개 중 6개 통과, **기존 검색/카테고리 테스트 5개 실패**. 기존 `inStock` 기본값과 `brands`/`includeSoldOut` 직렬화 기대값 불일치이며 해당 구현/테스트 파일은 이번에 수정하지 않았다.
- 프론트 전체 lint: **기존 오류 3개·경고 1개**. `ProductDetailPage.jsx`/`StoreMapPage.jsx`의 effect setState, `SearchPage.jsx`의 Fast Refresh export, `ProductInquirySection.jsx`의 hook 의존성 경고. 쿠폰 변경 파일에는 오류 없음.
- Supabase security advisors: 이번 쿠폰 테이블/RPC에 해당하는 새 경고 없음. 프로젝트의 기존 다른 테이블/함수 경고는 범위 밖이므로 수정하지 않았다.
- `git diff --check`: 통과.

| 요구 시나리오 | 실제 검증 범위 |
|---|---|
| ① 없는 매장 → 2초 토스트 | DB의 빈 목록 검증 완료. UI 분기 및 2,000ms 공통 토스트 연결 완료. 실제 클릭/시간 측정 미실행 |
| ② 있는 매장 → 바텀시트 | DB의 매장별 목록 검증 완료. 기존 Sheet 연결 완료. 실제 화면 미실행 |
| ③ 개별·모두 발급 → DB 저장 | 로컬 PostgreSQL 통과. 원격 개별 발급 및 저장 통과 후 롤백 |
| ④ 재발급 차단 | 로컬/원격 통과 |
| ⑤ 마이페이지 보유 쿠폰 | DB 조회·RLS/영구 저장 경로 검증. 목록/3개 상태 탭 연결 완료. 로그인 브라우저 확인 미실행 |
| ⑥ 같은 매장 여러 상품 할인 | 로컬 합산/주문 및 원격 수량 2개 주문 통과 |
| ⑦ 다른 매장 적용 금지 | 로컬/원격 통과 |
| ⑧ 최소 금액·수량/선택 변경 | 서버/프론트 계산 테스트 및 원격 최소 금액 거절 통과. 실제 UI 조작 미실행 |
| ⑨ 주문 확정 사용 처리·금액 스냅샷 | 로컬/원격 통과 |
| ⑩ 실패 미소모·취소 복원·만료 처리 | 로컬/원격 통과. 다중 매장 부분 실패 전체 롤백 확인 |
| ⑪ 다중 매장·중복 요청 | 로컬/원격 다중 매장 및 동일 요청 ID 재전송 통과. 실제 다중 연결 동시 부하 테스트는 미실행 |
| ⑫ 타 사용자 접근 금지 | 비로그인 API 401, 로컬/원격 authenticated RLS, 타인 쿠폰 사용·직접 조작 차단 통과 |

PGlite의 Promise 병렬 요청은 단일 엔진에서 직렬화되므로 실제 다중 연결 경합의 증거로 취급하지 않는다. 원격 DB에서는 행 잠금과 유일 제약의 적용을 확인하고 재전송을 검증했으며 별도의 동시 부하 발생기는 실행하지 않았다.

## 수정 파일 목록

백엔드 수정:

- `backend/package.json`, `backend/package-lock.json` (테스트 전용 PGlite 0.3.14 고정)
- `backend/src/controllers/checkout.controller.js`
- `backend/src/controllers/coupon.controller.js`
- `backend/src/repositories/coupon.repository.js`
- `backend/src/routes/coupon.routes.js`
- `backend/src/services/checkout.service.js`
- `backend/src/services/coupon.service.js`
- `backend/src/services/order.service.js`

백엔드 신규:

- `backend/src/repositories/couponRpc.js`
- 위에 기록한 마이그레이션 3개, 시드 SQL, 원격 검증 SQL
- `backend/tests/storeCoupons.test.js`
- `backend/tests/fixtures/coupon-schema.sql`

프론트 수정:

- `frontend/src/components/CartAddedToast.jsx`
- `frontend/src/pages/stores/components/StoreInfo.jsx`
- `frontend/src/pages/cart/CartPage.jsx`
- `frontend/src/pages/cart/components/CartStoreGroup.jsx`
- `frontend/src/pages/common/CheckoutPage.jsx`
- `frontend/src/pages/common/CheckoutParts.jsx`
- `frontend/src/pages/common/checkout.api.js`
- `frontend/src/pages/common/checkout.css`
- `frontend/src/pages/common/checkoutFormat.js`
- `frontend/src/pages/my/CouponDetailPage.jsx`
- `frontend/src/pages/my/CouponsPage.jsx`
- `frontend/src/pages/my/OrdersPage.jsx`
- `frontend/src/pages/my/hooks.js`
- `frontend/src/pages/my/my.api.js`

프론트 신규:

- `frontend/src/pages/stores/components/StoreCouponButton.jsx`
- `frontend/src/pages/stores/components/storeCoupons.css`
- `frontend/tests/storeCoupons.test.js`

문서 신규: `docs/store-coupons-implementation.md` (이 파일).

작업 시작 전부터 변경되어 있던 `backend/src/services/showcase.service.js`, `frontend/src/pages/showcases/ShowcasePages.jsx`, `frontend/src/pages/showcases/showcases.css`는 이번 쿠폰 작업에서 편집하지 않았다.

## 남은 연동 및 검증

- DB 적용은 완료했지만 변경한 프론트·백엔드의 외부 서비스 배포는 실행하지 않았다. 운영 앱 반영 시 두 서비스를 함께 배포/재시작해야 한다.
- 현재 Computer Use에 연결 가능한 브라우저가 없고 IAB도 사용할 수 없어, 로그인된 브라우저의 전체 발급→마이페이지→장바구니→주문 내역 클릭 검증을 수행하지 못했다.
- 좁은 화면·키보드·Safe Area·실제 아래 스와이프 및 2초 토스트 시각 검증이 남아 있다. 코드/빌드/SQL 통과를 기기 화면 통과로 간주하지 않는다.
- 실제 iOS/Android 네이티브 앱 런타임은 이 체크아웃에 없다. 해당 Expo 프로젝트가 별도라면 이 웹 코드가 네이티브 앱에 반영되었다고 볼 수 없다.
- 실제 결제 API와 판매자 쿠폰 관리 화면은 요청 범위에 따라 추가하지 않았다.
