import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

// 팀 공용 루트 .env와 README의 backend/.env 구성을 모두 지원한다.
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), override: true });

const rawUrl = process.env.SUPABASE_URL || process.env.API_URL;
const url = rawUrl?.replace(/\/(rest\/v1\/?|)$/, '');
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SECRET_KEYS;

if (!url || !key) {
  throw new Error('Supabase 서버 설정이 없습니다. SUPABASE_URL과 서버 전용 키를 확인하세요.');
}

export const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
