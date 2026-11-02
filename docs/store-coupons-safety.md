# 굿즈샵 쿠폰 예외처리·안정성 후속 보고서

2026-11-02 KST, `feature/M`. 최초 구현을 유지하면서 이번 요청에 추가한 변경만 정리한다.

## 변경된 로직

### 발급 만료·소진·부분 성공

- DB가 쿠폰 행 잠금 이후 `clock_timestamp()`로 발급 기간을 재검증한다. 트랜잭션 시작 시각인 `now()` 때문에 잠금 대기 중 만료를 놓치지 않는다.
- 바텀시트의 실제 요청 쿠폰 ID들을 서버로 보내며 서버가 매장 귀속, 활성 상태, 기간, 실제 발급 행 수를 검증한다. UNIQUE(user_id,coupon_id)와 기존 행 잠금은 유지한다.
- `issue_store_coupons_checked`는 `ISSUED`, `ALREADY_OWNED`, `COUPON_ISSUE_EXPIRED`, `COUPON_SOLD_OUT`, `COUPON_NOT_ISSUABLE`, `COUPON_NOT_FOUND`를 쿠폰별로 반환한다. 기존 3개 인자 RPC도 유지한다.
- 모두 받기는 예상 가능한 만료·소진을 쿠폰별 실패로 분리하여 정상 쿠폰을 발급한다. 예상하지 못한 DB 오류는 트랜잭션 전체를 롤백한다.
- 단건 만료에는 `쿠폰 발급 기간이 종료되었습니다.`, 소진에는 `쿠폰이 모두 소진되었습니다.`를 표시한다. 일부 성공 시 성공/실패 수와 쿠폰별 사유를 기존 시트 안에 표시한다.
- 발급 응답의 최신 목록으로 만료 쿠폰을 제외하고 소진 버튼을 비활성화한다. `받을 수 있는 쿠폰이 없습니다.`는 정상 조회 결과에 미발급·유효·잔여 쿠폰이 없는 경우에만 사용한다.

### 주문 중 만료·수량·판매 상태·금액 변경

- 서버 견적이 만료/사용 완료/최소 금액 미달 등으로 판단한 쿠폰은 선택 해제하고, 할인/최종금액을 재조회하며 기존 결제 동의를 해제한다.
- 확정 직전 DB 검증에서도 같은 상태를 다시 검사한다. 여러 매장 주문 처리 중 만료되는 경우를 위해 트랜잭션 마지막에도 기간을 확인하고, 실패하면 쿠폰·주문·재고·결제·적립금 변경 전체를 롤백한다.
- 기존 재고 오류/품절 상품 제외 흐름은 유지한다. 쿠폰 최소 금액 계산에는 해당 매장의 실제 주문 가능한 상품만 포함하며, 다른 매장 상품금액이나 배송비를 더하지 않는다.
- 확정 트랜잭션에서 판매상품과 원본 상품의 판매 상태/오픈 시각/가격/재고/수량을 검증하고 선택 장바구니 수량도 재검증한다.
- 장바구니가 표시용 할인율을 DB의 최종 판매가에 다시 적용하던 부분을 수정했다. 주문 견적과 동일한 `store_products.price`를 사용하며 기존 가격 표시 형태는 유지한다.
- 견적에 `confirmationToken`을 추가했다. 서버가 산출한 금액·수량·매장별 할인·배송비 확인 값과 주문 직전 견적이 다르면 `CHECKOUT_QUOTE_CHANGED`로 중단한다. 클라이언트가 보낸 가격/할인액으로 주문을 만들지 않는다.
- 장바구니와 주문 견적은 30초 간격 및 화면 복귀/온라인 복귀 시 다시 조회한다. 명시적인 수량/선택 변경은 기존 쿼리 갱신 흐름으로 즉시 재계산한다. 조회 오류만으로 쿠폰을 제거하거나 쿠폰 없음으로 표시하지 않는다.

요청한 안내 문구를 적용했다.

- `선택한 쿠폰의 사용 기간이 종료되었습니다. 주문금액을 다시 확인해 주세요.`
- `주문금액이 변경되어 쿠폰 적용 조건을 충족하지 않습니다.`
- 사용 완료 쿠폰에는 이미 사용한 쿠폰임을 안내하고 재사용을 차단한다.

### 앱 종료·응답 소실·재전송

- 발급 전 계정/매장별 보류 요청을 로컬 저장소에 기록한다. 응답 소실 시 서버의 보유 쿠폰 ID들을 재조회한다. 이미 만료된 보유 쿠폰도 발급 성공 여부를 확인할 수 있다.
- 아직 요청이 보이지 않는 상황은 실패로 단정하지 않는다. 미확정 상태는 보관하고, 재진입/포커스/온라인 복귀 때 조회한다. 사용자가 상태 확인을 다시 누르면 동일 쿠폰들만 안전하게 재시도한다.
- 주문 요청 ID와 원래 본문을 계정별 로컬 저장소에 전송 전에 기록한다. 이전 미확정 요청이 있는 동안 다른 본문으로 새 주문을 만들지 않는다.
- `GET /checkout/requests/:requestId`는 인증된 사용자의 주문만 찾아 기존 주문 결과를 반환한다. 행이 아직 없다는 이유만으로 실패라고 응답하지 않고 `UNKNOWN`을 반환한다.
- 재진입 시 기존 요청을 먼저 조회한다. 미확정이면 일반 주문 버튼/입력을 막고 기존 오류 안내와 재확인 버튼을 제공한다. 재시도는 원래 ID/본문을 사용한다.
- 서버도 확정 응답 소실/중복 재전송 시 기존 주문을 다시 조회한다. 이 경로에서 쿠폰을 임의로 복구하거나 사용 가능으로 변경하지 않는다.
- 기존 주문 요청 ID/매장 유일 인덱스 및 트랜잭션 잠금을 유지한다. 처리 결과가 끝내 확인되지 않으면 보류를 유지하며 새 주문을 허용하지 않는다.

### 전체 취소·부분 취소

- 기존 시스템은 주문 전체 취소와 완료 상품의 반품/교환 **요청 접수**를 제공한다. 주문 상품별 취소 수량/할인 배분/부분 환불 실행 API나 원장은 없다. 새 부분 취소 UI나 환불 실행 기능을 추가하지 않았다.
- 전체 취소는 기존 원자적 RPC를 유지한다. 잠금 대기 중 만료되어도 취소 시점의 DB 시각으로 `AVAILABLE`/`EXPIRED`를 결정한다.
- 향후 확장을 위한 `quotePartialCouponCancellation` 계산 함수를 추가했다. 현재 `coupons` 정책 대신 주문의 불변 `coupon_snapshot` 정책을 입력받는다.
- 누적 취소금액, 기존 환불금액, 남은 상품금액과 할인액을 계산한다. 최소 금액 미달이면 혜택을 회수하며, 총 환불은 실제 상품 결제액을 초과하지 않는다.
- 예: 20,000원 구매/3,000원 할인/최소 20,000원에서 1,000원 취소 시 남은 19,000원은 최소 미달이다. 할인 회수 때문에 추가 정산 2,000원이 필요하므로 `canRefund=false`이며 임의로 음수 환불이나 과다 환불을 실행하지 않는다.
- 부분 취소를 실제로 연결하려면 상품별 취소 수량과 요청 ID, 누적 환불 원장, 배송비/적립금/전체매장 쿠폰 배분, 추가 정산 정책, 한 트랜잭션 안의 중복 요청 방지가 필요하다. 과거 스냅샷이 없는 주문에는 별도 정책이 필요하다. 이 실행 기능은 이번 범위에서 구현하지 않았다.

## DB 및 SQL 실행

신규 테이블, 기존 데이터 초기화, 기존 시드 변경은 없다. 기존 쿠폰/주문 함수와 권한 구조를 확장했다. 신규 RPC도 SECURITY INVOKER이며 service_role에만 EXECUTE를 허용했다. 클라이언트의 보유 쿠폰 조회에는 기존 auth.uid() RLS가 유지된다.

아래 **두 마이그레이션을 원격 프로젝트 `twjqulccljimqwggzrpf`에 실제 적용**하고 migration history와 로컬 파일 버전을 맞췄다.

1. `backend/supabase/migrations/20261102055025_store_coupon_exception_safety.sql`
2. `backend/supabase/migrations/20261102055905_store_coupon_cancellation_clock.sql`

`backend/supabase/store_coupons_safety_verify.sql`과 확장한 `store_coupons_verify.sql`을 원격에서 실행해 통과했다. 검증용 발급/주문/상태 변경은 ROLLBACK했다.

실제 동시 HTTP 발급 검증에서는 새로 만든 임시 쿠폰 1장만 사용했다. 두 요청은 각각 시작 후 281ms/282ms에 응답했으며 최대 동시 진행 요청은 2개였다. 한 요청 `ISSUED`, 다른 요청 `COUPON_SOLD_OUT`, DB issued_count=1/실제 발급 행=1을 확인했다. 이후 **이번 검증에서 만든 쿠폰 ID에 속한 행만** 제거했고 잔여 쿠폰/발급 행 0개를 재조회했다. 기존 사용자/상품/매장/주문/찜/보유 쿠폰을 삭제하지 않았다.

기존 시드의 코드, 매장 연결, 유효기간 및 issued_count=0이 유지됨을 확인했다.

- 모모굿즈: `SHOP_MOMO_1000`
- 굿즈플래닛: `SHOP_PLANET_3000`, `SHOP_PLANET_10`
- 덕질상점: `SHOP_DEOK_2000`

쿠폰 테이블/RPC에 해당하는 새 security advisor 경고는 없었다.

## 검증 결과와 한계

| 시나리오 | 결과 |
|---|---|
| 1. 발급 버튼 클릭 시 만료 | 로컬 PostgreSQL 및 원격 SQL 통과. 트랜잭션 시작 이후 만료도 검사 |
| 2. 수량 소진/모두 받기 부분 성공 | 로컬/원격 SQL 통과. 프론트 메시지 분기 테스트 통과 |
| 3. 마지막 쿠폰 동시 발급 | 실제 Supabase HTTP 동시 요청 2개에서 1개만 발급 확인. 대규모 부하 테스트는 미실행 |
| 4. 주문 확정 직전 만료·이미 사용 | 로컬/원격 SQL 거절 및 미소모 확인. 선택 해제와 재확인은 코드 연결, 화면 클릭 미실행 |
| 5. 수량 감소/매장 최소 금액 미달 | 서버 계산·프론트 상태 전이 테스트 통과. 다른 매장 금액 불합산 확인 |
| 6. 적용 후 품절·중단·삭제·가격 변경 | 로컬 실제 SQL 롤백 및 서버 견적 확인 값 변경 테스트 통과 |
| 7. 전체/부분 취소 | 전체 취소 원격 통과. 부분 취소 계산 테스트 통과, 실제 부분 취소 실행 기능 없음 |
| 8. 발급 응답 소실 | 주입한 네트워크 실패로 재조회/성공 복구/미확정 보관 테스트 통과 |
| 9. 주문 응답 소실·앱 재진입·재전송 | 저장소/전송 계층을 주입한 테스트 통과. 원격 DB 동일 요청 재전송도 기존 회귀 검증 통과 |
| 10. 타 사용자 접근 | 비로그인 API 401, DB 소유권/RLS, 계정별 보류 요청 분리, 타 매장 발급 차단 통과 |

- 백엔드 전체 테스트 **92/92 통과**, 백엔드 lint 통과.
- 쿠폰 관련 프론트 테스트 **12/12 통과**. 이번 추가는 8개이며 기존 쿠폰 계산 4개를 포함한다.
- 변경한 프론트 JS/JSX lint 통과, 프로덕션 빌드 통과.
- 프론트 전체 테스트는 **19개 중 14개 통과/기존 검색·카테고리 5개 실패**. 해당 실패 파일은 수정하지 않았다. 기존 전체 프론트 lint 오류 3곳도 쿠폰 범위 밖이며 변경하지 않았다.
- 현재 연결 가능한 브라우저가 없어 실제 바텀시트 클릭/스와이프, 화면상 금액 및 동의 재확인, 실제 브라우저 강제 종료, 기기 네트워크 차단은 실행하지 못했다. 자동 테스트의 네트워크 실패/저장소 재구성 시뮬레이션을 실제 기기 검증으로 주장하지 않는다.
- 이 체크아웃은 React/Vite 웹이다. 별도 Expo/네이티브 앱 런타임 검증은 하지 않았다.
- 원격 DB 적용은 완료했지만 웹/Express 외부 배포는 하지 않았다. 새 견적 확인 값과 복구 API를 사용하므로 프론트와 백엔드는 함께 배포해야 한다.

## 이번 요청에서 수정·추가한 파일

백엔드:

- `backend/src/controllers/checkout.controller.js`
- `backend/src/routes/checkout.routes.js`
- `backend/src/repositories/coupon.repository.js`
- `backend/src/repositories/couponRpc.js`
- `backend/src/services/cart.service.js`
- `backend/src/services/checkout.service.js`
- `backend/src/services/coupon.service.js`
- `backend/src/services/couponCancellationQuote.js` (신규)
- 위 마이그레이션 2개 (신규)
- `backend/supabase/store_coupons_safety_verify.sql` (신규)
- `backend/supabase/store_coupons_verify.sql`
- `backend/tests/couponExceptionSafety.test.js` (신규)
- `backend/tests/storeCoupons.test.js`
- `backend/tests/fixtures/coupon-schema.sql`

프론트:

- `frontend/src/pages/stores/components/StoreCouponButton.jsx`
- `frontend/src/pages/cart/CartPage.jsx`
- `frontend/src/pages/cart/CartPage.css`
- `frontend/src/pages/cart/components/CartStoreGroup.jsx`
- `frontend/src/pages/common/CheckoutPage.jsx`
- `frontend/src/pages/common/checkout.api.js`
- `frontend/src/pages/common/checkoutRecovery.js` (신규)
- `frontend/src/pages/common/couponSafety.js` (신규)
- `frontend/src/pages/my/my.api.js`
- `frontend/src/components/CartAddedToast.css` (긴 예외 문구의 좁은 화면 줄바꿈만 보강)
- `frontend/tests/couponSafety.test.js` (신규)

문서:

- `docs/store-coupons-safety.md` (신규, 이 파일)
- `docs/store-coupons-implementation.md` (최신 후속 보고서 링크 추가)

새 라이브러리는 추가하지 않았다. 작업 시작 전부터 존재하던 쇼케이스 및 다른 개발자의 변경은 유지했다.
