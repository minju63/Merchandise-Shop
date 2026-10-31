// 공용 — 라우터 등록은 전부 여기. 수정 전 단톡 공지.
import { Router } from 'express';

// 연수
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import addressRoutes from './address.routes.js';
import paymentMethodRoutes from './paymentMethod.routes.js';
import notificationSettingRoutes from './notificationSetting.routes.js';
import checkoutRoutes from './checkout.routes.js';
import orderRoutes from './order.routes.js';
import couponRoutes from './coupon.routes.js';
import membershipRoutes from './membership.routes.js';
import reportRoutes from './report.routes.js';
import sellerApplicationRoutes from './sellerApplication.routes.js';
import supportRoutes from './support.routes.js';
import reviewRoutes from './review.routes.js';
import fanRoutes from './fan.routes.js';

// 민주
import upcomingRoutes from './upcoming.routes.js';
import homeRoutes from './home.routes.js';
import searchRoutes from './search.routes.js';
import bannerRoutes from './banner.routes.js';
import openAlertRoutes from './openAlert.routes.js';

// 여경
import storeRoutes from './store.routes.js';

// 은혜
import categoryRoutes from './category.routes.js';
import productRoutes from './product.routes.js';
import regionRoutes from './region.routes.js';

// 동균
import wishlistRoutes from './wishlist.routes.js';
import restockAlertRoutes from './restockAlert.routes.js';
import preorderRoutes from './preorder.routes.js';
import cartRoutes from './cart.routes.js';

// 미정
import notificationRoutes from './notification.routes.js';

const router = Router();

// 연수 — 로그인 · 결제 · 마이
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/addresses', addressRoutes);
router.use('/payment-methods', paymentMethodRoutes);
router.use('/notification-settings', notificationSettingRoutes);
router.use('/checkout', checkoutRoutes);
router.use('/orders', orderRoutes);
router.use('/coupons', couponRoutes);
router.use('/memberships', membershipRoutes);
router.use('/reports', reportRoutes);
router.use('/seller-applications', sellerApplicationRoutes);
router.use('/reviews', reviewRoutes); // 연수 버전 (평점 집계 포함)

// 민주 — 홈 · 검색
// upcoming.routes.js는 /home/sections/upcoming · /products/:id/open-alert 를 직접 가지고 있어서
// /home · /products 라우터보다 먼저 등록해야 한다.
router.use('/', upcomingRoutes);
router.use('/home', homeRoutes);
router.use('/search', searchRoutes);
router.use('/banners', bannerRoutes);
router.use('/fan', fanRoutes); // 팬 응원 전광판
router.use('/open-alerts', openAlertRoutes);

// 여경 — 굿즈샵
router.use('/stores', storeRoutes);

// 은혜 — 카테고리 · 상품
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes); // 상품 Q&A도 이 안에
router.use('/regions', regionRoutes);

// 동균 — 찜 · 장바구니
router.use('/wishlist', wishlistRoutes);
router.use('/restock-alerts', restockAlertRoutes);
router.use('/preorders', preorderRoutes);
router.use('/cart', cartRoutes);

// 미정
router.use('/notifications', notificationRoutes);
router.use('/header', notificationRoutes); // GET /header/badges

// 연수 — 고객센터 /notices · /faqs · /inquiries
// 루트('/')에 붙고 안에 Cache-Control: no-store 미들웨어가 있어서 반드시 맨 마지막에 둔다.
router.use('/', supportRoutes);

export default router;
