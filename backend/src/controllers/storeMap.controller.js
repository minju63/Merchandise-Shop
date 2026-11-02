import { getMapStores } from '../services/storeMap.service.js';
import { REGION_NAMES } from '../utils/regionNames.js';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function invalid(message) { throw Object.assign(new Error(message), { status: 400, code: 'INVALID_PARAMETER' }); }
export function parseMapQuery(query, productId) {
  const result = {};
  if (query.region !== undefined && (typeof query.region !== 'string' || !Object.hasOwn(REGION_NAMES, query.region))) invalid('지역이 올바르지 않습니다.');
  result.region = query.region;
  if (query.district !== undefined && (typeof query.district !== 'string' || !/^[가-힣0-9·\s-]{1,40}$/.test(query.district) || !result.region)) invalid('시·군·구 조건이 올바르지 않습니다.');
  result.district = query.district;
  for (const key of ['productId', 'regionId']) {
    const value = key === 'productId' && productId !== undefined ? productId : query[key];
    if (value !== undefined && (typeof value !== 'string' || !uuid.test(value))) invalid(`${key}가 올바르지 않습니다.`);
    result[key] = value;
  }
  if (query.keyword !== undefined && (typeof query.keyword !== 'string' || query.keyword.length > 200)) invalid('검색어는 200자 이내로 입력해 주세요.');
  result.keyword = query.keyword?.trim() || '';
  for (const key of ['openNow', 'pickup', 'delivery', 'inStock']) {
    if (query[key] !== undefined && !['true', 'false'].includes(query[key])) invalid(`${key}는 true 또는 false여야 합니다.`);
    result[key] = query[key] === 'true';
  }
  function number(key, min, max) {
    if (query[key] === undefined) return null;
    const value = typeof query[key] === 'string' && query[key].trim() ? Number(query[key]) : NaN;
    if (!Number.isFinite(value) || value < min || value > max) invalid(`${key}가 올바르지 않습니다.`);
    return value;
  }
  const latitude = number('latitude', -90, 90), longitude = number('longitude', -180, 180);
  if ((latitude === null) !== (longitude === null)) invalid('위도와 경도를 함께 보내 주세요.');
  result.origin = latitude === null ? null : { latitude, longitude };
  result.radius = number('radius', 0.001, 1000);
  result.sort = query.sort ?? 'popular';
  if (!['popular', 'newest', 'stock', 'distance'].includes(result.sort)) invalid('정렬 조건이 올바르지 않습니다.');
  if ((result.radius || result.sort === 'distance') && !result.origin) invalid('거리 검색에는 기준 위치가 필요합니다.');
  const south = number('south', -90, 90), north = number('north', -90, 90), west = number('west', -180, 180), east = number('east', -180, 180);
  if ([south, north, west, east].some((v) => v !== null)) {
    if ([south, north, west, east].some((v) => v === null) || south > north || west > east) invalid('지도 범위가 올바르지 않습니다.');
    result.bounds = { south, north, west, east };
  }
  return result;
}
export async function map(req, res) {
  res.set('Cache-Control', 'no-store').json({ success: true, data: await getMapStores(parseMapQuery(req.query)), message: null });
}
export async function productStores(req, res) {
  res.set('Cache-Control', 'no-store').json({ success: true, data: await getMapStores(parseMapQuery(req.query, req.params.productId)), message: null });
}
