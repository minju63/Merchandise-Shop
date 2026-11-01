import client from './client.js';
import { supabase } from '../lib/supabase.js';

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('로그인이 필요합니다.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

export const notificationApi = {
  list: async () => client.get('/notifications', { headers: await authHeaders() }),
  readAll: async () => client.patch('/notifications/read-all', {}, { headers: await authHeaders() }),
  read: async (id) => client.patch(`/notifications/${id}/read`, {}, { headers: await authHeaders() }),
  badges: async () => client.get('/header/badges', { headers: await authHeaders() }),
};
