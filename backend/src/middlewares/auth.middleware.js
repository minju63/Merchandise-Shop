import { getSupabase } from '../lib/supabase.js';

export async function requireAuth(req, res, next) {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      data: null,
      message: '로그인이 필요합니다.',
      code: 'AUTH_REQUIRED',
    });
  }

  const { data, error } = await getSupabase().auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({
      success: false,
      data: null,
      message: '유효하지 않은 로그인 정보입니다.',
      code: 'INVALID_TOKEN',
    });
  }

  req.user = data.user;
  return next();
}

export async function optionalAuth(req, res, next) {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) return next();

  const { data, error } = await getSupabase().auth.getUser(token);
  if (!error && data.user) req.user = data.user;
  return next();
}
