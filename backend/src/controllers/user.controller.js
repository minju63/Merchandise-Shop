import * as userService from '../services/user.service.js';
import { ok } from '../utils/response.js';

export async function getMySummary(req, res, next) {
  try {
    const data = await userService.getMySummary(res.locals.authUser.id);
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function updateMyProfile(req, res, next) {
  try {
    const data = await userService.updateMyProfile(res.locals.authUser.id, req.body);
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function getMyAgreements(req, res, next) {
  try {
    const data = await userService.getMyAgreements(res.locals.authUser.id, req.query);
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function withdrawAccount(req, res, next) {
  try {
    const data = await userService.withdrawAccount(res.locals.authUser.id, req.body);
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

function handle(action) {
  return async (req, res, next) => {
    try {
      res.json(ok(await action(res.locals.authUser.id, req)));
    } catch (error) {
      next(error);
    }
  };
}

export const getMyPoints = handle((userId, req) => userService.getMyPoints(userId, req.query));
export const recordProductView = handle((userId, req) =>
  userService.recordProductView(userId, req.body)
);
export const getRecentProducts = handle((userId, req) =>
  userService.getRecentProducts(userId, req.query)
);
export const listMyOpenAlerts = handle((userId, req) =>
  userService.listMyOpenAlerts(userId, req.query)
);
