-- 자유 응원 전광판: 순위 선정 대신 날짜별 유료 게시 (1일 100,000원)
-- · 기념일(생일 등)이 있는 날짜와 이미 팔린 날짜는 살 수 없다.
-- · 연속·나눠서 여러 날짜를 한 번에 결제할 수 있다. 연속된 날짜는 하나의 게시(slot)로 묶는다.
-- · 게시 자리(fan_banner_slots)와 꾸미기(fan_banner_designs)는 기존 흐름을 그대로 쓴다.

create table if not exists fan_billboard_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  character_id uuid not null references characters(id),
  amount integer not null check (amount > 0),
  price_per_day integer not null,
  payment_id uuid references payments(id),
  status text not null default 'PAID' check (status in ('PAID', 'CANCELED')),
  created_at timestamptz not null default now()
);
create index if not exists fan_billboard_bookings_user_idx on fan_billboard_bookings (user_id, created_at desc);

-- 날짜 하나당 한 행: 기본키가 같은 날짜의 중복 판매를 막는다.
create table if not exists fan_billboard_days (
  day date primary key,
  booking_id uuid not null references fan_billboard_bookings(id) on delete cascade,
  slot_id uuid not null references fan_banner_slots(id) on delete cascade
);

alter table fan_billboard_bookings enable row level security;
alter table fan_billboard_days enable row level security;

create or replace function fan_billboard_book(p_user uuid, p_character uuid, p_dates date[], p_payment uuid, p_price integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_dates date[];
  v_day date;
  v_prev date;
  v_start date;
  v_len integer;
  v_runs jsonb := '[]'::jsonb;
  v_out jsonb := '[]'::jsonb;
  v_week fan_banner_weeks;
  v_booking uuid;
  v_slot uuid;
  v_design uuid;
  v_run record;
begin
  select coalesce(array_agg(distinct d order by d), '{}') into v_dates from unnest(p_dates) d;
  if coalesce(array_length(v_dates, 1), 0) not between 1 and 31 then raise exception 'FAN_BILLBOARD_INVALID_DATES'; end if;
  -- 꾸미기 기한이 게시 7일 전이라, 오늘부터 8일 뒤 날짜부터 신청할 수 있다.
  if v_dates[1] < v_today + 8 then raise exception 'FAN_BILLBOARD_PAST_DATE'; end if;
  if not exists (select 1 from characters where id = p_character) then raise exception 'FAN_CHARACTER_NOT_FOUND'; end if;
  if exists (select 1 from anniversaries where is_active and event_date = any (v_dates)) then
    raise exception 'FAN_BILLBOARD_ANNIVERSARY_DATE';
  end if;
  if exists (select 1 from fan_billboard_days where day = any (v_dates))
     or exists (
       select 1 from fan_banner_slots s, unnest(v_dates) d
        where s.slot_type = 'FREE' and s.status in ('DECIDED', 'PUBLISHED')
          and d >= s.publish_date and d < s.publish_date + s.publish_days
     ) then
    raise exception 'FAN_BILLBOARD_DATE_TAKEN';
  end if;

  v_week := ensure_fan_week(now());
  insert into fan_billboard_bookings (user_id, character_id, amount, price_per_day, payment_id)
  values (p_user, p_character, p_price * array_length(v_dates, 1), p_price, p_payment)
  returning id into v_booking;

  -- 연속된 날짜를 한 구간으로 묶는다.
  v_start := null;
  foreach v_day in array v_dates loop
    if v_start is null then
      v_start := v_day; v_len := 1;
    elsif v_day = v_prev + 1 then
      v_len := v_len + 1;
    else
      v_runs := v_runs || jsonb_build_object('start', v_start, 'days', v_len);
      v_start := v_day; v_len := 1;
    end if;
    v_prev := v_day;
  end loop;
  v_runs := v_runs || jsonb_build_object('start', v_start, 'days', v_len);

  for v_run in select (r->>'start')::date as start_date, (r->>'days')::int as days from jsonb_array_elements(v_runs) r loop
    insert into fan_banner_slots (week_id, slot_type, publish_date, publish_days, winner_character_id, status)
    values (v_week.id, 'FREE', v_run.start_date, v_run.days, p_character, 'DECIDED')
    returning id into v_slot;
    -- 게시 7일 전 23:59(KST)까지 꾸미고 검수를 요청한다.
    insert into fan_banner_designs (slot_id, user_id, rank_no, authority, due_at)
    values (v_slot, p_user, 1, 'ACTIVE', ((v_run.start_date - 7)::timestamp + time '23:59') at time zone 'Asia/Seoul')
    returning id into v_design;
    insert into fan_billboard_days (day, booking_id, slot_id)
    select v_run.start_date + g, v_booking, v_slot from generate_series(0, v_run.days - 1) g;
    v_out := v_out || jsonb_build_object('designId', v_design, 'startDate', v_run.start_date, 'days', v_run.days);
  end loop;

  return jsonb_build_object('bookingId', v_booking, 'amount', p_price * array_length(v_dates, 1), 'runs', v_out);
end;
$$;

revoke execute on function fan_billboard_book from public, anon, authenticated;
