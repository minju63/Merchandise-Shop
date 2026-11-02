// 사전예약 흐름: (굿즈 패스 가입 안내) → 예약금 결제 시트. 상품 상세와 같은 시트를 쓴다.
import { useQueryClient } from '@tanstack/react-query';
import GoodsPassSheet from './GoodsPassSheet.jsx';
import PreorderSheet from './PreorderSheet.jsx';

export default function PreorderFlow({ flow, onChange }) {
  const queryClient = useQueryClient();
  if (!flow) return null;
  const cancel = () => {
    flow.reject(Object.assign(new Error('취소'), { cancelled: true }));
    onChange(null);
  };
  if (flow.step === 'pass') {
    return <GoodsPassSheet onClose={cancel} onSubscribed={() => onChange({ ...flow, step: 'preorder' })} />;
  }
  return (
    <PreorderSheet
      item={flow.item}
      onClose={cancel}
      onDone={(result) => {
        flow.resolve(result);
        onChange(null);
        queryClient.invalidateQueries({ queryKey: ['preorders'] });
      }}
      onFail={(error) => {
        if (error.code === 'SUBSCRIPTION_REQUIRED') {
          onChange({ ...flow, step: 'pass' });
          return;
        }
        flow.reject(error);
        onChange(null);
      }}
    />
  );
}
