import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import routes from '../src/routes/store.routes.js';
import { errorHandler } from '../src/middlewares/errorHandler.middleware.js';
import { createStoreInquiryService } from '../src/services/storeInquiry.service.js';
import { createStoreInquiryRepository } from '../src/repositories/storeInquiry.repository.js';

const storeId = '10000000-0000-4000-8000-000000000001';
const otherStoreId = '10000000-0000-4000-8000-000000000002';
const owner = { id: '20000000-0000-4000-8000-000000000001' };
const buyer = { id: '20000000-0000-4000-8000-000000000002' };
const inquiryId = '30000000-0000-4000-8000-000000000001';
const input = { title: ' 영업시간 문의 ', content: ' 주말에도 영업하나요? ', requestId: inquiryId };
function fixture(overrides = {}) {
  const writes = [];
  const repository = {
    async getStore(id) {
      return id === storeId ? { id, name: '매장', status: 'ACTIVE', owner_id: owner.id } : null;
    },
    async getMember(id) {
      return { id, status: 'ACTIVE', role: id === owner.id ? 'SELLER' : 'CONSUMER' };
    },
    async list(id, options) {
      return { items: [{ id: inquiryId, store_id: id }], totalCount: options.size };
    },
    async create(body) {
      writes.push(body);
      return body;
    },
    async answer(...args) {
      writes.push(args);
      return { status: 'ANSWERED' };
    },
    async updatePending(...args) {
      writes.push(args);
      return { id: inquiryId, status: 'PENDING' };
    },
    async removePending(...args) {
      writes.push(args);
      return { id: inquiryId };
    },
    ...overrides,
  };
  return { service: createStoreInquiryService(repository), writes };
}

test('굿즈샵 공개 목록은 로그인 없이 매장 ID와 페이지를 한정한다', async () => {
  const { service } = fixture();
  const result = await service.list(storeId, { page: 2, size: 10 });
  assert.equal(result.store.id, storeId);
  assert.equal(result.items[0].store_id, storeId);
  assert.equal(result.page, 2);
  for (const options of [{ page: 0 }, { size: 101 }, { page: Number.MAX_SAFE_INTEGER }]) {
    await assert.rejects(service.list(storeId, options), { status: 400 });
  }
  await assert.rejects(service.list('bad'), { status: 400 });
  await assert.rejects(service.list(otherStoreId), { status: 404 });
  await assert.rejects(
    fixture({
      async getStore() {
        return { status: 'CLOSED' };
      },
    }).service.list(storeId),
    { status: 404 }
  );
});

test('문의 생성은 검증된 회원만 허용하고 클라이언트 작성자·답변 필드를 무시한다', async () => {
  const { service, writes } = fixture();
  for (const user of [null, { ...buyer, is_anonymous: true }]) {
    await assert.rejects(service.create(storeId, user, input), { status: 401 });
  }
  await assert.rejects(
    fixture({
      async getMember() {
        return { status: 'SUSPENDED' };
      },
    }).service.create(storeId, buyer, input),
    { status: 403 }
  );
  for (const patch of [
    { title: ' \n ' },
    { content: '\t' },
    { title: '가'.repeat(101) },
    { content: '가'.repeat(5001) },
    { requestId: 'invalid' },
  ]) {
    await assert.rejects(service.create(storeId, buyer, { ...input, ...patch }), { status: 400 });
  }
  assert.equal(writes.length, 0);
  await service.create(storeId, buyer, {
    ...input,
    user_id: owner.id,
    store_id: otherStoreId,
    answer_content: '위조',
  });
  assert.deepEqual(writes[0], {
    store_id: storeId,
    user_id: buyer.id,
    request_id: inquiryId,
    title: input.title.trim(),
    content: input.content.trim(),
  });
});

test('판매자 답변은 매장 소유자만 허용하며 문의도 같은 매장으로 한정한다', async () => {
  const { service, writes } = fixture();
  await assert.rejects(service.answer(storeId, inquiryId, buyer, { content: '답변' }), {
    status: 403,
  });
  await assert.rejects(
    fixture({
      async getMember() {
        return { status: 'ACTIVE', role: 'CONSUMER' };
      },
    }).service.answer(storeId, inquiryId, owner, { content: '답변' }),
    { status: 403 }
  );
  await assert.rejects(
    fixture({
      async getMember() {
        return { status: 'ACTIVE', role: 'SELLER' };
      },
    }).service.answer(storeId, inquiryId, buyer, { content: '답변' }),
    { status: 403 }
  );
  assert.equal(writes.length, 0);
  await service.answer(storeId, inquiryId, owner, { content: ' 답변 ' });
  assert.deepEqual(writes[0], [storeId, inquiryId, owner.id, '답변']);
  await assert.rejects(
    fixture({
      async answer() {
        return null;
      },
    }).service.answer(storeId, inquiryId, owner, { content: '답변' }),
    { status: 404 }
  );
  await assert.rejects(service.answer(storeId, inquiryId, owner, { content: '  ' }), {
    status: 400,
  });
});

test('응답 유실 재시도는 동일 요청 키를 재사용하고 다른 내용으로 재사용하면 거부한다', async () => {
  const calls = [];
  const body = {
    store_id: storeId,
    user_id: buyer.id,
    request_id: inquiryId,
    title: '제목',
    content: '내용',
  };
  const query = {
    async upsert(value, options) {
      calls.push({ value, options });
      return { error: null };
    },
    select() {
      return this;
    },
    eq() {
      return this;
    },
    is() {
      return this;
    },
    async single() {
      return { data: { ...body, id: inquiryId }, error: null };
    },
  };
  const repo = createStoreInquiryRepository({
    from(table) {
      assert.equal(table, 'store_inquiries');
      return query;
    },
  });
  assert.equal((await repo.create(body)).id, inquiryId);
  assert.equal((await repo.create(body)).id, inquiryId);
  assert.deepEqual(calls[0].options, { onConflict: 'user_id,request_id', ignoreDuplicates: true });
  await assert.rejects(repo.create({ ...body, content: '다른 내용' }), { status: 409 });
});

test('목록 DB 실패는 빈 성공 응답으로 바꾸지 않는다', async () => {
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    is() {
      return this;
    },
    order() {
      return this;
    },
    async range() {
      return { error: { code: 'PGRST205' } };
    },
  };
  const repo = createStoreInquiryRepository({
    from() {
      return query;
    },
  });
  await assert.rejects(repo.list(storeId, { page: 1, size: 10 }), {
    status: 503,
    code: 'STORE_INQUIRY_SCHEMA_NOT_READY',
  });
});

test('문의 수정·삭제는 검증된 작성자 ID만 사용하고 변경 불가 상태는 거절한다', async () => {
  const { service, writes } = fixture();
  for (const action of ['update', 'remove']) {
    await assert.rejects(service[action](storeId, inquiryId, null, input), { status: 401 });
    await assert.rejects(service[action](storeId, 'bad', buyer, input), { status: 400 });
    const rejecting = fixture({
      async updatePending() {
        return null;
      },
      async removePending() {
        return null;
      },
    }).service;
    await assert.rejects(rejecting[action](storeId, inquiryId, buyer, input), {
      status: 409,
      code: 'INQUIRY_NOT_EDITABLE',
    });
  }
  await assert.rejects(service.update(storeId, inquiryId, buyer, { title: ' ', content: '내용' }), {
    status: 400,
  });
  await assert.rejects(
    service.update(storeId, inquiryId, buyer, { title: '제목', content: '가'.repeat(5001) }),
    { status: 400 }
  );
  await service.update(storeId, inquiryId, buyer, {
    ...input,
    user_id: owner.id,
    status: 'ANSWERED',
    answer_content: '위조',
  });
  await service.remove(storeId, inquiryId, buyer);
  assert.deepEqual(writes, [
    [storeId, inquiryId, buyer.id, { title: input.title.trim(), content: input.content.trim() }],
    [storeId, inquiryId, buyer.id],
  ]);
});

test('수정과 삭제 쿼리는 같은 SQL 작업에서 작성자·매장·답변대기·미삭제 조건을 모두 제한한다', async () => {
  for (const action of ['updatePending', 'removePending']) {
    const filters = [];
    let patch;
    const query = {
      update(value) {
        patch = value;
        return this;
      },
      eq(...values) {
        filters.push(values);
        return this;
      },
      is(...values) {
        filters.push(values);
        return this;
      },
      select() {
        return this;
      },
      async maybeSingle() {
        return { data: null, error: null };
      },
    };
    const repo = createStoreInquiryRepository({
      from() {
        return query;
      },
    });
    assert.equal(
      await repo[action](storeId, inquiryId, buyer.id, { title: '수정', content: '내용' }),
      null
    );
    assert.deepEqual(filters, [
      ['store_id', storeId],
      ['id', inquiryId],
      ['user_id', buyer.id],
      ['status', 'PENDING'],
      ['deleted_at', null],
    ]);
    if (action === 'removePending') assert.ok(Number.isFinite(Date.parse(patch.deleted_at)));
    else assert.deepEqual(patch, { title: '수정', content: '내용' });
  }
});

test('삭제된 문의의 등록 재시도는 문의를 다시 공개하지 않는다', async () => {
  const query = {
    async upsert() {
      return { error: null };
    },
    select() {
      return this;
    },
    eq() {
      return this;
    },
    async single() {
      return { data: { deleted_at: new Date().toISOString() }, error: null };
    },
  };
  const repo = createStoreInquiryRepository({
    from() {
      return query;
    },
  });
  await assert.rejects(repo.create({}), { status: 409, code: 'REQUEST_ALREADY_USED' });
});

test('공개 저장소 조회는 매장을 한정하고 작성자 개인정보와 요청 키는 응답에서 제외한다', async () => {
  const filters = [];
  let fields;
  const query = {
    select(value) {
      fields = value;
      return this;
    },
    eq(...values) {
      filters.push(values);
      return this;
    },
    is(...values) {
      filters.push(values);
      return this;
    },
    order() {
      return this;
    },
    async range() {
      return {
        data: [
          {
            id: inquiryId,
            store_id: storeId,
            user_id: buyer.id,
            title: '문의',
            author: { nickname: '작성자' },
          },
        ],
        count: 1,
        error: null,
      };
    },
  };
  const repo = createStoreInquiryRepository({
    from(table) {
      assert.equal(table, 'store_inquiries');
      return query;
    },
  });
  const result = await repo.list(storeId, { page: 1, size: 10, userId: buyer.id });
  assert.deepEqual(filters, [
    ['store_id', storeId],
    ['deleted_at', null],
  ]);
  assert.equal(result.items[0].authorName, '작성자');
  assert.equal(result.items[0].author, undefined);
  assert.equal(result.items[0].user_id, undefined);
  assert.equal(result.items[0].isMine, true);
  assert.equal((await repo.list(storeId, { page: 1, size: 10 })).items[0].isMine, false);
  assert.equal(
    (await repo.list(storeId, { page: 1, size: 10, userId: owner.id })).items[0].isMine,
    false
  );
  assert.ok(!fields.includes('request_id'));
  assert.ok(!fields.includes('email'));
});

test('실제 라우터는 무토큰 문의·답변과 잘못된 공개 조회 입력을 거부한다', async () => {
  const app = express();
  app.use(express.json());
  app.use('/stores', routes);
  app.use(errorHandler);
  const server = app.listen(0);
  try {
    const root = `http://127.0.0.1:${server.address().port}/stores`;
    for (const [path, method, status] of [
      [`/${storeId}/inquiries`, 'POST', 401],
      [`/${storeId}/inquiries/${inquiryId}/answer`, 'PUT', 401],
      [`/${storeId}/inquiries/${inquiryId}`, 'PATCH', 401],
      [`/${storeId}/inquiries/${inquiryId}`, 'DELETE', 401],
      ['/bad/inquiries', 'GET', 400],
      [`/${storeId}/inquiries?page=0`, 'GET', 400],
      [`/${storeId}/inquiries?size=101`, 'GET', 400],
      [`/${storeId}/inquiries?page=1&page=2`, 'GET', 400],
    ]) {
      const response = await fetch(root + path, { method });
      assert.equal(response.status, status, `${method} ${path}`);
    }
  } finally {
    server.close();
  }
});
