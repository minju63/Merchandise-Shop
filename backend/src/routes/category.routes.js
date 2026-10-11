// 담당: 은혜
// 카테고리 — /api/v1/categories (prefix는 routes/index.js에서 등록)
// 🔒 표시는 로그인 필요 — 구현 시 middlewares/auth.middleware.js의 requireAuth 적용
import { Router } from 'express';
import * as categoryController from '../controllers/category.controller.js';

const router = Router();

router.get('/', categoryController.getCategories); // 카테고리 목록 (?type=CONTENT|GOODS, ?home=true)

export default router;
