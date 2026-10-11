// 담당: 민주
// 배너 — /api/v1/banners (prefix는 routes/index.js에서 등록)
// 🔒 표시는 로그인 필요 — 구현 시 middlewares/auth.middleware.js의 requireAuth 적용
import { Router } from 'express';
import * as bannerController from '../controllers/banner.controller.js';

const router = Router();

router.get('/', bannerController.getBanners); // 배너 목록
router.post('/:id/click', bannerController.clickBanner); // 배너 클릭 기록

export default router;
