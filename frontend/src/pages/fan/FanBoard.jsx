import { useEffect } from 'react';
import { FONTS, ensureFanFonts } from './fanBoardPresets.js';
import './FanBoard.css';

// 팬 응원 전광판 렌더러. 홈 4·5번 배너와 꾸미기 미리보기가 이 컴포넌트 하나로 그려진다.
// 글자 크기는 배너 너비(cqw) 기준이라 어떤 크기에서도 같은 모양이고, 위치(pos)는 배너 기준 %다.
export default function FanBoard({ design, className = '', children, ...rest }) {
  useEffect(() => { ensureFanFonts(); }, []);

  const font = FONTS.find((item) => item.id === design.fontId) ?? FONTS[0];
  const bg = design.bg ?? {};
  const background = bg.kind === 'image' && bg.url
    ? { backgroundImage: `url(${bg.url})` }
    : bg.kind === 'color'
      ? { background: bg.colors[0] }
      : { background: `linear-gradient(115deg, ${(bg.colors ?? ['#0B1230', '#3D7BE0']).join(', ')})` };
  const layout = design.photoUrl ? design.photoLayout : 'none';

  // 줄마다 옮긴 만큼(배너 너비·높이 대비 %)을 cqw·cqh 로 밀어 어떤 크기에서도 같은 위치가 나온다
  const lineProps = (key) => {
    const offset = design.lineOffsets?.[key];
    return {
      'data-fan-line': key,
      style: offset ? { transform: `translate(${offset.x}cqw, ${offset.y}cqh)` } : undefined,
    };
  };

  return (
    <div className={`fan-board ${className}`.trim()} style={background} {...rest}>
      {bg.kind === 'image' ? <i className="fan-board__shade" aria-hidden="true" /> : null}
      {layout !== 'none' ? (
        <div className={`fan-board__photo fan-board__photo--${layout}`}>
          <img src={design.photoUrl} alt="" draggable="false" />
        </div>
      ) : null}
      <div
        className="fan-board__text"
        data-fan-text
        style={{
          left: `${design.pos?.x ?? 6}%`,
          top: `${design.pos?.y ?? 50}%`,
          color: design.textColor,
          textAlign: design.align,
          fontFamily: `${font.family}, sans-serif`,
          fontWeight: font.weight,
        }}
      >
        {design.dateLine ? <p className="fan-board__date" {...lineProps('date')}>{design.dateLine}</p> : null}
        <p className="fan-board__message" {...lineProps('message')}>{design.message}</p>
        {design.name ? <p className="fan-board__name" {...lineProps('name')}>{design.name}</p> : null}
        {design.nickname ? <p className="fan-board__from" {...lineProps('from')}>from. {design.nickname}</p> : null}
      </div>
      {children}
    </div>
  );
}
