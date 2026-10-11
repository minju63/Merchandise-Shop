// 담당: 동균
// 사전예약 — /api/v1/preorders (prefix는 routes/index.js에서 등록)
// 🔒 표시는 로그인 필요 — 구현 시 middlewares/auth.middleware.js의 requireAuth 적용
import { Router } from 'express';
import * as preorderController from '../controllers/preorder.controller.js';

const router = Router();

router.get('/quote', preorderController.getPreorderQuote); // 입고 예정일 · 예약금 · 잔액 · 예상 순번 (?storeProductId=&qty=) 🔒
router.post('/', preorderController.createPreorder); // 사전예약 신청 (J-06) 🔒
router.get('/', preorderController.getPreorders); // 내 사전예약 목록 🔒
router.delete('/:preorderId', preorderController.cancelPreorder); // 사전예약 취소 🔒

export default router;
