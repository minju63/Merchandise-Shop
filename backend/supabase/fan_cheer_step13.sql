-- 응원 13단계: 응원권 환불을 구매 후 30일 이내로 제한한다.
-- 기존 fan_cheer_step3b.sql을 다시 실행하지 말고, 구축된 DB에는 이 파일만 한 번 실행한다.

insert into fan_settings (key, int_value, description)
values ('cash_refund_days', 30, '구매 응원권 환불 가능 기간(일)')
on conflict (key) do update
  set int_value = excluded.int_value,
      description = excluded.description;

create or replace function cheer_refund_pack(p_user uuid, p_pack uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pack cheer_ticket_packs;
  v_amount integer;
begin
  select * into v_pack
    from cheer_ticket_packs
   where id = p_pack and user_id = p_user
   for update;

  if not found or v_pack.status <> 'ACTIVE' or v_pack.remaining = 0 then
    raise exception 'FAN_PACK_NOT_REFUNDABLE';
  end if;
  if v_pack.created_at < now() - make_interval(days => fan_setting('cash_refund_days')) then
    raise exception 'FAN_PACK_NOT_REFUNDABLE';
  end if;

  v_amount := v_pack.remaining * v_pack.unit_price;

  if v_pack.source = 'CASH' then
    -- 현금 구매분은 묶음에서 한 장도 사용하지 않은 경우에만 결제를 취소한다.
    if v_pack.remaining <> v_pack.quantity then
      raise exception 'FAN_PACK_NOT_REFUNDABLE';
    end if;
    update cheer_ticket_packs
       set remaining = 0, status = 'REFUNDED'
     where id = p_pack;
    return jsonb_build_object(
      'source', 'CASH',
      'amount', v_amount,
      'paymentId', v_pack.payment_id
    );
  end if;

  -- 적립금 구매분은 30일 안에 남아 있는 수량만큼 적립금으로 복원한다.
  update cheer_ticket_packs
     set remaining = 0, status = 'REFUNDED'
   where id = p_pack;
  insert into reward_credit_ledger (user_id, type, amount, expires_at)
  values (
    p_user,
    'TICKET_REFUND',
    v_amount,
    now() + make_interval(days => fan_setting('credit_valid_days'))
  );
  return jsonb_build_object('source', 'CREDIT', 'amount', v_amount);
end;
$$;

revoke execute on function cheer_refund_pack(uuid, uuid) from public, anon, authenticated;
