import * as service from "../services/support.service.js";
import { ok } from "../utils/response.js";
export async function listNotices(req, res, next) {
  try {
    res.status(200).json(ok(await service.listNotices(req.query)));
  } catch (error) {
    next(error);
  }
}
export async function getNotice(req, res, next) {
  try {
    res
      .status(200)
      .json(ok(await service.getNotice(req.params.noticeId, req.query)));
  } catch (error) {
    next(error);
  }
}
export async function listFaqs(req, res, next) {
  try {
    res.status(200).json(ok(await service.listFaqs(req.query)));
  } catch (error) {
    next(error);
  }
}
export async function listMyInquiries(req, res, next) {
  try {
    res
      .status(200)
      .json(
        ok(await service.listMyInquiries(res.locals.authUser.id, req.query)),
      );
  } catch (error) {
    next(error);
  }
}
export async function getMyInquiry(req, res, next) {
  try {
    res
      .status(200)
      .json(
        ok(
          await service.getMyInquiry(
            res.locals.authUser.id,
            req.params.inquiryId,
            req.query,
          ),
        ),
      );
  } catch (error) {
    next(error);
  }
}
export async function createInquiry(req, res, next) {
  try {
    res
      .status(201)
      .json(ok(await service.createInquiry(res.locals.authUser.id, req.body)));
  } catch (error) {
    next(error);
  }
}
export async function updateInquiry(req, res, next) {
  try {
    res
      .status(200)
      .json(
        ok(
          await service.updateInquiry(
            res.locals.authUser.id,
            req.params.inquiryId,
            req.body,
          ),
        ),
      );
  } catch (error) {
    next(error);
  }
}
export async function deleteInquiry(req, res, next) {
  try {
    res
      .status(200)
      .json(
        ok(
          await service.deleteInquiry(
            res.locals.authUser.id,
            req.params.inquiryId,
            req.body,
          ),
        ),
      );
  } catch (error) {
    next(error);
  }
}
