// 담당: 민주
// 테이블: banners · events · event_products
import { supabase } from '../lib/supabase.js';

export async function incrementBannerClick(bannerId) {
  const { data, error } = await supabase
    .from('banners')
    .select('click_count')
    .eq('id', bannerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;

  const { error: updateError } = await supabase
    .from('banners')
    .update({ click_count: data.click_count + 1 })
    .eq('id', bannerId);
  if (updateError) throw updateError;
  return true;
}
