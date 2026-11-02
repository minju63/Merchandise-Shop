import { uncertainRequest } from './couponSafety.js';

const unknown = () => Object.assign(new Error('주문 처리 결과를 확인하지 못했습니다. 주문 상태를 다시 확인해 주세요.'), { code: 'CHECKOUT_RESULT_UNKNOWN', pending: true });

// Persist an account-scoped request BEFORE sending it; replays always use its original body/ID.
export function checkoutRecovery({ storage, accountId, send, lookup, makeId }) {
  const key = `goodspang:checkout-request:${accountId}`;
  let memory;
  const read = () => {
    try { return JSON.parse(storage.getItem(key)) ?? memory ?? null; } catch { return memory ?? null; }
  };
  const write = (value) => {
    memory = value;
    try { if (value) storage.setItem(key, JSON.stringify(value)); else storage.removeItem(key); } catch { /* in-memory recovery remains available */ }
  };
  const resolve = async (request) => {
    const status = await lookup(request.id);
    if (status.status === 'COMPLETED') { write(null); return status.result; }
    return null;
  };
  const submit = async (body, requestId) => {
    const existing = read();
    if (existing && existing.fingerprint !== JSON.stringify(body)) throw unknown();
    const request = existing ?? { id: requestId ?? makeId(), body, fingerprint: JSON.stringify(body) };
    write(request);
    try {
      const result = await send(request.body, request.id);
      write(null);
      return result;
    } catch (error) {
      if (uncertainRequest(error) || existing) {
        try { const result = await resolve(request); if (result) return result; } catch { /* preserve unresolved request */ }
        throw unknown();
      }
      // A definitive response to the first attempt has completed its DB transaction.
      write(null);
      throw error;
    }
  };
  const recover = async (retry = false) => {
    const request = read();
    if (!request) return null;
    try { const result = await resolve(request); if (result) return result; } catch { /* retry uses same identity */ }
    if (retry) return submit(request.body, request.id);
    throw unknown();
  };
  return { read, submit, recover };
}
