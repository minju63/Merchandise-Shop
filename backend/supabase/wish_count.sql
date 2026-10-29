-- products.wish_count 를 동시 요청에서도 안전하게 증감한다.
-- wishlistProduct.repository.js 의 changeWishCount() 가 supabase.rpc() 로 호출한다.
create or replace function increment_wish_count(p_product_id uuid, p_delta int)
returns void language sql as $$
  update products
     set wish_count = greatest(0, coalesce(wish_count, 0) + p_delta),
         updated_at = now()
   where id = p_product_id;
$$;
