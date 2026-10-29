import { createClient } from '@supabase/supabase-js';

export const supabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
  : null;

// 개발용 — 브라우저 콘솔에서 supabase 를 쓸 수 있게 한다. 배포 빌드에는 포함되지 않는다.
if (import.meta.env.DEV) window.supabase = supabase;
