// 담당: 연수
// 소셜 로그인 직후 어느 화면에 떨어지든(홈 등) 가입이 덜 끝났으면 약관 화면으로 보낸다.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRegistrationState } from '../../api/auth.api.js';
import { useSession } from '../my/hooks.js';
import { AUTH_ROUTES } from './authRoutes.js';

export const OAUTH_PENDING_KEY = 'oauth-pending';

export default function OAuthLandingGuard() {
  const navigate = useNavigate();
  const { status } = useSession();

  useEffect(() => {
    if (status !== 'in') return;
    let pending = false;
    try {
      pending = sessionStorage.getItem(OAUTH_PENDING_KEY) === '1';
      if (pending) sessionStorage.removeItem(OAUTH_PENDING_KEY);
    } catch {
      return;
    }
    if (!pending) return;
    getRegistrationState().then(
      (state) => {
        if (!state.registrationComplete) navigate(AUTH_ROUTES.signupTerms, { replace: true });
      },
      () => {}
    );
  }, [status, navigate]);

  return null;
}
