import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { checkNickname } from '../common/auth.api.js';
import { getMyProfile, updateMyProfile, withdrawAccount } from './account.api.js';
import { formatPhone } from './accountFormat.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { useRequest, useRequireLogin, useSession } from './hooks.js';
import { ChevronIcon, ImageIcon } from './icons.jsx';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './account.css';
import './settings.css';

const PROVIDERS = { kakao: '카카오', google: '구글', apple: '애플' };

function maskPhone(value) {
  const text = formatPhone(value);
  const parts = text.split('-');
  return parts.length === 3 ? `${parts[0]}-****-${parts[2]}` : text || '등록된 번호 없음';
}

function Row({ label, value, onClick, danger = false, disabled = false }) {
  const content = (
    <>
      <span className="set-row__text">{label}</span>
      {value ? <span className="set-row__value">{value}</span> : null}
      {onClick ? <ChevronIcon /> : null}
    </>
  );
  if (!onClick) return <div className="set-row">{content}</div>;
  return (
    <button
      type="button"
      className={danger ? 'set-row set-row--danger' : 'set-row'}
      disabled={disabled}
      onClick={onClick}
    >
      {content}
    </button>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const { session } = useSession();
  const profileRequest = useRequest(signedIn, 'my-profile', getMyProfile);
  const [override, setOverride] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [nickname, setNickname] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const profile = override ?? profileRequest.data?.profile ?? null;
  const user = session?.user;
  const provider = user?.app_metadata?.provider ?? 'email';
  const social = PROVIDERS[provider] ?? null;

  const fail = (cause) => {
    setError(cause.message);
    setBusy(false);
  };

  const saveNickname = async () => {
    const value = nickname.trim();
    setBusy(true);
    setError('');
    try {
      const check = await checkNickname(value);
      if (check.available === false && value !== profile.nickname) {
        throw new Error('이미 사용 중인 닉네임이에요.');
      }
      const saved = await updateMyProfile({ nickname: value });
      setOverride(saved.profile);
      setSheet(null);
      setBusy(false);
    } catch (cause) {
      fail(cause);
    }
  };

  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const path = `profiles/${profile.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('goods-images')
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('goods-images').getPublicUrl(path);
      const saved = await updateMyProfile({ profileImageUrl: data.publicUrl });
      setOverride(saved.profile);
      setBusy(false);
    } catch (cause) {
      fail(cause);
    }
  };

  const changePassword = async () => {
    setError('');
    setMessage('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}${MY_ROUTES.login}`,
    });
    if (resetError) setError(resetError.message);
    else setMessage('비밀번호 변경 메일을 보냈어요.');
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate(MY_ROUTES.login, { replace: true });
  };

  const withdraw = async () => {
    setBusy(true);
    setError('');
    try {
      await withdrawAccount();
      await supabase.auth.signOut();
      navigate(MY_ROUTES.login, { replace: true });
    } catch (cause) {
      fail(cause);
    }
  };

  let body;
  if (profileRequest.error)
    body = <ErrorNotice error={profileRequest.error} onRetry={profileRequest.reload} />;
  else if (!profile) body = <Loading />;
  else
    body = (
      <>
        <label className="pf-avatar">
          <span
            className="pf-avatar__img"
            style={
              profile.profile_image_url
                ? { backgroundImage: `url(${profile.profile_image_url})` }
                : undefined
            }
          />
          <span className="pf-avatar__cam">
            <ImageIcon width="16" height="16" />
          </span>
          <input type="file" accept="image/*" onChange={uploadImage} disabled={busy} />
        </label>
        <p className="pf-name">{profile.nickname}</p>
        {error ? <p className="set-error">{error}</p> : null}
        {message ? (
          <p className="set-error" style={{ color: '#5b45d6' }}>
            {message}
          </p>
        ) : null}
        <section className="set-section">
          <Row
            label="닉네임"
            value={profile.nickname}
            onClick={() => {
              setNickname(profile.nickname);
              setError('');
              setSheet('nickname');
            }}
          />
          <Row label="이메일" value={profile.email} />
          <Row label="휴대폰" value={maskPhone(profile.phone)} />
        </section>
        <section className="set-section">
          <Row label="연결된 소셜 계정" value={social ?? '없음'} />
          {social ? null : <Row label="비밀번호 변경" onClick={changePassword} />}
          <Row label="약관·동의 내역" onClick={() => navigate(MY_ROUTES.terms)} />
        </section>
        <section className="set-section">
          <Row label="로그아웃" onClick={logout} />
          <Row
            label="회원 탈퇴"
            danger
            onClick={() => {
              setError('');
              setSheet('withdraw');
            }}
          />
        </section>
      </>
    );

  return (
    <main className="ord-page">
      <PageHeader title="개인정보 관리" />
      {body}
      {sheet ? (
        <div className="ord-sheet-backdrop" onClick={() => !busy && setSheet(null)}>
          <div className="ord-sheet" onClick={(event) => event.stopPropagation()}>
            <span className="ord-sheet__grip" />
            {sheet === 'nickname' ? (
              <>
                <h2 className="ord-sheet__title">닉네임 변경</h2>
                <div className="frm">
                  <input
                    value={nickname}
                    maxLength={12}
                    onChange={(event) => setNickname(event.target.value)}
                  />
                </div>
                {error ? <p className="ord-sheet__error">{error}</p> : null}
                <div className="ord-sheet__actions">
                  <button type="button" className="ord-btn" onClick={() => setSheet(null)}>
                    취소
                  </button>
                  <button
                    type="button"
                    className="ord-btn ord-btn--primary"
                    disabled={busy || nickname.trim().length < 2}
                    onClick={saveNickname}
                  >
                    저장
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="ord-sheet__title">정말 탈퇴할까요?</h2>
                <p className="ord-sheet__sub">
                  진행 중인 주문이 있으면 탈퇴할 수 없어요. 탈퇴하면 쿠폰과 멤버십 혜택이 사라져요.
                </p>
                {error ? <p className="ord-sheet__error">{error}</p> : null}
                <div className="ord-sheet__actions">
                  <button type="button" className="ord-btn" onClick={() => setSheet(null)}>
                    취소
                  </button>
                  <button
                    type="button"
                    className="ord-btn ord-btn--primary"
                    disabled={busy}
                    onClick={withdraw}
                  >
                    탈퇴하기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
