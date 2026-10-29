// 담당: 동균
// 재입고 알림 — /api/v1/restock-alerts (prefix는 routes/index.js에서 등록)
// 🔒 모든 경로 로그인 필요 — requireAuth
import { Router } from 'express';
import * as restockAlertController from '../controllers/restockAlert.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', restockAlertController.getRestockAlerts); // 내 재입고 알림 목록 (M-10a) 🔒
router.post('/', restockAlertController.createRestockAlert); // 재입고 알림 신청 (J-03) 🔒
router.delete('/:storeProductId', restockAlertController.deleteRestockAlert); // 재입고 알림 해제 (J-04 · M-10a) 🔒

export default router;
