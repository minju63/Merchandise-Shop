import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { getMySummary } from './my.api.js';

// 공용 useAuth.js가 비어 있어 마이 화면 전용으로 둔다.
export function useSession() {
  const [state, setState] = useState({ status: 'loading', session: null });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ status: data.session ? 'in' : 'out', session: data.session });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ status: session ? 'in' : 'out', session });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export function useMySummary(userId) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const key = userId ? `${userId}:${attempt}` : null;

  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    getMySummary().then(
      (data) => active && setResult({ key, data, error: null }),
      (error) => active && setResult({ key, data: null, error })
    );
    return () => {
      active = false;
    };
  }, [key]);

  const current = result && result.key === key ? result : null;
  return {
    loading: Boolean(key) && !current,
    data: current?.data ?? null,
    error: current?.error ?? null,
    retry: () => setAttempt((value) => value + 1),
  };
}

// 로그인 상태에서만 요청하는 단순 조회 훅. cacheKey가 바뀌면 다시 불러온다.
export function useRequest(enabled, cacheKey, fetcher) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const key = enabled ? `${cacheKey}:${attempt}` : null;
  const latest = useRef(fetcher);
  useEffect(() => {
    latest.current = fetcher;
  });

  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    latest.current().then(
      (data) => active && setResult({ key, data, error: null }),
      (error) => active && setResult({ key, data: null, error })
    );
    return () => {
      active = false;
    };
  }, [key]);

  const current = result && result.key === key ? result : null;
  return {
    loading: Boolean(key) && !current,
    data: current?.data ?? null,
    error: current?.error ?? null,
    reload: () => setAttempt((value) => value + 1),
  };
}

// 로그인하지 않았으면 로그인 화면으로 보내고, 로그인 여부를 돌려준다.
// 로그인 후 원래 화면으로 돌아오도록 현재 경로를 state.from 으로 넘긴다.
export function useRequireLogin(loginPath) {
  const navigate = useNavigate();
  const location = useLocation();
  const { status } = useSession();
  const from = `${location.pathname}${location.search}`;
  useEffect(() => {
    if (status === 'out') navigate(loginPath, { replace: true, state: { from } });
  }, [status, navigate, loginPath, from]);
  return status === 'in';
}
