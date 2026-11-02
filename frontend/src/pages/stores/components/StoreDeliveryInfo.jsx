const won = (value) => `${Number(value).toLocaleString('ko-KR')}원`;

export default function StoreDeliveryInfo({ data }) {
  if (!data.available)
    return (
      <div className="guide-content">
        <p>현재 배송을 지원하지 않습니다.</p>
      </div>
    );
  const info = data.info;
  if (!info)
    return (
      <div className="guide-content">
        <p>배송 안내 정보가 없습니다.</p>
      </div>
    );
  return (
    <div className="guide-content">
      {info.delivery_fee != null && (
        <div className="guide-line">
          <strong>기본 배송비</strong>
          <span>{won(info.delivery_fee)}</span>
        </div>
      )}
      {info.free_threshold != null && (
        <div className="guide-line">
          <strong>무료배송</strong>
          <span>{won(info.free_threshold)} 이상</span>
        </div>
      )}
      {info.min_order_amount != null && (
        <div className="guide-line">
          <strong>최소 주문</strong>
          <span>{won(info.min_order_amount)}</span>
        </div>
      )}
      {info.estimated_days != null && (
        <div className="guide-line">
          <strong>예상 배송</strong>
          <span>{info.estimated_days}일</span>
        </div>
      )}
      {info.courier_name && (
        <div className="guide-line">
          <strong>배송업체</strong>
          <span>{info.courier_name}</span>
        </div>
      )}
      <div className="guide-line">
        <strong>등록된 배송 지역</strong>
        <span>{data.areas?.length ? data.areas.map((area) => area.regionName).filter(Boolean).join(', ') || '지역 정보가 없습니다.' : '지역 정보가 없습니다.'}</span>
      </div>
      {info.guide_text && <p>{info.guide_text}</p>}
    </div>
  );
}
