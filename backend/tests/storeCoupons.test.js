import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import express from 'express';
import couponRoutes from '../src/routes/coupon.routes.js';
import checkoutRoutes from '../src/routes/checkout.routes.js';
import { PGlite } from '@electric-sql/pglite';
import { calculateCouponDiscount, evaluateCouponEligibility } from '../src/services/coupon.service.js';
import { groupItemsByStore, validateCouponAssignments } from '../src/services/checkout.service.js';

const uid = '20000000-0000-4000-8000-000000000001';
const other = '20000000-0000-4000-8000-000000000002';
const stores = [1, 2, 3, 4, 5].map((n) => `10000000-0000-4000-8000-00000000000${n}`);
const sale = randomUUID(), sale2 = randomUUID();
const db = new PGlite();
const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
const rpc = (name, params) => scalar(`select public.${name}(${params.map((_, i) => `$${i + 1}`).join(',')})`, params);
const list = (store = stores[0], user = uid) => rpc('list_store_coupons', [user, store]);
const issue = (store = stores[0], coupon = null, user = uid) => rpc('issue_store_coupons', [user, store, coupon]);
let owned;
const makeOrder = (storeId = stores[0], coupon = owned, amount = 20000, saleId = sale) => ({
  storeId, fulfillmentType: 'PICKUP', itemsAmount: amount, deliveryFee: 0,
  discountAmount: coupon ? 1000 : 0, cartCouponDiscountAmount: 0, payAmount: amount - (coupon ? 1000 : 0),
  pointsUsedAmount: 0, pointsEarnAmount: 0, commissionRate: 5, commissionAmount: 950,
  coupon: coupon ? { userCouponId: coupon } : null, pickup: null, address: null,
  items: [{ storeProductId: saleId, productName: '테스트 상품', quantity: amount / 10000, unitPrice: 10000 }],
});
const commit = (orders, requestId = randomUUID(), user = uid, hash = 'same') => rpc('commit_coupon_checkout', [
  user, requestId, hash, randomUUID(), JSON.stringify(orders), null, JSON.stringify({ id: null, label: '시연 결제' }), [], 0,
]);

test('쿠폰·주문 API는 비로그인 요청의 조회·발급·사용을 401로 차단', async () => {
  const app = express();
  app.use(express.json());
  app.use('/coupons', couponRoutes);
  app.use('/checkout', checkoutRoutes);
  const server = app.listen(0);
  try {
    for (const [path, method] of [['/coupons', 'GET'], [`/coupons/stores/${stores[0]}`, 'GET'], [`/coupons/stores/${stores[0]}/issue`, 'POST'], ['/checkout', 'POST'], [`/checkout/requests/${randomUUID()}`, 'GET']]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).code, 'AUTH_REQUIRED');
    }
  } finally { server.close(); }
});

test('매장 쿠폰 SQL: 발급, 주문 원자성, 취소, 접근 제어', async (t) => {
  try {
    await db.exec(await readFile(new URL('./fixtures/coupon-schema.sql', import.meta.url), 'utf8'));
    await db.query('insert into users values ($1,\'ACTIVE\'),($2,\'ACTIVE\')', [uid, other]);
    for (let i = 0; i < stores.length; i++) await db.query('insert into stores values($1,$2)', [stores[i], `store ${i}`]);
    await db.exec(await readFile(new URL('../supabase/migrations/20261102051653_store_coupons.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261102051936_store_coupon_zero_points_fix.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261102052039_store_coupon_order_number_fix.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261102055025_store_coupon_exception_safety.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261102055905_store_coupon_cancellation_clock.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261102094152_grade_discount_checkout.sql', import.meta.url), 'utf8'));
    const seed = await readFile(new URL('../supabase/store_coupons_seed.sql', import.meta.url), 'utf8');
    await db.exec(seed);
    await db.exec(seed);
    await db.query('insert into store_products(id,store_id,product_id,price,stock) values($1,$2,$3,10000,30),($4,$5,$6,10000,30)', [sale, stores[0], randomUUID(), sale2, stores[1], randomUUID()]);
    await db.exec("insert into products(id) select distinct product_id from store_products");

    await t.test('①② 쿠폰 미보유 매장과 보유 매장 구분, 시드 재실행 중복 없음', async () => {
      assert.equal((await list(stores[3])).items.length, 0);
      assert.equal((await list()).items.length, 1);
      assert.equal((await list(stores[1])).items.length, 2);
      assert.equal(await scalar('select count(*) from coupons'), 4);
    });
    await t.test('③④ 개별 발급·모두 받기 영구 저장, 재발급 차단', async () => {
      const coupon = (await list()).items[0];
      assert.equal((await issue(stores[0], coupon.id)).issuedCount, 1);
      assert.equal((await issue()).issuedCount, 0);
      assert.equal((await list()).items[0].owned, true);
      assert.equal((await issue(stores[1])).issuedCount, 2);
      owned = await scalar('select id from user_coupons where user_id=$1 and coupon_id=$2', [uid, coupon.id]);
      assert.equal(await scalar('select issued_count from coupons where id=$1', [coupon.id]), 1);
    });
    await t.test('발급 제한은 반복·경쟁 요청에서도 초과하지 않음', async () => {
      const id = (await list(stores[2])).items[0].id;
      await db.query('update coupons set total_quantity=1 where id=$1', [id]);
      const results = await Promise.all([issue(stores[2], id), issue(stores[2], id, other)]);
      assert.equal(results.reduce((n, v) => n + v.issuedCount, 0), 1);
      assert.equal(await scalar('select count(*) from user_coupons where coupon_id=$1', [id]), 1);
    });
    await t.test('⑦⑧ 타 매장·최소금액·타인 쿠폰 주문은 실패하고 소모되지 않음', async () => {
      await assert.rejects(commit([makeOrder(stores[1], owned, 20000, sale2)]));
      await assert.rejects(commit([makeOrder(stores[0], owned, 0)]));
      await assert.rejects(commit([makeOrder()], randomUUID(), other));
      assert.equal(await scalar('select status from user_coupons where id=$1', [owned]), 'AVAILABLE');
      assert.equal(await scalar('select count(*) from orders'), 0);
    });
    await t.test('⑩ 두 번째 매장 주문 실패 시 첫 매장의 재고·쿠폰·주문·결제 모두 롤백', async () => {
      const bad = makeOrder(stores[1], null, 20000, sale2);
      bad.payAmount = 1;
      await assert.rejects(commit([makeOrder(), bad]));
      assert.equal(await scalar('select status from user_coupons where id=$1', [owned]), 'AVAILABLE');
      assert.equal(await scalar('select stock from store_products where id=$1', [sale]), 30);
      assert.equal(await scalar('select count(*) from orders'), 0);
      assert.equal(await scalar('select count(*) from payments'), 0);
    });
    await t.test('⑥⑨⑪ 여러 상품·여러 매장 주문, 사용 주문 연결·스냅샷·중복 요청 차단', async () => {
      const request = randomUUID();
      const payload = [makeOrder(), makeOrder(stores[1], null, 20000, sale2)];
      const [group, repeated] = await Promise.all([commit(payload, request), commit(payload, request)]);
      assert.equal(group, repeated);
      assert.equal(await scalar('select count(*) from orders'), 2);
      assert.equal(await scalar('select sum(total_amount) from orders'), 39000);
      assert.equal(await scalar('select discount_amount from orders where used_coupon_id=$1', [owned]), 1000);
      assert.equal(await scalar('select status from user_coupons where id=$1', [owned]), 'USED');
      assert.ok(await scalar('select used_order_id from user_coupons where id=$1', [owned]));
      assert.ok(await scalar('select coupon_snapshot from orders where used_coupon_id=$1', [owned]));
      await assert.rejects(commit(payload));
      await assert.rejects(commit(payload, request, uid, 'changed'));
      assert.equal(await scalar('select count(*) from orders'), 2);
    });
    await t.test('⑩ 주문 취소 시 유효 쿠폰·재고 복구, 중복 취소 멱등성', async () => {
      const order = await scalar('select used_order_id from user_coupons where id=$1', [owned]);
      assert.equal(await rpc('cancel_coupon_order', [uid, order, 'test']), true);
      assert.equal(await rpc('cancel_coupon_order', [uid, order, 'test']), false);
      assert.equal(await scalar('select status from user_coupons where id=$1', [owned]), 'AVAILABLE');
      assert.equal(await scalar('select stock from store_products where id=$1', [sale]), 30);
    });
    await t.test('⑩ 만료 후 취소는 EXPIRED로 복구, 이전 주문 금액 유지', async () => {
      await commit([makeOrder()]);
      const order = await scalar('select used_order_id from user_coupons where id=$1', [owned]);
      await db.query("update user_coupons set expires_at=now()-interval '1 second' where id=$1", [owned]);
      await rpc('cancel_coupon_order', [uid, order, 'test']);
      assert.equal(await scalar('select status from user_coupons where id=$1', [owned]), 'EXPIRED');
      assert.equal(await scalar('select total_amount from orders where id=$1', [order]), 19000);
    });
    await t.test('기존 음수 적립금 계정도 적립금 0원 주문 가능', async () => {
      await db.query("insert into point_transactions(user_id,type,status,amount) values($1,'USE','CONFIRMED',-100)", [uid]);
      await commit([makeOrder(stores[0], null)]);
    });
    await t.test('회원 등급 할인은 discountAmount에 포함돼 저장되고, 결제금액이 안 맞으면 거절', async () => {
      const graded = { ...makeOrder(stores[0], null), discountAmount: 600, gradeDiscountAmount: 600, payAmount: 19400 };
      const before = await scalar('select count(*) from orders');
      await assert.rejects(commit([{ ...graded, payAmount: 20000 }]));
      await assert.rejects(commit([{ ...graded, gradeDiscountAmount: 30000, discountAmount: 30000, payAmount: -10000 }]));
      assert.equal(await scalar('select count(*) from orders'), before);
      const group = await commit([graded]);
      assert.equal(await scalar('select discount_amount from orders where checkout_group_id=$1', [group]), 600);
      assert.equal(await scalar('select total_amount from orders where checkout_group_id=$1', [group]), 19400);
    });
    await t.test('선택한 장바구니 수량이 바뀌면 주문 전체 거절', async () => {
      const cartId = randomUUID();
      await db.query("insert into cart_items(id,user_id,store_product_id,fulfillment_type,quantity) values($1,$2,$3,'PICKUP',1)", [cartId, uid, sale]);
      const before = await scalar('select count(*) from orders');
      await assert.rejects(rpc('commit_coupon_checkout', [uid,randomUUID(),'cart',randomUUID(),JSON.stringify([makeOrder(stores[0],null)]),null,'{"label":"test"}',[cartId],0]));
      assert.equal(await scalar('select count(*) from orders'), before);
      assert.equal(await scalar('select count(*) from cart_items'), 1);
    });
    await t.test('⑤⑫ RLS: 본인 쿠폰만 조회, 클라이언트 발급·사용 RPC 및 직접 조작 차단', async () => {
      await db.exec('set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
      assert.equal(await scalar('select count(*) from user_coupons'), 0);
      await assert.rejects(rpc('issue_coupon_atomic', [uid, (await db.query('select id from coupons limit 1')).rows[0].id]), /permission denied/);
      await assert.rejects(db.exec("update user_coupons set status='AVAILABLE'"), /permission denied/);
      await db.exec('reset role');
    });
  } finally { await db.close(); }
});

test('매장 합산·정률 상한·픽업/배달·최소 주문금액 경계', () => {
  const coupon = { discount_type: 'RATE', discount_value: 10, min_order_amount: 30000,
    max_discount: 5000, total_quantity: null, issued_count: 0, applies_to: 'ALL',
    valid_from: '2026-01-01', valid_until: '2027-01-01', is_active: true, store_id: stores[0], code: 'SHOP_RATE' };
  const item = { user_id: uid, status: 'AVAILABLE', expires_at: '2027-01-01', coupon };
  const now = new Date('2026-11-02');
  const quote = { userId: uid, storeId: stores[0], itemsAmount: 30000, deliveryFee: 3000, fulfillmentType: 'DELIVERY' };
  assert.equal(calculateCouponDiscount(coupon, { ...quote, itemsAmount: 100000 }), 5000);
  assert.equal(evaluateCouponEligibility(item, quote, now).discountAmount, 3000);
  assert.equal(evaluateCouponEligibility(item, { ...quote, fulfillmentType: 'PICKUP' }, now).discountAmount, 3000);
  assert.equal(evaluateCouponEligibility(item, { ...quote, itemsAmount: 29999 }, now).reason, 'MIN_ORDER_AMOUNT');
  assert.equal(evaluateCouponEligibility(item, { ...quote, storeId: stores[1] }, now).reason, 'STORE_MISMATCH');
  assert.equal(groupItemsByStore([{ storeId: stores[0], lineAmount: 10000 }, { storeId: stores[0], lineAmount: 20000 }])[0].itemsAmount, 30000);
  assert.throws(() => validateCouponAssignments([{ userCouponId: 'same' }, { userCouponId: 'same' }]));
});
