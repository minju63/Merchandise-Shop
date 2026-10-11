import * as service from "../services/report.service.js";
import { ok } from "../utils/response.js";
export async function createReport(req, res, next) {
  try {
    res
      .status(201)
      .json(ok(await service.createReport(res.locals.authUser.id, req.body)));
  } catch (error) {
    next(error);
  }
}
export async function listMyReports(req, res, next) {
  try {
    res
      .status(200)
      .json(ok(await service.listMyReports(res.locals.authUser.id, req.query)));
  } catch (error) {
    next(error);
  }
}
