const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const time = (value) => (value ? String(value).slice(0, 5) : null);

export default function StoreBusinessHours({ data }) {
  const hours = [...(data.businessHours || [])].sort((a, b) => a.day_of_week - b.day_of_week);
  return (
    <div className="guide-content">
      <p className="guide-alert">현재 상태: {data.status}</p>
      {data.temporaryClosed && <p>현재 임시 휴무 중입니다.</p>}
      {data.todayHours && (
        <p>
          오늘 영업시간:{' '}
          {data.todayHours.is_closed
            ? '정기 휴무'
            : `${time(data.todayHours.open_time) || '정보 없음'} - ${time(data.todayHours.close_time) || '정보 없음'}`}
        </p>
      )}
      {hours.length ? (
        hours.map((hour) => (
          <div
            className={`guide-line ${hour.day_of_week === data.todayDay ? 'current-day' : ''}`}
            key={hour.id ?? hour.day_of_week}
          >
            <strong>
              {DAYS[hour.day_of_week]}요일{hour.day_of_week === data.todayDay ? ' · 오늘' : ''}
            </strong>
            <span>
              {hour.is_closed
                ? '정기 휴무'
                : time(hour.open_time) && time(hour.close_time)
                  ? `${time(hour.open_time)} - ${time(hour.close_time)}`
                  : '영업시간 정보 없음'}
              {!hour.is_closed && hour.break_start && hour.break_end && (
                <small>
                  브레이크타임 {time(hour.break_start)} - {time(hour.break_end)}
                </small>
              )}
            </span>
          </div>
        ))
      ) : (
        <p>영업시간 정보 없음</p>
      )}
    </div>
  );
}
