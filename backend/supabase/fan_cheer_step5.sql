-- 응원 5단계: 전광판 꾸미기 (불러오기 · 임시 저장 · 검수 요청 · 홈 노출)
-- 초안입니다. 원격 Supabase 적용 전 사용자 확인 필요 (아직 적용하지 않음).
--
-- · 꾸미기 권한자(fan_banner_designs.authority = 'ACTIVE')만 불러오고 저장할 수 있다. 쓰기는 서버(service role)만.
-- · 날짜 줄 · 캐릭터명 · from. 닉네임은 저장하지 않고 서버가 응원 데이터에서 만들어 덮어쓴다 (수정 불가).
-- · 저장되는 값은 허용 목록으로 검증한다: 배경 · 사진 배치 · 폰트 · 글자색 · 정렬 · 좌표(0~100%) · 메인 문구(직접 입력은 16자, 추천 문구가 17자까지 있어 서버는 20자까지 허용).
-- · due_at(토 23:59) 이후와 SUBMITTED · APPROVED 상태에서는 저장할 수 없다.
-- · 이미지 경로는 {user_id}/{design_id}/... 형식이어야 한다 (Storage 정책과 같은 규칙).

-- ── 기념일 종류 → 날짜 줄 표기
create or replace function fan_anniversary_tag(p_kind text)
returns text
language sql
immutable
as $$
  select case p_kind
    when 'BIRTHDAY' then 'BIRTHDAY'
    when 'DEBUT' then 'ANNIVERSARY'
    when 'COMEBACK' then 'COMEBACK'
    when 'GOODS' then 'NEW GOODS'
    when 'SEASON' then 'SEASON GREETINGS'
  end;
$$;

-- ── 디자인 + 서버가 만드는 고정 영역을 합친 화면용 JSON (꾸미기 화면과 홈 배너가 같이 쓴다)
create or replace function fan_design_view(p_design uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_design fan_banner_designs;
  v_slot fan_banner_slots;
  v_name text;
  v_anniv anniversaries;
  v_nickname text;
  v_message text;
  v_date_line text;
  v_years integer;
begin
  select * into v_design from fan_banner_designs where id = p_design;
  if not found then return null; end if;
  select * into v_slot from fan_banner_slots where id = v_design.slot_id;
  select name into v_name from characters where id = v_slot.winner_character_id;

  -- 권한자가 이 최애에게 남긴 가장 최근 응원의 한마디 · 닉네임
  select c.nickname, c.message into v_nickname, v_message
    from cheers c
   where c.user_id = v_design.user_id and c.week_id = v_slot.week_id and c.slot_type = v_slot.slot_type
     and c.character_id = v_slot.winner_character_id
     and (v_slot.slot_type = 'FREE' or c.slot_id = v_slot.id)
   order by c.seq desc limit 1;

  if v_slot.slot_type = 'ANNIV' then
    select * into v_anniv from anniversaries where id = v_slot.anniversary_id;
    v_date_line := to_char(v_anniv.event_date, 'YYYY. MM. DD') || ' · ' || fan_anniversary_tag(v_anniv.kind);
    if v_anniv.base_year is not null then v_years := extract(year from v_anniv.event_date)::int - v_anniv.base_year; end if;
  else
    v_date_line := 'TODAY''S FAVE';
  end if;

  return jsonb_build_object(
    'designId', v_design.id,
    'slotType', v_slot.slot_type,
    'publishDate', v_slot.publish_date,
    'publishDays', v_slot.publish_days,
    'anniversaryKind', v_anniv.kind,
    'years', v_years,
    'cheerMessage', v_message,
    'design', v_design.design || jsonb_build_object(
      'type', v_slot.slot_type,
      'dateLine', v_date_line,
      'name', v_name,
      'nickname', coalesce(v_nickname, '')
    ),
    'backgroundPath', v_design.background_path,
    'photoPath', v_design.photo_path
  );
end;
$$;

-- ── 불러오기: 본인에게 권한이 있는 디자인만
create or replace function fan_get_design(p_user uuid, p_design uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_design fan_banner_designs;
begin
  select * into v_design from fan_banner_designs where id = p_design;
  if not found or v_design.user_id <> p_user or v_design.authority <> 'ACTIVE' then
    raise exception 'FAN_DESIGN_FORBIDDEN';
  end if;

  return fan_design_view(p_design) || jsonb_build_object(
    'reviewStatus', v_design.review_status,
    'rejectReason', v_design.reject_reason,
    'dueAt', v_design.due_at,
    'locked', (v_design.due_at is not null and now() > v_design.due_at)
              or v_design.review_status in ('SUBMITTED', 'APPROVED')
  );
end;
$$;

-- ── 임시 저장
create or replace function fan_save_design(p_user uuid, p_design uuid, p_payload jsonb, p_background text, p_photo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_design fan_banner_designs;
  v_prefix text := p_user::text || '/' || p_design::text || '/';
  v_fonts text[] := array['noto', 'blackhan', 'jua', 'gaegu', 'myeongjo', 'dohyeon', 'gowun',
                          'sunflower', 'pen', 'gamja', 'yeonsung', 'dokdo', 'gugi', 'songmyung'];
  v_bg jsonb := p_payload->'bg';
  v_pos jsonb := p_payload->'pos';
  v_message text := btrim(coalesce(p_payload->>'message', ''));
  v_color text;
  v_colors jsonb;
  v_clean jsonb;
begin
  select * into v_design from fan_banner_designs where id = p_design for update;
  if not found or v_design.user_id <> p_user or v_design.authority <> 'ACTIVE' then
    raise exception 'FAN_DESIGN_FORBIDDEN';
  end if;
  if (v_design.due_at is not null and now() > v_design.due_at) or v_design.review_status in ('SUBMITTED', 'APPROVED') then
    raise exception 'FAN_DESIGN_LOCKED';
  end if;

  -- 값 검증 (허용 목록)
  if coalesce(v_bg->>'kind', '') not in ('gradient', 'color', 'image') then raise exception 'FAN_DESIGN_INVALID'; end if;
  v_colors := coalesce(v_bg->'colors', '[]'::jsonb);
  if jsonb_typeof(v_colors) <> 'array' or jsonb_array_length(v_colors) not between 1 and 3 then raise exception 'FAN_DESIGN_INVALID'; end if;
  for v_color in select jsonb_array_elements_text(v_colors) loop
    if v_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'FAN_DESIGN_INVALID'; end if;
  end loop;
  if coalesce(p_payload->>'photoLayout', '') not in ('left', 'right', 'fill', 'none') then raise exception 'FAN_DESIGN_INVALID'; end if;
  if not (p_payload->>'fontId' = any (v_fonts)) then raise exception 'FAN_DESIGN_INVALID'; end if;
  if coalesce(p_payload->>'textColor', '') !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'FAN_DESIGN_INVALID'; end if;
  if coalesce(p_payload->>'align', '') not in ('left', 'center', 'right') then raise exception 'FAN_DESIGN_INVALID'; end if;
  if (v_pos->>'x') is null or (v_pos->>'y') is null
     or (v_pos->>'x')::numeric not between 0 and 100 or (v_pos->>'y')::numeric not between 0 and 100 then
    raise exception 'FAN_DESIGN_INVALID';
  end if;
  if char_length(v_message) not between 1 and 20 then raise exception 'FAN_DESIGN_INVALID_MESSAGE'; end if;
  if fan_has_banned_word(v_message) then raise exception 'FAN_BANNED_WORD'; end if;
  if (p_background is not null and left(p_background, length(v_prefix)) <> v_prefix)
     or (p_photo is not null and left(p_photo, length(v_prefix)) <> v_prefix) then
    raise exception 'FAN_DESIGN_INVALID_PATH';
  end if;

  -- 날짜 줄 · 캐릭터명 · 닉네임은 저장하지 않는다 (서버가 읽을 때 만든다)
  v_clean := jsonb_build_object(
    'bg', jsonb_build_object('kind', v_bg->>'kind', 'presetId', v_bg->>'presetId', 'colors', v_colors),
    'photoLayout', p_payload->>'photoLayout',
    'fontId', p_payload->>'fontId',
    'textColor', p_payload->>'textColor',
    'align', p_payload->>'align',
    'pos', jsonb_build_object('x', (v_pos->>'x')::numeric, 'y', (v_pos->>'y')::numeric),
    'message', v_message
  );

  update fan_banner_designs
     set design = v_clean, background_path = p_background, photo_path = p_photo,
         review_status = 'DRAFT', reject_reason = null, updated_at = now()
   where id = p_design;

  return jsonb_build_object('saved', true, 'reviewStatus', 'DRAFT');
end;
$$;

-- ── 검수 요청
create or replace function fan_submit_design(p_user uuid, p_design uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_design fan_banner_designs;
begin
  select * into v_design from fan_banner_designs where id = p_design for update;
  if not found or v_design.user_id <> p_user or v_design.authority <> 'ACTIVE' then
    raise exception 'FAN_DESIGN_FORBIDDEN';
  end if;
  if (v_design.due_at is not null and now() > v_design.due_at) or v_design.review_status in ('SUBMITTED', 'APPROVED') then
    raise exception 'FAN_DESIGN_LOCKED';
  end if;
  if coalesce(v_design.design->>'message', '') = '' then raise exception 'FAN_DESIGN_EMPTY'; end if;

  update fan_banner_designs
     set review_status = 'SUBMITTED', submitted_at = now(), reject_reason = null, updated_at = now()
   where id = p_design;

  return jsonb_build_object('reviewStatus', 'SUBMITTED');
end;
$$;

-- ── 홈 4·5번 배너: 오늘 게시 중인 승인된 디자인
create or replace function fan_home_boards(p_date date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_date date := coalesce(p_date, (now() at time zone 'Asia/Seoul')::date);
begin
  return coalesce((
    select jsonb_agg(fan_design_view(d.id) order by s.slot_type, s.publish_date)
      from fan_banner_slots s
      join fan_banner_designs d on d.slot_id = s.id and d.review_status = 'APPROVED' and d.authority = 'ACTIVE'
     where s.status in ('DECIDED', 'PUBLISHED')
       and v_date >= s.publish_date and v_date < s.publish_date + s.publish_days
  ), '[]'::jsonb);
end;
$$;

revoke execute on function fan_anniversary_tag, fan_design_view, fan_get_design, fan_save_design,
  fan_submit_design, fan_home_boards from public, anon, authenticated;
