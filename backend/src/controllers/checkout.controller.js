import * as service from "../services/checkout.service.js";
import { previewCheckout as preview } from "../services/checkout.service.js";
import { ok } from "../utils/response.js";

export async function previewCheckout(req, res, next) {
  try {
    const data = await preview(res.locals.authUser.id, req.body);
    return res.status(200).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function submitCheckout(req, res, next) {
  try {
    res
      .status(201)
      .json(ok(await service.submitCheckout(res.locals.authUser.id, req.body)));
  } catch (error) {
    next(error);
  }
}
export async function getCheckoutResult(req, res, next) {
  try {
    res.json(
      ok(
        await service.getCheckoutResult(
          res.locals.authUser.id,
          req.params.checkoutGroupId,
        ),
      ),
    );
  } catch (error) {
    next(error);
  }
}
