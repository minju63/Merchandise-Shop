-- 팬 응원 전광판 2단계: 테이블 · 주차 계산 · RLS · Storage
-- 초안입니다. 원격 Supabase 적용 전 사용자 확인 필요 (아직 적용하지 않음).
-- 응모권 지급·회수 함수/트리거는 3단계(fan_banner_step3.sql)에서 이어서 만든다.
-- 기존 fan_banner_entries(유료 신청 방식, 0행)는 건드리지 않는다.
--
-- 규칙: PK uuid default gen_random_uuid(), 시각 timestamptz, 금액 integer, 쓰기는 서버(service role)만.
-- 주차 기준은 KST(Asia/Seoul) 월요일 시작.

-- ── 캐릭터: 아직 없어서 products 의 (작품, 캐릭터)로 채운다
create table if not exists characters (
  id uuid primary key default gen_random_uuid(),
  name varchar not null,
  work_title varchar not null default '',
  profile_image_url varchar,
  created_at timestamptz not null default now(),
  unique (name, work_title)
);

insert into characters (name, work_title)
select distinct character_name, coalesce(work_title, '')
from products
where character_name is not null and character_name <> ''
on conflict do nothing;

-- ── 기념일
create table if not exists anniversaries (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  kind text not null check (kind in ('BIRTHDAY', 'DEBUT', 'COMEBACK', 'GOODS', 'SEASON')),
  event_date date not null,
  label varchar not null,                -- 표시명 (예: 토끼 생일)
  base_year smallint,                    -- 데뷔·첫 등장 주년 계산용 기준 연도
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (character_id, kind, event_date)
);
create index if not exists anniversaries_event_date_idx on anniversaries (event_date) where is_active;

-- ── 주차
create table if not exists fan_banner_weeks (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,       -- 월요일(KST)
  apply_start_at timestamptz not null,   -- 월 00:00
  apply_end_at timestamptz not null,     -- 목 23:59:59
  announce_at timestamptz not null,      -- 금 00:00
  submit_deadline_at timestamptz not null, -- 토 23:59:59
  publish_start date not null,           -- 다음 주 월요일
  publish_end date not null,             -- 다음 주 일요일
  drawn_at timestamptz,
  total_applications integer not null default 0,
  created_at timestamptz not null default now()
);

-- 주어진 시각이 속한 주차를 만들거나 돌려준다 (KST 월요일 시작)
create or replace function ensure_fan_week(at timestamptz default now())
returns fan_banner_weeks
language plpgsql
as $$
declare
  monday date := date_trunc('week', (at at time zone 'Asia/Seoul'))::date;
  week fan_banner_weeks;
begin
  select * into week from fan_banner_weeks where week_start = monday;
  if found then return week; end if;

  insert into fan_banner_weeks (week_start, apply_start_at, apply_end_at, announce_at,
                                submit_deadline_at, publish_start, publish_end)
  values (
    monday,
    (monday::timestamp) at time zone 'Asia/Seoul',
    ((monday + 3)::timestamp + interval '23 hours 59 minutes 59 seconds') at time zone 'Asia/Seoul',
    ((monday + 4)::timestamp) at time zone 'Asia/Seoul',
    ((monday + 5)::timestamp + interval '23 hours 59 minutes 59 seconds') at time zone 'Asia/Seoul',
    monday + 7,
    monday + 13
  )
  on conflict (week_start) do nothing;
  select * into week from fan_banner_weeks where week_start = monday;
  return week;
end;
$$;

-- ── 응모
create table if not exists fan_banner_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  week_id uuid not null references fan_banner_weeks(id) on delete cascade,
  slot_type text not null check (slot_type in ('ANNIV', 'FREE')),
  character_id uuid not null references characters(id),
  anniversary_id uuid references anniversaries(id),
  cheer_message varchar(30) not null,
  nickname varchar(20) not null,
  ticket_count smallint not null check (ticket_count between 1 and 10),
  agreed_image_rights boolean not null,
  agreed_rules boolean not null,
  created_at timestamptz not null default now(),
  check (agreed_image_rights and agreed_rules),
  check ((slot_type = 'ANNIV') = (anniversary_id is not null))
);
create index if not exists fan_banner_applications_week_idx on fan_banner_applications (week_id, slot_type);
create index if not exists fan_banner_applications_user_idx on fan_banner_applications (user_id, week_id);

-- ── 응모권 (지급 · 사용 · 회수 · 소멸 기록)
create table if not exists fan_banner_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  week_id uuid not null references fan_banner_weeks(id) on delete cascade,
  reason text not null check (reason in ('BASE', 'PICKUP', 'REVIEW', 'PURCHASE_50K', 'GOODS_PASS')),
  order_id uuid references orders(id) on delete set null,
  review_id uuid references reviews(id) on delete set null,
  status text not null default 'GRANTED' check (status in ('GRANTED', 'USED', 'REVOKED', 'EXPIRED')),
  application_id uuid references fan_banner_applications(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fan_banner_tickets_user_week_idx on fan_banner_tickets (user_id, week_id, status);
-- 같은 주문·리뷰로 같은 사유의 응모권이 두 번 지급되지 않게 한다
create unique index if not exists fan_banner_tickets_order_uniq on fan_banner_tickets (user_id, week_id, reason, order_id) where order_id is not null;
create unique index if not exists fan_banner_tickets_review_uniq on fan_banner_tickets (user_id, week_id, reason, review_id) where review_id is not null;
create unique index if not exists fan_banner_tickets_once_uniq on fan_banner_tickets (user_id, week_id, reason) where reason in ('BASE', 'PURCHASE_50K', 'GOODS_PASS');

-- ── 당첨
create table if not exists fan_banner_winners (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references fan_banner_weeks(id) on delete cascade,
  slot_type text not null check (slot_type in ('ANNIV', 'FREE')),
  application_id uuid not null references fan_banner_applications(id) on delete cascade,
  publish_date date not null,            -- 홈에 게시되는 날
  rank_no smallint not null default 1,   -- 1 = 당첨, 2~ = 미제출 시 넘어갈 다음 순번
  status text not null default 'PENDING' check (status in ('PENDING', 'ACTIVE', 'SUBMITTED', 'FORFEITED', 'PUBLISHED')),
  created_at timestamptz not null default now(),
  unique (week_id, slot_type, publish_date, rank_no),
  unique (application_id)
);

-- ── 전광판 디자인
create table if not exists fan_banner_designs (
  id uuid primary key default gen_random_uuid(),
  winner_id uuid not null unique references fan_banner_winners(id) on delete cascade,
  design jsonb not null,                 -- 배경 · 사진 배치 · 폰트 · 글자색 · 정렬 · 위치(%) · 문구
  background_path text,                  -- Storage fan-banner 경로
  photo_path text,
  review_status text not null default 'DRAFT' check (review_status in ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  reject_reason text,
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fan_banner_designs_status_idx on fan_banner_designs (review_status);

-- ── banners: 전광판 종류 허용 (fan_banner_step1.sql 과 같은 제약, 한 번만 적용)
alter table banners drop constraint if exists banners_banner_type_check;
alter table banners add constraint banners_banner_type_check
  check (banner_type in ('SERVICE_INTRO', 'AD', 'EXHIBITION', 'FAN', 'FAN_ANNIV', 'FAN_FREE', 'FAN_PROMO'));

-- ── 알림 종류 추가 (당첨 · 반려 · 승인)
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('RESTOCK', 'PREORDER_READY', 'OPEN_SOON', 'ORDER_STATUS', 'STORE_NEWS', 'COUPON_EXPIRY',
                  'INQUIRY_ANSWER', 'MARKETING', 'FAN_BANNER'));

-- ── RLS: 쓰기는 서버(service role)만, 본인 행만 읽기
alter table characters enable row level security;
alter table anniversaries enable row level security;
alter table fan_banner_weeks enable row level security;
alter table fan_banner_applications enable row level security;
alter table fan_banner_tickets enable row level security;
alter table fan_banner_winners enable row level security;
alter table fan_banner_designs enable row level security;

create policy characters_read on characters for select using (true);
create policy anniversaries_read on anniversaries for select using (is_active);
create policy fan_weeks_read on fan_banner_weeks for select using (true);
create policy fan_applications_own on fan_banner_applications for select using (user_id = auth.uid());
create policy fan_tickets_own on fan_banner_tickets for select using (user_id = auth.uid());
create policy fan_winners_own on fan_banner_winners for select using (
  exists (select 1 from fan_banner_applications a where a.id = application_id and a.user_id = auth.uid())
);
create policy fan_designs_own on fan_banner_designs for select using (
  exists (select 1 from fan_banner_winners w join fan_banner_applications a on a.id = w.application_id
          where w.id = winner_id and a.user_id = auth.uid())
);
create policy fan_designs_public on fan_banner_designs for select using (review_status = 'APPROVED');

-- ── Storage: 비공개 버킷. 경로는 {user_id}/{winner_id}/{background|photo}.{ext}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fan-banner', 'fan-banner', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy fan_banner_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'fan-banner' and (storage.foldername(name))[1] = auth.uid()::text);
create policy fan_banner_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'fan-banner' and (storage.foldername(name))[1] = auth.uid()::text);
create policy fan_banner_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'fan-banner' and (storage.foldername(name))[1] = auth.uid()::text);
-- 승인된 디자인의 이미지만 누구나 읽을 수 있다
create policy fan_banner_approved_read on storage.objects for select
  using (bucket_id = 'fan-banner' and exists (
    select 1 from fan_banner_designs d
    where d.review_status = 'APPROVED' and name in (d.background_path, d.photo_path)
  ));
