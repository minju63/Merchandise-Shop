import assert from 'node:assert/strict';
import test from 'node:test';
import { validateItems } from '../src/services/showcase.service.js';

const owner = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const sku = '33333333-3333-4333-8333-333333333333';
const layout = { x: 0.5, y: 0.4, scale: 1, rotation: 0, layer_order: 0 };

test('개인 진열장에는 해당 진열장의 사진만 허용한다', () => {
  const row = { id, owner_id: owner, type: 'PERSONAL' };
  const good = { ...layout, original_path: `${owner}/${id}/original/photo.png` };
  assert.doesNotThrow(() => validateItems([good], row));
  assert.throws(() => validateItems([{ ...good, original_path: `${owner}/other/original/photo.png` }], row), { code: 'INVALID_IMAGE' });
  assert.throws(() => validateItems([{ ...good, store_product_id: sku }], row), { code: 'INVALID_IMAGE' });
  assert.throws(() => validateItems([{ ...good, x: 1.2 }], row), { code: 'INVALID_ITEM' });
});

test('쇼핑 진열장은 판매상품 연결과 이미지 경로 형식을 확인한다', () => {
  const row = { id, owner_id: owner, type: 'SHOP' };
  const good = { ...layout, store_product_id: sku };
  assert.doesNotThrow(() => validateItems([good], row));
  assert.throws(() => validateItems([{ ...good, original_path: `${owner}/${id}/original/photo.png` }], row), { code: 'INVALID_PRODUCT' });
  assert.throws(() => validateItems([{ ...good, cutout_path: `other/${id}/cutout/photo.png` }], row), { code: 'INVALID_IMAGE' });
  assert.throws(() => validateItems([], row), { code: 'INVALID_ITEMS' });
});
