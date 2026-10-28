// 담당: 동균
// 찜 — /api/v1/wishlist (prefix는 routes/index.js에서 등록)
// 🔒 모든 경로 로그인 필요 — requireAuth
import { Router } from 'express';
import * as wishlistController from '../controllers/wishlist.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/products', wishlistController.getWishProducts); // 찜한 상품 목록 (J-01) 🔒
router.post('/products', wishlistController.addWishProduct); // 상품 찜 등록 🔒
router.delete('/products/:storeProductId', wishlistController.removeWishProduct); // 상품 찜 해제 (J-07) 🔒
router.get('/shops', wishlistController.getWishShops); // 찜한 굿즈샵 목록 (J-02) 🔒
router.post('/shops', wishlistController.addWishShop); // 굿즈샵 찜 등록 🔒
router.delete('/shops/:storeId', wishlistController.removeWishShop); // 굿즈샵 찜 해제 (J-07) 🔒
router.get('/counts', wishlistController.getWishCounts); // 상품 / 굿즈샵 탭 개수 🔒

export default router;
