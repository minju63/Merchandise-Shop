import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import Icon from './stores/components/Icon.jsx';

export default function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const requested = params.get('returnTo') || '/stores';
  const returnTo = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/stores';
  const [error, setError] = useState('');
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate(returnTo, { replace: true });
    });
  }, [navigate, returnTo]);
  async function signIn(provider) {
    if (!supabase) {
      setError('로그인 설정이 필요합니다.');
      return;
    }
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${returnTo}` },
    });
    if (authError) setError(authError.message);
  }
  return (
    <div className="app-shell">
      <header className="review-header">
        <Link to="/stores" aria-label="굿즈샵 목록으로">
          <Icon name="back" />
        </Link>
        <h1>로그인</h1>
      </header>
      <main className="review-main login-main">
        <h2>리뷰를 작성하려면 로그인해 주세요.</h2>
        <p>구매 완료된 상품만 리뷰할 수 있습니다.</p>
        <button className="review-write-button" onClick={() => signIn('google')}>
          Google로 로그인
        </button>
        <button className="secondary-button" onClick={() => signIn('kakao')}>
          카카오로 로그인
        </button>
        {error && (
          <p className="review-error" role="alert">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
