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
