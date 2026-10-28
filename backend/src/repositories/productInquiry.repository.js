/* Use the existing customer-support schema: inquiries belong to a store, not a listing.
 * The same store's PRODUCT inquiries appear across its product detail pages.
 * The server client bypasses RLS, so every read MUST also constrain user_id.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = 'id,title,content,status,answer_content,answered_at,created_at';
const IMAGES = 'inquiry_images(id,image_url,display_order)';

function requireId(value, name) {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw Object.assign(new Error(`${name}은 UUID여야 합니다.`), {
      status: 400,
      code: 'INVALID_REQUEST',
    });
  }
}

function checkError(error) {
  if (!error) return;
  const missingSchema = ['42703', 'PGRST204', 'PGRST200'].includes(error.code);
  throw Object.assign(
    new Error(
      missingSchema ? '상품 문의 DB 연결이 필요합니다.' : '상품 문의 처리에 실패했습니다.',
      { cause: error }
    ),
    {
      status: missingSchema ? 503 : 500,
      code: missingSchema ? 'INQUIRY_SCHEMA_NOT_READY' : 'INQUIRY_QUERY_FAILED',
    }
  );
}

export function createProductInquiryRepository(client) {
  return {
    async findByStoreId(storeId, { page = 1, size = 20, userId } = {}) {
      // Public GET retains no access to private support inquiries.
      if (!userId) return { items: [], totalCount: 0 };
      requireId(userId, 'userId');
      requireId(storeId, 'storeId');
      const offset = (page - 1) * size;
      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(size) ||
        size < 1 ||
        size > 100 ||
        !Number.isSafeInteger(offset + size)
      ) {
        throw Object.assign(new Error('페이지 범위를 확인해 주세요.'), {
          status: 400,
          code: 'INVALID_REQUEST',
        });
      }
      const { data, count, error } = await client
        .from('inquiries')
        .select(`${FIELDS},${IMAGES}`, { count: 'exact' })
        .eq('store_id', storeId)
        .eq('user_id', userId)
        .eq('category', 'PRODUCT')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + size - 1);
      checkError(error);
      return {
        items: (data ?? []).map((row) => ({
          ...row,
          inquiry_images: [...(row.inquiry_images ?? [])].sort(
            (a, b) => a.display_order - b.display_order || a.id.localeCompare(b.id)
          ),
        })),
        totalCount: count ?? 0,
      };
    },
    async create({ store_id, user_id, title, content }) {
      requireId(store_id, 'storeId');
      requireId(user_id, 'userId');
      if (
        typeof title !== 'string' ||
        !title.trim() ||
        Array.from(title.trim()).length > 100 ||
        typeof content !== 'string' ||
        !content.trim()
      ) {
        throw Object.assign(new Error('제목은 100자 이내이며 문의 내용이 필요합니다.'), {
          status: 400,
          code: 'INVALID_REQUEST',
        });
      }
      const { data, error } = await client
        .from('inquiries')
        .insert({
          store_id,
          user_id,
          category: 'PRODUCT',
          status: 'PENDING',
          title: title.trim(),
          content: content.trim(),
        })
        .select(FIELDS)
        .single();
      checkError(error);
      return data;
    },
  };
}

async function repository() {
  const { supabase } = await import('../lib/supabase.js');
  return createProductInquiryRepository(supabase);
}

export async function findByStoreId(storeId, options = {}) {
  if (!options.userId) return { items: [], totalCount: 0 };
  return (await repository()).findByStoreId(storeId, options);
}
export async function create(input) {
  return (await repository()).create(input);
}
