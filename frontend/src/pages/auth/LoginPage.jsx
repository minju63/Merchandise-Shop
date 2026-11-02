// 담당: 연수
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { BagIcon } from '../my/icons.jsx';
import { useSession } from '../my/hooks.js';
import { getRegistrationState } from '../../api/auth.api.js';
import { EMAIL_PATTERN } from './authRules.js';
import { AUTH_ROUTES, safeReturnPath } from './authRoutes.js';
import './auth.css';

// Supabase가 돌려주는 코드를 사용자에게 보여 줄 문장으로 바꾼다.
// 계정이 있는지 없는지는 알려 주지 않도록 잘못된 이메일·비밀번호는 같은 문장으로 묶는다.
function loginErrorMessage(cause) {
  switch (cause.code) {
    case 'email_not_confirmed':
      return '이메일 인증이 끝나지 않았어요. 받은 메일의 링크로 인증해 주세요.';
    case 'over_request_rate_limit':
      return '시도 횟수가 많아요. 잠시 후 다시 시도해 주세요.';
    case 'user_banned':
      return '이용할 수 없는 계정이에요.';
    default:
      return cause.status === 0 || cause.name === 'AuthRetryableFetchError'
        ? '네트워크 연결을 확인하고 다시 시도해 주세요.'
        : '이메일 또는 비밀번호를 확인해 주세요.';
  }
}

// 소셜 로그인 버튼 아이콘
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function KakaoMark() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path fill="#191919" d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.87 5.37 4.68 6.78l-.95 3.5c-.08.3.26.54.52.36l4.15-2.74c.53.07 1.05.1 1.6.1 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
    </svg>
  );
}

function NaverMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#fff" d="M16.27 12.85 7.5 0H0v24h7.73V11.15L16.5 24H24V0h-7.73z" />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { status } = useSession();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.notice ?? '');
  // 보호된 화면이 state.from 으로, 다른 탭이 ?returnTo= 로 보내므로 둘 다 받는다.
  const from =
    safeReturnPath(location.state?.from) ??
    safeReturnPath(params.get('returnTo')) ??
    AUTH_ROUTES.home;

  // 로그인된 상태면 가입 완료 여부를 보고 이동한다. 소셜 로그인 후 돌아왔을 때도 여기로 온다.
  useEffect(() => {
    if (status !== 'in') return undefined;
    let active = true;
    getRegistrationState().then(
      (state) => {
        if (!active) return;
        navigate(state.registrationComplete ? from : AUTH_ROUTES.signupTerms, { replace: true });
      },
      (cause) => {
        if (!active) return;
        setError(cause.message);
        // 이용할 수 없는 계정이거나 확인에 실패하면 로그인 상태를 풀어 다시 시도할 수 있게 한다.
        supabase.auth.signOut();
      }
    );
    return () => {
      active = false;
    };
  }, [status, from, navigate]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    setNotice('');
    setBusy(true);
    const { error: cause } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    });
    setBusy(false);
    // 성공하면 세션이 바뀌어 위의 effect가 가입 여부를 보고 이동시킨다.
    if (cause) setError(loginErrorMessage(cause));
  };

  // 소셜 로그인: Supabase가 해당 서비스 화면으로 보냈다가 /login 으로 돌려보내고, 위 effect가 가입 여부를 보고 이동시킨다.
  const signInWithProvider = async (provider, name) => {
    if (busy) return;
    setError('');
    setNotice('');
    setBusy(true);
    const { error: cause } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${AUTH_ROUTES.login}` },
    });
    if (cause) {
      setBusy(false);
      setError(`${name} 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.`);
    }
  };
  // 네이버는 아직 연결 전이라 모양만 보여 준다.
  const comingSoon = (name) => {
    setError('');
    setNotice(`${name} 로그인은 준비 중이에요.`);
  };

  return (
    <main className="lg-page lg-login">
      <section className="lg-brand">
        <span className="lg-brand__logo">
          <BagIcon width={36} height={36} />
        </span>
        <h1 className="lg-brand__name">굿즈픽</h1>
        <p className="lg-brand__tag">
          우리 동네 굿즈샵 재고를 한눈에,
          <br />
          픽업과 배달까지 한 번에
        </p>
      </section>

      <form onSubmit={submit}>
        <input
          className="lg-input"
          type="email"
          autoComplete="email"
          placeholder="이메일"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <input
          className="lg-input"
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        <button
          type="submit"
          className="lg-main-btn"
          disabled={busy || !EMAIL_PATTERN.test(form.email.trim()) || !form.password}
        >
          로그인
        </button>
      </form>
      {error ? <p className="lg-error">{error}</p> : null}
      {notice ? <p className="lg-note">{notice}</p> : null}

      <div className="lg-social">
        <p className="lg-social__title">SNS 계정으로 로그인</p>
        <div className="lg-social__row">
          <button type="button" className="lg-social__btn is-google" aria-label="구글로 로그인" disabled={busy} onClick={() => signInWithProvider('google', '구글')}>
            <GoogleMark />
          </button>
          <button type="button" className="lg-social__btn is-kakao" aria-label="카카오톡으로 로그인" disabled={busy} onClick={() => signInWithProvider('kakao', '카카오톡')}>
            <KakaoMark />
          </button>
          <button type="button" className="lg-social__btn is-naver" aria-label="네이버로 로그인" onClick={() => comingSoon('네이버')}>
            <NaverMark />
          </button>
        </div>
      </div>

      <div className="lg-links">
        <button
          type="button"
          onClick={() =>
            navigate(AUTH_ROUTES.findPassword, { state: { email: form.email.trim() } })
          }
        >
          비밀번호 찾기
        </button>
        <span className="lg-links__sep" />
        <button type="button" onClick={() => navigate(AUTH_ROUTES.signupTerms)}>
          <b>회원가입</b>
        </button>
      </div>
      <button type="button" className="lg-browse" onClick={() => navigate(AUTH_ROUTES.home)}>
        로그인 없이 둘러보기
      </button>
    </main>
  );
}
