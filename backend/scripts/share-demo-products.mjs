import { randomInt, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { supabase } from '../src/lib/supabase.js';
import { getMapStores } from '../src/services/storeMap.service.js';

const storeIds = [
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  'd101e327-d58c-4850-938f-386d775c07fb',
  '6d903525-8dee-4ea4-af78-2963c0434014',
];
const soldOutMode = process.argv.includes('--sold-out');
function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}
async function read(table, fields, configure = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const batch = check(await configure(supabase.from(table).select(fields)).order('id').range(from, from + 999));
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}
const [stores, products, existing] = await Promise.all([
  read('stores', 'id,name,address,status,pickup_available,delivery_available', (q) => q.in('id', storeIds)),
  read('products', 'id,name,status', (q) => q.eq('status', 'ON_SALE')),
  read('store_products', 'id,store_id,product_id,price,stock,status', (q) => q.in('store_id', storeIds)),
]);
if (stores.length !== 6 || stores.some((s) => s.status !== 'ACTIVE' || !s.address?.includes('(테스트용)'))) {
  throw new Error('Expected six active, explicitly labeled demo stores; no data changed.');
}
const plan = [];
for (const product of products) {
  const listings = existing.filter((l) => l.product_id === product.id);
  const source = listings.find((l) => l.status === 'ON_SALE' && Number.isFinite(Number(l.price)) && Number(l.price) >= 0);
  if (!source) continue;
  const owners = new Set(listings.map((l) => l.store_id));
  const sellableOwners = new Set(listings.filter((l) => l.status === 'ON_SALE').map((l) => l.store_id));
  const soldOutOwners = new Set(listings.filter((l) => l.status === 'SOLD_OUT' && Number(l.stock) === 0).map((l) => l.store_id));
  // Reruns never reset existing stock; each eligible product gets at least
  // three selling demo stores, sometimes four, where unoccupied stores exist.
  if (soldOutMode ? soldOutOwners.size >= 1 : sellableOwners.size >= 3) continue;
  const candidates = stores.filter((s) => !owners.has(s.id));
  const needed = Math.min(candidates.length, soldOutMode ? randomInt(1, 3) : randomInt(3, 5) - sellableOwners.size);
  for (let i = 0; i < needed; i++) {
    const [store] = candidates.splice(randomInt(candidates.length), 1);
    plan.push({ id: randomUUID(), product_id: product.id, store_id: store.id,
      price: Number(source.price), stock: soldOutMode ? 0 : randomInt(3, 31), status: soldOutMode ? 'SOLD_OUT' : 'ON_SALE',
      pickup_available: store.pickup_available === true,
      delivery_available: store.delivery_available === true });
  }
}
console.log(JSON.stringify({ eligibleProducts: products.length, productsToShare: new Set(plan.map((p) => p.product_id)).size,
  newListings: plan.length, perStore: stores.map((s) => ({ name: s.name, additions: plan.filter((p) => p.store_id === s.id).length })) }, null, 2));
if (process.argv.includes('--apply') && plan.length) {
  const directory = new URL('./data/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const audit = new URL(`${soldOutMode ? 'sold-out' : 'shared'}-demo-products-${Date.now()}.json`, directory);
  await writeFile(audit, `${JSON.stringify(plan, null, 2)}\n`, { flag: 'wx' });
  // A single INSERT statement keeps this seed atomic. Database defaults fill
  // listing metadata; no product, original listing, or purchase history is copied.
  const inserted = check(await supabase.from('store_products').insert(plan)
    .select('id,store_id,product_id,stock,status'));
  if (inserted.length !== plan.length) throw new Error('Inserted count differs from plan.');
  const after = await read('store_products', 'id,store_id,product_id,price,stock,status', (q) => q.in('store_id', storeIds));
  for (const original of existing) {
    const saved = after.find((l) => l.id === original.id);
    if (!saved || ['store_id', 'product_id', 'price', 'stock', 'status'].some((key) => saved[key] !== original[key])) {
      throw new Error(`Existing listing changed during verification: ${original.id}`);
    }
  }
  const sharedIds = [...new Set(plan.map((p) => p.product_id))];
  for (const id of sharedIds) {
    const owners = new Set(after.filter((l) => l.product_id === id && (soldOutMode
      ? l.status === 'SOLD_OUT' && Number(l.stock) === 0 : l.status === 'ON_SALE')).map((l) => l.store_id));
    if (owners.size < (soldOutMode ? 1 : 3)) throw new Error(`Expected listing status missing for product: ${id}`);
  }
  const sample = await getMapStores({ productId: sharedIds[0], origin: { latitude: 35.083, longitude: 129.004 }, radius: 20, sort: 'stock' });
  if (soldOutMode) {
    if (!sample.items.some((s) => s.status === 'SOLD_OUT' && s.stock === 0 && !s.inStock)) throw new Error('Sold-out marker missing.');
    const inStockOnly = await getMapStores({ productId: sharedIds[0], inStock: true });
    if (inStockOnly.items.some((s) => !s.inStock || s.stock <= 0)) throw new Error('In-stock filter included sold-out stores.');
  } else if (sample.items.length < 3) throw new Error('Map API did not return shared sellers.');
  console.log(JSON.stringify({ inserted: inserted.length, sharedProducts: sharedIds.length,
    existingListingsPreserved: existing.length, sample: {
      product: products.find((p) => p.id === sharedIds[0]).name,
      stores: sample.items.map((s) => ({ name: s.name, stock: s.stock, status: s.status })),
    } }, null, 2));
}
