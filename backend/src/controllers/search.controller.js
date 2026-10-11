import { logSearch, searchProducts } from '../services/search.service.js';
import { fail } from '../utils/response.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGIONS = new Set(['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']);

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'INVALID_PARAMETER';
  throw error;
}

function commaList(value, validator, label) {
  if (value === undefined || value === '') return [];
  if (typeof value !== 'string' || value.length > 1000) badRequest(`${label} 조건이 올바르지 않습니다.`);
  const values = [...new Set(value.split(',').filter(Boolean))];
  if (values.length > 30 || values.some((item) => !validator(item))) badRequest(`${label} 조건이 올바르지 않습니다.`);
  return values;
}

function amount(value, label) {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) badRequest(`${label} 금액이 올바르지 않습니다.`);
  return Number(value);
}

function flag(value, label) {
  if (value === undefined || value === '') return undefined;
  if (value !== 'true' && value !== 'false') badRequest(`${label} 조건이 올바르지 않습니다.`);
  return value === 'true';
}

function choice(value, allowed, label) {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !allowed.includes(value)) badRequest(`${label} 조건이 올바르지 않습니다.`);
  return Number(value);
}

export async function getSearchProducts(req, res) {
  const { storeId, q = '', region = '', sort = 'popular', page = '1', size = '20', contentCategories, goodsCategories, regions, minPrice, maxPrice, inStock, pickup, delivery, discountOnly, discountBands, includeUpcoming, ratingMin, wishlistMin } = req.query;
  if (storeId !== undefined && (typeof storeId !== 'string' || !UUID.test(storeId))) {
    badRequest('올바른 굿즈샵 ID가 아닙니다.');
  }
  if (typeof q !== 'string' || q.trim().length > 200) badRequest('검색어는 200자 이하여야 합니다.');
  if (typeof region !== 'string' || region.trim().length > 50) badRequest('지역 조건이 올바르지 않습니다.');
  if (typeof sort !== 'string' || !['popular', 'sales', 'wishlist', 'newest', 'priceLow', 'priceHigh', 'stock'].includes(sort)) {
    badRequest('올바른 정렬 기준이 아닙니다.');
  }
  if (typeof page !== 'string' || !/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(Number(page))) {
    badRequest('page는 1 이상의 정수여야 합니다.');
  }
  if (typeof size !== 'string' || !/^[1-9]\d*$/.test(size) || Number(size) > 100) {
    badRequest('size는 1~100 사이여야 합니다.');
  }

  const filters = {
    contentCategories: commaList(contentCategories, (value) => UUID.test(value), '카테고리'),
    goodsCategories: commaList(goodsCategories, (value) => UUID.test(value), '굿즈 종류'),
    regions: commaList(regions, (value) => REGIONS.has(value), '지역'),
    minPrice: amount(minPrice, '최소'),
    maxPrice: amount(maxPrice, '최대'),
    inStock: flag(inStock, '재고'),
    pickup: flag(pickup, '픽업'),
    delivery: flag(delivery, '배달'),
    discountOnly: flag(discountOnly, '할인'),
    discountBands: commaList(discountBands, (value) => ['under10', '10to30', 'over30'].includes(value), '할인율'),
    includeUpcoming: flag(includeUpcoming, '입고 예정'),
    ratingMin: choice(ratingMin, ['3', '3.5', '4', '4.5'], '후기 별점'),
    wishlistMin: choice(wishlistMin, ['10', '50', '100', '500'], '찜 개수'),
  };
  if (filters.minPrice !== undefined && filters.maxPrice !== undefined && filters.minPrice > filters.maxPrice) badRequest('최소 가격은 최대 가격보다 클 수 없습니다.');

  const data = await searchProducts({
    storeId,
    query: q.trim(),
    region: region.trim(),
    sort,
    page: Number(page),
    size: Number(size),
    filters,
  });
  res.json({ success: true, data, message: null });
}

export async function postSearchLog(req, res) {
  const searchLog = await logSearch({
    userId: req.user?.id,
    query: req.body.query,
    resultCount: req.body.resultCount,
    regionId: req.body.regionId,
  });

  res.status(201).json({ success: true, data: searchLog, message: null });
}

// ───── 아래는 미구현 스텁 ─────

const notImplemented = (res) =>
  res.status(501).json(fail('NOT_IMPLEMENTED', '아직 구현되지 않았습니다'));

// GET /api/v1/search — 통합 검색
export async function getSearch(req, res) {
  // TODO
  notImplemented(res);
}

// GET /api/v1/search/suggest — 자동완성
export async function getSearchSuggest(req, res) {
  // TODO
  notImplemented(res);
}

// GET /api/v1/search/popular — 인기 검색어
export async function getPopularSearches(req, res) {
  // TODO
  notImplemented(res);
}

// GET /api/v1/search/recent — 최근 검색어
export async function getRecentSearches(req, res) {
  // TODO
  notImplemented(res);
}

// DELETE /api/v1/search/recent — 최근 검색어 삭제
export async function deleteRecentSearches(req, res) {
  // TODO
  notImplemented(res);
}
