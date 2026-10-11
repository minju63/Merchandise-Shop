# OWNERS — 파일 담당자

파일 상단의 `// 담당: 이름` 주석과 이 문서가 기준입니다. 남의 파일을 고쳐야 하면 담당자에게 먼저 말해 주세요.

## 탭별 담당

| 영역 | 담당 | 백엔드 기능 (`routes` · `controllers` · `services`) | 프론트 |
|---|---|---|---|
| 홈 · 검색 | 민주 | `home` · `search` · `banner` · `openAlert` · `upcoming` | `pages/home/` · `pages/search/` |
| 굿즈샵 | 여경 | `store` | `pages/stores/` |
| 카테고리 · 상품 | 은혜 | `category` · `region` · `product` · `productInquiry` | `pages/category/` |
| 찜 · 장바구니 | 동균 | `wishlist` · `restockAlert` · `preorder` · `cart` | `pages/wish/` · `pages/cart/` |
| 로그인 · 결제 · 마이 | 연수 | `auth` · `user` · `address` · `paymentMethod` · `notificationSetting` · `checkout` · `order` · `coupon` · `membership` · `report` · `sellerApplication` · `review` · `support` | `pages/auth/` · `pages/checkout/` · `pages/my/` |
| 알림 | **미정** | `notification` (`/notifications` · `/header/badges`) | — |

## Repository (테이블 단위)

| 담당 | 파일 → 테이블 |
|---|---|
| **은혜 (공용)** | `product` → products · `storeProduct` → store_products · `region` → regions · `category` → categories · `productCategory` → product_categories · `productImage` → product_images · `productInquiry` → product_inquiries |
| 여경 | `store` · `storeImage` · `storeBusinessHour` · `storeCategory` · `storePickupInfo` · `storeDeliveryInfo` · `storeDeliveryArea` · `inventoryLog` |
| 동균 | `wishlistProduct` · `wishlistShop` · `restockAlert` · `preorder` · `cartItem` |
| 연수 | `user` · `address` · `paymentMethod` · `notificationSetting` · `order` · `payment` · `coupon` · `membership` · `inquiry` · `notice` · `faq` · `report` · `sellerApplication` · `review` |
| 민주 | `banner` · `searchLog` · `openAlert` |
| 미정 | `notification` |

**공용 Repository(`product` · `storeProduct` · `region` 등 은혜 소유)는 직접 수정하지 마세요.** 필요한 조회 함수가 있으면 은혜에게 추가를 요청합니다.

## 공용 파일 — 수정 전 단톡 공지

| 파일 | 내용 |
|---|---|
| `backend/src/app.js` | 미들웨어 · `app.use('/api/v1', routes)` 한 줄 |
| `backend/src/routes/index.js` | **모든 라우터 등록은 여기 한 곳** |
| `backend/src/utils/response.js` | `ok()` · `fail()` 응답 형식 |
| `backend/src/middlewares/*` | 인증 · 404 · 에러 핸들러 |
| `backend/src/lib/supabase.js` | Supabase 클라이언트 (service_role) |
| `frontend/src/App.jsx` | **모든 화면 라우트는 여기에 미리 등록** |
| `frontend/src/api/client.js` | axios 인스턴스 |
| `frontend/src/components/*` | Header · BottomNavigation · ProductCard · UpcomingProductCard · CartIconBadge |
| `frontend/src/lib/supabase.js` | Supabase 클라이언트 (anon) |

## 규칙

1. 파일명은 camelCase 단수 + `.레이어.js` (`store.routes.js`, `paymentMethod.repository.js`)
2. 라우터는 기능 단위, 리포지토리는 테이블 단위
3. 모든 API는 `/api/v1` prefix
4. 라우터 등록은 `routes/index.js` 한 곳에서만
5. 모든 파일 상단에 `// 담당: 이름`
6. 미구현 핸들러는 `501` + `fail('NOT_IMPLEMENTED', '아직 구현되지 않았습니다')`

## 아직 안 정해진 것

- [ ] 알림 목록(`notification.*`) 담당
- [ ] `product_inquiries` 신규 테이블 확정 여부
- [ ] 페이지네이션 `page/size` 통일 (연수 문서는 cursor)
