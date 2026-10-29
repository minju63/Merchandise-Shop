// 담당: 연수
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MY_ROUTES } from '../my/routes.js';
import { ChevronIcon } from '../my/icons.jsx';
import { AuthHeader, Box } from './AuthParts.jsx';
import { AUTH_ROUTES } from './authRoutes.js';
import './auth.css';

const TERMS = [
  { key: 'age14', tag: '필수', name: '만 14세 이상입니다', required: true, link: false },
  { key: 'service', tag: '필수', name: '서비스 이용약관', required: true, link: true },
  { key: 'privacy', tag: '필수', name: '개인정보 수집 · 이용', required: true, link: true },
  { key: 'location', tag: '선택', name: '위치기반서비스 이용약관', link: true },
  { key: 'marketing', tag: '선택', name: '마케팅 정보 수신', link: true },
  { key: 'nightPush', tag: '선택', name: '야간 알림 수신 (21시 – 08시)', link: true },
];

const EMPTY = {
  age14: false,
  service: false,
  privacy: false,
  location: false,
  marketing: false,
  nightPush: false,
};

export default function SignupTermsPage() {
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(EMPTY);

  const all = TERMS.every((term) => agreed[term.key]);
  const requiredDone = TERMS.filter((term) => term.required).every((term) => agreed[term.key]);

  const toggle = (key, value) =>
    setAgreed((prev) => {
      const next = { ...prev, [key]: value };
      // 야간 알림은 마케팅 수신에 동의해야만 켤 수 있다.
      if (key === 'marketing' && !value) next.nightPush = false;
      return next;
    });
  const toggleAll = (value) =>
    setAgreed(Object.fromEntries(TERMS.map((term) => [term.key, value])));

  return (
    <main className="lg-page">
      <AuthHeader title="회원가입" step={1} />
      <h2 className="lg-heading">
        굿즈픽 이용약관에
        <br />
        동의해 주세요
      </h2>

      <div className="lg-all">
        <Box checked={all} onChange={toggleAll} label="전체 동의하기" />
        <div className="lg-all__text">
          <strong>전체 동의하기</strong>
          <span>선택 항목을 포함해 모든 약관에 동의해요</span>
        </div>
      </div>

      <ul className="lg-terms">
        {TERMS.map((term, index) => {
          const disabled = term.key === 'nightPush' && !agreed.marketing;
          return (
            <li key={term.key}>
              {index === 3 ? <div className="lg-terms__sep" /> : null}
              <div className={disabled ? 'lg-term is-off' : 'lg-term'}>
                <Box
                  checked={agreed[term.key]}
                  disabled={disabled}
                  onChange={(value) => toggle(term.key, value)}
                  label={term.name}
                />
                <span className={term.required ? 'lg-term__tag is-req' : 'lg-term__tag'}>
                  {term.tag}
                </span>
                <span className="lg-term__name">{term.name}</span>
                {term.link ? (
                  <button
                    type="button"
                    className="lg-term__go"
                    aria-label={`${term.name} 보기`}
                    onClick={() => navigate(`${MY_ROUTES.terms}?type=${term.key}`)}
                  >
                    <ChevronIcon width={16} height={16} />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="lg-hint">야간 알림은 마케팅 정보 수신에 동의해야 선택할 수 있어요.</p>

      <div className="lg-footer">
        <button
          type="button"
          className="lg-main-btn"
          disabled={!requiredDone}
          onClick={() => navigate(AUTH_ROUTES.signupInfo, { state: { agreements: agreed } })}
        >
          다음
        </button>
      </div>
    </main>
  );
}
