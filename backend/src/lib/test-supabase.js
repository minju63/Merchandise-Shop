import 'dotenv/config';
import { supabase } from './supabase.js';

console.log('Stores 테이블 조회 시작');

async function testStores() {
  try {
    const { data, error } = await supabase.from('stores').select('*').limit(3);

    if (error) {
      console.error('매장 조회 실패:', error);
      process.exitCode = 1;
      return;
    }

    console.log('매장 조회 성공');
    console.log('매장 데이터:', data);
    console.log('컬럼명:', Object.keys(data?.[0] ?? {}));
    if (!data?.length) console.log('매장 데이터가 없어 컬럼을 확인할 수 없습니다.');

  } catch (error) {
    console.error('매장 조회 중 오류:', error);
    process.exitCode = 1;
  }
}

await testStores();
