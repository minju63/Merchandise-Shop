import * as authService from '../services/auth.service.js';
import { ok } from '../utils/response.js';

export async function checkNickname(req, res, next) {
  try {
    const data = await authService.checkNicknameAvailability(req.query.nickname);
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function checkEmail(req, res, next) {
  try {
    const data = await authService.checkEmailAvailability(req.query.email);
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function completeSignup(req, res, next) {
  try {
    // authUser는 이 라우터의 실제 토큰 검증 결과이며 request body에서 받지 않는다.
    const data = await authService.completeSignup(res.locals.authUser, req.body);
    res.status(data.created ? 201 : 200).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function getRegistrationState(req, res, next) {
  try {
    const data = await authService.getRegistrationState(res.locals.authUser.id);
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}
