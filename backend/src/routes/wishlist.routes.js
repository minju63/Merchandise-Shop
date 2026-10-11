// 담당: 동균
// 찜 — /api/v1/wishlist (prefix는 routes/index.js에서 등록)
// 🔒 표시는 로그인 필요 — 구현 시 middlewares/auth.middleware.js의 requireAuth 적용
import { Router } from 'express';
import * as wishlistController from '../controllers/wishlist.controller.js';

const router = Router();

router.get('/products', wishlistController.getWishProducts); // 찜한 상품 목록 (J-01) 🔒
router.post('/products', wishlistController.addWishProduct); // 상품 찜 등록 🔒
router.delete('/products/:storeProductId', wishlistController.removeWishProduct); // 상품 찜 해제 (J-07) 🔒
router.get('/shops', wishlistController.getWishShops); // 찜한 굿즈샵 목록 (J-02) 🔒
router.delete('/shops/:storeId', wishlistController.removeWishShop); // 굿즈샵 찜 해제 (J-07) 🔒
router.get('/counts', wishlistController.getWishCounts); // 상품 / 굿즈샵 탭 개수 🔒

export default router;
