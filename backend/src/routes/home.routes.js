// 담당: 민주
// 홈 — /api/v1/home (prefix는 routes/index.js에서 등록)
// 🔒 표시는 로그인 필요 — 구현 시 middlewares/auth.middleware.js의 requireAuth 적용
import { Router } from 'express';
import * as homeController from '../controllers/home.controller.js';

const router = Router();

router.get('/', homeController.getHome); // 홈 화면 전체 섹션
router.get('/sections/:type', homeController.getHomeSection); // 섹션 더보기 (popular · new · recommend · low-stock · upcoming)

export default router;
