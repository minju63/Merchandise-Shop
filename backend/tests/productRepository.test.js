import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductRepository } from '../src/repositories/product.repository.js';

test('상품 ID가 없으면 DB 조회를 건너뛰고 null을 반환한다', async () => {
  let queried = false;

  const client = {
    from() {
      queried = true;
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: { id: 'fallback' }, error: null }),
              };
            },
          };
        },
      };
    },
  };

  const repository = createProductRepository(client);

  assert.equal(await repository.findById(undefined), null);
  assert.equal(queried, false);
});
