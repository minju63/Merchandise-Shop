// 담당: 동균 (호출만 — 멤버십 · 결제수단 백엔드는 연수님 담당)
// 굿즈 패스 구독 전환(J-05)에 필요한 호출
import client from './client.js';
import { supabase } from '../lib/supabase.js';

async function authHeaders() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: {} };
  if (!data.session?.access_token) throw new Error('로그인이 필요합니다.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

export const membershipApi = {
  plans: () => client.get('/memberships/plans'),
  me: async () => client.get('/memberships/me', { headers: await authHeaders() }),
  // body: { planCode, paymentMethodId, paymentAgreed: true, autoRenew? }
  subscribe: async (body) => client.post('/memberships', body, { headers: await authHeaders() }),
  // 구독 결제에 쓸 결제수단 (POST /memberships 에 paymentMethodId 가 필요하다)
  paymentMethods: async () => client.get('/payment-methods', { headers: await authHeaders() }),
};
