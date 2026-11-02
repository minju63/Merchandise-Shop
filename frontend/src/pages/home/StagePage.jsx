import { DetailShell } from './BannerDetailParts.jsx';
import StageSection from './StageSection.jsx';

// 홈 배너 · 빠른 버튼에서 들어오는 LIVE 최애 스테이지 화면 (/stage): 1~10위 전체와 응원 버튼
export default function StagePage({ onBack, onCheer, onOpenGuide }) {
  return (
    <DetailShell title="최애 스테이지" ready onBack={onBack}>
      <StageSection expanded onCheer={onCheer} onOpenGuide={onOpenGuide} />
    </DetailShell>
  );
}
