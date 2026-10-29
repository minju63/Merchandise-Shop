import { Router } from "express";
import * as controller from "../controllers/order.controller.js";
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
router.get("/", requireAuthentication, controller.listMyOrders);
router.get("/claims", requireAuthentication, controller.listMyClaims);
router.post(
  "/:orderId/claims",
  requireAuthentication,
  controller.createMyClaim,
);
router.get(
  "/:orderId/pickup",
  requireAuthentication,
  controller.getMyPickupInfo,
);
router.patch(
  "/:orderId/address",
  requireAuthentication,
  controller.changeOrderAddress,
);
router.post(
  "/:orderId/reorder",
  requireAuthentication,
  controller.getReorderItems,
);
router.post(
  "/:orderId/cancel",
  requireAuthentication,
  controller.cancelMyOrder,
);
router.get("/:orderId", requireAuthentication, controller.getMyOrderDetail);
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
