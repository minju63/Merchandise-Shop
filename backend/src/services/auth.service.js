import * as userRepository from '../repositories/user.repository.js';
import { issueSignupCoupons } from './coupon.service.js';

const TERMS_TYPES = ['SERVICE', 'PRIVACY', 'LOCATION', 'MARKETING', 'NIGHT_PUSH'];

function failure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function validateObject(value, allowedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw failure(400, 'INVALID_INPUT', `${label} 형식을 확인해 주세요.`);
  }
  if (Object.keys(value).some((key) => !allowedKeys.includes(key))) {
    throw failure(400, 'UNKNOWN_FIELDS', `${label}에 허용되지 않은 항목이 있어요.`);
  }
}

export function normalizeNickname(value) {
  if (typeof value !== 'string') {
    throw failure(400, 'INVALID_NICKNAME', '닉네임을 입력해 주세요.');
  }
  const nickname = value.normalize('NFC').trim();
  if (!/^[가-힣a-zA-Z0-9]{2,12}$/.test(nickname)) {
    throw failure(400, 'INVALID_NICKNAME', '닉네임은 한글·영문·숫자 2~12자로 입력해 주세요.');
  }
  return nickname;
}

export function validateSignupInput(input) {
  validateObject(input, ['nickname', 'phone', 'agreements', 'termsVersions'], '가입 정보');
  const nickname = normalizeNickname(input.nickname);
  validateObject(
    input.agreements,
    ['age14', 'service', 'privacy', 'location', 'marketing', 'nightPush'],
    '약관 동의'
  );
  for (const [key, value] of Object.entries(input.agreements)) {
    if (typeof value !== 'boolean') {
      throw failure(400, 'INVALID_AGREEMENT', `${key} 동의는 true 또는 false로 보내 주세요.`);
    }
  }
  if (
    input.agreements.age14 !== true ||
    input.agreements.service !== true ||
    input.agreements.privacy !== true
  ) {
    throw failure(400, 'REQUIRED_AGREEMENTS', '만 14세 이상 확인과 필수 약관 동의가 필요해요.');
  }
  const agreements = {
    age14: true,
    service: true,
    privacy: true,
    location: input.agreements.location ?? false,
    marketing: input.agreements.marketing ?? false,
    nightPush: input.agreements.nightPush ?? false,
  };
  if (agreements.nightPush && !agreements.marketing) {
    throw failure(
      400,
      'NIGHT_PUSH_REQUIRES_MARKETING',
      '마케팅 수신 동의 후 야간 알림을 켤 수 있어요.'
    );
  }

  let phone = null;
  if (input.phone !== undefined && input.phone !== null && input.phone !== '') {
    if (typeof input.phone !== 'string' || !/^[0-9\s()-]+$/.test(input.phone)) {
      throw failure(400, 'INVALID_PHONE', '연락처 형식을 확인해 주세요.');
    }
    phone = input.phone.replace(/[\s()-]/g, '');
    if (!/^0\d{9,10}$/.test(phone)) {
      throw failure(400, 'INVALID_PHONE', '연락처는 0으로 시작하는 10~11자리로 입력해 주세요.');
    }
  }

  const termsVersions = input.termsVersions ?? {};
  validateObject(termsVersions, TERMS_TYPES, '약관 버전');
  const versions = {};
  for (const [key, value] of Object.entries(termsVersions)) {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > 100) {
      throw failure(400, 'INVALID_TERMS_VERSION', '약관 버전 형식을 확인해 주세요.');
    }
    versions[key] = value.trim();
  }
  return { nickname, phone, agreements, termsVersions: versions };
}

export function buildInitialNotificationSettings(agreements) {
  return {
    marketing: agreements.marketing,
    night_push: agreements.nightPush,
  };
}

export async function authenticate(authorization) {
  const token =
    typeof authorization === 'string' ? /^Bearer ([^\s]+)$/i.exec(authorization)?.[1] : null;
  if (!token) throw failure(401, 'AUTH_REQUIRED', '로그인이 필요해요.');

  let result;
  try {
    const { supabase } = await import('../lib/supabase.js');
    result = await supabase.auth.getUser(token);
  } catch {
    throw failure(503, 'AUTH_UNAVAILABLE', '인증 서버에 연결하지 못했어요.');
  }
  if (result.error) {
    if ([400, 401, 403].includes(result.error.status)) {
      throw failure(401, 'INVALID_TOKEN', '로그인이 만료되었거나 유효하지 않아요.');
    }
    throw failure(503, 'AUTH_UNAVAILABLE', '인증 상태를 확인하지 못했어요.');
  }
  if (!result.data?.user?.id) {
    throw failure(401, 'INVALID_TOKEN', '로그인 상태를 확인해 주세요.');
  }
  return result.data.user;
}

export async function checkNicknameAvailability(input) {
  const nickname = normalizeNickname(input);
  const existing = await userRepository.findByNickname(nickname);
  return { nickname, available: existing === null, reason: existing ? 'TAKEN' : null };
}

export async function checkEmailAvailability(input) {
  const email = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!/^[^\s@%_,]+@[^\s@%_,]+\.[^\s@%_,]+$/.test(email) || email.length > 254) {
    throw failure(400, 'INVALID_EMAIL', '이메일 형식을 확인해 주세요.');
  }
  const existing = await userRepository.findByEmail(email);
  return { email, available: existing === null, reason: existing ? 'TAKEN' : null };
}

export function buildRegistrationState(snapshot) {
  const { user, agreements, notificationSettings } = snapshot;
  const missingSteps = [];
  if (!user) missingSteps.push('PROFILE');
  const latest = new Map();
  for (const agreement of agreements) {
    if (!latest.has(agreement.terms_type)) latest.set(agreement.terms_type, agreement);
  }
  if (!['SERVICE', 'PRIVACY'].every((type) => latest.get(type)?.agreed === true)) {
    missingSteps.push('REQUIRED_AGREEMENTS');
  }
  if (!notificationSettings) missingSteps.push('NOTIFICATION_SETTINGS');
  return {
    exists: user !== null,
    registrationComplete: missingSteps.length === 0 && user?.status === 'ACTIVE',
    missingSteps,
    user,
  };
}

function ensureActiveAccount(user) {
  if (user && user.status !== 'ACTIVE') {
    throw failure(403, 'ACCOUNT_UNAVAILABLE', '이 계정은 현재 이용할 수 없어요.');
  }
}

export async function getRegistrationState(userId) {
  const snapshot = await userRepository.getRegistrationSnapshot(userId);
  ensureActiveAccount(snapshot.user);
  return buildRegistrationState(snapshot);
}

export async function completeSignup(authUser, input) {
  const validated = validateSignupInput(input);
  const snapshot = await userRepository.getRegistrationSnapshot(authUser.id);
  ensureActiveAccount(snapshot.user);
  const existingState = buildRegistrationState(snapshot);
  if (existingState.registrationComplete) {
    const signupCoupons = await finishSignupCoupons(authUser.id);
    return {
      ...existingState,
      created: false,
      alreadyRegistered: true,
      signupCoupons,
      couponIssuancePending: signupCoupons.pending,
    };
  }
  if (snapshot.user && snapshot.user.nickname !== validated.nickname) {
    throw failure(409, 'PROFILE_ALREADY_CREATED', '저장된 닉네임으로 가입을 이어서 진행해 주세요.');
  }

  const email = snapshot.user?.email ?? authUser.email;
  if (typeof email !== 'string' || email.trim().length === 0) {
    throw failure(
      422,
      'EMAIL_REQUIRED',
      '현재 DB에는 이메일이 필요해요. 이메일이 있는 계정으로 가입해 주세요.'
    );
  }
  if (!snapshot.user) {
    const nickname = await checkNicknameAvailability(validated.nickname);
    if (!nickname.available) {
      throw failure(409, 'NICKNAME_TAKEN', '이미 사용 중인 닉네임이에요.');
    }
  }
  const agreementValues = {
    SERVICE: validated.agreements.service,
    PRIVACY: validated.agreements.privacy,
    LOCATION: validated.agreements.location,
    MARKETING: validated.agreements.marketing,
    NIGHT_PUSH: validated.agreements.nightPush,
  };

  let saved;
  try {
    saved = await userRepository.completeSignup(authUser.id, {
      email,
      nickname: validated.nickname,
      phone: validated.phone,
      agreements: TERMS_TYPES.map((type) => ({
        terms_type: type,
        terms_version: validated.termsVersions[type] ?? null,
        agreed: agreementValues[type],
      })),
      notificationSettings: buildInitialNotificationSettings(validated.agreements),
    });
  } catch (error) {
    if (error.databaseCode === '23505') {
      throw failure(409, 'NICKNAME_TAKEN', '이미 사용 중인 닉네임이에요.');
    }
    throw error;
  }
  ensureActiveAccount(saved.user);
  const state = buildRegistrationState(saved);
  if (!state.registrationComplete) {
    throw failure(
      503,
      'REGISTRATION_INCOMPLETE',
      '가입 저장이 완료되지 않았어요. 다시 시도해 주세요.'
    );
  }
  const signupCoupons = await finishSignupCoupons(authUser.id);
  return {
    ...state,
    created: snapshot.user === null,
    alreadyRegistered: false,
    signupCoupons,
    couponIssuancePending: signupCoupons.pending,
  };
}

// 가입 저장 성공과 혜택 발급 실패를 구분한다. 가입 재호출로 실제 누락 쿠폰을 다시 확인한다.
export async function finishSignupCoupons(userId) {
  try {
    return await issueSignupCoupons(userId);
  } catch (error) {
    return {
      status: 'FAILED',
      pending: true,
      errorCode: typeof error.code === 'string' ? error.code : 'COUPON_ISSUANCE_FAILED',
    };
  }
}
