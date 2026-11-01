-- 응원 12단계: 홈 4번 기념일 전광판을 누르면 열리는 "오늘 기념일인 최애 모아보기" 화면.
--  · birthday_congrats  : 생일 축하 한마디 (최대 50자, 금칙어는 숨김 처리)
--  · congrats_likes     : 축하하기 하트 (1인 1최애 1회, 다시 누르면 취소)
--  · congrats_like_seeds: 목업용 기본 축하 수 (실제 하트 수와 합산)
--  · fan_day_board      : 그날 기념일인 최애 · 응원 순위 · 대표 응원 한마디 · 축하 수를 한 번에 돌려준다
--  · fan_day_like_toggle / fan_day_congrats_add : 로그인한 사용자의 축하하기 · 축하 한마디 (무료)
-- 쓰기는 서버(service role)만 한다. fan_cheer_step3b.sql · fan_banner_step3.sql 실행 후 한 번 실행한다(여러 번 실행해도 안전).

-- ── 테이블
create table if not exists birthday_congrats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  event_date date not null,
  character_id uuid not null references characters(id) on delete cascade,
  message varchar(50) not null check (char_length(btrim(message)) between 1 and 50),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists birthday_congrats_day_idx on birthday_congrats (event_date, created_at desc) where not is_hidden;
create index if not exists birthday_congrats_user_day_idx on birthday_congrats (user_id, event_date);

create table if not exists congrats_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  event_date date not null,
  character_id uuid not null references characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, event_date, character_id)
);
create index if not exists congrats_likes_day_idx on congrats_likes (event_date, character_id);

create table if not exists congrats_like_seeds (
  event_date date not null,
  character_id uuid not null references characters(id) on delete cascade,
  like_count integer not null default 0 check (like_count >= 0),
  primary key (event_date, character_id)
);

alter table birthday_congrats enable row level security;
alter table congrats_likes enable row level security;
alter table congrats_like_seeds enable row level security;
revoke all on table birthday_congrats, congrats_likes, congrats_like_seeds from anon, authenticated;

-- ── 그날의 기념일 모아보기
-- 응원 순위·응원 수는 cheer_results(기념일 슬롯)에서 읽고, 정산 전이라 결과가 없으면 cheers 합계로 대신한다.
-- 순위에 오른 최애는 rank 순서로, 응원에 참여하지 않았지만 그날 기념일인 최애는 participants 가 아닌 others 로 나눠 준다.
create or replace function fan_day_board(p_date date, p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_slot fan_banner_slots;
  v_has_results boolean;
  v_ranked jsonb;
  v_others jsonb;
  v_total integer;
  v_birthday_only boolean;
  v_winner uuid;
  v_design_user uuid;
begin
  select count(*), coalesce(bool_and(kind = 'BIRTHDAY'), true)
    into v_total, v_birthday_only
    from anniversaries where event_date = p_date and is_active;

  -- 같은 날짜 슬롯이 여러 주에 있을 수 있어, 확정된 것을 우선해 가장 최근 것을 쓴다
  select * into v_slot from fan_banner_slots
   where slot_type = 'ANNIV' and publish_date = p_date
   order by (status in ('DECIDED', 'PUBLISHED')) desc, created_at desc
   limit 1;

  select exists (select 1 from cheer_results where slot_id = v_slot.id) into v_has_results;
  v_winner := v_slot.winner_character_id;

  -- 꾸미기 권한을 가진 팬(1위 최애의 전광판 주인)
  select d.user_id into v_design_user from fan_banner_designs d
   where d.slot_id = v_slot.id and d.authority = 'ACTIVE' limit 1;

  select coalesce(jsonb_agg(item order by (item->>'rank')::int), '[]'::jsonb) into v_ranked
  from (
    select jsonb_build_object(
      'rank', t.rank_no,
      'characterId', ch.id,
      'name', ch.name,
      'workTitle', ch.work_title,
      'imageUrl', ch.profile_image_url,
      'cheerCount', t.total,
      'isWinner', (v_winner is not null and ch.id = v_winner) or (v_winner is null and t.rank_no = 1),
      'kind', (select a.kind from anniversaries a where a.character_id = ch.id and a.event_date = p_date and a.is_active limit 1),
      -- 가장 많이 응원한 팬의 가장 최근 응원 한마디 (1위는 꾸미기 권한 팬 우선). 한마디가 비었으면 생략한다
      'cheerMessage', (
        select c.message from cheers c
         where c.slot_id = v_slot.id and c.character_id = ch.id and btrim(c.message) <> ''
         order by coalesce(c.user_id = v_design_user and t.rank_no = 1, false) desc,
                  (select sum(c2.cheer_count) from cheers c2 where c2.slot_id = v_slot.id and c2.character_id = ch.id and c2.user_id = c.user_id) desc,
                  c.seq desc
         limit 1
      ),
      'cheerNickname', (
        select c.nickname from cheers c
         where c.slot_id = v_slot.id and c.character_id = ch.id and btrim(c.message) <> ''
         order by coalesce(c.user_id = v_design_user and t.rank_no = 1, false) desc,
                  (select sum(c2.cheer_count) from cheers c2 where c2.slot_id = v_slot.id and c2.character_id = ch.id and c2.user_id = c.user_id) desc,
                  c.seq desc
         limit 1
      ),
      'likeCount', coalesce((select s.like_count from congrats_like_seeds s where s.event_date = p_date and s.character_id = ch.id), 0)
                   + (select count(*) from congrats_likes l where l.event_date = p_date and l.character_id = ch.id),
      'liked', p_user is not null and exists (select 1 from congrats_likes l where l.event_date = p_date and l.character_id = ch.id and l.user_id = p_user)
    ) as item
    from (
      select r.character_id, r.rank_no::int as rank_no, r.cheer_count::int as total
        from cheer_results r
       where v_has_results and r.slot_id = v_slot.id
      union all
      select x.character_id,
             (row_number() over (order by x.total desc, x.last_seq asc))::int,
             x.total::int
        from (
          select c.character_id, sum(c.cheer_count) as total, max(c.seq) as last_seq
            from cheers c where not v_has_results and c.slot_id = v_slot.id group by c.character_id
        ) x
    ) t
    join characters ch on ch.id = t.character_id
  ) ranked;

  select coalesce(jsonb_agg(item order by item->>'name'), '[]'::jsonb) into v_others
  from (
    select distinct on (ch.id) jsonb_build_object(
      'characterId', ch.id,
      'name', ch.name,
      'workTitle', ch.work_title,
      'imageUrl', ch.profile_image_url,
      'kind', a.kind,
      'likeCount', coalesce((select s.like_count from congrats_like_seeds s where s.event_date = p_date and s.character_id = ch.id), 0)
                   + (select count(*) from congrats_likes l where l.event_date = p_date and l.character_id = ch.id),
      'liked', p_user is not null and exists (select 1 from congrats_likes l where l.event_date = p_date and l.character_id = ch.id and l.user_id = p_user)
    ) as item
    from anniversaries a
    join characters ch on ch.id = a.character_id
   where a.event_date = p_date and a.is_active
     and not exists (select 1 from jsonb_array_elements(v_ranked) e where (e->>'characterId')::uuid = ch.id)
  ) o;

  return jsonb_build_object(
    'date', p_date,
    'total', v_total,
    'birthdayOnly', v_birthday_only,
    'ranked', v_ranked,
    'others', v_others,
    'congrats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', bc.id, 'characterId', bc.character_id, 'characterName', ch.name,
        'message', bc.message, 'nickname', coalesce(u.nickname, '팬'), 'createdAt', bc.created_at,
        'mine', p_user is not null and bc.user_id = p_user
      ) order by bc.created_at desc)
      from (
        select * from birthday_congrats
         where event_date = p_date and (not is_hidden or user_id = p_user)
         order by created_at desc limit 30
      ) bc
      join characters ch on ch.id = bc.character_id
      left join users u on u.id = bc.user_id
    ), '[]'::jsonb)
  );
end;
$$;

-- ── 축하하기 하트: 누르면 켜지고, 다시 누르면 꺼진다
create or replace function fan_day_like_toggle(p_user uuid, p_date date, p_character uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_liked boolean;
begin
  if not exists (select 1 from anniversaries where event_date = p_date and character_id = p_character and is_active) then
    raise exception 'FAN_DAY_CHARACTER_NOT_FOUND';
  end if;
  delete from congrats_likes where user_id = p_user and event_date = p_date and character_id = p_character;
  if found then
    v_liked := false;
  else
    insert into congrats_likes (user_id, event_date, character_id) values (p_user, p_date, p_character)
    on conflict do nothing;
    v_liked := true;
  end if;
  return jsonb_build_object(
    'liked', v_liked,
    'likeCount', coalesce((select like_count from congrats_like_seeds where event_date = p_date and character_id = p_character), 0)
                 + (select count(*) from congrats_likes where event_date = p_date and character_id = p_character)
  );
end;
$$;

-- ── 생일 축하 한마디: 무료, 하루 최대 5개. 금칙어가 들어 있으면 저장하되 숨김 처리한다
create or replace function fan_day_congrats_add(p_user uuid, p_date date, p_character uuid, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text := btrim(coalesce(p_message, ''));
  v_hidden boolean;
  v_id uuid;
begin
  if char_length(v_message) not between 1 and 50 then raise exception 'FAN_DAY_INVALID_MESSAGE'; end if;
  if not exists (select 1 from anniversaries where event_date = p_date and character_id = p_character and is_active) then
    raise exception 'FAN_DAY_CHARACTER_NOT_FOUND';
  end if;
  if (select count(*) from birthday_congrats where user_id = p_user and event_date = p_date) >= 5 then
    raise exception 'FAN_DAY_CONGRATS_LIMIT';
  end if;
  v_hidden := fan_has_banned_word(v_message);
  insert into birthday_congrats (user_id, event_date, character_id, message, is_hidden)
  values (p_user, p_date, p_character, v_message, v_hidden)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'hidden', v_hidden);
end;
$$;

-- ── 내가 쓴 축하 한마디 수정. 수정한 문구도 금칙어를 다시 검사한다.
create or replace function fan_day_congrats_update(p_user uuid, p_date date, p_congrats uuid, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text := btrim(coalesce(p_message, ''));
  v_hidden boolean;
begin
  if char_length(v_message) not between 1 and 50 then raise exception 'FAN_DAY_INVALID_MESSAGE'; end if;
  v_hidden := fan_has_banned_word(v_message);

  update birthday_congrats
     set message = v_message, is_hidden = v_hidden
   where id = p_congrats and user_id = p_user and event_date = p_date;
  if not found then raise exception 'FAN_DAY_CONGRATS_NOT_FOUND'; end if;

  return jsonb_build_object('id', p_congrats, 'hidden', v_hidden);
end;
$$;

-- ── 내가 쓴 축하 한마디 삭제
create or replace function fan_day_congrats_delete(p_user uuid, p_date date, p_congrats uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from birthday_congrats where id = p_congrats and user_id = p_user and event_date = p_date;
  if not found then raise exception 'FAN_DAY_CONGRATS_NOT_FOUND'; end if;
  return jsonb_build_object('id', p_congrats, 'deleted', true);
end;
$$;

revoke execute on function fan_day_board, fan_day_like_toggle, fan_day_congrats_add,
  fan_day_congrats_update, fan_day_congrats_delete from public, anon, authenticated;
