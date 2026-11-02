-- 자유 응원 전광판: 날짜 줄(TODAY'S FAVE)과 from. 닉네임을 직접 쓰게 한다.
-- · 기념일 전광판은 기존처럼 서버가 날짜 줄·닉네임을 만든다.
-- · 자유 응원은 둘 다 디자인에 저장하고, 비어 있으면 검수 요청을 보낼 수 없다.

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
    -- 자유 응원: 직접 쓴 값이 있으면 그대로, 없으면 기본 문구
    v_date_line := case when v_design.design ? 'dateLine' then v_design.design->>'dateLine' else 'TODAY''S FAVE' end;
    if v_design.design ? 'nickname' then v_nickname := v_design.design->>'nickname'; end if;
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
  v_lines jsonb := coalesce(p_payload->'lineOffsets', '{}'::jsonb);
  v_line text;
  v_slot_type text;
  v_date_line text := btrim(coalesce(p_payload->>'dateLine', ''));
  v_nickname text := btrim(coalesce(p_payload->>'nickname', ''));
begin
  select * into v_design from fan_banner_designs where id = p_design for update;
  if not found or v_design.user_id <> p_user or v_design.authority <> 'ACTIVE' then
    raise exception 'FAN_DESIGN_FORBIDDEN';
  end if;
  if (v_design.due_at is not null and now() > v_design.due_at) or v_design.review_status in ('SUBMITTED', 'APPROVED') then
    raise exception 'FAN_DESIGN_LOCKED';
  end if;
  select slot_type into v_slot_type from fan_banner_slots where id = v_design.slot_id;

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
  -- 줄마다 옮긴 거리(배너 너비·높이 대비 %). 허용한 네 줄만, 좌표는 -100~100 안에서 받는다
  if jsonb_typeof(v_lines) <> 'object' then raise exception 'FAN_DESIGN_INVALID'; end if;
  for v_line in select jsonb_object_keys(v_lines) loop
    if v_line not in ('date', 'message', 'name', 'from')
       or jsonb_typeof(v_lines->v_line->'x') <> 'number' or jsonb_typeof(v_lines->v_line->'y') <> 'number'
       or (v_lines->v_line->>'x')::numeric not between -100 and 100
       or (v_lines->v_line->>'y')::numeric not between -100 and 100 then
      raise exception 'FAN_DESIGN_INVALID';
    end if;
  end loop;
  if char_length(v_message) not between 1 and 20 then raise exception 'FAN_DESIGN_INVALID_MESSAGE'; end if;
  if fan_has_banned_word(v_message) then raise exception 'FAN_BANNED_WORD'; end if;
  if v_slot_type = 'FREE' then
    if char_length(v_date_line) > 20 or char_length(v_nickname) > 20 then raise exception 'FAN_DESIGN_INVALID_TEXT'; end if;
    if fan_has_banned_word(v_date_line) or fan_has_banned_word(v_nickname) then raise exception 'FAN_BANNED_WORD'; end if;
  end if;
  if (p_background is not null and left(p_background, length(v_prefix)) <> v_prefix)
     or (p_photo is not null and left(p_photo, length(v_prefix)) <> v_prefix) then
    raise exception 'FAN_DESIGN_INVALID_PATH';
  end if;

  -- 기념일 전광판의 날짜 줄·캐릭터명·닉네임은 저장하지 않는다 (서버가 읽을 때 만든다). 자유 응원은 날짜 줄·닉네임을 저장한다.
  v_clean := jsonb_build_object(
    'bg', jsonb_build_object('kind', v_bg->>'kind', 'presetId', v_bg->>'presetId', 'colors', v_colors),
    'photoLayout', p_payload->>'photoLayout',
    'fontId', p_payload->>'fontId',
    'textColor', p_payload->>'textColor',
    'align', p_payload->>'align',
    'pos', jsonb_build_object('x', (v_pos->>'x')::numeric, 'y', (v_pos->>'y')::numeric),
    'lineOffsets', (select coalesce(jsonb_object_agg(k, jsonb_build_object('x', (v_lines->k->>'x')::numeric, 'y', (v_lines->k->>'y')::numeric)), '{}'::jsonb)
                      from jsonb_object_keys(v_lines) as k),
    'message', v_message
  );
  if v_slot_type = 'FREE' then
    v_clean := v_clean || jsonb_build_object('dateLine', v_date_line, 'nickname', v_nickname);
  end if;

  update fan_banner_designs
     set design = v_clean, background_path = p_background, photo_path = p_photo,
         review_status = 'DRAFT', reject_reason = null, updated_at = now()
   where id = p_design;

  return jsonb_build_object('saved', true, 'reviewStatus', 'DRAFT');
end;
$$;

create or replace function fan_submit_design(p_user uuid, p_design uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_design fan_banner_designs;
  v_slot_type text;
begin
  select * into v_design from fan_banner_designs where id = p_design for update;
  if not found or v_design.user_id <> p_user or v_design.authority <> 'ACTIVE' then
    raise exception 'FAN_DESIGN_FORBIDDEN';
  end if;
  if (v_design.due_at is not null and now() > v_design.due_at) or v_design.review_status in ('SUBMITTED', 'APPROVED') then
    raise exception 'FAN_DESIGN_LOCKED';
  end if;
  if coalesce(v_design.design->>'message', '') = '' then raise exception 'FAN_DESIGN_EMPTY'; end if;
  select slot_type into v_slot_type from fan_banner_slots where id = v_design.slot_id;
  -- 자유 응원은 날짜 줄과 from. 닉네임을 모두 채워야 검수를 요청할 수 있다.
  if v_slot_type = 'FREE'
     and (btrim(coalesce(v_design.design->>'dateLine', '')) = '' or btrim(coalesce(v_design.design->>'nickname', '')) = '') then
    raise exception 'FAN_DESIGN_INCOMPLETE';
  end if;

  update fan_banner_designs
     set review_status = 'SUBMITTED', submitted_at = now(), reject_reason = null, updated_at = now()
   where id = p_design;

  return jsonb_build_object('reviewStatus', 'SUBMITTED');
end;
$$;

revoke execute on function fan_design_view, fan_save_design, fan_submit_design from public, anon, authenticated;
