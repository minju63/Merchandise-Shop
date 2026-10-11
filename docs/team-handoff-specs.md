# 굿즈팡 · 마이/로그인/결제 백엔드 → 다른 담당자 전달 명세

작성: 2026-10-10 · 작성자 영역: 팀원 5(마이) 백엔드 — 로그인·마이·결제
상태: **전체 미전달** (이 문서가 첫 전달본). 담당자 답변이 오면 각 항목의 `상태`를 갱신한다.
기준: 현재 `feat/source-scaffold` 브랜치의 담당 백엔드 53개 파일(1~10단계 코드 작성 완료) + 마이 메인(M-00) 화면 구현 시작.

> 검증 범위: 라우터 13개 import/린트/무토큰·잘못된 입력 응답은 확인했고, 공개 API 5개는 실제 Supabase로 호출해 확인했다.
> **로그인이 필요한 API의 정상 경로(가입·주문·취소 등)와 다른 탭 연동은 아직 검증하지 않았다.**

---

## 0. 먼저 합의해야 하는 것 (전원 / 공용 담당)

### 0-1. 응답 형식 — IF-027 `결정됨` (2026-10-10, README 8장 형식 적용 완료)

담당 백엔드(라우터 13·컨트롤러 13·서비스)를 README 8장 형식으로 수정했다. **다른 담당자 API도 같은 형식을 써야 프론트 `client.js`가 한 가지로 처리할 수 있다.**

| 항목 | 형식 |
| --- | --- |
| 성공 | `{ "success": true, "data": …, "message": null }` |
| 실패 | `{ "success": false, "data": null, "message": "…", "code": "ERROR_CODE" }` (HTTP 상태코드 함께) |
| 목록 입력 | `?page=1&size=20` (기본 20, 최대 100. 약관 동의 내역만 기본 50) |
| 목록 응답 | `data: { items, page, size, totalCount }` |
| 페이징 없는 짧은 목록(배송지·결제수단·쿠폰함) | `data: { items, totalCount, … }` |

- 공통 코드는 `backend/src/utils/response.js`의 `ok(data)`, `fail(code, message)`에 만들었다(README가 지정한 위치이며 원래 빈 파일이었다). **다른 담당자는 이 두 함수를 import해서 쓰고, 이 파일을 수정/병합할 때 두 함수를 유지해 달라.** 공용 `error.middleware.js`를 만들면 `fail()`을 사용.
- 이전 `limit/offset`, `total` 키는 더 이상 받지도 주지도 않는다(`limit=5`을 보내면 400).
- 에러 코드 문자열(예: `AUTH_REQUIRED`, `ACCOUNT_UNAVAILABLE`, `STOCK_CHANGED`)은 기존과 동일하다.
- 확인 요청: 다른 담당자 API가 이 형식을 따르는지, 따르지 않는 곳이 있다면 어떻게 맞출지.

### 0-2. 파일명·경로 충돌 — IF-028 `미전달`

`SOURCE_STRUCTURE.md` 스캐폴드는 기능 접두사가 복수형(`users/orders/coupons/memberships/payments/notifications/support`)이고, 담당 백엔드는 단수형으로 만들었다. 같은 기능에 빈 파일과 구현 파일이 둘씩 있다.

| 스캐폴드(빈 파일) | 담당 구현 파일 | 제안 |
| --- | --- | --- |
| `users.*` | `user.*`, `auth.*`, `address.*`, `paymentMethod.*`, `notificationSetting.*`, `sellerApplication.*` | 구현 파일을 유지하고 빈 `users.*`는 사용하지 않음 |
| `orders.*` | `order.*`, `checkout.*` | 〃 |
| `payments.*` | `payment.repository.js`(결제 저장은 checkout/order/membership에서 호출) | 〃 |
| `coupons.*` | `coupon.*` | 〃 |
| `memberships.*` | `membership.*` | 〃 |
| `support.*` | `support.*`(문의·공지·FAQ), `report.*`, `review.*` | 같은 이름 사용. report/review는 별도 라우터 |
| `notifications.*` | 알림 설정만 `notificationSetting.*`. **알림함은 알림 담당** | 알림함은 `notifications.*`에 그대로 |

결정 필요: 빈 복수형 파일을 지울지, 이름을 바꿔 맞출지. 파일을 지우거나 이름을 바꾸는 작업은 공용 담당이 한다(담당 구현 파일은 건드리지 않음).

---

## 1. 공용 서버 · 인증 담당 (대표 담당 미정)

### IF-007 확장 · IF-019 — `app.js` 라우터 등록 `미전달`

`express.json()` 뒤, 404 처리 앞에 등록. **마운트 경로는 제안이며 확정 필요**(README 규칙은 복수형 `/shops`, `/products`이므로 아래도 복수형 위주로 제안).

```js
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import addressRoutes from './routes/address.routes.js';
import paymentMethodRoutes from './routes/paymentMethod.routes.js';
import notificationSettingRoutes from './routes/notificationSetting.routes.js';
import couponRoutes from './routes/coupon.routes.js';
import checkoutRoutes from './routes/checkout.routes.js';
import orderRoutes from './routes/order.routes.js';
import membershipRoutes from './routes/membership.routes.js';
import supportRoutes from './routes/support.routes.js';
import reportRoutes from './routes/report.routes.js';
import sellerApplicationRoutes from './routes/sellerApplication.routes.js';
import reviewRoutes from './routes/review.routes.js';

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/payment-methods', paymentMethodRoutes);
app.use('/api/v1/notification-settings', notificationSettingRoutes);
app.use('/api/v1/coupons', couponRoutes);
app.use('/api/v1/checkout', checkoutRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/memberships', membershipRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/seller-applications', sellerApplicationRoutes);
app.use('/api/v1/reviews', reviewRoutes);
```

- 이 중 1~5단계 7개는 문서에 있었고, **orders·memberships·support·reports·seller-applications·reviews 6개와 checkout의 `POST /`, `GET /:checkoutGroupId`는 이번에 추가**된 것이다.
- `CLIENT_URL` CORS(`credentials: true`)는 현재 `app.js`에 있다. 프론트 개발 주소(`http://localhost:5173`)와 맞는지 확인.

### IF-006 — 계정 상태 검사 `미전달`

- 담당 라우터는 각자 Supabase Auth 토큰을 검증(`auth.service.authenticate`)하고 `users.status = ACTIVE`를 확인한다.
- 공용 `auth.middleware.js`를 만들면 **중복 검증/이중 호출**을 어떻게 할지 정해야 한다(공개 닉네임 검사 `GET /auth/nickname-check`, 가입 미완료 계정이 `POST /auth/signup`·`GET /auth/me/exists`에 들어오는 조건은 유지해야 함).
- `WITHDRAWN`/`SUSPENDED`는 다른 탭의 개인 API에서도 막아야 한다(탈퇴는 상태 전환만 하고 Auth 계정은 삭제하지 않으므로 토큰은 계속 유효).

### 확인 요청
- 마운트 경로(위 표), 빈 복수형 파일 정리(0-2) 결정. 응답/에러/페이지네이션은 0-1로 결정됨.
- 서버 실행 시 `.env` 필수 값: `SUPABASE_URL`(끝에 `/rest/v1/` 없이 `https://xxxx.supabase.co`만), `SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. 공용 프론트 담당 (HTTP 클라이언트·인증·Storage·주소검색, 대표 담당 미정)

마이 메인(M-00) 구현이 이 파일들에 의존한다. 현재 모두 **빈 파일**이다.

### IF-029 — 프론트 공용 기반 `미전달`
| 파일 | 마이 화면에 필요한 것 |
| --- | --- |
| `src/api/client.js` | axios 인스턴스, `VITE_API_BASE_URL`, Supabase 세션의 `access_token`을 `Authorization: Bearer`로 자동 첨부, 401 처리, 0-1 응답 형식 해석 |
| `src/hooks/useAuth.js`, `src/store/auth.store.js` | 로그인 여부/사용자 ID/로그인 수단(`user.app_metadata.provider`)/로그아웃. **M-00의 "카카오 로그인 · 이메일" 표시에 로그인 수단이 필요**(우리 `/users/me`는 provider를 내려주지 않음) |
| `src/styles/tokens.css` | 보라 포인트 색·간격·글자 크기. 현재 `index.css`는 Vite 기본값 |
| `src/components/TabBar.jsx`, `Header.jsx` | 하단 5탭(홈/굿즈샵/카테고리/찜/마이) |
| 라우터 | `App.jsx`가 Vite 데모 화면. 라우팅 구성 필요(`react-router-dom` 설치됨) |

### IF-008 · IF-026 — Storage 업로드 `미전달`
- 프로필 사진: 업로드 후 **HTTPS URL**을 `PATCH /users/me`의 `profileImageUrl`로 보낸다(제거는 `null`). 버킷 이름·경로 규칙·크기/형식 제한·소유 확인·삭제 정리 담당을 정해야 한다.
- 문의 사진(`inquiry_images`)·리뷰 사진(`review_images`, 최대 3장): 백엔드는 `SUPABASE_URL` 도메인의 **공개 Storage 경로이며 `storage/v1/object/public/<버킷>/<폴더>/…`, 본인 폴더인 파일만** 허용하고 실제 존재 여부를 확인한다. **폴더 이름이 사용자 ID 기준인지**, 버킷 이름은 무엇인지 확정해 달라.

### IF-013 — 주소 검색 `미전달`
- 배송지 저장 API 입력: `recipientName / recipientPhone / zipCode / roadAddress / detailAddress`, 선택 `label / deliveryRequest / latitude / longitude / isDefault`.
- 주소 검색 공급자(예: 다음 우편번호)와 응답 → 위 필드 매핑을 프론트 담당이 정해야 한다. 좌표는 위도·경도 숫자 쌍 또는 **둘 다 null**.

### IF-009 — 로그인 프론트가 쓸 API `미전달`
1. Supabase Auth로 로그인 → `GET /auth/me/exists`로 신규/기존 분기
2. 약관 동의·정보 입력 → `POST /auth/signup` (`nickname`, `phone`, `agreements{age14,service,privacy,location,marketing,nightPush}`, `termsVersions`)
3. 닉네임 중복: `GET /auth/nickname-check?nickname=`
4. 가입 응답의 `signupCoupons` / `couponIssuancePending`을 보고 "첫 주문 할인 지급 완료"를 표시할지 판단
5. 탈퇴 성공 후 Supabase `signOut()`
- **이메일 중복 확인**(L-03 화면)은 백엔드 API가 없다. Supabase Auth가 처리하는지 프론트와 정해야 한다.

---

## 3. 팀원 4 · 찜 탭 (찜·재입고·사전예약)

### IF-001 `미전달` — 같은 DB 조회
- 상품 찜 `wishlist_products(user_id, store_product_id)`, 매장 찜 `wishlist_shops(user_id, store_id)`에 저장/해제.
- 마이 메인 `GET /users/me`의 `activity.wishlistProducts`/`wishlistShops`는 **같은 테이블을 본인 user_id로 exact count**한다. 별도 API를 만들 필요는 없고, 저장한 행이 마이 숫자에 맞게 반영되는지만 확인.

### IF-011 `미전달` — 재입고 신청 목록/해제 (우리 API에 없음)
- 마이 알림 설정(M-10)에 "재입고 알림 신청 목록 **4**" 진입과 개수가 있다.
- 필요: 본인 신청 목록·개수·해제 API의 **경로, 인증, 응답 필드(상품명/이미지/신청 시각/매장·상품 식별자), 오류 코드**. 마이는 이 응답을 그대로 사용해 화면을 연결한다.
- 우리 `notification_settings.restock`은 수신 on/off 토글일 뿐이다.

### NEXT-010 `미전달` — 멤버십 사전예약·우선 알림
- 요금제 `preorder_enabled`, `alert_priority_minutes`(멤버십 기간 내 유효)를 사전예약/재입고 알림 우선 발송에서 어떻게 쓸지.
- 우리 `GET /memberships/me`가 `entitlements{ preorderEnabled, alertPriorityMinutes, benefits }`를 계산해서 내려준다. 같은 규칙을 쓰려면 이 값을 호출하거나 같은 DB 필드를 사용.

---

## 4. 알림 담당 (공통)

### IF-002 `미전달` — 읽음/미확인 수
- `notifications.user_id`, `is_read`. 마이 헤더 벨 배지 = `header.unreadNotifications` = `is_read=false` 개수. 읽음 처리 후 즉시 줄어들어야 한다.

### IF-012 `미전달` — 설정 반영
- `notification_settings`: `push_enabled`(전체), `order_status`, `restock`, `liked_store_news`, `coupon_expiry`, `inquiry_answer`, `marketing`, `night_push`.
- 발송 시 **master(`push_enabled`) AND 유형별 토글**을 함께 확인. 마케팅은 `marketing`, 야간(21~08시) 마케팅은 `night_push`도 확인. 마케팅이 꺼지면 `night_push`는 서버가 함께 false로 저장한다.
- 설정 행이 없으면 우리는 409 `NOTIFICATION_SETTINGS_MISSING`을 준다.

### IF-023 (신규, 기존 NEXT-006) `미전달` — 알림 생성 책임
우리 백엔드는 `notifications`를 **읽기만** 한다. 아래 이벤트에서 알림 행을 누가 어떻게 만들지 정해야 한다.

| 이벤트 | 우리 코드 위치 | 비고 |
| --- | --- | --- |
| 주문 접수(결제 완료) | `checkout.service.submitCheckout` | 매장별 주문 N건 |
| 주문 취소 | `order.service.cancelMyOrder` | |
| 문의 답변 등록 | (관리자 영역) | `inquiry_answer` 토글 |
| 쿠폰 만료 3일 전 | (스케줄러 `jobs/` 영역) | `coupon_expiry` 토글 |
| 픽업 준비 완료·배송 시작 | (판매자 영역) | `order_status` 토글 |
- 선택지: (A) 각 기능이 `notifications` 직접 insert (B) 알림 담당이 제공하는 함수/API를 호출. 확정 전에는 우리 쪽에서 호출 코드를 만들지 않는다.

---

## 5. 상품·재고·굿즈샵 담당 (팀원 2 굿즈샵 + 상품 상세 공통)

### IF-016 `미전달` — 가격·재고 계약
읽는 곳: `store_products.id/store_id/product_id/price/discount_rate/stock/max_per_order/status/pickup_available/delivery_available`, `products` 상태/`open_at`.
- **`price`가 최종 판매가인지, `discount_rate`를 다시 차감해야 하는지 확정 필요.** 현재는 `price`=최종가, 할인율 재차감 없음으로 가정했다.

### IF-020 (신규) `미전달` — 재고 쓰기 (결제·취소 시)
우리 `order.repository.adjustStock`이 **`store_products`를 직접 수정**한다.
- 결제 성공: `stock -= quantity`, 0이 되면 `status='SOLD_OUT'`.
- 주문 취소: `stock += quantity`, `SOLD_OUT`이었으면 `ON_SALE`로 복구.
- 같은 `stock/status` 값일 때만 수정하는 낙관적 갱신이며, 값이 바뀌었으면 409 `STOCK_CHANGED`. 매 변경은 `inventory_logs(store_product_id, change_type, quantity_delta, stock_before, stock_after, order_id, changed_by)`에 기록한다.
- 확인 요청: 상품·재고 담당이 같은 필드를 수정하는 코드(상품 수정, 재고 임박 표시)가 있는지, `change_type` 허용 값이 무엇인지, 우리가 쓰는 방식이 허용되는지.

### IF-005 · IF-018 `미전달` — 매장·영업정책
- 사용: `stores.id/name/address/owner_id/status/membership_plan`, 영업시간·픽업 설정(`store_business_hours`, `store_pickup_infos`: 준비시간·휴게·보관 `hold_hours`), 배송 설정(`store_delivery_infos`, `store_delivery_areas`), `regions(name, aliases, parent_id)`.
- **요일 0=일요일, 한국 시각**, 픽업 가능 구간은 **마감(영업 종료) 전 2시간**에서 영업 시작·준비시간·휴게시간을 제외한 구간. 매장 화면과 같은 규칙을 쓰는지 확인.
- **현재 `regions`/배송지역 데이터가 비어 있어 정상 배송 견적이 불가능**하다. 지역 미설정·미매칭이면 우리는 배송비/합계를 NULL, `canSubmit=false`로 응답한다.
- 소유 매장이 `CLOSED`가 아니거나 진행 중 주문이 있으면 회원 탈퇴를 거절한다(`STORE_CLOSURE_REQUIRED`/`ONGOING_ORDERS` 409). 매장 폐쇄 기능이 어디서 `CLOSED`로 바꾸는지 연결 필요.

### IF-022 (신규) `미전달` — 리뷰 평점 집계 쓰기
리뷰 작성/수정/삭제 직후 우리 `review.repository.synchronizeRatings`가 **`products`와 `stores`에 `review_count`, `rating_avg`를 직접 갱신**한다(숨김 `is_hidden=true`·삭제 리뷰 제외, 평균은 소수 둘째 자리).
- 실패하면 응답에 `ratingAggregationPending: true`가 들어가고 리뷰 자체는 저장된다.
- 확인 요청: 상품/매장 상세가 같은 컬럼을 읽는지, 다른 곳에서 같은 값을 계산·덮어쓰는지.
- 리뷰 표시(상품·매장 상세 화면)용 **공개 리뷰 목록 API는 우리 쪽에 없다**(`GET /reviews/me`는 본인 작성 가능 항목 목록). 필요하면 담당 지정.

### 신고 버튼(상품·매장 상세) `미전달`
`POST /reports` `{ targetType: PRODUCT|STORE|REVIEW, targetId(uuid), reason: FAKE|ILLEGAL|ABUSE|SPAM|ETC, detail(ETC일 때 필수, 최대 1000자) }`. 본인 리뷰는 신고 불가(400).

---

## 6. 장바구니 담당 (공통)

### IF-003 `미전달`
- `cart_items.user_id`는 실제 Auth 사용자 ID. 마이 헤더 장바구니 배지 `header.cartItems`는 **상품 수량 합이 아니라 행 수**다. 배지 기준을 장바구니 화면과 맞출 것.

### IF-017 · IF-021 (신규) `미전달`
- 결제 요청 `POST /checkout/preview`, `POST /checkout`: `mode: CART`, `cartItemIds`(본인 `cart_items.id`). 수량·판매 상품·수령 방법은 DB에서 읽는다. 선택 행의 `is_selected`는 우리가 바꾸지 않는다.
- **결제 성공 시 `removeSelectedCart`가 해당 `cart_items` 행을 삭제**한다(본인 소유, 선택한 ID만).
- 같은 매장 내 혼합 수령(픽업+배달)은 `storeOptions`로 통일해서 보내거나 `CONFLICTING_FULFILLMENT`. 재고 부족은 자동 축소하지 않고 `stockIssues`로 돌려준다.
- 확인 요청: 장바구니 담당이 삭제 대신 별도 처리를 하길 원하는지, 재구매(`POST /orders/:id/reorder`)가 돌려주는 상품 정보를 장바구니 담기 API에 어떻게 연결할지(우리는 담기를 직접 하지 않는다).

---

## 7. 판매자 · 관리자 영역 (담당 미확정)

### IF-004 · IF-024 `미전달` — 주문 상태 전이

| DB 상태 | 마이 표시 | 상태 변경 주체 |
| --- | --- | --- |
| PAID | 주문 완료/접수 | 우리 결제 저장(`submitCheckout`) |
| PREPARING | 준비 중 | 판매자 주문 확인 |
| READY_FOR_PICKUP | 픽업 대기 | 판매자 준비 완료 + **`pickup_deadline` 저장 필수** |
| SHIPPING | 배달 중 | 판매자 배송 시작 |
| COMPLETED | 수령 완료 | 판매자 픽업 확인 또는 배송 완료 |
| CANCELED | 취소 | 우리 `POST /orders/:id/cancel` |

- **고객 취소 가능 조건은 `PAID`뿐이다.** `PREPARING` 이후에는 고객이 취소하지 못한다(화면의 "매장에서 주문을 확인하기 전까지"와 일치). 판매자 쪽 취소/거절 기능이 있다면 재고·쿠폰 복원 규칙을 같이 맞춰야 한다.
- 상태가 바뀔 때마다 `order_status_histories`에 이력을 남기는지 확인(우리 코드는 결제·취소 시 기록).
- 픽업 안내: `pickup_deadline` 기준 **마감 2시간 전부터 마감까지** `canPickupNow`. 우리는 개별 예약 시각 컬럼을 만들지 않았다.

### 미구현 계약 — QR/픽업 코드 수령 확인 `미전달`
마이는 `GET /orders/:id/pickup`에서 `pickupCode`와 `qrPayload`(`{"orderId","pickupCode"}` JSON 문자열)를 내려준다(마감 전 유효할 때만). **판매자 쪽에서 이 값을 읽어 `COMPLETED`로 바꾸는 API의 경로·입력·권한이 아직 없다.**

### IF-025 (신규, 기존 NEXT-008) `미전달` — 관리자 처리
| 기능 | 우리가 저장하는 것 | 관리자/판매자가 해야 하는 것 |
| --- | --- | --- |
| 1:1 문의 | `inquiries`, `inquiry_images` (상태 대기 중만 수정/삭제 가능) | 답변 저장·공개. 우리 `GET /support/inquiries(/:id)`가 답변을 그대로 내려주므로 **답변 컬럼/상태 값 확정** |
| 신고 | `reports` 접수 | 처리 상태 변경·조치(콘텐츠 숨김). 리뷰 숨김은 `reviews.is_hidden=true` |
| 입점 신청 | `seller_applications(status='PENDING')`(`storeName, businessNo(10자리), 연락처 등`) | 승인/반려, **승인 시 `users.role` 변경과 `stores` 생성 책임**. 우리는 신청만으로 역할을 SELLER로 바꾸지 않는다 |
| 공지·FAQ | 읽기만 (`notices`, `faqs`) | 작성·게시 |
- 마이 "내 굿즈샵 입점하기" 배너 노출 조건: `GET /users/me`의 `profile.role === 'CONSUMER'`일 때만 표시 (현재 구현 기준).

---

## 8. 팀원 1 · 홈 / 기획

### IF-015 `미전달` — 쿠폰 정책과 노출
- 쿠폰 코드 접두어 문법(DB `coupons.code` 규칙, 스키마 컬럼 추가 없음): `SIGNUP_`=가입 자동 발급, `DELIVERY_`=배송비 할인(`applies_to=DELIVERY`), `FIRST_ORDER_`=취소 외 실제 주문이 없을 때만. 조합 시 `SIGNUP_`이 맨 앞이고 중복 없이. 일반 코드는 상품 금액 할인.
- 홈·굿즈샵·마이 쿠폰함이 **같은 정책(DB `coupons`)** 을 사용해야 한다. 노출용 "예상 할인"과 결제 시 "서버 검증 금액"(`serverPriceVerified`)을 구분해서 표시.

### 기획 · 시드 데이터 — IF-010 · IF-030 `미전달`
현재 Supabase에서 확인한 행 수: `users 1, stores 3, products 9, store_products 9`, 그 외 **`coupons`, `membership_plans`, `notices`, `faqs`, `regions`, `orders`, `payments`, `reviews`, `inquiries` 등은 0행**이다. 아래가 채워져야 해당 화면이 실제로 동작한다.
| 필요 데이터 | 이유 |
| --- | --- |
| `coupons` 정책(코드·기간·수량·할인값·최소금액·적용 매장) | 쿠폰함·가입 쿠폰·결제 쿠폰 선택 |
| `membership_plans` (베이직/플러스 가격·혜택·`alert_priority_minutes`·`preorder_enabled`) | 멤버십 화면, M-00의 "플러스 멤버십" 배지 |
| `notices`, `faqs` | 고객센터 |
| `regions`, `store_delivery_areas` | 배송비 계산 |
| 약관 버전, 닉네임 금칙어 정책 | 가입. 금칙어 필터는 **미구현**(형식 2~12자·중복 검사만) |
| 상품 가격 의미(IF-016)와 지역 미설정 시 배송 불가 정책 | 결제 견적 |

---

## 부록 A. 마이 메인(M-00) 화면 → 데이터 주인

`GET /users/me` 응답(성공 시 `data`):
`{ profile, orderSummary{periodStart,periodEnd,counts{PAID,PREPARING,READY_FOR_PICKUP,SHIPPING,COMPLETED,CANCELED}}, activity{wishlistProducts,wishlistShops,availableCoupons}, header{unreadNotifications,cartItems}, membership, readyPickup }`

| 화면 요소 | 필드 | 데이터 주인 |
| --- | --- | --- |
| 닉네임/이메일/사진 | `profile.nickname/email/profile_image_url` | 마이(우리) |
| "카카오 로그인" | (우리 응답에 없음) Supabase `app_metadata.provider` | 공용 프론트(IF-029) |
| "플러스 멤버십" 배지 | `membership.membership_plans.name` | 마이 + 기획(요금제 데이터) |
| 벨 배지 | `header.unreadNotifications` | 알림(IF-002) |
| 장바구니 배지 | `header.cartItems` (행 수) | 장바구니(IF-003) |
| 픽업 준비 카드(QR 보기) | `readyPickup`: `order_no`, `stores.name`, `pickup_deadline`, `canPickupNow` | 판매자 상태 전이(IF-004) |
| 주문 현황(주문 완료/준비 중/픽업 대기/배달 중/수령 완료, 최근 3개월) | `orderSummary.counts` = PAID/PREPARING/READY_FOR_PICKUP/SHIPPING/COMPLETED | 마이 + 판매자 |
| 찜한 상품/굿즈샵 | `activity.wishlistProducts/wishlistShops` | 찜(IF-001) |
| 쿠폰 N장 | `activity.availableCoupons` (유효 기간·정책 활성 기준) | 마이 + 기획(IF-015) |
| 입점하기 배너 | `GET /users/me` (profile.role) | 마이 + 관리자(IF-025) |
| 비로그인 화면 | 토큰 없음 → 401 `AUTH_REQUIRED` | 공용 프론트 |

## 부록 B. 담당 백엔드 API 목록 (현재 제안 경로)

| 기능 | 메서드 · 경로 |
| --- | --- |
| auth | `GET /auth/nickname-check`, `GET /auth/me/exists`, `POST /auth/signup` |
| users | `GET /users/me`, `PATCH /users/me`, `DELETE /users/me`, `GET /users/me/agreements` |
| addresses | `GET·POST /addresses`, `PATCH /addresses/:id`, `PATCH /addresses/:id/default`, `DELETE /addresses/:id` |
| payment-methods | `GET·POST /payment-methods`, `PATCH /payment-methods/:id/default`, `DELETE /payment-methods/:id` |
| notification-settings | `GET·PATCH /notification-settings` |
| coupons | `GET /coupons`, `GET /coupons/usable`, `GET /coupons/:userCouponId`, `POST /coupons/register` |
| checkout | `POST /checkout/preview`, `POST /checkout`, `GET /checkout/:checkoutGroupId` |
| orders | `GET /orders`, `GET /orders/:id`, `GET /orders/:id/pickup`, `PATCH /orders/:id/address`, `POST /orders/:id/reorder`, `POST /orders/:id/cancel` |
| memberships | `GET /memberships/plans`(공개), `GET /memberships/me`, `POST /memberships`, `POST /memberships/me/cancel` |
| support | `GET /support/notices(/:id)`, `GET /support/faqs`(공개), `GET·POST /support/inquiries`, `GET·PATCH·DELETE /support/inquiries/:id` |
| reports | `POST /reports`, `GET /reports` |
| seller-applications | `GET /seller-applications/me`, `POST /seller-applications` |
| reviews | `GET /reviews/me`, `POST /reviews`, `PATCH·DELETE /reviews/:id` |

## 부록 C. 전달 상태 기록

| ID | 받을 담당 | 상태 | 전달일 | 답변 |
| --- | --- | --- | --- | --- |
| IF-027 | 전원·공용 서버 | 내부 결정(README 형식 적용), 팀 공유 미전달 | | |
| IF-028 | 전원·공용 서버 | 미전달 | | |
| IF-006/007/019 | 공용 서버·인증 | 미전달 | | |
| IF-029/008/026/013/009 | 공용 프론트 | 미전달 | | |
| IF-001/011/NEXT-010 | 팀원 4 찜 | 미전달 | | |
| IF-002/012/023 | 알림 | 미전달 | | |
| IF-016/020/005/018/022 | 상품·재고·굿즈샵 | 미전달 | | |
| IF-003/017/021 | 장바구니 | 미전달 | | |
| IF-004/024/025 | 판매자·관리자 | 미전달 | | |
| IF-015/010/030 | 팀원 1 홈·기획 | 미전달 | | |
