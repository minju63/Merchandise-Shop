import * as service from '../services/coupon.service.js';
import { ok } from '../utils/response.js';

export async function listCheckoutCoupons(req, res, next) {
  try {
    const data = await service.listCheckoutCoupons(res.locals.authUser.id, req.query);
    res.status(200).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function listMyCoupons(req, res, next) {
  try {
    const data = await service.listMyCoupons(res.locals.authUser.id, req.query);
    res.status(200).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function getMyCouponDetail(req, res, next) {
  try {
    const data = await service.getMyCouponDetail(
      res.locals.authUser.id,
      req.params.userCouponId,
      req.query
    );
    res.status(200).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function registerCouponCode(req, res, next) {
  try {
    const data = await service.registerCouponCode(res.locals.authUser.id, req.body);
    res.status(200).json(ok(data));
  } catch (error) {
    next(error);
  }
}
