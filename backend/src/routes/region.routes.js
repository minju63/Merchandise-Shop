// 담당: 은혜
// 지역 — /api/v1/regions (prefix는 routes/index.js에서 등록)
// 🔒 표시는 로그인 필요 — 구현 시 middlewares/auth.middleware.js의 requireAuth 적용
import { Router } from 'express';
import * as regionController from '../controllers/region.controller.js';

const router = Router();

router.get('/', regionController.getRegions); // 지역 목록

export default router;
