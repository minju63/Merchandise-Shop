// 담당: 동균
// 사전예약 — /api/v1/preorders (prefix는 routes/index.js에서 등록)
// 🔒 모든 경로 로그인 필요 — requireAuth
import { Router } from 'express';
import * as preorderController from '../controllers/preorder.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/quote', preorderController.getPreorderQuote); // 입고 예정일 · 예약금 · 잔액 · 예상 순번 (?storeProductId=&qty=) 🔒
router.post('/', preorderController.createPreorder); // 사전예약 신청 (J-06) 🔒
router.get('/', preorderController.getPreorders); // 내 사전예약 목록 🔒
router.delete('/:preorderId', preorderController.cancelPreorder); // 사전예약 취소 🔒

export default router;
