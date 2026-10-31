import { PALETTE_30, hexToRgb, rgbToHex } from './fanDesignUtils.js';

// 색 팔레트 패널: 30색 스와치 + R·G·B 슬라이더 + 색 코드 + 기기 색상 팔레트
export default function FanColorPanel({ title, value, onChange, onClose }) {
  const rgb = hexToRgb(value);

  return (
    <div className="fan-palette" role="dialog" aria-label={title}>
      <div className="fan-palette__head">
        <strong>{title}</strong>
        <button type="button" aria-label="팔레트 닫기" onClick={onClose}>닫기</button>
      </div>

      <div className="fan-palette__swatches">
        {PALETTE_30.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`색 ${color}`}
            aria-pressed={color.toUpperCase() === value.toUpperCase()}
            style={{ background: color }}
            onClick={() => onChange(color)}
          />
        ))}
      </div>

      {['R', 'G', 'B'].map((channel, index) => (
        <label className="fan-palette__slider" key={channel}>
          <span>{channel}</span>
          <input
            type="range"
            min="0"
            max="255"
            value={rgb[index]}
            onChange={(event) => {
              const next = [...rgb];
              next[index] = Number(event.target.value);
              onChange(rgbToHex(next));
            }}
          />
          <output>{rgb[index]}</output>
        </label>
      ))}

      <div className="fan-palette__code">
        <i style={{ background: value }} aria-hidden="true" />
        <code>{value.toUpperCase()}</code>
        <label className="fan-palette__device">
          기기 색상 팔레트 열기
          <input type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} />
        </label>
      </div>
    </div>
  );
}
