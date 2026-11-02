import { useEffect } from 'react';
import { FONTS, PHOTO_BOX, ensureFanFonts } from './fanBoardPresets.js';
import './FanBoard.css';

const CORNERS = ['nw', 'ne', 'sw', 'se'];
const ALL_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

// footnote: 홈 배너에서 문구 아래에 덧붙이는 한 줄(예: 그날 기념일인 최애 수). 꾸미기 화면에서는 쓰지 않는다.
// 팬 응원 전광판 렌더러. 홈 4·5번 배너와 꾸미기 미리보기가 이 컴포넌트 하나로 그려진다.
// 글자 크기는 배너 너비(cqw) 기준이라 어떤 크기에서도 같은 모양이고, 위치(pos)는 배너 기준 %다.
export default function FanBoard({ design, className = '', children, editable = false, selected = null, textPosition, footnote = null, ...rest }) {
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
  // 크기 배율은 줄의 가운데를 기준으로 키우고 줄인다
  const lineProps = (key) => {
    const offset = design.lineOffsets?.[key];
    const scale = design.lineScales?.[key] ?? 1;
    const moved = offset ? `translate(${offset.x}cqw, ${offset.y}cqh)` : '';
    const sized = scale !== 1 ? ` scale(${scale})` : '';
    return {
      'data-fan-line': key,
      className: `fan-board__${key}${editable && selected === key ? ' is-selected' : ''}`,
      style: { transform: `${moved}${sized}`.trim() || undefined, '--line-scale': scale },
    };
  };
  // 선택한 줄·사진에만 네모 점을 보여 준다 (글자는 모서리 4개, 사진은 모서리·가장자리 8개)
  const handles = (key, names) => (editable && selected === key
    ? names.map((name) => <i key={name} className={`fan-handle fan-handle--${name}`} data-fan-handle={name} />)
    : null);

  // 사진 틀은 배너 크기 대비 %라서 어떤 크기에서도 같은 모양이 나온다
  const box = layout !== 'none' ? (design.photoBox ?? PHOTO_BOX[layout]) : null;
  const photoFrame = box
    ? { left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`, right: 'auto', bottom: 'auto' }
    : undefined;

  return (
    <div className={`fan-board ${className}`.trim()} style={background} {...rest}>
      {bg.kind === 'image' ? <i className="fan-board__shade" aria-hidden="true" /> : null}
      {layout !== 'none' ? (
        <div
          className={`fan-board__photo fan-board__photo--${layout}${editable && selected === 'photo' ? ' is-selected' : ''}`}
          data-fan-photo
          style={photoFrame}
        >
          <img src={design.photoUrl} alt="" draggable="false" />
          {handles('photo', ALL_HANDLES)}
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
          ...textPosition,
        }}
      >
        {design.dateLine ? <p {...lineProps('date')}>{design.dateLine}{handles('date', CORNERS)}</p> : null}
        <p {...lineProps('message')}>{design.message}{handles('message', CORNERS)}</p>
        {design.name ? <p {...lineProps('name')}>{design.name}{handles('name', CORNERS)}</p> : null}
        {design.nickname ? <p {...lineProps('from')}>from. {design.nickname}{handles('from', CORNERS)}</p> : null}
        {footnote ? <p className="fan-board__day">{footnote}</p> : null}
      </div>
      {children}
    </div>
  );
}
