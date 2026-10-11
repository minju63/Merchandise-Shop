import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

// 팀 공용 루트 .env와 README의 backend/.env 구성을 모두 지원한다.
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), override: true });

let supabaseClient;

export function getSupabase() {
  const rawUrl = process.env.SUPABASE_URL || process.env.API_URL;
  const url = rawUrl?.replace(/\/(rest\/v1\/?|)$/, '');
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SECRET_KEYS;

  if (!url || !key) {
    const error = new Error('Supabase 서버 설정이 없습니다. SUPABASE_URL과 서버 전용 키를 확인하세요.');
    error.status = 503;
    throw error;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return supabaseClient;
}

// 기존 굿즈샵 모듈이 사용하는 supabase 이름도 동일한 클라이언트로 연결한다.
export const supabase = new Proxy({}, {
  get(_target, property) {
    const client = getSupabase();
    const value = client[property];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
