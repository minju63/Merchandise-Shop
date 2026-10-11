import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { CheckIcon } from '../my/icons.jsx';
import { useSession } from '../my/hooks.js';
import { AuthHeader } from './AuthParts.jsx';
import { checkEmail, checkNickname, completeSignup } from './auth.api.js';
import { AUTH_ROUTES } from './authRoutes.js';
import './auth.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9]{2,12}$/;

function Msg({ tone, children }) {
  return (
    <p className={`lg-msg ${tone ? `is-${tone}` : ''}`}>
      {tone === 'ok' ? <CheckIcon width={12} height={12} strokeWidth={3} /> : null}
      {children}
    </p>
  );
}

export default function SignupFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const agreements = location.state?.agreements ?? null;
  const { status, session } = useSession();
  // 소셜 로그인으로 이미 계정이 있으면 이메일·비밀번호 입력은 건너뛴다.
  const hasAccount = status === 'in';

  const [form, setForm] = useState({
    email: '',
    password: '',
    confirm: '',
    nickname: '',
    phone: '',
  });
  // 중복 확인을 마친 값. 입력값이 바뀌면 자동으로 무효가 된다.
  const [emailCheck, setEmailCheck] = useState(null);
  const [nicknameCheck, setNicknameCheck] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [verifyMail, setVerifyMail] = useState(false);

  useEffect(() => {
    if (!agreements) navigate(AUTH_ROUTES.signupTerms, { replace: true });
  }, [agreements, navigate]);

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const email = form.email.trim();
  const nickname = form.nickname.trim();
  const phoneDigits = form.phone.replace(/\D/g, '');

  const emailOk = emailCheck?.value === email && emailCheck.available;
  const nicknameOk = nicknameCheck?.value === nickname && nicknameCheck.available;
  const passwordOk =
    /[A-Za-z]/.test(form.password) && /\d/.test(form.password) && form.password.length >= 8;
  const confirmOk = form.confirm.length > 0 && form.confirm === form.password;
  const phoneOk = phoneDigits === '' || /^0\d{9,10}$/.test(phoneDigits);

  const runCheck = async (kind) => {
    setError('');
    try {
      if (kind === 'email') {
        const result = await checkEmail(email);
        setEmailCheck({ value: email, available: result.available });
      } else {
        const result = await checkNickname(nickname);
        setNicknameCheck({ value: nickname, available: result.available });
      }
    } catch (cause) {
      setError(cause.message);
    }
  };

  const ready =
    status !== 'loading' &&
    nicknameOk &&
    phoneOk &&
    (hasAccount || (emailOk && passwordOk && confirmOk));

  const submit = async (event) => {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      if (!hasAccount) {
        const { data, error: cause } = await supabase.auth.signUp({
          email,
          password: form.password,
        });
        if (cause) throw new Error(cause.message);
        if (!data.session) {
          // 이메일 인증이 켜져 있으면 세션이 없다. 인증 후 로그인하면 가입이 이어진다.
          setVerifyMail(true);
          return;
        }
      }
      const result = await completeSignup({
        nickname,
        phone: phoneDigits || null,
        agreements: {
          age14: agreements.age14,
          service: agreements.service,
          privacy: agreements.privacy,
          location: agreements.location,
          marketing: agreements.marketing,
          nightPush: agreements.nightPush,
        },
      });
      navigate(AUTH_ROUTES.signupDone, { replace: true, state: { signup: result } });
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };

  if (!agreements) return null;

  if (verifyMail)
    return (
      <main className="lg-page">
        <AuthHeader title="회원가입" step={2} />
        <h2 className="lg-heading">인증 메일을 보냈어요</h2>
        <p className="lg-hint">
          {email} 로 보낸 메일의 링크로 인증한 뒤 로그인하면 가입이 이어져요.
        </p>
        <div className="lg-footer">
          <button type="button" className="lg-main-btn" onClick={() => navigate(AUTH_ROUTES.login)}>
            로그인하러 가기
          </button>
        </div>
      </main>
    );

  return (
    <main className="lg-page">
      <AuthHeader title="회원가입" step={2} />
      <h2 className="lg-heading">회원 정보를 입력해 주세요</h2>

      <form className="lg-form" onSubmit={submit} id="signup-form">
        {hasAccount ? (
          <div className="lg-field">
            <label htmlFor="su-email">이메일</label>
            <input id="su-email" className="lg-input" value={session?.user?.email ?? ''} readOnly />
          </div>
        ) : (
          <>
            <div className="lg-field">
              <label htmlFor="su-email">
                이메일 <i>*</i>
              </label>
              <div className="lg-row">
                <input
                  id="su-email"
                  className="lg-input"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={set('email')}
                />
                <button
                  type="button"
                  className="lg-side-btn"
                  disabled={!EMAIL_PATTERN.test(email)}
                  onClick={() => runCheck('email')}
                >
                  중복 확인
                </button>
              </div>
              {emailCheck?.value === email ? (
                emailCheck.available ? (
                  <Msg tone="ok">사용할 수 있는 이메일이에요</Msg>
                ) : (
                  <Msg tone="bad">이미 가입된 이메일이에요</Msg>
                )
              ) : null}
            </div>

            <div className="lg-field">
              <label htmlFor="su-pw">
                비밀번호 <i>*</i>
              </label>
              <input
                id="su-pw"
                className="lg-input"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={set('password')}
              />
              <Msg tone={form.password && !passwordOk ? 'bad' : ''}>
                영문 · 숫자를 포함해 8자 이상
              </Msg>
            </div>

            <div className="lg-field">
              <label htmlFor="su-pw2">
                비밀번호 확인 <i>*</i>
              </label>
              <input
                id="su-pw2"
                className="lg-input"
                type="password"
                autoComplete="new-password"
                value={form.confirm}
                onChange={set('confirm')}
              />
              {form.confirm ? (
                confirmOk ? (
                  <Msg tone="ok">비밀번호가 일치해요</Msg>
                ) : (
                  <Msg tone="bad">비밀번호가 일치하지 않아요</Msg>
                )
              ) : null}
            </div>
          </>
        )}

        <div className="lg-field">
          <label htmlFor="su-nick">
            닉네임 <i>*</i>
          </label>
          <div className="lg-row">
            <input
              id="su-nick"
              className="lg-input"
              maxLength={12}
              value={form.nickname}
              onChange={set('nickname')}
            />
            <button
              type="button"
              className="lg-side-btn"
              disabled={!NICKNAME_PATTERN.test(nickname)}
              onClick={() => runCheck('nickname')}
            >
              중복 확인
            </button>
          </div>
          {nicknameCheck?.value === nickname ? (
            nicknameCheck.available ? (
              <Msg tone="ok">사용할 수 있는 닉네임이에요</Msg>
            ) : (
              <Msg tone="bad">이미 사용 중인 닉네임이에요</Msg>
            )
          ) : (
            <Msg>한글 · 영문 · 숫자 2~12자</Msg>
          )}
        </div>

        <div className="lg-field">
          <label htmlFor="su-phone">휴대폰 번호 (선택)</label>
          <input
            id="su-phone"
            className="lg-input"
            type="tel"
            inputMode="numeric"
            placeholder="010-0000-0000"
            value={form.phone}
            onChange={set('phone')}
          />
          {phoneOk ? (
            <Msg>주문 알림 연락처로 쓰여요</Msg>
          ) : (
            <Msg tone="bad">연락처 형식을 확인해 주세요</Msg>
          )}
        </div>
      </form>
      {error ? <p className="lg-error">{error}</p> : null}

      <div className="lg-footer">
        <button type="submit" form="signup-form" className="lg-main-btn" disabled={!ready || busy}>
          가입하기
        </button>
      </div>
    </main>
  );
}
