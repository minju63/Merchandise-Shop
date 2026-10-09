import { supabase } from '../lib/supabase.js';
import * as reviewService from '../services/review.service.js';

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function storeId(req) {
  if (!UUID.test(req.params.storeId))
    throw reviewService.reviewError(400, 'INVALID_PARAMETER', '올바른 굿즈샵 ID가 아닙니다.');
  return req.params.storeId;
}

function options(req) {
  const { sort = 'latest', page = '1', size = '20' } = req.query;
  if (typeof sort !== 'string' || !['latest', 'high', 'low'].includes(sort))
    throw reviewService.reviewError(400, 'INVALID_PARAMETER', '올바른 정렬 기준이 아닙니다.');
  if (typeof page !== 'string' || !/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(Number(page)))
    throw reviewService.reviewError(400, 'INVALID_PARAMETER', 'page는 1 이상의 정수여야 합니다.');
  if (typeof size !== 'string' || !/^[1-9]\d*$/.test(size) || Number(size) > 100)
    throw reviewService.reviewError(400, 'INVALID_PARAMETER', 'size는 1~100 사이여야 합니다.');
  return { sort, page: Number(page), size: Number(size) };
}

export async function requireUser(req, res, next) {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  if (!match) throw reviewService.reviewError(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
  const { data, error } = await supabase.auth.getUser(match[1]);
  if (error || !data.user)
    throw reviewService.reviewError(
      401,
      'UNAUTHORIZED',
      '로그인이 만료되었습니다. 다시 로그인해 주세요.'
    );
  req.userId = data.user.id;
  next();
}

export async function list(req, res) {
  const result = await reviewService.listStoreReviews(storeId(req), options(req));
  if (!result)
    throw reviewService.reviewError(404, 'STORE_NOT_FOUND', '굿즈샵을 찾을 수 없습니다.');
  res.json({ success: true, data: result, message: null });
}

export async function eligible(req, res) {
  const result = await reviewService.eligibleItems(req.userId, storeId(req));
  if (!result)
    throw reviewService.reviewError(404, 'STORE_NOT_FOUND', '굿즈샵을 찾을 수 없습니다.');
  res.json({ success: true, data: result, message: null });
}

export async function create(req, res) {
  const result = await reviewService.createReview(req.userId, req.body);
  res.status(201).json({ success: true, data: result, message: '리뷰가 등록되었습니다.' });
}
