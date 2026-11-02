import { supabase } from '../lib/supabase.js';

const FIELDS = 'id,store_id,title,content,status,answer_content,answered_at,created_at';

function check(error) {
  if (!error) return;
  const missing = ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error.code);
  throw Object.assign(
    new Error(
      missing ? '굿즈샵 문의 DB 마이그레이션이 필요합니다.' : '굿즈샵 문의 처리에 실패했습니다.',
      { cause: error }
    ),
    {
      status: missing ? 503 : 500,
      code: missing ? 'STORE_INQUIRY_SCHEMA_NOT_READY' : 'STORE_INQUIRY_QUERY_FAILED',
    }
  );
}

export function createStoreInquiryRepository(client) {
  return {
    async getStore(id) {
      const { data, error } = await client
        .from('stores')
        .select('id,name,owner_id,status')
        .eq('id', id)
        .eq('status', 'ACTIVE')
        .maybeSingle();
      check(error);
      return data;
    },
    async getMember(id) {
      const { data, error } = await client
        .from('users')
        .select('id,status,role')
        .eq('id', id)
        .maybeSingle();
      check(error);
      return data;
    },
    async list(storeId, { page, size, userId }) {
      const offset = (page - 1) * size;
      const { data, error, count } = await client
        .from('store_inquiries')
        .select(`${FIELDS},user_id,author:users!store_inquiries_user_id_fkey(nickname)`, {
          count: 'exact',
        })
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + size - 1);
      check(error);
      return {
        items: (data ?? []).map(({ author, user_id, ...row }) => ({
          ...row,
          isMine: Boolean(userId && user_id === userId),
          authorName: author?.nickname || '회원',
        })),
        totalCount: count ?? 0,
      };
    },
    async create(input) {
      // A repeated request after a lost response reads the original row instead of inserting twice.
      const { error } = await client
        .from('store_inquiries')
        .upsert(input, { onConflict: 'user_id,request_id', ignoreDuplicates: true });
      check(error);
      const { data, error: readError } = await client
        .from('store_inquiries')
        .select(`${FIELDS},deleted_at`)
        .eq('user_id', input.user_id)
        .eq('request_id', input.request_id)
        .single();
      check(readError);
      if (data.deleted_at) {
        throw Object.assign(new Error('이미 삭제된 문의입니다. 새 문의로 작성해 주세요.'), {
          status: 409,
          code: 'REQUEST_ALREADY_USED',
        });
      }
      if (
        data.store_id !== input.store_id ||
        data.title !== input.title ||
        data.content !== input.content
      ) {
        throw Object.assign(
          new Error('이 요청은 이미 등록되었습니다. 목록을 확인한 후 새 문의를 작성해 주세요.'),
          { status: 409, code: 'REQUEST_ALREADY_USED' }
        );
      }
      const row = { ...data };
      delete row.deleted_at;
      return row;
    },
    async updatePending(storeId, inquiryId, userId, patch) {
      const { data, error } = await client
        .from('store_inquiries')
        .update(patch)
        .eq('store_id', storeId)
        .eq('id', inquiryId)
        .eq('user_id', userId)
        .eq('status', 'PENDING')
        .is('deleted_at', null)
        .select(FIELDS)
        .maybeSingle();
      check(error);
      return data;
    },
    async removePending(storeId, inquiryId, userId) {
      const { data, error } = await client
        .from('store_inquiries')
        .update({ deleted_at: new Date().toISOString() })
        .eq('store_id', storeId)
        .eq('id', inquiryId)
        .eq('user_id', userId)
        .eq('status', 'PENDING')
        .is('deleted_at', null)
        .select('id')
        .maybeSingle();
      check(error);
      return data;
    },
    async answer(storeId, inquiryId, userId, content) {
      const { data, error } = await client
        .from('store_inquiries')
        .update({
          status: 'ANSWERED',
          answer_content: content,
          answered_by: userId,
          answered_at: new Date().toISOString(),
        })
        .eq('store_id', storeId)
        .eq('id', inquiryId)
        .is('deleted_at', null)
        .select(FIELDS)
        .maybeSingle();
      check(error);
      return data;
    },
  };
}

export const storeInquiryRepository = createStoreInquiryRepository(supabase);
