import { randomUUID } from 'node:crypto';
import { getSupabase } from '../lib/supabase.js';

const db = () => getSupabase();
const fail = (status, code, message) => { throw Object.assign(new Error(message), { status, code }); };
const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value ?? '');
const check = ({ data, error }) => {
  if (error) fail(503, 'SHOWCASE_STORAGE_ERROR', '진열장 정보를 처리하지 못했어요.');
  return data;
};
const validText = (value, max, required = false) => typeof value === 'string'
  && value.length <= max && (!required || value.trim().length > 0);
const asset = (id, path) => path ? `/api/v1/showcases/${id}/media/${encodeURIComponent(path)}` : null;

async function profile(userId) {
  if (!userId) fail(401, 'AUTH_REQUIRED', '로그인이 필요합니다.');
  const row = check(await db().from('users').select('id,nickname,role,status').eq('id', userId).maybeSingle());
  if (!row || row.status !== 'ACTIVE') fail(403, 'ACCOUNT_UNAVAILABLE', '사용할 수 없는 계정이에요.');
  return row;
}
async function shopOwner(userId, storeId) {
  const user = await profile(userId);
  if (!['SELLER', 'ADMIN'].includes(user.role)) fail(403, 'SELLER_REQUIRED', '승인된 판매자만 이용할 수 있어요.');
  if (!uuid(storeId)) fail(400, 'INVALID_STORE', '매장을 다시 선택해 주세요.');
  const store = check(await db().from('stores').select('id,name,owner_id,status').eq('id', storeId).maybeSingle());
  if (!store || store.owner_id !== userId || store.status !== 'ACTIVE') fail(403, 'STORE_FORBIDDEN', '운영 중인 내 매장만 관리할 수 있어요.');
  return store;
}
async function base(id) {
  if (!uuid(id)) fail(400, 'INVALID_ID', '진열장 주소를 확인해 주세요.');
  const row = check(await db().from('showcases').select('*').eq('id', id).maybeSingle());
  if (!row) fail(404, 'SHOWCASE_NOT_FOUND', '진열장을 찾을 수 없어요.');
  return row;
}
async function allowed(id, userId, edit = false) {
  const row = await base(id);
  if (edit ? row.owner_id !== userId : !row.is_public && row.owner_id !== userId)
    fail(edit ? 403 : 404, 'SHOWCASE_FORBIDDEN', '진열장을 볼 수 없어요.');
  if (row.owner_id === userId || edit) {
    await profile(userId);
    if (row.type === 'SHOP') await shopOwner(userId, row.store_id);
  } else {
    const owner = check(await db().from('users').select('status').eq('id', row.owner_id).maybeSingle());
    if (owner?.status !== 'ACTIVE') fail(404, 'SHOWCASE_NOT_FOUND', '진열장을 찾을 수 없어요.');
    if (row.type === 'SHOP') {
      const store = check(await db().from('stores').select('status').eq('id', row.store_id).maybeSingle());
      if (store?.status !== 'ACTIVE') fail(404, 'SHOWCASE_NOT_FOUND', '진열장을 찾을 수 없어요.');
    }
  }
  return row;
}
async function decorate(row, viewerId, detailed = false) {
  const [owner, store, items, liked] = await Promise.all([
    db().from('users').select('nickname,status').eq('id', row.owner_id).maybeSingle(),
    row.store_id ? db().from('stores').select('id,name,status,pickup_available,delivery_available,temporary_closed').eq('id', row.store_id).maybeSingle() : Promise.resolve({ data: null }),
    db().from('showcase_items').select('*').eq('showcase_id', row.id).order('layer_order'),
    viewerId ? db().from('showcase_likes').select('user_id').eq('showcase_id', row.id).eq('user_id', viewerId).limit(1) : Promise.resolve({ data: [] }),
  ]);
  [owner, store, items, liked].forEach(check);
  const productIds = [...new Set((items.data ?? []).map((item) => item.store_product_id).filter(Boolean))];
  const records = productIds.length ? check(await db().from('store_products')
    .select('id,price,discount_rate,stock,status,pickup_available,delivery_available,product:products(name,thumbnail_url)')
    .in('id', productIds)) : [];
  const products = new Map(records.map((record) => [record.id, {
    id: record.id, name: record.product?.name, imageUrl: record.product?.thumbnail_url,
    price: Math.round(record.price * (100 - (record.discount_rate ?? 0)) / 100), stock: record.stock, status: record.status,
    pickupAvailable: Boolean(record.pickup_available && store.data?.pickup_available && !store.data?.temporary_closed && store.data?.status === 'ACTIVE'),
    deliveryAvailable: Boolean(record.delivery_available && store.data?.delivery_available && !store.data?.temporary_closed && store.data?.status === 'ACTIVE'),
  }]));
  const enriched = (items.data ?? []).map((item) => {
    const product = products.get(item.store_product_id) ?? null;
    return { ...item, imageUrl: item.cutout_path ? asset(row.id, item.cutout_path)
      : item.original_path ? asset(row.id, item.original_path) : product?.imageUrl, product };
  });
  const thumbnail = row.thumbnail_path || (items.data ?? []).find((item) => item.cutout_path || item.original_path)?.cutout_path
    || (items.data ?? []).find((item) => item.original_path)?.original_path;
  return {
    ...row, ownerNickname: owner.data?.nickname ?? '회원', ownerStatus: owner.data?.status,
    storeName: store.data?.name ?? null,
    storeStatus: store.data?.status ?? null, itemCount: items.data?.length ?? 0,
    likeCount: row.like_count ?? 0, liked: Boolean(liked.data?.length),
    thumbnailUrl: asset(row.id, thumbnail),
    items: detailed ? enriched : enriched.map((item) => ({
      id: item.id, x: item.x, y: item.y, scale: item.scale, rotation: item.rotation,
      layer_order: item.layer_order, imageUrl: item.imageUrl,
    })),
  };
}

export async function list({ type, storeId, categoryId, mine, sort = 'newest', page = 1, size = 12 }, viewerId) {
  if (!['PERSONAL', 'SHOP'].includes(type) || !['newest', 'popular'].includes(sort))
    fail(400, 'INVALID_FILTER', '목록 조건을 확인해 주세요.');
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1 || size > 30)
    fail(400, 'INVALID_PAGE', '페이지를 확인해 주세요.');
  if (storeId && (type !== 'SHOP' || !uuid(storeId))) fail(400, 'INVALID_STORE', '매장을 다시 선택해 주세요.');
  if (mine) await (type === 'SHOP' ? shopOwner(viewerId, storeId) : profile(viewerId));
  if (categoryId && (type !== 'SHOP' || mine || !uuid(categoryId)))
    fail(400, 'INVALID_CATEGORY', '카테고리를 다시 선택해 주세요.');
  let query;
  if (categoryId) {
    query = db().rpc('showcases_by_category', {
      p_category: categoryId, p_store: storeId || null, p_sort: sort,
    }, { count: 'exact' });
  } else {
    query = db().from('showcases').select('*', { count: 'exact' }).eq('type', type);
    if (mine) query = query.eq('owner_id', viewerId);
    else query = query.eq('is_public', true);
    if (storeId) query = query.eq('store_id', storeId);
    query = query.order(sort === 'popular' ? 'like_count' : 'created_at', { ascending: false });
  }
  const { data, count, error } = await query.range((page - 1) * size, page * size - 1);
  check({ data, error });
  let items = await Promise.all((data ?? []).map((row) => decorate(row, viewerId)));
  if (!mine) items = items.filter((row) => row.is_public && row.ownerStatus === 'ACTIVE' && (type !== 'SHOP' || row.storeStatus === 'ACTIVE'));
  return { items, totalCount: count ?? 0, page, size };
}

export async function detail(id, viewerId) {
  const row = await allowed(id, viewerId);
  return decorate(row, viewerId, true);
}

export async function create(input, viewerId) {
  await profile(viewerId);
  if (!['PERSONAL', 'SHOP'].includes(input.type) || !validText(input.name, 80, true))
    fail(400, 'INVALID_SHOWCASE', '진열장 이름을 확인해 주세요.');
  if (input.type === 'SHOP') await shopOwner(viewerId, input.storeId);
  const row = check(await db().from('showcases').insert({
    owner_id: viewerId, type: input.type, store_id: input.type === 'SHOP' ? input.storeId : null,
    name: input.name.trim(),
  }).select('*').single());
  return decorate(row, viewerId, true);
}

export function validateItems(items, row) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 40)
    fail(400, 'INVALID_ITEMS', '굿즈를 1개 이상, 40개 이하로 배치해 주세요.');
  for (const item of items) {
    if (![item.x, item.y, item.scale, item.rotation, item.layer_order].every(Number.isFinite)
      || item.x < 0 || item.x > 1 || item.y < 0 || item.y > 1
      || item.scale < 0.25 || item.scale > 3 || Math.abs(item.rotation) > 180
      || item.layer_order < 0 || item.layer_order > 100
      || !['goods_name', 'work_title', 'character_name'].every((field) => item[field] == null || validText(item[field], 100))
      || (item.note != null && !validText(item.note, 300)))
      fail(400, 'INVALID_ITEM', '굿즈 배치 정보를 확인해 주세요.');
    if (row.type === 'PERSONAL') {
      if (item.store_product_id || !item.original_path?.startsWith(`${row.owner_id}/${row.id}/original/`)
        || item.cutout_path && !item.cutout_path.startsWith(`${row.owner_id}/${row.id}/cutout/`))
        fail(400, 'INVALID_IMAGE', '내 사진만 추가할 수 있어요.');
    } else if (!uuid(item.store_product_id) || item.original_path)
      fail(400, 'INVALID_PRODUCT', '매장 상품을 선택해 주세요.');
    if (row.type === 'SHOP' && item.cutout_path && !item.cutout_path.startsWith(`${row.owner_id}/${row.id}/cutout/`))
      fail(400, 'INVALID_IMAGE', '내 진열장 이미지로 다시 처리해 주세요.');
  }
}

export async function save(id, input, viewerId) {
  const row = await allowed(id, viewerId, true);
  if (!Number.isInteger(input.version) || !validText(input.name, 80, true)
    || !validText(input.description ?? '', 500) || typeof input.isPublic !== 'boolean')
    fail(400, 'INVALID_SHOWCASE', '진열장 정보를 확인해 주세요.');
  const background = check(await db().from('showcase_backgrounds').select('id').eq('id', input.backgroundId).eq('enabled', true).maybeSingle());
  if (!background) fail(400, 'INVALID_BACKGROUND', '배경을 다시 선택해 주세요.');
  validateItems(input.items, row);
  if (row.type === 'SHOP') {
    const ids = [...new Set(input.items.map((item) => item.store_product_id))];
    const products = check(await db().from('store_products').select('id,store_id').in('id', ids));
    if (products.length !== ids.length || products.some((product) => product.store_id !== row.store_id))
      fail(403, 'PRODUCT_FORBIDDEN', '내 매장 상품만 추가할 수 있어요.');
  }
  const result = await db().rpc('save_showcase', {
    p_id: id, p_owner: viewerId, p_version: input.version,
    p_name: input.name.trim(), p_description: input.description ?? '',
    p_background: input.backgroundId, p_public: input.isPublic,
    p_items: input.items.map((item, index) => ({
      store_product_id: item.store_product_id ?? null, goods_name: item.goods_name ?? null,
      work_title: item.work_title ?? null, character_name: item.character_name ?? null,
      note: item.note ?? null, original_path: item.original_path ?? null,
      cutout_path: item.cutout_path ?? null, x: item.x, y: item.y,
      scale: item.scale, rotation: item.rotation, layer_order: index,
    })),
  });
  if (result.error) fail(result.error.message?.includes('changed elsewhere') ? 409 : 503,
    'SHOWCASE_SAVE_FAILED', result.error.message?.includes('changed elsewhere')
      ? '다른 기기에서 수정했어요. 새로고침 후 다시 편집해 주세요.' : '저장하지 못했어요. 다시 시도해 주세요.');
  return detail(id, viewerId);
}

export async function remove(id, viewerId) {
  const row = await allowed(id, viewerId, true);
  check(await db().from('showcases').delete().eq('id', id).eq('owner_id', viewerId));
  for (const folder of ['original', 'cutout', 'thumbnail']) {
    const prefix = `${row.owner_id}/${id}/${folder}`;
    const listing = await db().storage.from('showcase-private').list(prefix, { limit: 1000 });
    if (!listing.error && listing.data?.length) {
      await db().storage.from('showcase-private').remove(listing.data.map((file) => `${prefix}/${file.name}`));
    }
  }
  return { deleted: true };
}

export async function like(id, viewerId, liked) {
  await profile(viewerId);
  const row = await allowed(id, viewerId);
  if (!row.is_public || row.owner_id === viewerId) fail(403, 'LIKE_FORBIDDEN', '이 진열장은 좋아요를 누를 수 없어요.');
  const result = liked
    ? await db().from('showcase_likes').upsert({ showcase_id: id, user_id: viewerId }, { onConflict: 'showcase_id,user_id', ignoreDuplicates: true })
    : await db().from('showcase_likes').delete().eq('showcase_id', id).eq('user_id', viewerId);
  check(result);
  return decorate(await base(id), viewerId);
}

export async function products(storeId, viewerId) {
  await shopOwner(viewerId, storeId);
  const rows = check(await db().from('store_products')
    .select('id,store_id,price,stock,status,product:products(name,thumbnail_url)')
    .eq('store_id', storeId).not('status', 'in', '(HIDDEN,DELETED)').order('created_at', { ascending: false }).limit(100));
  return rows.map((row) => ({ ...row, name: row.product?.name, imageUrl: row.product?.thumbnail_url }));
}

function imageInfo(buffer) {
  if (buffer.length < 32 || buffer.length > 6 * 1024 * 1024) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    && buffer.toString('ascii', buffer.length - 8, buffer.length - 4) === 'IEND')
    return { mime: 'image/png', ext: 'png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (buffer.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))
    && buffer.subarray(buffer.length - 2).equals(Buffer.from('ffd9', 'hex'))) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3].includes(marker))
        return { mime: 'image/jpeg', ext: 'jpg', width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      offset += 2 + length;
    }
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
    && buffer.readUInt32LE(4) + 8 === buffer.length) {
    const format = buffer.toString('ascii', 12, 16);
    if (format === 'VP8X') return { mime: 'image/webp', ext: 'webp', width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
    if (format === 'VP8L') return { mime: 'image/webp', ext: 'webp', width: 1 + (((buffer[22] & 0x3f) << 8) | buffer[21]), height: 1 + (((buffer[24] & 0x0f) << 10) | (buffer[23] << 2) | ((buffer[22] & 0xc0) >> 6)) };
    if (format === 'VP8 ') return { mime: 'image/webp', ext: 'webp', width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

export async function upload(id, input, viewerId) {
  const row = await allowed(id, viewerId, true);
  if ((row.type !== 'PERSONAL' && input.kind !== 'thumbnail') || !['original', 'cutout', 'thumbnail'].includes(input.kind)
    || typeof input.base64 !== 'string' || input.base64.length > 8_400_000)
    fail(400, 'INVALID_IMAGE', '사진 파일을 확인해 주세요.');
  const buffer = Buffer.from(input.base64, 'base64');
  const info = imageInfo(buffer);
  if (!info || info.width < 16 || info.height < 16 || info.width > 8000 || info.height > 8000)
    fail(400, 'INVALID_IMAGE', 'PNG, JPG, WebP 사진(6MB 이하)을 선택해 주세요.');
  if (input.kind === 'thumbnail' && info.mime !== 'image/png')
    fail(400, 'INVALID_IMAGE', '미리보기는 PNG여야 해요.');
  if (input.kind !== 'thumbnail') {
    const listing = await db().storage.from('showcase-private').list(`${viewerId}/${id}/${input.kind}`, { limit: 101 });
    if (listing.error) fail(503, 'UPLOAD_FAILED', '사진 저장 공간을 확인하지 못했어요.');
    if (listing.data.length >= 100) fail(413, 'UPLOAD_LIMIT', '사진은 진열장당 최대 100장까지 올릴 수 있어요.');
  }
  const path = `${viewerId}/${id}/${input.kind}/${randomUUID()}.${info.ext}`;
  const result = await db().storage.from('showcase-private').upload(path, buffer, { contentType: info.mime, upsert: false });
  if (result.error) fail(503, 'UPLOAD_FAILED', '사진 업로드에 실패했어요. 다시 시도해 주세요.');
  if (input.kind === 'thumbnail') {
    const updated = await db().from('showcases').update({ thumbnail_path: path }).eq('id', id).eq('owner_id', viewerId);
    check(updated);
    if (row.thumbnail_path) await db().storage.from('showcase-private').remove([row.thumbnail_path]);
  }
  return { path, imageUrl: asset(id, path) };
}

export async function removeBackground(id, input, viewerId) {
  const row = await allowed(id, viewerId, true);
  if (row.type !== 'PERSONAL' || !input.path?.startsWith(`${viewerId}/${id}/original/`))
    fail(400, 'INVALID_IMAGE', '먼저 원본 사진을 올려 주세요.');
  if (!process.env.REMOVE_BG_API_KEY)
    fail(503, 'REMOVAL_UNAVAILABLE', '배경 제거 설정이 없어요. 원본 사진으로 계속 편집할 수 있어요.');
  const original = await db().storage.from('showcase-private').download(input.path);
  if (original.error) fail(404, 'IMAGE_NOT_FOUND', '원본 사진을 찾을 수 없어요.');
  const form = new FormData();
  form.append('image_file', original.data, 'photo.jpg');
  form.append('size', 'auto');
  let response;
  try {
    response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST', headers: { 'X-Api-Key': process.env.REMOVE_BG_API_KEY },
      body: form, signal: AbortSignal.timeout(30000),
    });
  } catch {
    fail(503, 'REMOVAL_FAILED', '배경 제거 연결이 끊겼어요. 다시 시도해 주세요.');
  }
  if (!response.ok) fail(503, 'REMOVAL_FAILED', '배경 제거에 실패했어요. 다시 시도하거나 원본을 사용해 주세요.');
  const buffer = Buffer.from(await response.arrayBuffer());
  const info = imageInfo(buffer);
  if (info?.mime !== 'image/png' || ![4, 6].includes(buffer[25])) fail(503, 'REMOVAL_FAILED', '투명 이미지를 만들지 못했어요.');
  const path = `${viewerId}/${id}/cutout/${randomUUID()}.png`;
  const saved = await db().storage.from('showcase-private').upload(path, buffer, { contentType: 'image/png' });
  if (saved.error) fail(503, 'UPLOAD_FAILED', '처리된 사진을 저장하지 못했어요.');
  return { path, imageUrl: asset(id, path) };
}

export async function removeProductBackground(id, productId, viewerId) {
  const row = await allowed(id, viewerId, true);
  if (row.type !== 'SHOP' || !uuid(productId)) fail(400, 'INVALID_PRODUCT', '매장 상품을 선택해 주세요.');
  const product = check(await db().from('store_products')
    .select('id,store_id,product:products(thumbnail_url)').eq('id', productId).maybeSingle());
  if (!product || product.store_id !== row.store_id) fail(403, 'PRODUCT_FORBIDDEN', '내 매장 상품만 추가할 수 있어요.');
  if (!product.product?.thumbnail_url) fail(400, 'IMAGE_NOT_FOUND', '이 상품에는 이미지가 없어요.');
  if (!process.env.REMOVE_BG_API_KEY)
    fail(503, 'REMOVAL_UNAVAILABLE', '배경 제거 설정이 없어요. 원본 상품 사진을 사용할 수 있어요.');
  const form = new FormData();
  form.append('image_url', product.product.thumbnail_url);
  form.append('size', 'auto');
  let response;
  try {
    response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST', headers: { 'X-Api-Key': process.env.REMOVE_BG_API_KEY },
      body: form, signal: AbortSignal.timeout(30000),
    });
  } catch { fail(503, 'REMOVAL_FAILED', '배경 제거 연결이 끊겼어요. 다시 시도해 주세요.'); }
  if (!response.ok) fail(503, 'REMOVAL_FAILED', '배경 제거에 실패했어요. 원본 사진을 사용할 수 있어요.');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (imageInfo(buffer)?.mime !== 'image/png' || ![4, 6].includes(buffer[25])) fail(503, 'REMOVAL_FAILED', '투명 이미지를 만들지 못했어요.');
  const path = `${viewerId}/${id}/cutout/${randomUUID()}.png`;
  const result = await db().storage.from('showcase-private').upload(path, buffer, { contentType: 'image/png' });
  if (result.error) fail(503, 'UPLOAD_FAILED', '처리된 이미지를 저장하지 못했어요.');
  return { path, imageUrl: asset(id, path) };
}

export async function media(id, path, viewerId) {
  const row = await allowed(id, viewerId);
  if (!path.startsWith(`${row.owner_id}/${id}/`)) fail(404, 'IMAGE_NOT_FOUND', '이미지를 찾을 수 없어요.');
  const originals = check(await db().from('showcase_items').select('id')
    .eq('showcase_id', id).eq('original_path', path).limit(1));
  const cutouts = originals.length ? [] : check(await db().from('showcase_items').select('id')
    .eq('showcase_id', id).eq('cutout_path', path).limit(1));
  if (!originals.length && !cutouts.length && row.thumbnail_path !== path && row.owner_id !== viewerId)
    fail(404, 'IMAGE_NOT_FOUND', '이미지를 찾을 수 없어요.');
  const result = await db().storage.from('showcase-private').download(path);
  if (result.error) fail(404, 'IMAGE_NOT_FOUND', '이미지를 찾을 수 없어요.');
  return { buffer: Buffer.from(await result.data.arrayBuffer()), mime: result.data.type || 'application/octet-stream' };
}

export async function backgrounds() {
  return check(await db().from('showcase_backgrounds').select('*').eq('enabled', true).order('id'));
}

export async function categories() {
  return check(await db().from('categories').select('id,name').eq('type', 'CONTENT').eq('is_active', true).order('sort_order'));
}
