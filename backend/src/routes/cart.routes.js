// 담당: 동균
// 장바구니 — /api/v1/cart (prefix는 routes/index.js에서 등록)
// 🔒 모든 경로 로그인 필요 — requireAuth
import { Router } from 'express';
import * as cartController from '../controllers/cart.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', cartController.getCart); // 장바구니 조회 (?type=PICKUP|DELIVERY) 🔒
router.get('/counts', cartController.getCartCounts); // 장바구니 아이콘 뱃지 개수 🔒
router.post('/items', cartController.addCartItem); // 장바구니 담기 🔒
router.patch('/items/:cartItemId', cartController.updateCartItem); // 수량 변경 · 선택(isSelected) 🔒
router.delete('/items', cartController.deleteCartItems); // 선택 삭제 🔒

export default router;
