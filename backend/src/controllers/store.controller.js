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

export async function list(req, res) {
  const options = query(req, ['popular', 'newest', 'stock']);
  options.openNow = flag(req.query.openNow, 'openNow');
  options.pickup = flag(req.query.pickup, 'pickup');
  options.delivery = flag(req.query.delivery, 'delivery');
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
  const options = query(req, ['popular', 'sales', 'newest', 'stock']);
  if (req.query.q !== undefined) badRequest('검색 파라미터는 지원하지 않습니다.');
  const result = await storeService.getStoreProductsPage(id, options);
  if (!result) notFound();
  ok(res, result);
}
