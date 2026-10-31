-- 21 supplied anime products; approved classification/store corrections applied.
-- Images uploaded and checked byte-for-byte by backend/scripts/import-anime-products.mjs.
-- Existing names are skipped so reruns never reset live stock or create duplicates.
DO $import$
DECLARE
  r record;
  product_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('anime-products-import'));
  FOR r IN SELECT * FROM (VALUES
    ('하시비라 이노스케 키링', '10000000-0000-4000-8000-000000000002', 5000, 15, '귀멸의 칼날', '3d860334-138f-4661-8dbf-db81f7bcdd17', true, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/Inoshuke-keyring-3e0800f0b7a9.png'),
    ('아가츠마 젠이츠 티셔츠', '10000000-0000-4000-8000-000000000003', 15000, 15, '귀멸의 칼날', '79276595-6dd2-4734-888d-a43c31c9073d', true, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/JenItsu-Tshirt-50846438a179.png'),
    ('렌고쿠 쿄쥬로 캔뱃지', '10000000-0000-4000-8000-000000000002', 5000, 13, '귀멸의 칼날', 'f664e15e-b3fc-4064-b6d3-38fc38075f02', false, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/kyojuro-pinbutten-e1dcaf929b19.png'),
    ('마히토 키링', '10000000-0000-4000-8000-000000000002', 5000, 8, '주술회전', '3d860334-138f-4661-8dbf-db81f7bcdd17', false, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/mahito-keyring-96e29276edab.png'),
    ('젠인 마키 캔뱃지', '10000000-0000-4000-8000-000000000004', 5000, 15, '주술회전', 'f664e15e-b3fc-4064-b6d3-38fc38075f02', false, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/maki-pinbutten-fa3e3dd8e0d1.png'),
    ('메이메이 포토카드', '10000000-0000-4000-8000-000000000004', 5000, 15, '주술회전', 'dbdee87f-5f06-4afd-b8d3-6fb33f34762d', false, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/meimei-photocard-8e2b61ebb84d.png'),
    ('칸로지 미츠리 캔뱃지', '10000000-0000-4000-8000-000000000004', 5000, 15, '귀멸의 칼날', 'f664e15e-b3fc-4064-b6d3-38fc38075f02', true, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/mitsuri-pinbutten-107d605a42d0.png'),
    ('카마도 네즈코 키링', '10000000-0000-4000-8000-000000000004', 5000, 30, '귀멸의 칼날', '3d860334-138f-4661-8dbf-db81f7bcdd17', true, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/nezuko-keyring-8fef572b1aa9.png'),
    ('카마도 네즈코 포토카드', '10000000-0000-4000-8000-000000000004', 5000, 30, '귀멸의 칼날', 'dbdee87f-5f06-4afd-b8d3-6fb33f34762d', true, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/nezuko-photocard-58474909a574.png'),
    ('카마도 네즈코 미니 인형', '10000000-0000-4000-8000-000000000004', 5000, 30, '귀멸의 칼날', '4df3cc13-3756-4e03-9f4c-9000908ee1f7', true, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/nezuko-plush-e63305d6b0fc.png'),
    ('카마도 네즈코 티셔츠', '10000000-0000-4000-8000-000000000004', 5000, 30, '귀멸의 칼날', '79276595-6dd2-4734-888d-a43c31c9073d', true, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/nezuko-Tshirt-ab592d3073ca.png'),
    ('판다 파우치', '10000000-0000-4000-8000-000000000004', 5000, 30, '주술회전', '774826e7-40d8-4a8a-afbe-e17c7ab6d366', true, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/panda-pouch-3c44e621a8ce.png'),
    ('코쵸우 시노부 피규어', '10000000-0000-4000-8000-000000000004', 35000, 30, '귀멸의 칼날', '7101d0f7-5a98-4cb4-9bf3-9993c3644fc2', true, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/shinobu-pigure-bc925b9fdb24.png'),
    ('코쵸우 시노부 볼펜', '10000000-0000-4000-8000-000000000004', 5000, 30, '귀멸의 칼날', 'c6ba9ca6-fe60-46d9-b49a-e15d97534e38', true, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/shinobuu-pen-155ae776bc9a.png'),
    ('쇼코 머그컵', '10000000-0000-4000-8000-000000000004', 5000, 30, '주술회전', '774826e7-40d8-4a8a-afbe-e17c7ab6d366', true, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/shoko-cup-635500729555.png'),
    ('카마도 탄지로 아크릴 스탠드', '10000000-0000-4000-8000-000000000004', 5000, 30, '귀멸의 칼날', 'a78ea349-818b-4018-b856-1e2aa30ffc31', true, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/tanjiro-acrylstand-4dc65250093b.png'),
    ('카마도 탄지로 미니 인형', '10000000-0000-4000-8000-000000000004', 25000, 30, '귀멸의 칼날', '4df3cc13-3756-4e03-9f4c-9000908ee1f7', true, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/tanjiro-plush-ac92d0737f88.png'),
    ('우즈이 텐겐 텀블러', '10000000-0000-4000-8000-000000000004', 15000, 30, '귀멸의 칼날', '774826e7-40d8-4a8a-afbe-e17c7ab6d366', true, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/tengen-etc-59bf2177a1bf.png'),
    ('우즈이 텐겐 피규어', '10000000-0000-4000-8000-000000000004', 45000, 30, '귀멸의 칼날', '7101d0f7-5a98-4cb4-9bf3-9993c3644fc2', true, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/tengen-pigure-0629d8855292.png'),
    ('옷코츠 유타 아크릴 스탠드', '10000000-0000-4000-8000-000000000004', 45000, 30, '주술회전', 'a78ea349-818b-4018-b856-1e2aa30ffc31', true, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/Uta-acrylstand-3e7d1cfe7f09.png'),
    ('옷코츠 유타 샤프', '10000000-0000-4000-8000-000000000004', 3500, 30, '주술회전', 'c6ba9ca6-fe60-46d9-b49a-e15d97534e38', true, 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products/Uta-pen-ab70b683f5c2.png')
  ) AS source(name, store_id, price, stock, work_title, goods_id, delivery, image_url)
  LOOP
    IF EXISTS (SELECT 1 FROM public.products p WHERE p.name = r.name) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.products(name, work_title, base_price, thumbnail_url, status)
      VALUES(r.name, r.work_title, r.price, r.image_url, 'ON_SALE') RETURNING id INTO product_id;
    INSERT INTO public.product_images(product_id, image_url, display_order, is_thumbnail)
      VALUES(product_id, r.image_url, 0, true);
    INSERT INTO public.product_categories(product_id, category_id)
      VALUES(product_id, '64f4e5c0-f1db-4d32-a9e5-946f26254f95'::uuid), (product_id, r.goods_id::uuid);
    INSERT INTO public.store_products(store_id, product_id, price, stock, status, pickup_available, delivery_available)
      VALUES(r.store_id::uuid, product_id, r.price, r.stock, 'ON_SALE', true, r.delivery);
  END LOOP;
END
$import$;
