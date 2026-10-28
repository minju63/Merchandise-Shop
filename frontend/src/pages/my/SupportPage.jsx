import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listFaqs, listInquiries } from './account.api.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { ChatIcon, DocIcon, HeadsetIcon, HelpIcon, MegaphoneIcon, SearchIcon } from './icons.jsx';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './settings.css';
import './support.css';

const faqFetcher = () => listFaqs({ size: 100 });
const inquiryFetcher = () => listInquiries();

function Flag() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 21V4m0 0h11l-2 4 2 4H5" />
    </svg>
  );
}

export default function SupportPage() {
  const navigate = useNavigate();
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const faqs = useRequest(signedIn, 'faqs', faqFetcher);
  const inquiries = useRequest(signedIn, 'my-inquiries', inquiryFetcher);
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [openId, setOpenId] = useState(null);

  const all = faqs.data?.items ?? [];
  const categories = [...new Set(all.map((faq) => faq.category).filter(Boolean))];
  const needle = keyword.trim().toLowerCase();
  const shown = all.filter(
    (faq) =>
      (!category || faq.category === category) &&
      (!needle || `${faq.question} ${faq.answer}`.toLowerCase().includes(needle))
  );
  const answered = (inquiries.data?.items ?? []).filter(
    (item) => item.status === 'ANSWERED'
  ).length;

  const tiles = [
    ['공지사항', <MegaphoneIcon key="n" />, MY_ROUTES.notices],
    ['FAQ', <HelpIcon key="f" />, null],
    ['내 문의', <ChatIcon key="i" />, MY_ROUTES.inquiries],
    ['내 신고', <Flag key="r" />, MY_ROUTES.reports],
    ['약관 및 정책', <DocIcon key="t" />, MY_ROUTES.terms],
    ['1:1 문의', <HeadsetIcon key="c" />, MY_ROUTES.inquiryNew],
  ];

  let list;
  if (faqs.error) list = <ErrorNotice error={faqs.error} onRetry={faqs.reload} />;
  else if (!faqs.data) list = <Loading />;
  else if (shown.length === 0) list = <p className="ord-empty">검색 결과가 없어요</p>;
  else
    list = shown.map((faq) => {
      const open = openId === faq.id;
      return (
        <div key={faq.id} className="sup-faq">
          <button
            type="button"
            className="sup-faq__q"
            onClick={() => setOpenId(open ? null : faq.id)}
          >
            <b>Q</b>
            <span>{faq.question}</span>
          </button>
          {open ? <p className="sup-faq__a">{faq.answer}</p> : null}
        </div>
      );
    });

  return (
    <main className="ord-page ord-page--fab">
      <PageHeader title="고객센터" />
      <label className="sup-search">
        <SearchIcon />
        <input
          value={keyword}
          placeholder="궁금한 내용을 검색해 보세요"
          onChange={(event) => setKeyword(event.target.value)}
        />
      </label>
      <div className="sup-grid">
        {tiles.map(([label, icon, path]) => (
          <button
            key={label}
            type="button"
            className="sup-tile"
            onClick={() =>
              path
                ? navigate(path)
                : document.getElementById('faq-list')?.scrollIntoView({ behavior: 'smooth' })
            }
          >
            {icon}
            <span>{label}</span>
            {label === '내 문의' && answered > 0 ? <small>답변 완료 {answered}</small> : null}
          </button>
        ))}
      </div>
      {categories.length > 0 ? (
        <div className="sup-chips">
          {['', ...categories].map((name) => (
            <button
              key={name || 'all'}
              type="button"
              className={category === name ? 'ord-chip is-active' : 'ord-chip'}
              onClick={() => setCategory(name)}
            >
              {name || '전체'}
            </button>
          ))}
        </div>
      ) : null}
      <h2 className="sup-h" id="faq-list">
        자주 묻는 질문
      </h2>
      {list}
      <p className="sup-hours">운영 시간 평일 10:00 – 18:00 (점심 12:00 – 13:00)</p>
      <footer className="ord-footer">
        <button
          type="button"
          className="ord-btn ord-btn--primary ord-btn--block"
          onClick={() => navigate(MY_ROUTES.inquiryNew)}
        >
          1:1 문의하기
        </button>
      </footer>
    </main>
  );
}
