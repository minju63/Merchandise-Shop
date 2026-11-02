import { access, readFile } from 'node:fs/promises';
import { supabase } from '../src/lib/supabase.js';

const plans = [
  {
    id: '10000000-0000-4000-8000-000000000004',
    name: '서면굿즈샵',
    images: [
      ['Seomyeon_goodsshop.png', 'stores/seomyeon-goodsshop-1.png'],
      ['seomyenon_goodsshop2.png', 'stores/seomyeon-goodsshop-2.png'],
    ],
  },
  {
    id: '6d903525-8dee-4ea4-af78-2963c0434014',
    name: '집에서면',
    images: [['home_seomyeon.png', 'stores/home-seomyeon-1.png']],
  },
  {
    id: 'd101e327-d58c-4850-938f-386d775c07fb',
    name: '별빛응원샵',
    images: [
      ['star_cheerup.png', 'stores/starlight-cheer-shop-1.png'],
      ['star_cheerup2.png', 'stores/starlight-cheer-shop-2.png'],
    ],
  },
];

function checked({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

for (const plan of plans) {
  for (const [file] of plan.images) {
    await access(new URL(`../assets/${file}`, import.meta.url));
  }
}

const stores = checked(
  await supabase
    .from('stores')
    .select('id,name,thumbnail_url')
    .in('id', plans.map((plan) => plan.id)),
);
if (
  stores.length !== plans.length ||
  plans.some((plan) => stores.find((store) => store.id === plan.id)?.name !== plan.name)
) {
  throw new Error('대상 매장 ID와 이름이 현재 DB와 일치하지 않아 변경하지 않았습니다.');
}

if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify(plans, null, 2));
  process.exit(0);
}

for (const plan of plans) {
  const imageUrls = [];
  for (const [file, storagePath] of plan.images) {
    const bytes = await readFile(new URL(`../assets/${file}`, import.meta.url));
    checked(
      await supabase.storage.from('goods-images').upload(storagePath, bytes, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: true,
      }),
    );
    imageUrls.push(supabase.storage.from('goods-images').getPublicUrl(storagePath).data.publicUrl);
  }

  checked(
    await supabase
      .from('stores')
      .update({ thumbnail_url: imageUrls[0] })
      .eq('id', plan.id)
      .eq('name', plan.name)
      .select('id')
      .single(),
  );
  checked(await supabase.from('store_images').delete().eq('store_id', plan.id));
  checked(
    await supabase.from('store_images').insert(
      imageUrls.map((image_url, display_order) => ({
        store_id: plan.id,
        image_url,
        display_order,
        is_thumbnail: display_order === 0,
      })),
    ),
  );
}

const savedStores = checked(
  await supabase
    .from('stores')
    .select('id,name,thumbnail_url')
    .in('id', plans.map((plan) => plan.id)),
);
const savedImages = checked(
  await supabase
    .from('store_images')
    .select('store_id,image_url,display_order,is_thumbnail')
    .in('store_id', plans.map((plan) => plan.id))
    .order('display_order'),
);
for (const plan of plans) {
  const store = savedStores.find((row) => row.id === plan.id);
  const images = savedImages.filter((row) => row.store_id === plan.id);
  if (!store?.thumbnail_url || images.length !== plan.images.length) {
    throw new Error(`${plan.name} 이미지 저장 검증에 실패했습니다.`);
  }
}
console.log(
  JSON.stringify(
    plans.map((plan) => ({
      name: plan.name,
      imageCount: savedImages.filter((row) => row.store_id === plan.id).length,
    })),
    null,
    2,
  ),
);
