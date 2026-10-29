// 굿즈 패스 구독 전환 (J-05)
// 담당: 동균
// 요금제·혜택은 GET /memberships/plans 데이터만 보여준다. 데이터에 없는 혜택은 적지 않는다.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { membershipApi } from '../../../api/membership.api.js';

const won = (value) => `${Number(value ?? 0).toLocaleString('ko-KR')}원`;

export default function GoodsPassSheet({ onClose, onSubscribed }) {
  const queryClient = useQueryClient();
  const [agreed, setAgreed] = useState(false);
  const plansQuery = useQuery({ queryKey: ['memberships', 'plans'], queryFn: membershipApi.plans });
  const methodsQuery = useQuery({ queryKey: ['payment-methods'], queryFn: membershipApi.paymentMethods });
  const plans = plansQuery.data?.data.items ?? [];
  const methods = methodsQuery.data?.data.items ?? [];
  const paymentMethod = methods.find((method) => method.is_default) ?? methods[0];
  const preorderPlan = plans.find((plan) => plan.preorder_enabled);

  const subscribeMutation = useMutation({
    mutationFn: () =>
      membershipApi.subscribe({
        planCode: preorderPlan.code,
        paymentMethodId: paymentMethod.id,
        paymentAgreed: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['memberships'] });
      onSubscribed();
    },
  });

  return (
    <div className="wish-dialog-backdrop wish-sheet-backdrop" onClick={subscribeMutation.isPending ? undefined : onClose}>
      <div
        className="wish-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wish-pass-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="wish-pass-title">사전예약은 굿즈 패스 회원 전용이에요</h2>
        <p className="wish-dialog-note">사전예약 권한이 있는 요금제를 구독하면 바로 예약할 수 있어요.</p>
        {plansQuery.isPending ? (
          <p className="wish-dialog-note">요금제를 불러오는 중…</p>
        ) : plansQuery.isError ? (
          <p className="wish-dialog-error">요금제를 불러오지 못했어요.</p>
        ) : (
          <div className="wish-plans">
            {plans.map((plan) => (
              <div key={plan.code} className={`wish-plan${plan.preorder_enabled ? ' is-recommended' : ''}`}>
                {plan.preorder_enabled && <span className="wish-plan-badge">사전예약 가능</span>}
                <p className="wish-plan-name">{plan.name}</p>
                <p className="wish-plan-price">
                  월 <strong>{won(plan.monthly_price)}</strong>
                </p>
                {Array.isArray(plan.benefits) && plan.benefits.length > 0 && (
                  <ul className="wish-plan-benefits">
                    {plan.benefits.map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
        {plansQuery.data?.data.demoOnly && (
          <p className="wish-dialog-note">시연용 결제로 실제 금액이 청구되지 않아요.</p>
        )}
        {preorderPlan && methodsQuery.isSuccess && !paymentMethod && (
          <p className="wish-dialog-error">등록된 결제수단이 없어요. 마이 &gt; 결제수단에서 먼저 등록해 주세요.</p>
        )}
        {preorderPlan && paymentMethod && (
          <label className="wish-pass-agree">
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
            {paymentMethod.provider_name}
            {paymentMethod.last4 ? ` (${paymentMethod.last4})` : ''}로 월 {won(preorderPlan.monthly_price)} 결제에 동의해요
          </label>
        )}
        {subscribeMutation.isError && (
          <p className="wish-dialog-error" role="alert">
            {subscribeMutation.error.message}
          </p>
        )}
        <button
          type="button"
          className="wish-sheet-primary"
          disabled={!preorderPlan || !paymentMethod || !agreed || subscribeMutation.isPending}
          onClick={() => subscribeMutation.mutate()}
        >
          {subscribeMutation.isPending ? '구독 중…' : `${preorderPlan?.name ?? ''} 구독하고 사전예약하기`}
        </button>
        <button type="button" className="wish-sheet-cancel" disabled={subscribeMutation.isPending} onClick={onClose}>
          나중에 할게요
        </button>
      </div>
    </div>
  );
}
