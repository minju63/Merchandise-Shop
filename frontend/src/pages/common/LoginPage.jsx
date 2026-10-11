import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { BagIcon } from '../my/icons.jsx';
import { useSession } from '../my/hooks.js';
import { getRegistrationState } from './auth.api.js';
import { AUTH_ROUTES } from './authRoutes.js';
import './auth.css';

const PROVIDERS = [
  { id: 'kakao', label: '카카오로 시작하기', className: 'lg-social--kakao' },
  { id: 'google', label: 'Google로 시작하기', className: 'lg-social--google' },
  { id: 'apple', label: 'Apple로 시작하기', className: 'lg-social--apple' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status } = useSession();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const from = location.state?.from ?? AUTH_ROUTES.home;

  // 로그인된 상태면 가입 완료 여부를 보고 이동한다. 소셜 로그인 후 돌아왔을 때도 여기로 온다.
  useEffect(() => {
    if (status !== 'in') return undefined;
    let active = true;
    getRegistrationState().then(
      (state) => {
        if (!active) return;
        navigate(state.registrationComplete ? from : AUTH_ROUTES.signupTerms, { replace: true });
      },
      (cause) => active && setError(cause.message),
    );
    return () => {
      active = false;
    };
  }, [status, from, navigate]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    const { error: cause } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    });
    setBusy(false);
    if (cause) setError('이메일 또는 비밀번호를 확인해 주세요.');
  };

  const social = async (provider) => {
    setError('');
    const { error: cause } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${AUTH_ROUTES.login}` },
    });
    if (cause) setError('소셜 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
  };

  const findPassword = async () => {
    setError('');
    setNotice('');
    if (!form.email.trim()) {
      setError('비밀번호를 찾을 이메일을 먼저 입력해 주세요.');
      return;
    }
    const { error: cause } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
      redirectTo: `${window.location.origin}${AUTH_ROUTES.login}`,
    });
    if (cause) setError('재설정 메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    else setNotice('비밀번호 재설정 메일을 보냈어요. 메일함을 확인해 주세요.');
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

      {PROVIDERS.map((provider) => (
        <button
          key={provider.id}
          type="button"
          className={`lg-social ${provider.className}`}
          onClick={() => social(provider.id)}
        >
          {provider.id === 'google' ? <span className="lg-social__g">G</span> : null}
          {provider.label}
        </button>
      ))}

      <p className="lg-divider">또는 이메일로 로그인</p>

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
          disabled={busy || !form.email.trim() || !form.password}
        >
          로그인
        </button>
      </form>
      {error ? <p className="lg-error">{error}</p> : null}
      {notice ? <p className="lg-note">{notice}</p> : null}

      <div className="lg-links">
        <button type="button" onClick={findPassword}>
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
