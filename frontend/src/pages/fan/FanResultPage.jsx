import { DetailSection, DetailShell } from '../home/BannerDetailParts.jsx';
import './FanCheer.css';

const SLOT_LABELS = { ANNIV: '기념일 응원', FREE: '자유 응원' };

const formatDate = (value) => {
  const date = new Date(value);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

const formatDue = (value) => new Date(value).toLocaleString('ko-KR', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

// 응원 결과 화면 (/fan/result): 이긴 최애는 축하와 꾸미기, 진 최애는 반환된 적립금을 보여준다.
export default function FanResultPage({ result, error, onBack, onDesign, onCheer, onTickets }) {
  const items = result?.items ?? [];
  const pastWeeks = (result?.pastWeeks ?? []).filter((week) => week.items?.length);

  return (
    <DetailShell
      title="응원 결과"
      ready={Boolean(result) || Boolean(error)}
      error={error && !result ? error : undefined}
      onBack={onBack}
      footer={<button className="bd__btn" type="button" onClick={onCheer}>다시 응원하러 가기</button>}
    >
      {result && !result.settled ? (
        <DetailSection>
          <p className="bd__empty">아직 발표된 결과가 없어요. 결과는 매주 금요일에 알려드려요.</p>
        </DetailSection>
      ) : null}

      {items.length === 0 && result?.settled ? (
        <DetailSection>
          <p className="bd__empty">지난 주에 응원한 기록이 없어요</p>
        </DetailSection>
      ) : null}

      {items.map((item) => renderItem(item, { onDesign, onTickets }))}

      {pastWeeks.map((week) => (
        <div key={week.weekId}>
          <h2 className="fan-result__week">지난 응모{week.weekStart ? ` · ${formatDate(week.weekStart)} 주` : ''}</h2>
          {week.items.map((item) => renderItem(item, { onDesign, onTickets }))}
        </div>
      ))}
    </DetailShell>
  );
}

function renderItem(item, { onDesign, onTickets }) {
  const key = `${item.slotType}-${item.slotId ?? 'week'}-${item.characterId}`;
  const unestablished = item.returnReason === 'NOT_ESTABLISHED';

  return (
    <DetailSection key={key} title={`${SLOT_LABELS[item.slotType]} · ${item.name}`}>
      <p className="fan-result__meta">
        내 응원 {item.myCount}회 · 전체 {item.rank}위 ({item.totalCount}회)
        {item.publishDate ? ` · 게시 ${formatDate(item.publishDate)}${item.publishDays > 1 ? ` (${item.publishDays}일)` : ''}` : ''}
      </p>

      {item.won ? (
        <div className="fan-result fan-result--win">
          <strong>우리 최애가 1위!</strong>
          <p>{item.publishDate ? `${formatDate(item.publishDate)}에 홈 배너에 올라가요.` : '곧 홈 배너에 올라가요.'}</p>
          {item.designId && item.designStatus !== 'APPROVED' ? (
            <>
              <p>가장 많이 응원한 팬이라 전광판을 꾸밀 수 있어요. {item.designDueAt ? `${formatDue(item.designDueAt)}까지 제출해 주세요.` : ''}</p>
              <button className="bd__btn" type="button" onClick={() => onDesign(item.designId)}>전광판 꾸미러 가기</button>
            </>
          ) : null}
        </div>
      ) : (
        <div className="fan-result">
          <strong>{unestablished ? '게시 조건 미달로 배너가 게시되지 않아요' : '아쉽게 순위에 들지 못했어요'}</strong>
          {item.returnCredit > 0 ? (
            <p>
              적립금 {item.returnCredit.toLocaleString('ko-KR')}원이 지급됐어요.{' '}
              <button className="fan-link" type="button" onClick={onTickets}>적립금으로 응원권 사기 ›</button>
            </p>
          ) : (
            <p>무료 응원권으로 한 응원은 반환되지 않아요.</p>
          )}
        </div>
      )}
    </DetailSection>
  );
}
