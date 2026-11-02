import { Router } from "express";
import * as controller from "../controllers/membership.controller.js";
import { authenticate } from "../services/auth.service.js";
import { fail } from "../utils/response.js";
const router = Router();
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
async function requireAuthentication(req, res, next) {
  try {
    res.locals.authUser = await authenticate(req.get("Authorization"));
    next();
  } catch (error) {
    next(error);
  }
}
router.get("/plans", controller.listConsumerPlans);
router.get("/me", requireAuthentication, controller.getMyMembership);
router.post("/", requireAuthentication, controller.subscribeMembership);
// 이번 달 멤버십 쿠폰팩 (플랜별 쿠폰, 매달 1번)
router.get("/me/coupon-pack", requireAuthentication, controller.getMyMembershipCouponPack);
router.post("/me/coupon-pack", requireAuthentication, controller.claimMembershipCouponPack);
router.post(
  "/me/cancel",
  requireAuthentication,
  controller.scheduleMembershipCancellation,
);
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const known =
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status < 600 &&
    typeof error.code === "string";
  res
    .status(known ? error.status : 500)
    .json(
      fail(
        known ? error.code : "INTERNAL_ERROR",
        known ? error.message : "요청을 처리하지 못했어요.",
      ),
    );
});
export default router;
