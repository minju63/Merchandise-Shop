// 공용 — 라우터 등록은 전부 여기. 수정 전 단톡 공지.
import { Router } from 'express';

// 연수 — feat/mytab-login-checkout 머지 시 아래 import와 router.use 주석 해제
// import authRoutes from './auth.routes.js';
// import userRoutes from './user.routes.js';
// import addressRoutes from './address.routes.js';
// import paymentMethodRoutes from './paymentMethod.routes.js';
// import notificationSettingRoutes from './notificationSetting.routes.js';
// import checkoutRoutes from './checkout.routes.js';
// import orderRoutes from './order.routes.js';
// import couponRoutes from './coupon.routes.js';
// import membershipRoutes from './membership.routes.js';
// import reportRoutes from './report.routes.js';
// import sellerApplicationRoutes from './sellerApplication.routes.js';
// import supportRoutes from './support.routes.js';
import reviewRoutes from './review.routes.js';

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
// router.use('/auth', authRoutes);
// router.use('/users', userRoutes);
// router.use('/addresses', addressRoutes);
// router.use('/payment-methods', paymentMethodRoutes);
// router.use('/notification-settings', notificationSettingRoutes);
// router.use('/checkout', checkoutRoutes);
// router.use('/orders', orderRoutes);
// router.use('/coupons', couponRoutes);
// router.use('/memberships', membershipRoutes);
// router.use('/reports', reportRoutes);
// router.use('/seller-applications', sellerApplicationRoutes);
router.use('/reviews', reviewRoutes); // 현재는 여경의 POST /reviews — 연수 머지 시 합칠 것
// router.use('/', supportRoutes); // /notices · /faqs · /inquiries

// 민주 — 홈 · 검색
// upcoming.routes.js는 /home/sections/upcoming · /products/:id/open-alert 를 직접 가지고 있어서
// /home · /products 라우터보다 먼저 등록해야 한다.
router.use('/', upcomingRoutes);
router.use('/home', homeRoutes);
router.use('/search', searchRoutes);
router.use('/banners', bannerRoutes);
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

export default router;
