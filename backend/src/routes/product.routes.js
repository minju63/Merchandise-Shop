import { Router } from 'express';
import {
  getProducts,
  getProductDetail,
  getRelatedProducts,
} from '../controllers/product.controller.js';
import {
  getProductInquiries,
  createProductInquiry,
} from '../controllers/productInquiry.controller.js';

// Shared owner mounts /api/v1/products and injects the existing verified auth middleware.
// optionalAuth verifies tokens on GETs and populates req.user for wishlist/private inquiries.
// requireAuth verifies tokens on POSTs. No duplicate authentication implementation here.
function authUnavailable(req, res) {
  return res.status(503).json({
    success: false,
    data: null,
    message: '현재 문의 등록을 사용할 수 없습니다.',
    code: 'AUTH_NOT_CONFIGURED',
  });
}

export function createProductRouter({ requireAuth = authUnavailable, optionalAuth } = {}) {
  const router = Router();
  if (optionalAuth) router.use(optionalAuth);
  router.get('/', getProducts);
  router.get('/:storeProductId/related', getRelatedProducts);
  router.get('/:storeProductId/inquiries', getProductInquiries);
  router.post('/:storeProductId/inquiries', requireAuth, createProductInquiry);
  router.get('/:storeProductId', getProductDetail);
  return router;
}

export default createProductRouter();
