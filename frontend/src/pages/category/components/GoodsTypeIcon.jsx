const shapes = {
  '모두 보기': <><rect x="5" y="5" width="12" height="12" rx="3" /><rect x="23" y="5" width="12" height="12" rx="3" /><rect x="5" y="23" width="12" height="12" rx="3" /><rect x="23" y="23" width="12" height="12" rx="3" /></>,
  '포토카드': <><rect x="11" y="5" width="23" height="29" rx="3" transform="rotate(10 22 20)" /><rect x="6" y="7" width="23" height="29" rx="3" fill="#faf7ff" /><circle cx="17.5" cy="17" r="4" /><path d="M11 29c0-7 13-7 13 0M11 32h13" /></>,
  '키링': <><circle cx="20" cy="8" r="5" /><path d="M20 13v7" /><path d="m20 18 4 6 7 2-5 5 1 7-7-3-7 3 1-7-5-5 7-2Z" /></>,
  '피규어': <><circle cx="20" cy="10" r="6" /><path d="M14 17h12l3 10-5 2v6h-8v-6l-5-2ZM14 20l-6 6M26 20l6 6" /><ellipse cx="20" cy="36" rx="13" ry="2" /></>,
  '아크릴 스탠드': <><path d="M12 31V13a8 8 0 0 1 16 0v18Z" /><circle cx="20" cy="14" r="4" /><path d="M15 26c0-8 10-8 10 0M20 31v4" /><ellipse cx="20" cy="35" rx="13" ry="3" /></>,
  '인형': <><circle cx="11" cy="9" r="5" /><circle cx="29" cy="9" r="5" /><circle cx="20" cy="17" r="11" /><ellipse cx="20" cy="31" rx="10" ry="7" /><path d="M16 16h.1M24 16h.1M18 21q2 2 4 0" /></>,
  '캔뱃지': <><circle cx="20" cy="20" r="15" /><circle cx="20" cy="20" r="11" /><path d="m20 11 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" /></>,
  '문구': <><rect x="6" y="6" width="21" height="29" rx="3" /><path d="M11 6v29M15 13h7M15 19h7M15 25h5M29 28l5-20 4 1-5 20-4 5Z" /></>,
  '의류': <path d="m13 6-10 7 5 9 6-3v16h12V19l6 3 5-9-10-7c-2 7-12 7-14 0Z" />,
  '기타 굿즈': <><rect x="5" y="16" width="30" height="7" rx="2" /><path d="M8 23v13h24V23M20 16v20" /><path d="M20 16C4 16 9 1 16 7l4 9c16 0 11-15 4-9Z" /></>,
};

export default function GoodsTypeIcon({ name }) {
  return <svg className="category-goods-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name] || shapes['기타 굿즈']}</svg>;
}
