// 담당: 연수
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { AuthHeader } from './AuthParts.jsx';
import { EMAIL_PATTERN } from './authRules.js';
import { AUTH_ROUTES } from './authRoutes.js';
import './auth.css';

// L-05 비밀번호 찾기. 서버 API 없이 Supabase가 재설정 메일을 보낸다.
export default function FindPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  const address = email.trim();
  const valid = EMAIL_PATTERN.test(address);

  const submit = async (event) => {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    const { error: cause } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}${AUTH_ROUTES.resetPassword}`,
    });
    setBusy(false);
    if (cause?.code === 'over_email_send_rate_limit' || cause?.code === 'over_request_rate_limit') {
      setError('요청이 너무 많아요. 잠시 후 다시 시도해 주세요.');
    } else if (cause) {
      setError('재설정 메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    } else {
      setSentTo(address);
    }
  };

  if (sentTo)
    return (
      <main className="lg-page">
        <AuthHeader title="비밀번호 찾기" />
        <h2 className="lg-heading">메일을 확인해 주세요</h2>
        <p className="lg-hint">
          {sentTo} 로 비밀번호 재설정 링크를 보냈어요. 가입된 이메일이라면 곧 도착해요. 메일이
          보이지 않으면 스팸함도 확인해 주세요.
        </p>
        <div className="lg-footer">
          <button type="button" className="lg-main-btn" onClick={() => navigate(AUTH_ROUTES.login)}>
            로그인으로 돌아가기
          </button>
        </div>
      </main>
    );

  return (
    <main className="lg-page">
      <AuthHeader title="비밀번호 찾기" />
      <h2 className="lg-heading">
        가입한 이메일을 입력하면
        <br />
        재설정 링크를 보내드려요
      </h2>
      <form className="lg-form" onSubmit={submit} id="find-password-form">
        <div className="lg-field">
          <label htmlFor="fp-email">이메일</label>
          <input
            id="fp-email"
            className="lg-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </form>
      {error ? <p className="lg-error">{error}</p> : null}
      <div className="lg-footer">
        <button
          type="submit"
          form="find-password-form"
          className="lg-main-btn"
          disabled={!valid || busy}
        >
          재설정 메일 보내기
        </button>
      </div>
    </main>
  );
}
