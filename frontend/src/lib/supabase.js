import { createClient } from '@supabase/supabase-js';

// 팀원 .env에 REST 주소(…/rest/v1/)가 들어 있어도 인증·스토리지 요청이 깨지지 않게 프로젝트 주소만 쓴다.
// (백엔드 lib/supabase.js도 같은 방식으로 뒤쪽 /rest/v1 을 제거한다.)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/(rest\/v1\/?|)$/, '');

export const supabase = supabaseUrl && import.meta.env.VITE_SUPABASE_ANON_KEY
  ? createClient(supabaseUrl, import.meta.env.VITE_SUPABASE_ANON_KEY)
  : null;

// 개발용 — 브라우저 콘솔에서 supabase 를 쓸 수 있게 한다. 배포 빌드에는 포함되지 않는다.
if (import.meta.env.DEV) window.supabase = supabase;
