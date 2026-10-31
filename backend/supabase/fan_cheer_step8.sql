-- 응원 8단계: 전광판 꾸미기에서 글자 줄(날짜 · 메인 문구 · 이름 · from.)을 줄마다 따로 옮길 수 있게 한다.
-- 저장 함수에 lineOffsets({ date|message|name|from: {x, y} }, 배너 너비·높이 대비 %)를 허용 목록으로 검증해 담는다.
-- 글자 내용(날짜 줄 · 이름 · 닉네임)은 여전히 저장하지 않고 서버가 만든다. fan_cheer_step5.sql 실행 후 한 번 실행한다.

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
    'lineOffsets', (select coalesce(jsonb_object_agg(k, jsonb_build_object('x', (v_lines->k->>'x')::numeric, 'y', (v_lines->k->>'y')::numeric)), '{}'::jsonb)
                      from jsonb_object_keys(v_lines) as k),
    'message', v_message
  );

  update fan_banner_designs
     set design = v_clean, background_path = p_background, photo_path = p_photo,
         review_status = 'DRAFT', reject_reason = null, updated_at = now()
   where id = p_design;

  return jsonb_build_object('saved', true, 'reviewStatus', 'DRAFT');
end;
$$;
