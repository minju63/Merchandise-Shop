-- 응원 포인트 + 응원 순위 방식 2단계: DB 구조 교체
-- 초안입니다. 원격 Supabase 적용 전 사용자 확인 필요 (아직 적용하지 않음).
--
-- 이전 추첨 방식(fan_banner_step2/3.sql)으로 만든 응모 테이블·함수는 데이터가 0건이라 지우고 새로 만든다.
-- 남기는 것: characters · anniversaries · fan_banner_weeks · ensure_fan_week · fan_has_banned_word ·
--           fan-banner 버킷 · notifications 의 FAN_BANNER 타입 · banners 타입 확장
-- 이 파일에서는 구조와 무료 응원권 지급·회수(트리거)까지 만든다.
-- 충전 · 응원하기 · 순위 · 결과 정산 함수는 3·4단계 SQL 에서 이어서 만든다.
--
-- 규칙: PK uuid default gen_random_uuid(), 시각 timestamptz, 금액 integer. 쓰기는 서버(service role)만.
-- 잔액(응원 포인트 · 적립금)은 원장(ledger)의 합계로 계산한다. 무료 응원권은 포인트와 별도 잔액이다.

-- ── 1. 이전 방식 정리
drop trigger if exists fan_orders_tickets on orders;
drop trigger if exists fan_reviews_tickets on reviews;
drop policy if exists fan_banner_approved_read on storage.objects;

drop function if exists fan_apply(uuid, text, uuid, uuid, text, text, integer, boolean, boolean);
drop function if exists fan_overview(uuid);
drop function if exists fan_expire_tickets();
drop function if exists fan_ensure_tickets(uuid);
drop function if exists fan_on_order_change();
drop function if exists fan_on_review_change();
drop function if exists fan_recheck_purchase(uuid);
drop function if exists fan_revoke_tickets(uuid, uuid);
drop function if exists fan_grant_ticket(uuid, text, uuid, uuid);

drop table if exists fan_banner_designs cascade;
drop table if exists fan_banner_winners cascade;
drop table if exists fan_banner_applications cascade;
drop table if exists fan_banner_tickets cascade;

-- ── 2. 운영 설정값 (관리자 화면에서 바꾼다)
create table if not exists fan_settings (
  key text primary key,
  int_value integer not null,
  description text not null,
  updated_at timestamptz not null default now()
);

insert into fan_settings (key, int_value, description) values
  ('cheer_price', 1000, '응원 1회 가격(P)'),
  ('daily_cheer_limit', 100, '1인 1일 최대 응원 횟수(유료+무료)'),
  ('min_paid_amount', 30000, '배너 게시에 필요한 최소 유료 응원 합계(P)'),
  ('credit_return_rate', 105, '적립금 반환 비율(%)'),
  ('return_choice_days', 7, '반환 방식 선택 기한(일)'),
  ('credit_valid_days', 365, '적립금 유효기간(일)'),
  ('free_slot_count', 3, '주당 자유 응원 전광판 자리 수'),
  ('anniv_publish_days', 1, '기념일 전광판 게시 일수')
on conflict (key) do nothing;

create or replace function fan_setting(p_key text)
returns integer
language sql
stable
as $$
  select int_value from fan_settings where key = p_key;
$$;

-- ── 3. 주차: 추첨 컬럼 대신 정산 정보
alter table fan_banner_weeks
  drop column if exists drawn_at,
  drop column if exists total_applications,
  add column if not exists min_paid_amount integer,
  add column if not exists free_slot_count smallint,
  add column if not exists settled_at timestamptz;

-- 주차를 만들 때 그 시점의 설정값을 복사해 둔다 (이후 설정을 바꿔도 이미 연 주차는 그대로)
create or replace function ensure_fan_week(at timestamptz default now())
returns fan_banner_weeks
language plpgsql
as $$
declare
  monday date := date_trunc('week', (at at time zone 'Asia/Seoul'))::date;
  week fan_banner_weeks;
begin
  select * into week from fan_banner_weeks where week_start = monday;
  if found then
    if week.min_paid_amount is null then
      update fan_banner_weeks
         set min_paid_amount = fan_setting('min_paid_amount'), free_slot_count = fan_setting('free_slot_count')
       where id = week.id returning * into week;
    end if;
    return week;
  end if;

  insert into fan_banner_weeks (week_start, apply_start_at, apply_end_at, announce_at,
                                submit_deadline_at, publish_start, publish_end, min_paid_amount, free_slot_count)
  values (
    monday,
    (monday::timestamp) at time zone 'Asia/Seoul',
    ((monday + 3)::timestamp + interval '23 hours 59 minutes 59 seconds') at time zone 'Asia/Seoul',
    ((monday + 4)::timestamp) at time zone 'Asia/Seoul',
    ((monday + 5)::timestamp + interval '23 hours 59 minutes 59 seconds') at time zone 'Asia/Seoul',
    monday + 7,
    monday + 13,
    fan_setting('min_paid_amount'),
    fan_setting('free_slot_count')
  )
  on conflict (week_start) do nothing;
  select * into week from fan_banner_weeks where week_start = monday;
  return week;
end;
$$;

update fan_banner_weeks
   set min_paid_amount = fan_setting('min_paid_amount'), free_slot_count = fan_setting('free_slot_count')
 where min_paid_amount is null;

-- ── 4. 슬롯: 게시 자리 (기념일은 날짜마다 하나, 자유는 결과 확정 때 만든다)
create table fan_banner_slots (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references fan_banner_weeks(id) on delete cascade,
  slot_type text not null check (slot_type in ('ANNIV', 'FREE')),
  publish_date date not null,
  anniversary_id uuid references anniversaries(id),   -- 기념일 자리: 이긴 최애의 기념일
  winner_character_id uuid references characters(id),
  status text not null default 'OPEN'
    check (status in ('OPEN', 'DECIDED', 'NOT_ESTABLISHED', 'PUBLISHED')),
  created_at timestamptz not null default now(),
  unique (week_id, slot_type, publish_date)
);
create index fan_banner_slots_publish_idx on fan_banner_slots (publish_date) where status in ('DECIDED', 'PUBLISHED');

-- ── 5. 무료 응원권 (응원 포인트와 별도 잔액)
create table free_cheer_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  week_id uuid not null references fan_banner_weeks(id) on delete cascade,
  reason text not null check (reason in ('BASE', 'PICKUP', 'REVIEW', 'GOODS_PASS')),
  order_id uuid references orders(id) on delete set null,
  review_id uuid references reviews(id) on delete set null,
  status text not null default 'GRANTED' check (status in ('GRANTED', 'USED', 'REVOKED', 'EXPIRED')),
  cheer_id uuid,                                       -- 사용한 응원 (cheers FK 는 아래에서 추가)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index free_cheer_tickets_user_week_idx on free_cheer_tickets (user_id, week_id, status);
create unique index free_cheer_tickets_order_uniq on free_cheer_tickets (user_id, week_id, reason, order_id)
  where order_id is not null and status in ('GRANTED', 'USED');
create unique index free_cheer_tickets_review_uniq on free_cheer_tickets (user_id, week_id, reason, review_id)
  where review_id is not null and status in ('GRANTED', 'USED');
create unique index free_cheer_tickets_once_uniq on free_cheer_tickets (user_id, week_id, reason)
  where reason in ('BASE', 'GOODS_PASS') and status in ('GRANTED', 'USED');

-- ── 6. 응원
create table cheers (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,             -- 동점일 때 먼저 도달한 쪽을 가리는 순서
  user_id uuid not null references users(id) on delete cascade,
  week_id uuid not null references fan_banner_weeks(id) on delete cascade,
  slot_type text not null check (slot_type in ('ANNIV', 'FREE')),
  slot_id uuid references fan_banner_slots(id),        -- 기념일 응원: 그 날짜의 슬롯, 자유 응원: null
  character_id uuid not null references characters(id),
  anniversary_id uuid references anniversaries(id),
  pay_type text not null check (pay_type in ('POINT', 'FREE_TICKET')),
  cheer_count smallint not null check (cheer_count between 1 and 100),
  unit_price integer not null default 0 check (unit_price >= 0),  -- 응원 당시 1회 가격 (무료는 0)
  message varchar(30) not null,
  nickname varchar(20) not null,
  agreed_rules boolean not null check (agreed_rules),
  agreed_image_rights boolean not null check (agreed_image_rights),
  created_at timestamptz not null default now(),
  check ((slot_type = 'ANNIV') = (anniversary_id is not null)),
  check ((slot_type = 'ANNIV') = (slot_id is not null))
);
create index cheers_ranking_idx on cheers (week_id, slot_type, slot_id, character_id);
create index cheers_user_day_idx on cheers (user_id, created_at);

alter table free_cheer_tickets
  add constraint free_cheer_tickets_cheer_fk foreign key (cheer_id) references cheers(id) on delete set null;

-- ── 7. 결과: 슬롯(또는 자유 응원 주차)별 최애 순위
create table cheer_results (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references fan_banner_weeks(id) on delete cascade,
  slot_type text not null check (slot_type in ('ANNIV', 'FREE')),
  slot_id uuid references fan_banner_slots(id),
  character_id uuid not null references characters(id),
  rank_no smallint not null,
  cheer_count integer not null,                        -- 유료+무료
  paid_amount integer not null,                        -- 유료 응원 합계(P)
  is_winner boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index cheer_results_uniq on cheer_results
  (week_id, slot_type, coalesce(slot_id, '00000000-0000-0000-0000-000000000000'::uuid), character_id);

-- ── 8. 응원 포인트 원장 (잔액 = 합계)
create table cheer_point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('CHARGE', 'CHEER_USE', 'RETURN_POINT', 'CASH_REFUND', 'ADMIN')),
  amount integer not null check (amount <> 0),         -- 충전·반환은 +, 사용·환불은 -
  payment_id uuid references payments(id),
  cheer_id uuid references cheers(id) on delete set null,
  return_choice_id uuid,                               -- return_choices FK 는 아래에서 추가
  memo text,
  created_at timestamptz not null default now()
);
create index cheer_point_ledger_user_idx on cheer_point_ledger (user_id, created_at desc);

-- ── 9. 적립금 원장 (굿즈 구매 전용, 유효기간 있음)
create table reward_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('RETURN_105', 'USE', 'EXPIRE')),
  amount integer not null check (amount <> 0),
  expires_at timestamptz,                              -- 적립(+) 건의 만료일
  return_choice_id uuid,
  order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index reward_credit_ledger_user_idx on reward_credit_ledger (user_id, created_at desc);

-- ── 10. 반환 선택 (진 최애에 쓴 유료 응원)
create table return_choices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  week_id uuid not null references fan_banner_weeks(id) on delete cascade,
  slot_type text not null check (slot_type in ('ANNIV', 'FREE')),
  slot_id uuid references fan_banner_slots(id),
  character_id uuid not null references characters(id),
  reason text not null default 'LOST' check (reason in ('LOST', 'NOT_ESTABLISHED')),
  amount integer not null check (amount > 0),          -- 반환 대상 유료 포인트
  choice text check (choice in ('CREDIT_105', 'POINT')),
  deadline_at timestamptz not null,
  chosen_at timestamptz,
  status text not null default 'PENDING' check (status in ('PENDING', 'PROCESSED')),
  auto_processed boolean not null default false,       -- 기한 안에 고르지 않아 자동 처리됨
  created_at timestamptz not null default now()
);
create unique index return_choices_uniq on return_choices
  (user_id, week_id, slot_type, coalesce(slot_id, '00000000-0000-0000-0000-000000000000'::uuid), character_id);
create index return_choices_pending_idx on return_choices (deadline_at) where status = 'PENDING';

alter table cheer_point_ledger
  add constraint cheer_point_ledger_return_fk foreign key (return_choice_id) references return_choices(id) on delete set null;
alter table reward_credit_ledger
  add constraint reward_credit_ledger_return_fk foreign key (return_choice_id) references return_choices(id) on delete set null;

-- ── 11. 전광판 디자인: 슬롯 + 꾸미기 권한자 + 순번
create table fan_banner_designs (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references fan_banner_slots(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,   -- 꾸미기 권한자
  rank_no smallint not null default 1,                 -- 1 = 최다 응원 팬, 미제출 시 2, 3 ... 으로 이동
  authority text not null default 'ACTIVE' check (authority in ('ACTIVE', 'FORFEITED')),
  design jsonb not null default '{}'::jsonb,
  background_path text,                                -- Storage fan-banner 경로
  photo_path text,
  review_status text not null default 'DRAFT' check (review_status in ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  reject_reason text,
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slot_id, rank_no)
);
create index fan_banner_designs_status_idx on fan_banner_designs (review_status);

-- ── 12. 결제 목적에 응원 포인트 충전 추가 (모의 결제도 payments 행으로 남긴다)
alter table payments drop constraint if exists payments_purpose_check;
alter table payments add constraint payments_purpose_check
  check (purpose in ('ORDER', 'PREORDER_DEPOSIT', 'PREORDER_BALANCE', 'MEMBERSHIP', 'FAN_BANNER', 'CHEER_CHARGE'));
alter table payments drop constraint if exists payments_check;
alter table payments add constraint payments_check
  check (order_id is not null or preorder_id is not null or purpose in ('MEMBERSHIP', 'FAN_BANNER', 'CHEER_CHARGE'));

-- ── 13. 무료 응원권 지급 · 회수 (주문/리뷰 트리거)
-- 한도: 기본 1(주 1) / 픽업 완료 건당 +1(일 5) / 리뷰 건당 +1(일 5) / 굿즈 패스 +1(주 1)
create or replace function fan_grant_ticket(p_user uuid, p_reason text, p_order uuid default null, p_review uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week fan_banner_weeks := ensure_fan_week(now());
  v_cap integer := case p_reason when 'PICKUP' then 5 when 'REVIEW' then 5 else 1 end;
  v_today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_count integer;
begin
  -- 응원 기간(목 23:59:59) 이후에 받은 응원권은 쓸 수 없으므로 지급하지 않는다
  if now() > v_week.apply_end_at then return; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user::text || v_week.id::text, 0));

  select count(*) into v_count from free_cheer_tickets
   where user_id = p_user and week_id = v_week.id and reason = p_reason and status in ('GRANTED', 'USED')
     -- 픽업·리뷰는 하루(KST) 기준, 나머지는 한 주 기준
     and (p_reason not in ('PICKUP', 'REVIEW') or created_at >= v_today_start);
  if v_count >= v_cap then return; end if;

  insert into free_cheer_tickets (user_id, week_id, reason, order_id, review_id)
  values (p_user, v_week.id, p_reason, p_order, p_review)
  on conflict do nothing;
end;
$$;

-- 주문 또는 리뷰로 받은 응원권 회수. 이미 응원에 쓴 응원권이면 그 응원 횟수에서도 뺀다.
-- 결과가 확정된 주차는 건드리지 않는다.
create or replace function fan_revoke_tickets(p_order uuid default null, p_review uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket record;
  v_remaining integer;
begin
  for v_ticket in
    select t.id, t.cheer_id, w.settled_at
      from free_cheer_tickets t
      join fan_banner_weeks w on w.id = t.week_id
     where t.status in ('GRANTED', 'USED')
       and ((p_order is not null and t.order_id = p_order) or (p_review is not null and t.review_id = p_review))
     for update of t
  loop
    if v_ticket.settled_at is not null then continue; end if;

    update free_cheer_tickets set status = 'REVOKED', updated_at = now() where id = v_ticket.id;

    if v_ticket.cheer_id is not null then
      select count(*) into v_remaining from free_cheer_tickets
       where cheer_id = v_ticket.cheer_id and status = 'USED';
      if v_remaining = 0 then
        delete from cheers where id = v_ticket.cheer_id;
      else
        update cheers set cheer_count = v_remaining where id = v_ticket.cheer_id;
      end if;
    end if;
  end loop;
end;
$$;

create or replace function fan_on_order_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed boolean := tg_op = 'INSERT';
begin
  if tg_op = 'UPDATE' then v_changed := old.status is distinct from new.status; end if;

  if v_changed and new.status = 'CANCELED' then
    perform fan_revoke_tickets(p_order => new.id);
  elsif v_changed and new.status = 'COMPLETED' and new.fulfillment_type = 'PICKUP' then
    perform fan_grant_ticket(new.user_id, 'PICKUP', p_order => new.id);
  end if;
  return new;
end;
$$;

create trigger fan_orders_tickets
  after insert or update of status on orders
  for each row execute function fan_on_order_change();

create or replace function fan_on_review_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not new.is_hidden and new.deleted_at is null then
      perform fan_grant_ticket(new.user_id, 'REVIEW', p_review => new.id);
    end if;
  else
    if (new.is_hidden and not old.is_hidden) or (new.deleted_at is not null and old.deleted_at is null) then
      perform fan_revoke_tickets(p_review => new.id);
    end if;
  end if;
  return new;
end;
$$;

create trigger fan_reviews_tickets
  after insert or update of is_hidden, deleted_at on reviews
  for each row execute function fan_on_review_change();

-- 기본(BASE) · 굿즈 패스 응원권은 이벤트가 없어서 화면을 열 때 서버가 부른다
create or replace function fan_ensure_tickets(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform fan_grant_ticket(p_user, 'BASE');
  if exists (
    select 1 from user_memberships
     where user_id = p_user and plan_code = 'CONSUMER_PLUS' and status = 'ACTIVE'
       and (current_period_end is null or current_period_end > now())
  ) then
    perform fan_grant_ticket(p_user, 'GOODS_PASS');
  end if;
end;
$$;

-- 목요일 마감 후 남은 무료 응원권 소멸 (5단계 스케줄 작업에서 호출)
create or replace function fan_expire_tickets()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update free_cheer_tickets set status = 'EXPIRED', updated_at = now()
   where status = 'GRANTED'
     and week_id in (select id from fan_banner_weeks where apply_end_at < now());
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function fan_grant_ticket, fan_revoke_tickets, fan_ensure_tickets, fan_expire_tickets
  from public, anon, authenticated;

-- ── 14. RLS: 쓰기는 서버(service role)만, 본인 행만 읽기
alter table fan_settings enable row level security;
alter table fan_banner_slots enable row level security;
alter table free_cheer_tickets enable row level security;
alter table cheers enable row level security;
alter table cheer_results enable row level security;
alter table cheer_point_ledger enable row level security;
alter table reward_credit_ledger enable row level security;
alter table return_choices enable row level security;
alter table fan_banner_designs enable row level security;

create policy fan_settings_read on fan_settings for select using (true);
create policy fan_slots_read on fan_banner_slots for select using (true);
create policy cheer_results_read on cheer_results for select using (true);
create policy free_tickets_own on free_cheer_tickets for select using (user_id = auth.uid());
create policy cheers_own on cheers for select using (user_id = auth.uid());
create policy point_ledger_own on cheer_point_ledger for select using (user_id = auth.uid());
create policy credit_ledger_own on reward_credit_ledger for select using (user_id = auth.uid());
create policy return_choices_own on return_choices for select using (user_id = auth.uid());
create policy fan_designs_own on fan_banner_designs for select using (user_id = auth.uid());
create policy fan_designs_public on fan_banner_designs for select using (review_status = 'APPROVED');

-- 승인된 디자인의 이미지만 누구나 읽을 수 있다 (본인 폴더 업로드·수정 정책은 그대로 유지)
create policy fan_banner_approved_read on storage.objects for select
  using (bucket_id = 'fan-banner' and exists (
    select 1 from fan_banner_designs d
    where d.review_status = 'APPROVED' and name in (d.background_path, d.photo_path)
  ));
