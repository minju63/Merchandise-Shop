// 담당: 민주
// 오픈 알림 — /api/v1/open-alerts (prefix는 routes/index.js에서 등록)
// 🔒 표시는 로그인 필요 — 구현 시 middlewares/auth.middleware.js의 requireAuth 적용
import { Router } from 'express';
import * as openAlertController from '../controllers/openAlert.controller.js';

const router = Router();

router.post('/', openAlertController.createOpenAlert); // 오픈 알림 신청 🔒
router.delete('/:productId', openAlertController.deleteOpenAlert); // 오픈 알림 해제 🔒

export default router;
