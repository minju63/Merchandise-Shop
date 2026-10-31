-- 팬 응원 전광판 1단계: 홈 배너 종류 확장
-- FAN_ANNIV 기념일 전광판 · FAN_FREE 자유 응원 전광판 · FAN_PROMO 응모 홍보 (링크 컬럼 없이 사용)
-- 기존 FAN 행은 기념일 전광판처럼 그대로 동작한다.
-- 원격 Supabase 적용 전 사용자 확인 필요 (아직 적용하지 않음).
alter table banners drop constraint if exists banners_banner_type_check;
alter table banners add constraint banners_banner_type_check
  check (banner_type in ('SERVICE_INTRO', 'AD', 'EXHIBITION', 'FAN', 'FAN_ANNIV', 'FAN_FREE', 'FAN_PROMO'));

comment on column banners.banner_type is 'SERVICE_INTRO 서비스 소개 · AD 판매자 광고 · EXHIBITION 기획전 · FAN(구) · FAN_ANNIV 기념일 전광판 · FAN_FREE 자유 응원 전광판 · FAN_PROMO 응모 홍보';
