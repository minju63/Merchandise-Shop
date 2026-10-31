import * as service from "../services/order.service.js";
import { ok } from "../utils/response.js";
export async function listMyOrders(req, res, next) {
  try {
    res
      .status(200)
      .json(ok(await service.listMyOrders(res.locals.authUser.id, req.query)));
  } catch (error) {
    next(error);
  }
}
export async function getMyOrderDetail(req, res, next) {
  try {
    res
      .status(200)
      .json(
        ok(
          await service.getMyOrderDetail(
            res.locals.authUser.id,
            req.params.orderId,
            req.query,
          ),
        ),
      );
  } catch (error) {
    next(error);
  }
}
export async function getMyPickupInfo(req, res, next) {
  try {
    res
      .status(200)
      .json(
        ok(
          await service.getMyPickupInfo(
            res.locals.authUser.id,
            req.params.orderId,
            req.query,
          ),
        ),
      );
  } catch (error) {
    next(error);
  }
}
export async function changeOrderAddress(req, res, next) {
  try {
    res
      .status(200)
      .json(
        ok(
          await service.changeOrderAddress(
            res.locals.authUser.id,
            req.params.orderId,
            req.body,
          ),
        ),
      );
  } catch (error) {
    next(error);
  }
}
export async function getReorderItems(req, res, next) {
  try {
    res
      .status(200)
      .json(
        ok(
          await service.getReorderItems(
            res.locals.authUser.id,
            req.params.orderId,
            req.body,
          ),
        ),
      );
  } catch (error) {
    next(error);
  }
}
export async function cancelMyOrder(req, res, next) {
  try {
    res
      .status(200)
      .json(
        ok(
          await service.cancelMyOrder(
            res.locals.authUser.id,
            req.params.orderId,
            req.body,
          ),
        ),
      );
  } catch (error) {
    next(error);
  }
}
export async function listMyClaims(req, res, next) {
  try {
    res.json(ok(await service.listMyClaims(res.locals.authUser.id, req.query)));
  } catch (error) {
    next(error);
  }
}
export async function createMyClaim(req, res, next) {
  try {
    res
      .status(201)
      .json(
        ok(
          await service.createMyClaim(
            res.locals.authUser.id,
            req.params.orderId,
            req.body,
          ),
        ),
      );
  } catch (error) {
    next(error);
  }
}
