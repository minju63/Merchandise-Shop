// 담당: 동균
// 재입고 알림 — /api/v1/restock-alerts (prefix는 routes/index.js에서 등록)
// 🔒 표시는 로그인 필요 — 구현 시 middlewares/auth.middleware.js의 requireAuth 적용
import { Router } from 'express';
import * as restockAlertController from '../controllers/restockAlert.controller.js';

const router = Router();

router.get('/', restockAlertController.getRestockAlerts); // 내 재입고 알림 목록 (M-10a) 🔒
router.post('/', restockAlertController.createRestockAlert); // 재입고 알림 신청 (J-03) 🔒
router.delete('/:storeProductId', restockAlertController.deleteRestockAlert); // 재입고 알림 해제 (J-04 · M-10a) 🔒

export default router;
