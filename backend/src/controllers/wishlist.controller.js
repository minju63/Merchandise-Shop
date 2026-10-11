// 담당: 동균
// 찜 컨트롤러 — 요청 검증 · 응답 형식만 담당, 로직은 wishlist.service.js
import { fail } from '../utils/response.js';

const notImplemented = (res) =>
  res.status(501).json(fail('NOT_IMPLEMENTED', '아직 구현되지 않았습니다'));

// GET /api/v1/wishlist/products — 찜한 상품 목록 (J-01) 🔒
export async function getWishProducts(req, res) {
  // TODO: wishlist.service.js 호출
  notImplemented(res);
}

// POST /api/v1/wishlist/products — 상품 찜 등록 🔒
export async function addWishProduct(req, res) {
  // TODO: wishlist.service.js 호출
  notImplemented(res);
}

// DELETE /api/v1/wishlist/products/:storeProductId — 상품 찜 해제 (J-07) 🔒
export async function removeWishProduct(req, res) {
  // TODO: wishlist.service.js 호출
  notImplemented(res);
}

// GET /api/v1/wishlist/shops — 찜한 굿즈샵 목록 (J-02) 🔒
export async function getWishShops(req, res) {
  // TODO: wishlist.service.js 호출
  notImplemented(res);
}

// DELETE /api/v1/wishlist/shops/:storeId — 굿즈샵 찜 해제 (J-07) 🔒
export async function removeWishShop(req, res) {
  // TODO: wishlist.service.js 호출
  notImplemented(res);
}

// GET /api/v1/wishlist/counts — 상품 / 굿즈샵 탭 개수 🔒
export async function getWishCounts(req, res) {
  // TODO: wishlist.service.js 호출
  notImplemented(res);
}
