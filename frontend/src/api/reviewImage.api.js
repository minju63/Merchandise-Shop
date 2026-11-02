import client from './client.js';
import { supabase } from '../lib/supabase.js';

async function authHeaders() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: {} };
  if (!data.session?.access_token) throw new Error('로그인이 필요합니다.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

async function toBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  return btoa(binary);
}

export async function uploadReviewImages(files, { storeId } = {}) {
  const response = await client.post(
    '/reviews/images',
    {
      files: await Promise.all(
        files.map(async (file) => ({ mimeType: file.type, base64: await toBase64(file) }))
      ),
      ...(storeId ? { storeId } : {}),
    },
    { headers: await authHeaders(), timeout: 60000 }
  );
  return response.data.urls;
}
