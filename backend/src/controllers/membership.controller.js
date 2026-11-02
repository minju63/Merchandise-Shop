import * as service from "../services/membership.service.js";
import * as couponPack from "../services/membershipCoupon.service.js";
import { ok } from "../utils/response.js";
export async function listConsumerPlans(req, res, next) {
  try {
    res.status(200).json(ok(await service.listConsumerPlans(req.query)));
  } catch (error) {
    next(error);
  }
}
export async function getMyMembership(req, res, next) {
  try {
    res
      .status(200)
      .json(
        ok(await service.getMyMembership(res.locals.authUser.id, req.query)),
      );
  } catch (error) {
    next(error);
  }
}
export async function subscribeMembership(req, res, next) {
  try {
    res
      .status(201)
      .json(
        ok(await service.subscribeMembership(res.locals.authUser.id, req.body)),
      );
  } catch (error) {
    next(error);
  }
}
export async function scheduleMembershipCancellation(req, res, next) {
  try {
    res
      .status(200)
      .json(
        ok(
          await service.scheduleMembershipCancellation(
            res.locals.authUser.id,
            req.body,
          ),
        ),
      );
  } catch (error) {
    next(error);
  }
}
export async function getMyMembershipCouponPack(req, res, next) {
  try {
    res
      .status(200)
      .json(ok(await couponPack.getMyMembershipCouponPack(res.locals.authUser.id)));
  } catch (error) {
    next(error);
  }
}
export async function claimMembershipCouponPack(req, res, next) {
  try {
    res
      .status(201)
      .json(ok(await couponPack.claimMembershipCouponPack(res.locals.authUser.id)));
  } catch (error) {
    next(error);
  }
}
