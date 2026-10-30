// Upload the supplied assets and prepare an atomic, repeatable SQL import.
// Run from backend: node scripts/import-anime-products.mjs
// Then execute docs/anime-products-import.sql on the configured project.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getSupabase } from '../src/lib/supabase.js';

const rows = [
  ['하시비라 이노스케 키링', '굿즈플래닛', 5000, 15, '귀멸의 칼날', '키링', true, 'Inoshuke-keyring.png'],
  ['아가츠마 젠이츠 티셔츠', '덕질상점', 15000, 15, '귀멸의 칼날', '의류', true, 'JenItsu-Tshirt.png'],
  ['렌고쿠 쿄쥬로 캔뱃지', '굿즈플래닛', 5000, 13, '귀멸의 칼날', '캔뱃지', false, 'kyojuro-pinbutten.png'],
  ['마히토 키링', '굿즈플래닛', 5000, 8, '주술회전', '키링', false, 'mahito-keyring.png'],
  ['젠인 마키 캔뱃지', '서면굿즈샵', 5000, 15, '주술회전', '캔뱃지', false, 'maki-pinbutten.png'],
  ['메이메이 포토카드', '서면굿즈샵', 5000, 15, '주술회전', '포토카드', false, 'meimei-photocard.png'],
  ['칸로지 미츠리 캔뱃지', '서면굿즈샵', 5000, 15, '귀멸의 칼날', '캔뱃지', true, 'mitsuri-pinbutten.png'],
  ['카마도 네즈코 키링', '서면굿즈샵', 5000, 30, '귀멸의 칼날', '키링', true, 'nezuko-keyring.png'],
  ['카마도 네즈코 포토카드', '서면굿즈샵', 5000, 30, '귀멸의 칼날', '포토카드', true, 'nezuko-photocard.png'],
  ['카마도 네즈코 미니 인형', '서면굿즈샵', 5000, 30, '귀멸의 칼날', '인형', true, 'nezuko-plush.png'],
  ['카마도 네즈코 티셔츠', '서면굿즈샵', 5000, 30, '귀멸의 칼날', '의류', true, 'nezuko-Tshirt.png'],
  ['판다 파우치', '서면굿즈샵', 5000, 30, '주술회전', '기타 굿즈', true, 'panda-pouch.png'],
  ['코쵸우 시노부 피규어', '서면굿즈샵', 35000, 30, '귀멸의 칼날', '피규어', true, 'shinobu-pigure.png'],
  ['코쵸우 시노부 볼펜', '서면굿즈샵', 5000, 30, '귀멸의 칼날', '문구', true, 'shinobuu-pen.png'],
  ['쇼코 머그컵', '서면굿즈샵', 5000, 30, '주술회전', '기타 굿즈', true, 'shoko-cup.png'],
  ['카마도 탄지로 아크릴 스탠드', '서면굿즈샵', 5000, 30, '귀멸의 칼날', '아크릴 스탠드', true, 'tanjiro-acrylstand.png'],
  ['카마도 탄지로 미니 인형', '서면굿즈샵', 25000, 30, '귀멸의 칼날', '인형', true, 'tanjiro-plush.png'],
  ['우즈이 텐겐 텀블러', '서면굿즈샵', 15000, 30, '귀멸의 칼날', '기타 굿즈', true, 'tengen-etc.png'],
  ['우즈이 텐겐 피규어', '서면굿즈샵', 45000, 30, '귀멸의 칼날', '피규어', true, 'tengen-pigure.png'],
  ['옷코츠 유타 아크릴 스탠드', '서면굿즈샵', 45000, 30, '주술회전', '아크릴 스탠드', true, 'Uta-acrylstand.png'],
  ['옷코츠 유타 샤프', '서면굿즈샵', 3500, 30, '주술회전', '문구', true, 'Uta-pen.png'],
];

const client = getSupabase();
const check = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};
const [stores, categories, bucket] = await Promise.all([
  client.from('stores').select('id,name').then(check),
  client.from('categories').select('id,name,type').then(check),
  client.storage.getBucket('goods-images').then(check),
]);
if (!bucket.public) throw new Error('goods-images must be public for product thumbnails.');
const uniqueId = (items, predicate, label) => {
  const matches = items.filter(predicate);
  if (matches.length !== 1) throw new Error(`Expected one match: ${label}`);
  return matches[0].id;
};
const contentId = uniqueId(categories, (c) => c.type === 'CONTENT' && c.name === '애니메이션', '애니메이션');
// Validate all mappings and files before uploading anything.
const products = await Promise.all(rows.map(async ([name, store, price, stock, work, goods, delivery, file]) => ({
  name, price, stock, work, delivery, file,
  storeId: uniqueId(stores, (s) => s.name === store, store),
  goodsId: uniqueId(categories, (c) => c.type === 'GOODS' && c.name === goods, goods),
  bytes: await readFile(new URL(`../assets/${file}`, import.meta.url)),
})));

for (const product of products) {
  const digest = createHash('sha256').update(product.bytes).digest('hex').slice(0, 12);
  const path = `products/${product.file.slice(0, -4)}-${digest}.png`;
  const { error } = await client.storage.from('goods-images').upload(path, product.bytes, {
    contentType: 'image/png', upsert: false,
  });
  if (error && String(error.statusCode) !== '409') throw new Error(`${product.file}: ${error.message}`);
  product.url = client.storage.from('goods-images').getPublicUrl(path).data.publicUrl;
  const response = await fetch(product.url);
  if (!response.ok) throw new Error(`Image unavailable: ${product.file} (${response.status})`);
  const actual = Buffer.from(await response.arrayBuffer());
  if (!actual.equals(product.bytes)) throw new Error(`Image differs: ${product.file}`);
  console.log(`Verified image: ${product.file}`);
}

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const values = products.map((p) => `    (${[p.name, p.storeId, p.price, p.stock, p.work, p.goodsId, p.delivery, p.url].map((v) => typeof v === 'string' ? quote(v) : String(v)).join(', ')})`).join(',\n');
const sql = `-- 21 supplied anime products; approved classification/store corrections applied.
-- Images uploaded and checked byte-for-byte by backend/scripts/import-anime-products.mjs.
-- Existing names are skipped so reruns never reset live stock or create duplicates.
DO $import$
DECLARE
  r record;
  product_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('anime-products-import'));
  FOR r IN SELECT * FROM (VALUES
${values}
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
      VALUES(product_id, '${contentId}'::uuid), (product_id, r.goods_id::uuid);
    INSERT INTO public.store_products(store_id, product_id, price, stock, status, pickup_available, delivery_available)
      VALUES(r.store_id::uuid, product_id, r.price, r.stock, 'ON_SALE', true, r.delivery);
  END LOOP;
END
$import$;
`;
await writeFile(new URL('../../docs/anime-products-import.sql', import.meta.url), sql);
console.log('Prepared docs/anime-products-import.sql (21 products). Execute it to register products.');
