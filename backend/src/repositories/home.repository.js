// 담당: 민주
// 테이블: products · store_products · stores · store_business_hours · product_categories · categories · banners
import { getSupabase } from '../lib/supabase.js';

const PRODUCT_LIMIT = 200;

const PRODUCT_FIELDS = `
  id, name, brand, thumbnail_url, base_price, status, released_at, open_at,
  popularity_score, alert_count, created_at,
  store_products (
    id, store_id, price, discount_rate, stock, status, restock_expected_at,
    pickup_available, delivery_available, stores ( name, status )
  ),
  product_categories ( categories ( id, code, name, type ) )
`;

function throwOnError(error) {
  if (error) throw error;
}

export async function findHomeProducts() {
  const { data, error } = await getSupabase()
    .from('products')
    .select(PRODUCT_FIELDS)
    .in('status', ['ON_SALE', 'UPCOMING'])
    .limit(PRODUCT_LIMIT);

  throwOnError(error);
  return data;
}

export async function findHomeBanners(now) {
  const { data, error } = await getSupabase()
    .from('banners')
    .select('id, title, image_url, banner_type, character_name, event_date, message, fan_nickname, starts_at, ends_at, click_count, stores:sponsor_store_id ( name )')
    .eq('slot', 'HOME_TOP')
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order('sort_order', { ascending: true });

  throwOnError(error);
  return data;
}

export async function findBanner(bannerId) {
  const { data, error } = await getSupabase()
    .from('banners')
    .select(`
      id, title, image_url, banner_type, starts_at, ends_at, click_count, is_active,
      stores:sponsor_store_id (
        id, name, short_description, thumbnail_url, address, status, pickup_available, delivery_available
      )
    `)
    .eq('id', bannerId)
    .maybeSingle();

  throwOnError(error);
  return data;
}

export async function findIntroStores() {
  const { data, error } = await getSupabase()
    .from('stores')
    .select('id, name, address, thumbnail_url, pickup_available, delivery_available, store_business_hours ( day_of_week, open_time, close_time, is_closed )')
    .eq('status', 'ACTIVE')
    .eq('temporary_closed', false)
    .order('name', { ascending: true })
    .limit(20);

  throwOnError(error);
  return data;
}

export async function findProductsByCharacters(characterNames) {
  const { data, error } = await getSupabase()
    .from('products')
    .select(PRODUCT_FIELDS)
    .in('character_name', characterNames)
    .in('status', ['ON_SALE', 'UPCOMING'])
    .limit(PRODUCT_LIMIT);

  throwOnError(error);
  return data;
}

export async function findActiveCategories() {
  const { data, error } = await getSupabase()
    .from('categories')
    .select('id, type, code, name, sort_order, is_home_shortcut')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  throwOnError(error);
  return data;
}
