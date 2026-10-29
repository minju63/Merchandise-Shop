import * as storeService from '../services/store.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'INVALID_PARAMETER';
  throw error;
}

function notFound() {
  const error = new Error('굿즈샵을 찾을 수 없습니다.');
  error.status = 404;
  error.code = 'STORE_NOT_FOUND';
  throw error;
}

function storeId(req) {
  if (!UUID.test(req.params.storeId)) badRequest('올바른 굿즈샵 ID가 아닙니다.');
  return req.params.storeId;
}

function query(req, sorts) {
  const { sort = sorts[0], page = '1', size = '20' } = req.query;
  if (typeof sort !== 'string' || !sorts.includes(sort)) badRequest('올바른 정렬 기준이 아닙니다.');
  if (typeof page !== 'string' || !/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(Number(page)))
    badRequest('page는 1 이상의 정수여야 합니다.');
  if (typeof size !== 'string' || !/^[1-9]\d*$/.test(size) || Number(size) > 100)
    badRequest('size는 1~100 사이여야 합니다.');
  return { sort, page: Number(page), size: Number(size) };
}

function flag(value, name) {
  if (value === undefined) return false;
  if (value !== 'true' && value !== 'false') badRequest(`${name}은 true 또는 false여야 합니다.`);
  return value === 'true';
}

function ok(res, data) {
  res.json({ success: true, data, message: null });
}

// 위치 파라미터는 저장·로그 없이 이 요청의 거리 계산에만 쓴다.
function coordinate(value, name, limit) {
  if (value === undefined) return null;
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(number) || Math.abs(number) > limit)
    badRequest(`${name}은 올바른 좌표여야 합니다.`);
  return number;
}

function radius(value) {
  if (value === undefined) return null;
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(number) || number <= 0 || number > 1000)
    badRequest('radiusKm는 0보다 크고 1000 이하여야 합니다.');
  return number;
}

export async function list(req, res) {
  const options = query(req, ['popular', 'newest', 'stock', 'distance']);
  options.openNow = flag(req.query.openNow, 'openNow');
  options.pickup = flag(req.query.pickup, 'pickup');
  options.delivery = flag(req.query.delivery, 'delivery');
  const lat = coordinate(req.query.lat, 'lat', 90);
  const lng = coordinate(req.query.lng, 'lng', 180);
  if ((lat === null) !== (lng === null)) badRequest('lat과 lng는 함께 보내야 합니다.');
  options.origin = lat === null ? null : { lat, lng };
  options.radiusKm = radius(req.query.radiusKm);
  if (options.radiusKm !== null && !options.origin) badRequest('radiusKm는 lat, lng와 함께 보내야 합니다.');
  if (options.sort === 'distance' && !options.origin) badRequest('거리순은 현재 위치(lat, lng)가 필요합니다.');
  ok(res, await storeService.listStores(options));
}

export async function detail(req, res) {
  const result = await storeService.getStoreDetail(storeId(req));
  if (!result) notFound();
  ok(res, result);
}

export async function hours(req, res) {
  const result = await storeService.getStoreDetail(storeId(req));
  if (!result) notFound();
  ok(res, {
    businessHours: result.businessHours,
    openNow: result.openNow,
    status: result.businessStatus,
    reason: result.openReason,
    todayDay: result.todayDay,
    todayHours: result.todayHours,
    temporaryClosed: result.temporaryClosed,
  });
}

export async function pickup(req, res) {
  const result = await storeService.getStoreDetail(storeId(req));
  if (!result) notFound();
  ok(res, { available: result.pickupAvailable, info: result.pickupInfo });
}

export async function delivery(req, res) {
  const result = await storeService.getStoreDetail(storeId(req));
  if (!result) notFound();
  ok(res, {
    available: result.deliveryAvailable,
    info: result.deliveryInfo,
    areas: result.deliveryAreas,
  });
}

export async function products(req, res) {
  const id = storeId(req);
  const options = query(req, [
    'popular', 'sales', 'newest', 'wishlist', 'stock', 'stock_asc', 'price_asc', 'price_desc',
  ]);
  if (req.query.q !== undefined) badRequest('검색 파라미터는 지원하지 않습니다.');
  const result = await storeService.getStoreProductsPage(id, options);
  if (!result) notFound();
  ok(res, result);
}
