-- 홈 배너 종류 구분 + 팬 응원 전광판(FAN) 배너용 컬럼
-- 이미 Supabase 프로젝트에 migration(banner_types_and_fan_fields)으로 적용되어 있다.
alter table banners
  add column if not exists banner_type text,
  add column if not exists character_name varchar,
  add column if not exists event_date date,
  add column if not exists message text,
  add column if not exists fan_nickname varchar;

update banners set banner_type = case when is_sponsored then 'AD' else 'EXHIBITION' end where banner_type is null;

alter table banners
  alter column banner_type set not null,
  alter column banner_type set default 'EXHIBITION';

alter table banners drop constraint if exists banners_banner_type_check;
alter table banners add constraint banners_banner_type_check
  check (banner_type in ('SERVICE_INTRO', 'AD', 'EXHIBITION', 'FAN'));

comment on column banners.banner_type is 'SERVICE_INTRO 서비스 소개 · AD 판매자 광고 · EXHIBITION 기획전 · FAN 팬 응원 전광판(링크 없음)';
comment on column banners.character_name is 'FAN 배너: 축하 대상 캐릭터명';
comment on column banners.event_date is 'FAN 배너: 기념일(생일 등)';
comment on column banners.message is 'FAN 배너: 응원 문구';
comment on column banners.fan_nickname is 'FAN 배너: 응원한 팬 닉네임';
