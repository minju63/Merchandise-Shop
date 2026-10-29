import * as productService from '../services/product.service.js';
import { REGION_NAMES } from '../utils/regionNames.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// upcoming: 오픈·입고 예정 시각이 가까운 순 → 나머지는 인기순. 홈의 입고 예정 전체보기에서만 쓴다.
const SORTS = ['popular', 'sales', 'newest', 'stock', 'price_asc', 'price_desc', 'upcoming', 'stock_asc', 'wishlist'];

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'INVALID_REQUEST';
  throw error;
}

function uuid(value, name) {
  if (typeof value !== 'string' || !UUID.test(value)) {
    invalid(`${name}은 UUID여야 합니다.`);
  }
  return value;
}

function integer(value, name, minimum, maximum = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    invalid(`${name}은 정수여야 합니다.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    invalid(`${name}의 허용 범위는 ${minimum}~${maximum}입니다.`);
  }
  return parsed;
}

function boolean(value, name) {
  if (value !== 'true' && value !== 'false') {
    invalid(`${name}은 true 또는 false여야 합니다.`);
  }
  return value === 'true';
}

// Keep validation responses local; forward Service failures to shared middleware.
function validate(res, callback) {
  try {
    return callback();
  } catch (error) {
    res.status(error.status).json({
      success: false,
      data: null,
      message: error.message,
      code: error.code,
    });
    return null;
  }
}

// Service contract: getProducts(filters), including optional authenticated userId.
export async function getProducts(req, res, next) {
  const filters = validate(res, () => {
    const query = req.query;
    const result = {
      sort: query.sort ?? 'popular',
      page: query.page === undefined ? 1 : integer(query.page, 'page', 1),
      size: query.size === undefined ? 20 : integer(query.size, 'size', 1, 100),
      userId: req.user?.id,
    };

    if (!SORTS.includes(result.sort)) invalid('지원하지 않는 정렬 방식입니다.');
    for (const name of ['contentCategoryId', 'goodsCategoryId', 'regionId']) {
      if (query[name] !== undefined) result[name] = uuid(query[name], name);
    }
    if (query.regionIds !== undefined) {
      if (typeof query.regionIds !== 'string' || query.regionIds.length > 1200) invalid('regionIds 조건이 올바르지 않습니다.');
      const ids = [...new Set(query.regionIds.split(',').filter(Boolean))];
      if (ids.length === 0 || ids.length > 30) invalid('regionIds 조건이 올바르지 않습니다.');
      result.regionIds = ids.map((id) => uuid(id, 'regionIds'));
    }
    if (query.regionNames !== undefined) {
      if (typeof query.regionNames !== 'string' || query.regionNames.length > 150) invalid('지역 조건이 올바르지 않습니다.');
      const names = [...new Set(query.regionNames.split(',').filter(Boolean))];
      if (!names.length || names.some((name) => !Object.hasOwn(REGION_NAMES, name))) invalid('지역 조건이 올바르지 않습니다.');
      result.regionNames = names;
    }
    if (query.brands !== undefined) {
      if (typeof query.brands !== 'string' || query.brands.length > 1500) invalid('브랜드 조건이 올바르지 않습니다.');
      const brands = [...new Set(query.brands.split(',').map((name) => name.trim()).filter(Boolean))];
      if (!brands.length || brands.length > 75 || brands.some((name) => name.length > 40)) invalid('브랜드 조건이 올바르지 않습니다.');
      result.brands = brands;
    }
    for (const name of ['minPrice', 'maxPrice']) {
      if (query[name] !== undefined) result[name] = integer(query[name], name, 0);
    }
    for (const [name, choices] of [
      ['ratingMin', ['3', '3.5', '4', '4.5']],
      ['wishlistMin', ['10', '50', '100', '500']],
    ]) {
      if (query[name] !== undefined) {
        if (typeof query[name] !== 'string' || !choices.includes(query[name])) {
          invalid(`${name} 조건이 올바르지 않습니다.`);
        }
        result[name] = Number(query[name]);
      }
    }
    for (const name of ['inStock', 'pickup', 'delivery', 'discountOnly', 'includeUpcoming', 'includeSoldOut']) {
      if (query[name] !== undefined) result[name] = boolean(query[name], name);
    }
    if (result.minPrice !== undefined && result.maxPrice !== undefined
      && result.minPrice > result.maxPrice) {
      invalid('minPrice는 maxPrice보다 클 수 없습니다.');
    }
    return result;
  });
  if (!filters) return;

  try {
    const data = await productService.getProducts(filters);
    return res.status(200).json({ success: true, data, message: null });
  } catch (error) {
    return next(error);
  }
}

// Service contract: getProductDetail(storeProductId, { userId }).
export async function getProductDetail(req, res, next) {
  const storeProductId = validate(res, () => uuid(req.params.storeProductId, 'storeProductId'));
  if (!storeProductId) return;

  try {
    const data = await productService.getProductDetail(storeProductId, { userId: req.user?.id });
    return res.status(200).json({ success: true, data, message: null });
  } catch (error) {
    return next(error);
  }
}

// 비슷한 상품을 재고 있게 취급하는 다른 굿즈샵 추천
export async function getSimilarStores(req, res, next) {
  const input = validate(res, () => ({
    storeProductId: uuid(req.params.storeProductId, 'storeProductId'),
    size: req.query.size === undefined ? 10 : integer(req.query.size, 'size', 1, 30),
    includeCurrent: req.query.includeCurrent === undefined ? false : boolean(req.query.includeCurrent, 'includeCurrent'),
  }));
  if (!input) return;

  try {
    const data = await productService.getSimilarStores(input.storeProductId, {
      size: input.size,
      includeCurrent: input.includeCurrent,
    });
    return res.status(200).json({ success: true, data, message: null });
  } catch (error) {
    return next(error);
  }
}

// Service contract: getRelatedProducts(storeProductId, { size, userId }).
export async function getRelatedProducts(req, res, next) {
  const input = validate(res, () => ({
    storeProductId: uuid(req.params.storeProductId, 'storeProductId'),
    size: req.query.size === undefined ? 20 : integer(req.query.size, 'size', 1, 100),
  }));
  if (!input) return;

  try {
    const data = await productService.getRelatedProducts(input.storeProductId, {
      size: input.size,
      userId: req.user?.id,
    });
    return res.status(200).json({ success: true, data, message: null });
  } catch (error) {
    return next(error);
  }
}
