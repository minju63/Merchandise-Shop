import * as service from '../services/paymentMethod.service.js';
import { ok } from '../utils/response.js';

export async function listMyPaymentMethods(req, res, next) {
  try {
    const data = await service.listMyPaymentMethods(res.locals.authUser.id, req.query);
    res.status(200).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function createPaymentMethod(req, res, next) {
  try {
    const data = await service.createPaymentMethod(res.locals.authUser.id, req.body);
    res.status(201).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function setDefaultPaymentMethod(req, res, next) {
  try {
    const data = await service.setDefaultPaymentMethod(
      res.locals.authUser.id,
      req.params.paymentMethodId,
      req.body
    );
    res.status(200).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function deletePaymentMethod(req, res, next) {
  try {
    const data = await service.deletePaymentMethod(
      res.locals.authUser.id,
      req.params.paymentMethodId,
      req.body
    );
    res.status(200).json(ok(data));
  } catch (error) {
    next(error);
  }
}
