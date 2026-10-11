// 담당: 미정
// 알림 — /api/v1/notifications (prefix는 routes/index.js에서 등록)
// routes/index.js에서 /header 에도 같이 등록 → GET /api/v1/header/badges
// 🔒 표시는 로그인 필요 — 구현 시 middlewares/auth.middleware.js의 requireAuth 적용
import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller.js';

const router = Router();

router.get('/', notificationController.getNotifications); // 알림 목록 🔒
router.patch('/read-all', notificationController.readAllNotifications); // 전체 읽음 🔒
router.patch('/:id/read', notificationController.readNotification); // 알림 읽음 🔒
router.get('/badges', notificationController.getHeaderBadges); // 헤더 뱃지 (알림 · 장바구니 개수) — /header/badges

export default router;
