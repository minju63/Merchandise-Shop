export default function StorePickupInfo({ data }) {
  if (!data.available)
    return (
      <div className="guide-content">
        <p>현재 픽업을 지원하지 않습니다.</p>
      </div>
    );
  const info = data.info;
  if (!info)
    return (
      <div className="guide-content">
        <p>픽업 안내 정보가 없습니다.</p>
      </div>
    );
  return (
    <div className="guide-content">
      {info.prepare_minutes != null && (
        <div className="guide-line">
          <strong>준비 예상</strong>
          <span>{info.prepare_minutes}분</span>
        </div>
      )}
      {info.hold_hours != null && (
        <div className="guide-line">
          <strong>보관 기간</strong>
          <span>{info.hold_hours}시간</span>
        </div>
      )}
      {info.parking_available != null && (
        <div className="guide-line">
          <strong>주차</strong>
          <span>{info.parking_available ? '가능' : '불가'}</span>
        </div>
      )}
      {info.guide_text && <p>{info.guide_text}</p>}
    </div>
  );
}
