// 담당: 연수
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
    // req.user는 requireAuth가 토큰으로 확인한 사용자이며 request body에서 받지 않는다.
    const data = await authService.completeSignup(req.user, req.body);
    res.status(data.created ? 201 : 200).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function getRegistrationState(req, res, next) {
  try {
    const data = await authService.getRegistrationState(req.user.id);
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}
