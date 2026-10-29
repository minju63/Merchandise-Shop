// 담당: 연수
import client from './client.js';
import { supabase } from '../lib/supabase.js';

// 공용 client는 토큰을 붙이지 않으므로, 로그인이 필요한 호출만 세션 토큰을 직접 싣는다.
async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

// 공용 client가 응답을 { success, data, message }까지 벗겨 주므로 data만 꺼낸다.
const data = (body) => body.data;

export const checkEmail = (email) =>
  client.get('/auth/email-check', { params: { email } }).then(data);

export const checkNickname = (nickname) =>
  client.get('/auth/nickname-check', { params: { nickname } }).then(data);

export const getRegistrationState = async () =>
  client.get('/auth/me/exists', { headers: await authHeaders() }).then(data);

export const completeSignup = async (body) =>
  client.post('/auth/signup', body, { headers: await authHeaders() }).then(data);
