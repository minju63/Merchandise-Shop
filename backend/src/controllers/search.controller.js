import { logSearch, searchProducts } from '../services/search.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'INVALID_PARAMETER';
  throw error;
}

export async function getSearchProducts(req, res) {
  const { storeId, q = '', region = '', sort = 'popular', page = '1', size = '20' } = req.query;
  if (storeId !== undefined && (typeof storeId !== 'string' || !UUID.test(storeId))) {
    badRequest('올바른 굿즈샵 ID가 아닙니다.');
  }
  if (typeof q !== 'string' || q.trim().length > 200) badRequest('검색어는 200자 이하여야 합니다.');
  if (typeof region !== 'string' || region.trim().length > 50) badRequest('지역 조건이 올바르지 않습니다.');
  if (typeof sort !== 'string' || !['popular', 'sales', 'newest', 'stock'].includes(sort)) {
    badRequest('올바른 정렬 기준이 아닙니다.');
  }
  if (typeof page !== 'string' || !/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(Number(page))) {
    badRequest('page는 1 이상의 정수여야 합니다.');
  }
  if (typeof size !== 'string' || !/^[1-9]\d*$/.test(size) || Number(size) > 100) {
    badRequest('size는 1~100 사이여야 합니다.');
  }

  const data = await searchProducts({
    storeId,
    query: q.trim(),
    region: region.trim(),
    sort,
    page: Number(page),
    size: Number(size),
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
