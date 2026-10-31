import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DetailSection, DetailShell } from '../home/BannerDetailParts.jsx';
import FanBoard from './FanBoard.jsx';
import FanColorPanel from './FanColorPanel.jsx';
import useBoardDrag from './useBoardDrag.js';
import {
  ANNIVERSARY_KINDS,
  FONTS,
  GRADIENT_PRESETS,
  MESSAGE_MAX_LENGTH,
  TEXT_COLORS,
  defaultDesign,
} from './fanBoardPresets.js';
import { defaultPosFor, fillYears, initialMessage, mergeDesign, messageTabs, toPayload } from './fanDesignUtils.js';
import './FanCheer.css';
import './FanDesign.css';

const AUTOSAVE_MS = 1000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const LAYOUTS = [
  ['left', '왼쪽'],
  ['right', '오른쪽'],
  ['fill', '꽉 채우기'],
  ['none', '사진 없이'],
];
const ALIGNS = [
  ['left', '왼쪽'],
  ['center', '가운데'],
  ['right', '오른쪽'],
];

const formatDue = (value) => new Date(value).toLocaleString('ko-KR', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

// 전광판 꾸미기 화면 (/fan/design/:designId). 기념일/자유 응원은 data.slotType 으로 나뉜다.
// 서버에서 받은 디자인을 화면 상태로 바꾼다 (이미지 서명 URL 포함)
function initialDesign(data) {
  const merged = mergeDesign(data.slotType, data.design, data.years, data.anniversaryKind);
  return {
    ...merged,
    bg: data.backgroundUrl ? { ...merged.bg, kind: 'image', url: data.backgroundUrl } : merged.bg,
    photoUrl: data.photoUrl ?? null,
  };
}

// 데이터가 도착하기 전에는 틀만 보여주고, 도착하면 디자인마다 새로 시작하는 편집기를 그린다.
export default function FanDesignPage({ data, ...props }) {
  if (!data) return <DetailShell title="전광판 꾸미기" ready={false} error={props.error} onBack={props.onBack} />;
  return <FanDesignEditor key={data.designId} data={data} {...props} />;
}

function FanDesignEditor({ data, saveState, error, onBack, onSave, onSubmit, onUpload }) {
  const type = data.slotType;
  const kind = data.anniversaryKind;
  const years = data.years;
  const locked = Boolean(data.locked);

  const [design, setDesign] = useState(() => initialDesign(data));
  const [paths, setPaths] = useState(() => ({ background: data.backgroundPath ?? null, photo: data.photoPath ?? null }));
  const [version, setVersion] = useState(0);
  const [palette, setPalette] = useState(null);
  const [tab, setTab] = useState(() => (messageTabs(type, kind).find((item) => item.active) ?? messageTabs(type, kind)[0]).key);
  const latest = useRef({ design, paths });
  const fileInputs = useRef({});

  useEffect(() => { latest.current = { design, paths }; }, [design, paths]);

  // 변경하면 1초 뒤 자동 저장(DRAFT). 드래그 중에는 version 이 바뀌지 않아 손을 뗄 때 한 번만 저장한다.
  useEffect(() => {
    if (version === 0 || locked) return undefined;
    const timer = window.setTimeout(() => {
      const { design: current, paths: currentPaths } = latest.current;
      onSave(toPayload(current), { backgroundPath: currentPaths.background, photoPath: currentPaths.photo });
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback((patch, nextPaths) => {
    setDesign((current) => ({ ...current, ...patch }));
    if (nextPaths) setPaths((current) => ({ ...current, ...nextPaths }));
    setVersion((value) => value + 1);
  }, []);

  const drag = useBoardDrag({
    offsets: design.lineOffsets,
    disabled: locked,
    onMove: (key, offset) => setDesign((current) => ({ ...current, lineOffsets: { ...current.lineOffsets, [key]: offset } })),
    onCommit: (key, offset) => update({ lineOffsets: { ...design.lineOffsets, [key]: offset } }),
  });

  const tabs = useMemo(() => messageTabs(type, kind), [type, kind]);
  const activeTab = tabs.find((item) => item.key === tab) ?? tabs[0];
  const chips = fillYears(activeTab.list, years);

  const [uploadError, setUploadError] = useState('');
  const pickFile = async (event, target) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setUploadError('JPG 또는 PNG 이미지만 올릴 수 있어요.'); return; }
    if (file.size > MAX_IMAGE_BYTES) { setUploadError('이미지는 5MB 이하만 올릴 수 있어요.'); return; }
    setUploadError('');
    try {
      const { path, url } = await onUpload(file, target);
      if (target === 'background') {
        update({ bg: { kind: 'image', presetId: null, colors: design.bg.colors, url } }, { background: path });
      } else {
        // 사진 없이 상태에서 올리면 왼쪽 배치로 자동 변경
        const layout = design.photoLayout === 'none' ? 'left' : design.photoLayout;
        update({
          photoUrl: url,
          photoLayout: layout,
          pos: layout === design.photoLayout ? design.pos : defaultPosFor(layout),
          lineOffsets: layout === design.photoLayout ? design.lineOffsets : {},
        }, { photo: path });
      }
    } catch (uploadFailure) {
      setUploadError(uploadFailure.message || '이미지를 올리지 못했어요.');
    }
  };

  const reset = () => {
    const base = defaultDesign(type);
    setDesign((current) => ({
      ...current,
      ...base,
      dateLine: current.dateLine,
      name: current.name,
      nickname: current.nickname,
      photoUrl: null,
      message: initialMessage(type, kind, years),
      pos: defaultPosFor('none'),
      lineOffsets: {},
    }));
    setPaths({ background: null, photo: null });
    setVersion((value) => value + 1);
  };

  const submit = () => {
    if (window.confirm('검수를 요청할까요? 요청한 뒤에는 수정할 수 없어요.')) {
      onSubmit(toPayload(design), { backgroundPath: paths.background, photoPath: paths.photo });
    }
  };

  // 추천 문구 중에는 16자를 넘는 것(HAPPY ANNIVERSARY)이 있어 자르지 않는다. 직접 입력만 maxLength 로 16자를 지킨다.
  const chooseMessage = (text) => update({ message: text });
  const chooseBgColor = (hex) => update({ bg: { kind: 'color', presetId: null, colors: [hex] } }, { background: null });

  const slotLabel = type === 'ANNIV' ? '기념일 응원 당일 게시' : '자유 응원 하루 게시';
  const saveLabel = { saving: '저장 중...', saved: '자동 저장됨', error: '저장 실패' }[saveState] ?? '';

  return (
    <DetailShell
      title="전광판 꾸미기"
      ready
      onBack={onBack}
      footer={(
        <>
          <button className="bd__btn bd__btn--secondary" type="button" disabled={locked} onClick={reset}>처음으로</button>
          <button className="bd__btn" type="button" disabled={locked || saveState === 'saving'} onClick={submit}>검수 요청하기</button>
        </>
      )}
    >
      <p className="fan-design__badge">
        {locked && data.reviewStatus === 'SUBMITTED' ? '검수 중이에요' : locked && data.reviewStatus === 'APPROVED' ? '승인됐어요' : '축하해요! 우리 최애가 1위예요'}
        {' · '}
        {data.dueAt ? `${formatDue(data.dueAt)}까지 제출` : '토요일 23:59까지 제출'} · {slotLabel}
      </p>
      {data.reviewStatus === 'REJECTED' && data.rejectReason ? (
        <p className="fan-design__reject" role="alert">반려 사유: {data.rejectReason}. 수정해서 다시 제출해 주세요.</p>
      ) : null}

      <div className="fan-design__preview">
        <FanBoard design={design} className={locked ? '' : 'fan-board--edit'} {...drag} />
        <p className="fan-design__hint">
          {locked ? '지금은 수정할 수 없어요' : '글자 줄을 하나씩 끌어서 위치를 옮길 수 있어요'}
          {saveLabel ? <span> · {saveLabel}</span> : null}
        </p>
      </div>

      {error ? <p className="fan-error fan-design__error" role="alert">{error}</p> : null}
      {uploadError ? <p className="fan-error fan-design__error" role="alert">{uploadError}</p> : null}

      <fieldset className="fan-design__fieldset" disabled={locked}>
        <DetailSection title="배경">
          <div className="fan-design__row">
            <button type="button" className="fan-design__btn" onClick={() => fileInputs.current.background?.click()}>이미지 올리기</button>
            <button type="button" className="fan-design__btn" onClick={() => setPalette(palette === 'bg' ? null : 'bg')}>색 팔레트</button>
            <input
              ref={(node) => { fileInputs.current.background = node; }}
              type="file"
              accept="image/jpeg,image/png"
              hidden
              onChange={(event) => pickFile(event, 'background')}
            />
          </div>
          <p className="bd__caption">JPG·PNG, 권장 1760×504. 글자가 잘 보이도록 어두운 막이 자동으로 깔려요.</p>
          <div className="fan-design__presets" role="radiogroup" aria-label="배경 프리셋">
            {GRADIENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={design.bg.presetId === preset.id}
                className={design.bg.presetId === preset.id ? 'is-on' : ''}
                style={{ background: `linear-gradient(115deg, ${preset.colors.join(', ')})` }}
                onClick={() => update({ bg: { kind: 'gradient', presetId: preset.id, colors: preset.colors } }, { background: null })}
              >
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
          {palette === 'bg' ? (
            <FanColorPanel
              title="배경 색"
              value={design.bg.kind === 'color' ? design.bg.colors[0] : '#6F5BE7'}
              onChange={chooseBgColor}
              onClose={() => setPalette(null)}
            />
          ) : null}
        </DetailSection>

        <DetailSection title="최애 사진" description="세로 660×940 이상을 권장해요 (JPG·PNG)">
          <div className="fan-design__row">
            <button type="button" className="fan-design__btn" onClick={() => fileInputs.current.photo?.click()}>사진 올리기</button>
            <input
              ref={(node) => { fileInputs.current.photo = node; }}
              type="file"
              accept="image/jpeg,image/png"
              hidden
              onChange={(event) => pickFile(event, 'photo')}
            />
          </div>
          <div className="fan-design__seg" role="radiogroup" aria-label="사진 배치">
            {LAYOUTS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={design.photoLayout === value}
                className={design.photoLayout === value ? 'is-on' : ''}
                disabled={value !== 'none' && !design.photoUrl}
                onClick={() => update({ photoLayout: value, pos: defaultPosFor(value), lineOffsets: {} })}
              >{label}</button>
            ))}
          </div>
        </DetailSection>

        <DetailSection title="폰트">
          <div className="fan-design__fonts" role="radiogroup" aria-label="폰트">
            {FONTS.map((font) => (
              <button
                key={font.id}
                type="button"
                role="radio"
                aria-checked={design.fontId === font.id}
                className={design.fontId === font.id ? 'is-on' : ''}
                style={{ fontFamily: `${font.family}, sans-serif`, fontWeight: font.weight }}
                onClick={() => update({ fontId: font.id })}
              >{font.name}</button>
            ))}
          </div>
        </DetailSection>

        <DetailSection title="글자 배치">
          <div className="fan-design__seg" role="radiogroup" aria-label="줄 정렬">
            {ALIGNS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={design.align === value}
                className={design.align === value ? 'is-on' : ''}
                onClick={() => update({ align: value })}
              >{label}</button>
            ))}
          </div>
          <button type="button" className="fan-design__btn" onClick={() => update({ pos: defaultPosFor(design.photoLayout), lineOffsets: {} })}>위치 처음으로</button>
          <p className="bd__caption">날짜 줄, 캐릭터 이름, from. 닉네임은 자동으로 붙어서 글자는 바꿀 수 없지만 위치는 옮길 수 있어요.</p>
        </DetailSection>

        <DetailSection title="메인 문구">
          <div className="fan-chips">
            {tabs.map((item) => (
              <button key={item.key} type="button" aria-pressed={item.key === activeTab.key} className={item.key === activeTab.key ? 'is-on' : ''} onClick={() => setTab(item.key)}>
                {ANNIVERSARY_KINDS[item.key]?.label ?? item.key}
              </button>
            ))}
          </div>
          <div className="fan-design__chips">
            {chips.map((text) => (
              <button key={text} type="button" aria-pressed={design.message === text} className={design.message === text ? 'is-on' : ''} onClick={() => chooseMessage(text)}>{text}</button>
            ))}
          </div>
          <label className="fan-field">
            <span>직접 입력 <em>{design.message.length}/{MESSAGE_MAX_LENGTH}</em></span>
            <input
              className="fan-input"
              type="text"
              maxLength={MESSAGE_MAX_LENGTH}
              value={design.message}
              onChange={(event) => chooseMessage(event.target.value)}
            />
          </label>
          <ul className="bd__notice">
            <li>날짜·기념일 표시는 자동으로 붙어요.</li>
            <li>응원하는 말이면 자유롭게 쓸 수 있어요.</li>
            <li>비방·광고·홍보성·응원과 무관한 내용은 반려돼요.</li>
          </ul>
        </DetailSection>

        <DetailSection title="글자색">
          <div className="fan-design__colors">
            {TEXT_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                aria-label={color.name}
                aria-pressed={design.textColor.toUpperCase() === color.value}
                className={design.textColor.toUpperCase() === color.value ? 'is-on' : ''}
                style={{ background: color.value }}
                onClick={() => update({ textColor: color.value })}
              />
            ))}
            <button type="button" className="fan-design__btn" onClick={() => setPalette(palette === 'text' ? null : 'text')}>색 팔레트</button>
          </div>
          {palette === 'text' ? (
            <FanColorPanel title="글자 색" value={design.textColor} onChange={(hex) => update({ textColor: hex })} onClose={() => setPalette(null)} />
          ) : null}
        </DetailSection>
      </fieldset>
    </DetailShell>
  );
}
