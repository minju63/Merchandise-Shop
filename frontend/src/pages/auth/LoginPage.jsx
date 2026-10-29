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

  return (
    <main className="lg-page lg-login">
      <section className="lg-brand">
        <span className="lg-brand__logo">
          <BagIcon width={36} height={36} />
        </span>
        <h1 className="lg-brand__name">굿즈팡</h1>
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
