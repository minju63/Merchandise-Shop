// 담당: 동균
// 찜 컨트롤러 — 요청 검증 · 응답 형식만 담당, 로직은 wishlist.service.js
import * as wishlistService from '../services/wishlist.service.js';
import { ok, fail } from '../utils/response.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSITIVE_INT = /^[1-9]\d*$/;

function badRequest(res, code, message) {
  res.status(400).json(fail(code, message));
}

// 유효하지 않으면 400 응답을 보내고 null 을 반환한다.
function pagination(req, res) {
  const { page = '1', size = '20' } = req.query;
  if (typeof page !== 'string' || !POSITIVE_INT.test(page) || !Number.isSafeInteger(Number(page))) {
    badRequest(res, 'INVALID_PAGE', 'page는 1 이상의 정수여야 합니다.');
    return null;
  }
  if (typeof size !== 'string' || !POSITIVE_INT.test(size) || Number(size) > 100) {
    badRequest(res, 'INVALID_SIZE', 'size는 1~100 사이의 정수여야 합니다.');
    return null;
  }
  return { page: Number(page), size: Number(size) };
}

function uuid(res, value, name) {
  if (typeof value === 'string' && UUID.test(value)) return value;
  badRequest(res, 'INVALID_REQUEST', `올바른 ${name} 형식이 아닙니다.`);
  return null;
}

// GET /api/v1/wishlist/products — 찜한 상품 목록 (J-01) 🔒
export async function getWishProducts(req, res) {
  const paging = pagination(req, res);
  if (!paging) return;
  const { sort = 'recent' } = req.query;
  if (typeof sort !== 'string' || !Object.hasOwn(wishlistService.WISH_SORTS, sort)) {
    badRequest(res, 'INVALID_SORT', '지원하지 않는 정렬 방식입니다.');
    return;
  }
  res.json(ok(await wishlistService.getWishProducts({ userId: req.user.id, ...paging, sort })));
}

// POST /api/v1/wishlist/products — 상품 찜 등록 🔒
export async function addWishProduct(req, res) {
  const storeProductId = uuid(res, req.body?.storeProductId, 'storeProductId');
  if (!storeProductId) return;
  res.json(ok(await wishlistService.addWishProduct({ userId: req.user.id, storeProductId })));
}

// DELETE /api/v1/wishlist/products/:storeProductId — 상품 찜 해제 (J-07) 🔒
export async function removeWishProduct(req, res) {
  const storeProductId = uuid(res, req.params.storeProductId, 'storeProductId');
  if (!storeProductId) return;
  res.json(ok(await wishlistService.removeWishProduct({ userId: req.user.id, storeProductId })));
}

// GET /api/v1/wishlist/shops — 찜한 굿즈샵 목록 (J-02) 🔒
export async function getWishShops(req, res) {
  const paging = pagination(req, res);
  if (!paging) return;
  res.json(ok(await wishlistService.getWishShops({ userId: req.user.id, ...paging })));
}

// POST /api/v1/wishlist/shops — 굿즈샵 찜 등록 🔒
export async function addWishShop(req, res) {
  const storeId = uuid(res, req.body?.storeId, 'storeId');
  if (!storeId) return;
  res.json(ok(await wishlistService.addWishShop({ userId: req.user.id, storeId })));
}

// DELETE /api/v1/wishlist/shops/:storeId — 굿즈샵 찜 해제 (J-07) 🔒
export async function removeWishShop(req, res) {
  const storeId = uuid(res, req.params.storeId, 'storeId');
  if (!storeId) return;
  res.json(ok(await wishlistService.removeWishShop({ userId: req.user.id, storeId })));
}

// GET /api/v1/wishlist/counts — 상품 / 굿즈샵 찜 개수 🔒
export async function getWishCounts(req, res) {
  res.json(ok(await wishlistService.getWishCounts(req.user.id)));
}
