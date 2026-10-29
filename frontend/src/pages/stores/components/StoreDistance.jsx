const MIN_KM = 1;
const MAX_KM = 100;

// 거리순을 골랐을 때만 보이는 내 위치 반경(km) 슬라이더.
export default function StoreDistance({ radiusKm, onRadiusChange }) {
  return (
    <div className="distance-panel">
      <div className="distance-head">
        <label htmlFor="store-radius">내 주변 반경</label>
        <strong>{radiusKm}km 이내</strong>
      </div>
      <input
        id="store-radius"
        className="distance-slider"
        type="range"
        min={MIN_KM}
        max={MAX_KM}
        step={1}
        value={radiusKm}
        style={{ '--fill': `${((radiusKm - MIN_KM) / (MAX_KM - MIN_KM)) * 100}%` }}
        onChange={(event) => onRadiusChange(Number(event.target.value))}
      />
    </div>
  );
}

