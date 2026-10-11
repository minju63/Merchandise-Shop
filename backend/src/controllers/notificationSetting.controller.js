import * as service from '../services/notificationSetting.service.js';
import { ok } from '../utils/response.js';

export async function getMyNotificationSettings(req, res, next) {
  try {
    const data = await service.getMyNotificationSettings(res.locals.authUser.id, req.query);
    res.status(200).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function updateMyNotificationSettings(req, res, next) {
  try {
    const data = await service.updateMyNotificationSettings(res.locals.authUser.id, req.body);
    res.status(200).json(ok(data));
  } catch (error) {
    next(error);
  }
}
