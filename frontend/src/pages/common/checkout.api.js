import { http } from '../my/my.api.js';
import { supabase } from '../../lib/supabase.js';
import { checkoutRecovery } from './checkoutRecovery.js';

const data = (response) => response.data.data;

export const previewCheckout = (body) => http.post('/checkout/preview', body).then(data);
const recoveryByAccount = new Map();
function recoveryFor(accountId) {
  if (!recoveryByAccount.has(accountId)) recoveryByAccount.set(accountId, checkoutRecovery({
    accountId, storage: {
      getItem: (key) => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value), removeItem: (key) => localStorage.removeItem(key),
    },
    makeId: () => crypto.randomUUID(),
    send: (body, key) => http.post('/checkout', body, { headers: { 'Idempotency-Key': key } }).then(data),
    lookup: (key) => http.get(`/checkout/requests/${key}`).then(data),
  }));
  return recoveryByAccount.get(accountId);
}
export async function submitCheckout(body, requestId) {
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) throw Object.assign(new Error('로그인이 필요해요.'), { status: 401 });
  return recoveryFor(auth.session.user.id).submit(body, requestId);
}
export const hasPendingCheckout = (accountId) => Boolean(accountId && recoveryFor(accountId).read());
export const recoverPendingCheckout = (accountId, retry = false) => recoveryFor(accountId).recover(retry);
export const getCheckoutResult = (groupId) => http.get(`/checkout/${groupId}`).then(data);
