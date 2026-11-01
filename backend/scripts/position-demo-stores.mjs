import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { supabase } from '../src/lib/supabase.js';
import { getMapStores } from '../src/services/storeMap.service.js';

// Only these six existing demo stores are eligible for relocation.
const positions = [
  ['10000000-0000-4000-8000-000000000001', 35.0860, 129.0020],
  ['10000000-0000-4000-8000-000000000002', 35.0830, 129.0060],
  ['10000000-0000-4000-8000-000000000003', 35.0795, 129.0010],
  ['d101e327-d58c-4850-938f-386d775c07fb', 35.0865, 129.0100],
  ['10000000-0000-4000-8000-000000000004', 35.0800, 129.0090],
  ['6d903525-8dee-4ea4-af78-2963c0434014', 35.0885, 128.9975],
];
function checked({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}
const stores = checked(await supabase.from('stores')
  .select('id,name,address,latitude,longitude,region_id').in('id', positions.map(([id]) => id)));
if (stores.length !== positions.length || stores.some((s) => !s.address?.includes('(테스트용)'))) {
  throw new Error('Expected exactly six explicitly labeled test stores; no updates made.');
}
const regions = checked(await supabase.from('regions').select('id,name'));
const busan = regions.find((r) => r.name.includes('부산'));
const planned = positions.map(([id, latitude, longitude]) => ({
  id, latitude, longitude, address: '부산 사하구 감천 인근 (테스트용)',
  region_id: busan?.id ?? stores.find((s) => s.id === id).region_id,
}));
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify(planned, null, 2));
} else {
  const backupDir = new URL('./data/', import.meta.url);
  const backup = new URL('demo-store-locations.original.json', backupDir);
  await mkdir(backupDir, { recursive: true });
  try {
    await writeFile(backup, `${JSON.stringify(stores, null, 2)}\n`, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const previous = JSON.parse(await readFile(backup, 'utf8'));
    if (!stores.every((s) => previous.some((p) => p.id === s.id))) throw new Error('Backup does not match demo stores.');
  }
  for (const plannedStore of planned) {
    const original = stores.find((s) => s.id === plannedStore.id);
    const updated = checked(await supabase.from('stores').update({
      address: plannedStore.address, latitude: plannedStore.latitude,
      longitude: plannedStore.longitude, region_id: plannedStore.region_id,
    }).eq('id', plannedStore.id).eq('address', original.address).select('id').single());
    if (updated.id !== plannedStore.id) throw new Error('Store update failed.');
  }
  const saved = checked(await supabase.from('stores')
    .select('id,name,address,latitude,longitude,region_id').in('id', positions.map(([id]) => id)));
  for (const p of planned) {
    const actual = saved.find((s) => s.id === p.id);
    if (actual.latitude !== p.latitude || actual.longitude !== p.longitude || actual.region_id !== p.region_id || actual.address !== p.address) {
      throw new Error(`Verification failed for ${p.id}`);
    }
  }
  const map = await getMapStores({ origin: { latitude: 35.083, longitude: 129.004 }, radius: 3, sort: 'distance' });
  if (!positions.every(([id]) => map.items.some((s) => s.id === id))) throw new Error('Some demo stores are missing from the map API.');
  console.log(JSON.stringify({ updated: saved.length, verifiedInMap: map.items.length, stores: saved.map((s) => ({ name: s.name, latitude: s.latitude, longitude: s.longitude })) }, null, 2));
}
