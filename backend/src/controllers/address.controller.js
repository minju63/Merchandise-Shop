import * as service from '../services/address.service.js';
import { ok } from '../utils/response.js';

export async function listMyAddresses(req, res, next) {
  try {
    const data = await service.listMyAddresses(res.locals.authUser.id, req.query);
    res.status(200).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function createAddress(req, res, next) {
  try {
    const data = await service.createAddress(res.locals.authUser.id, req.body);
    res.status(201).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function setDefaultAddress(req, res, next) {
  try {
    const data = await service.setDefaultAddress(
      res.locals.authUser.id,
      req.params.addressId,
      req.body
    );
    res.status(200).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function updateAddress(req, res, next) {
  try {
    const data = await service.updateAddress(
      res.locals.authUser.id,
      req.params.addressId,
      req.body
    );
    res.status(200).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function deleteAddress(req, res, next) {
  try {
    const data = await service.deleteAddress(
      res.locals.authUser.id,
      req.params.addressId,
      req.body
    );
    res.status(200).json(ok(data));
  } catch (error) {
    next(error);
  }
}
