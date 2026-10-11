import { supabase } from '../lib/supabase.js'; // 여경 함수용
import * as reviewService from '../services/review.service.js'; // 여경 함수용
import * as service from "../services/review.service.js";
import { ok } from "../utils/response.js";
export async function listMyReviewItems(req, res, next) {
  try {
    res
      .status(200)
      .json(
        ok(await service.listMyReviewItems(res.locals.authUser.id, req.query)),
      );
  } catch (error) {
    next(error);
  }
}
export async function createReview(req, res, next) {
  try {
    res
      .status(201)
      .json(ok(await service.createReview(res.locals.authUser.id, req.body)));
  } catch (error) {
    next(error);
  }
}
export async function updateReview(req, res, next) {
  try {
    res
      .status(200)
      .json(
        ok(
          await service.updateReview(
            res.locals.authUser.id,
            req.params.reviewId,
            req.body,
          ),
        ),
      );
  } catch (error) {
    next(error);
  }
}
export async function deleteReview(req, res, next) {
  try {
    res
      .status(200)
      .json(
        ok(
          await service.deleteReview(
            res.locals.authUser.id,
            req.params.reviewId,
            req.body,
          ),
        ),
      );
  } catch (error) {
    next(error);
  }
}

// ───── 여경 — 굿즈샵 리뷰 (develop 901aa29 에서 원문 그대로 가져옴) ─────

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
// (아래 내부 헬퍼는 위 함수들 전용)

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

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
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

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
export async function list(req, res) {
  const result = await reviewService.listStoreReviews(storeId(req), options(req));
  if (!result)
    throw reviewService.reviewError(404, 'STORE_NOT_FOUND', '굿즈샵을 찾을 수 없습니다.');
  res.json({ success: true, data: result, message: null });
}

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
// TODO: 연수님 GET /api/v1/reviews/me?tab=WRITABLE 와 기능이 겹친다.
//       리뷰 작성 진입점을 마이탭으로 통일하기로 하면 이 함수와
//       GET /stores/:storeId/reviewable-items 라우트를 제거한다. (팀 확인 중)
export async function eligible(req, res) {
  const result = await reviewService.eligibleItems(req.userId, storeId(req));
  if (!result)
    throw reviewService.reviewError(404, 'STORE_NOT_FOUND', '굿즈샵을 찾을 수 없습니다.');
  res.json({ success: true, data: result, message: null });
}
