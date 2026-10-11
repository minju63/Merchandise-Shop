// 담당: 은혜
// 상품 — /api/v1/products (prefix는 routes/index.js에서 등록)
// 상품 Q&A 핸들러는 productInquiry.controller.js — prefix가 같아서 라우터는 이 파일 하나
// 🔒 표시는 로그인 필요 — 구현 시 middlewares/auth.middleware.js의 requireAuth 적용
import { Router } from 'express';
import * as productController from '../controllers/product.controller.js';
import * as productInquiryController from '../controllers/productInquiry.controller.js';

const router = Router();

router.get('/', productController.getProducts); // 상품 목록 · 필터 · 정렬
router.get('/:storeProductId', productController.getProductDetail); // 판매상품 상세 (공용 상품 상세)
router.get('/:storeProductId/related', productController.getRelatedProducts); // 관련 상품
router.get('/:storeProductId/inquiries', productInquiryController.getProductInquiries); // 상품 Q&A
router.post('/:storeProductId/inquiries', productInquiryController.createProductInquiry); // 상품 문의 작성 🔒

export default router;
