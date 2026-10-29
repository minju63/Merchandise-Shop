// 담당: 연수
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../my/hooks.js';
import { AuthHeader } from './AuthParts.jsx';
import { isValidPassword } from './authRules.js';
import { AUTH_ROUTES } from './authRoutes.js';
import './auth.css';

// 재설정 메일의 링크로 들어오는 화면. 링크가 유효하면 Supabase가 임시 세션을 만들어 준다.
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { status } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const passwordOk = isValidPassword(password);
  const confirmOk = confirm.length > 0 && confirm === password;

  const submit = async (event) => {
    event.preventDefault();
    if (!passwordOk || !confirmOk || busy) return;
    setBusy(true);
    setError('');
    const { error: cause } = await supabase.auth.updateUser({ password });
    if (cause) {
      setBusy(false);
      setError(
        cause.code === 'same_password'
          ? '이전과 다른 비밀번호를 입력해 주세요.'
          : '비밀번호를 바꾸지 못했어요. 링크가 만료됐다면 메일을 다시 받아 주세요.'
      );
      return;
    }
    // 임시 세션은 끊고 새 비밀번호로 다시 로그인하게 한다.
    await supabase.auth.signOut();
    navigate(AUTH_ROUTES.login, {
      replace: true,
      state: { notice: '비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.' },
    });
  };

  if (status === 'loading') return <main className="lg-page" />;

  if (status === 'out')
    return (
      <main className="lg-page">
        <AuthHeader title="비밀번호 재설정" />
        <h2 className="lg-heading">링크가 만료됐거나 올바르지 않아요</h2>
        <p className="lg-hint">재설정 메일을 다시 받아 주세요.</p>
        <div className="lg-footer">
          <button
            type="button"
            className="lg-main-btn"
            onClick={() => navigate(AUTH_ROUTES.findPassword, { replace: true })}
          >
            재설정 메일 다시 받기
          </button>
        </div>
      </main>
    );

  return (
    <main className="lg-page">
      <AuthHeader title="비밀번호 재설정" />
      <h2 className="lg-heading">새 비밀번호를 입력해 주세요</h2>
      <form className="lg-form" onSubmit={submit} id="reset-password-form">
        <div className="lg-field">
          <label htmlFor="rp-pw">새 비밀번호</label>
          <input
            id="rp-pw"
            className="lg-input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className={`lg-msg ${password && !passwordOk ? 'is-bad' : ''}`}>
            영문 · 숫자를 포함해 8자 이상
          </p>
        </div>
        <div className="lg-field">
          <label htmlFor="rp-pw2">새 비밀번호 확인</label>
          <input
            id="rp-pw2"
            className="lg-input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
          {confirm && !confirmOk ? (
            <p className="lg-msg is-bad">비밀번호가 일치하지 않아요</p>
          ) : null}
        </div>
      </form>
      {error ? <p className="lg-error">{error}</p> : null}
      <div className="lg-footer">
        <button
          type="submit"
          form="reset-password-form"
          className="lg-main-btn"
          disabled={!passwordOk || !confirmOk || busy}
        >
          비밀번호 변경
        </button>
      </div>
    </main>
  );
}
