import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { quotePartialCouponCancellation } from '../src/services/couponCancellationQuote.js';
import { calculateStoreQuote, checkoutQuoteToken } from '../src/services/checkout.service.js';
import { toCartItem } from '../src/services/cart.service.js';

test('쿠폰 발급/주문 시점 변경 SQL 회귀', async (t) => {
  const db = new PGlite();
  const uid = randomUUID(), other = randomUUID(), shop = randomUUID(), product = randomUUID(), sale = randomUUID();
  const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
  const rpc = (name, values) => scalar(`select public.${name}(${values.map((_, index) => `$${index + 1}`).join(',')})`, values);
  const coupon = async (overrides = {}) => {
    const id = randomUUID();
    await db.query("insert into coupons(id,store_id,name,discount_type,discount_value,min_order_amount,valid_from,valid_until) values($1,$2,'test','FIXED',1000,10000,clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 day')", [id, shop]);
    for (const [key, value] of Object.entries(overrides)) {
      assert.ok(['is_active', 'total_quantity'].includes(key));
      await db.query(`update coupons set ${key}=$1 where id=$2`, [value, id]);
    }
    return id;
  };
  const issue = (ids, user = uid) => rpc('issue_store_coupons_checked', [user, shop, ids]);
  const payload = (uc) => [{ storeId: shop, fulfillmentType: 'PICKUP', itemsAmount: 20000, deliveryFee: 0,
    discountAmount: 1000, cartCouponDiscountAmount: 0, payAmount: 19000, pointsUsedAmount: 0, pointsEarnAmount: 0,
    commissionRate: 0, commissionAmount: 0, coupon: { userCouponId: uc },
    items: [{ storeProductId: sale, productName: 'fixture', quantity: 2, unitPrice: 10000 }] }];
  const commit = (uc) => rpc('commit_coupon_checkout', [uid, randomUUID(), 'hash', randomUUID(), JSON.stringify(payload(uc)), null, '{"label":"test"}', [], 0]);
  try {
    await db.exec(await readFile(new URL('./fixtures/coupon-schema.sql', import.meta.url), 'utf8'));
    for (const name of ['20261102051653_store_coupons.sql', '20261102051936_store_coupon_zero_points_fix.sql', '20261102052039_store_coupon_order_number_fix.sql', '20261102055025_store_coupon_exception_safety.sql', '20261102055905_store_coupon_cancellation_clock.sql'])
      await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
    await db.query("insert into users values($1,'ACTIVE'),($2,'ACTIVE')", [uid, other]);
    await db.query("insert into stores values($1,'fixture')", [shop]);
    await db.query("insert into products(id) values($1)", [product]);
    await db.query('insert into store_products(id,store_id,product_id,price,stock) values($1,$2,$3,10000,20)', [sale, shop, product]);
    await t.test('발급 버튼 클릭 전에 만료: now()가 아닌 잠금 후 현재 시각 검증', async () => {
      const id = await coupon();
      await db.query("update coupons set valid_until=clock_timestamp()+interval '200 milliseconds' where id=$1", [id]);
      await db.exec("begin; select pg_sleep(0.25)");
      assert.equal(await scalar('select valid_until>now() from coupons where id=$1', [id]), true);
      const result = await issue([id]);
      assert.equal(result.results[0].status, 'COUPON_ISSUE_EXPIRED');
      assert.equal(await scalar('select count(*) from user_coupons where coupon_id=$1', [id]), 0);
      await db.exec('rollback');
    });
    await t.test('모두 받기에서 정상·만료·소진·비활성 결과 분리', async () => {
      const good = await coupon(), expired = await coupon(), sold = await coupon({ total_quantity: 1 }), inactive = await coupon({ is_active: false });
      await db.query("update coupons set valid_until=clock_timestamp()-interval '1 second' where id=$1", [expired]);
      await issue([sold], other);
      const result = await issue([good, expired, sold, inactive]);
      assert.equal(result.issuedCount, 1); assert.equal(result.failedCount, 3);
      assert.deepEqual(new Set(result.results.map((row) => row.status)), new Set(['ISSUED', 'COUPON_ISSUE_EXPIRED', 'COUPON_SOLD_OUT', 'COUPON_NOT_ISSUABLE']));
      assert.equal((await issue([good])).results[0].status, 'ALREADY_OWNED');
      assert.equal(await scalar('select issued_count from coupons where id=$1', [sold]), 1);
    });
    await t.test('주문 확정 직전 만료·이미 사용 쿠폰 거절 및 주문/재고 롤백', async () => {
      const id = await coupon(); const issued = await issue([id]); const uc = issued.results[0].userCouponId;
      await db.query("update user_coupons set expires_at=clock_timestamp()+interval '200 milliseconds' where id=$1", [uc]);
      await db.exec('begin; select pg_sleep(0.25)');
      await assert.rejects(commit(uc), (error) => JSON.parse(error.detail).code === 'COUPON_EXPIRED');
      await db.exec('rollback');
      assert.equal(await scalar('select status from user_coupons where id=$1', [uc]), 'AVAILABLE');
      assert.equal(await scalar('select count(*) from orders'), 0);
      await db.query("update user_coupons set expires_at=clock_timestamp()+interval '1 day',status='USED' where id=$1", [uc]);
      await assert.rejects(commit(uc), (error) => JSON.parse(error.detail).code === 'COUPON_USED');
      assert.equal(await scalar('select stock from store_products where id=$1', [sale]), 20);
    });
    await t.test('상품 품절·판매 중단·삭제·가격/수량 변경 후 기존 견적 거절', async () => {
      const id = await coupon(); const uc = (await issue([id])).results[0].userCouponId;
      for (const sql of ["update store_products set stock=0", "update store_products set status='SOLD_OUT'", "update products set status='STOPPED'", 'update store_products set price=9999', 'delete from products']) {
        await db.exec('begin'); await db.exec(sql);
        await assert.rejects(commit(uc)); await db.exec('rollback');
        assert.equal(await scalar('select status from user_coupons where id=$1', [uc]), 'AVAILABLE');
      }
      assert.equal(await scalar('select count(*) from orders'), 0);
    });
    await t.test('타 매장 쿠폰 발급 요청은 존재 여부를 노출하지 않고 거절', async () => {
      const foreign = await coupon(); await db.query('update coupons set store_id=$1 where id=$2', [randomUUID(), foreign]);
      assert.equal((await issue([foreign])).results[0].status, 'COUPON_NOT_FOUND');
      assert.equal(await scalar('select count(*) from user_coupons where coupon_id=$1', [foreign]), 0);
    });
    await t.test('취소 트랜잭션 도중 만료된 쿠폰은 AVAILABLE로 복원하지 않는다', async () => {
      const id = await coupon(); const uc = (await issue([id])).results[0].userCouponId;
      await commit(uc);
      const orderId = await scalar('select used_order_id from user_coupons where id=$1', [uc]);
      await db.query("update user_coupons set expires_at=clock_timestamp()+interval '150 milliseconds' where id=$1", [uc]);
      await db.exec('begin; select pg_sleep(0.2)');
      await rpc('cancel_coupon_order', [uid, orderId, 'test']);
      assert.equal(await scalar('select status from user_coupons where id=$1', [uc]), 'EXPIRED');
      await db.exec('commit');
    });
  } finally { await db.close(); }
});

test('판매 불가 상품 및 다른 매장 금액으로 최소 주문 조건을 충족시키지 않는다', () => {
  const now = new Date('2026-11-02');
  const item = (id, stock) => ({ storeProductId: id, lineAmount: 10000, quantity: 1, product: { name: id, status: 'ON_SALE', open_at: null }, sale: { stock, max_per_order: null, status: 'ON_SALE' } });
  const owned = { id: 'mine', user_id: 'buyer', status: 'AVAILABLE', expires_at: '2027-01-01', coupon: {
    store_id: 'A', code: 'SHOP_TEST', discount_type: 'FIXED', discount_value: 1000, min_order_amount: 15000,
    max_discount: null, total_quantity: null, issued_count: 1, applies_to: 'ALL', is_active: true, valid_from: '2026-01-01', valid_until: '2027-01-01' } };
  const quote = calculateStoreQuote({ storeId: 'A', itemsAmount: 20000, items: [item('available', 1), item('sold-out', 0)] },
    { deliveryFee: 0, option: { fulfillmentType: 'PICKUP' } }, owned, 'buyer', false, now);
  assert.equal(quote.orderableItemsAmount, 10000); assert.equal(quote.coupon.reason, 'MIN_ORDER_AMOUNT'); assert.equal(quote.discountAmount, 0);
});

test('부분 취소 계산: 중복 할인 환불 방지·최소 미달 회수·최종 전액 상한', () => {
  const policy = { discount_type: 'FIXED', discount_value: 3000, min_order_amount: 10000, max_discount: null };
  const base = { itemsAmount: 30000, couponDiscount: 3000, policy, cancelAmount: 10000 };
  assert.equal(quotePartialCouponCancellation(base).refundAmount, 10000);
  assert.equal(quotePartialCouponCancellation({ ...base, previouslyCanceledAmount: 10000, previouslyRefundedAmount: 10000 }).refundAmount, 10000);
  const last = quotePartialCouponCancellation({ ...base, previouslyCanceledAmount: 20000, previouslyRefundedAmount: 20000 });
  assert.equal(last.refundAmount, 7000); assert.equal(last.restoreCoupon, true);
  const clawback = quotePartialCouponCancellation({ ...base, itemsAmount: 20000, cancelAmount: 1000, policy: { ...policy, min_order_amount: 20000 } });
  assert.equal(clawback.refundAmount, 0); assert.equal(clawback.additionalAmountDue, 2000); assert.equal(clawback.canRefund, false);
  assert.throws(() => quotePartialCouponCancellation({ ...base, previouslyRefundedAmount: 30000 }));
});

test('장바구니 판매가를 이중 할인하지 않고 중단된 상품은 최소 금액에서 제외', () => {
  const store = { status: 'ACTIVE', pickup_available: true };
  const sale = { id: 'sale', price: 20000, discount_rate: 20, stock: 5, status: 'ON_SALE', pickup_available: true,
    product: { id: 'product', status: 'ON_SALE', open_at: null }, store };
  const row = { id: 'cart', quantity: 1, is_selected: true, store_product: sale };
  assert.equal(toCartItem(row, 'PICKUP').finalPrice, 20000);
  assert.equal(toCartItem(row, 'PICKUP').price, 25000);
  sale.product.status = 'STOPPED';
  assert.equal(toCartItem(row, 'PICKUP').isSelected, false);
  assert.equal(toCartItem(row, 'PICKUP').available, false);
});

test('서버 견적 확인 값은 금액·수량·매장별 쿠폰/배송비 변경 시 달라진다', () => {
  const quote = { orders: [{ storeId: 'A', fulfillmentType: 'PICKUP', items: [{ storeProductId: 'sku', quantity: 1, unitPrice: 20000 }], discountAmount: 1000, cartCouponDiscountAmount: 0, deliveryFee: 0, payAmount: 19000, coupon: { userCouponId: 'coupon' } }], totals: { payAmount: 19000 } };
  const original = checkoutQuoteToken(quote);
  assert.equal(checkoutQuoteToken(structuredClone(quote)), original);
  for (const patch of [{ discountAmount: 0 }, { deliveryFee: 3000 }, { payAmount: 18000 }, { coupon: { userCouponId: 'other' } }, { items: [{ storeProductId: 'sku', quantity: 2, unitPrice: 10000 }] }]) {
    assert.notEqual(checkoutQuoteToken({ ...quote, orders: [{ ...quote.orders[0], ...patch }] }), original);
  }
});
