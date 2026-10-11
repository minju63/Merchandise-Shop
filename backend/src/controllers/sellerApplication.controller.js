import * as service from "../services/sellerApplication.service.js";
import { ok } from "../utils/response.js";
export async function getMySellerApplication(req, res, next) {
  try {
    res
      .status(200)
      .json(
        ok(
          await service.getMySellerApplication(
            res.locals.authUser.id,
            req.query,
          ),
        ),
      );
  } catch (error) {
    next(error);
  }
}
export async function submitSellerApplication(req, res, next) {
  try {
    res
      .status(201)
      .json(
        ok(
          await service.submitSellerApplication(
            res.locals.authUser.id,
            req.body,
          ),
        ),
      );
  } catch (error) {
    next(error);
  }
}
