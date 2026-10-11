const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export const BellIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);

export const CartIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M3 4h2.5l2 11h10l2-8H7" />
    <circle cx="9" cy="19" r="1.2" />
    <circle cx="17" cy="19" r="1.2" />
  </svg>
);

export const SlidersIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </svg>
);

export const ChevronIcon = (props) => (
  <svg {...base} width={18} height={18} {...props}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const UserIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
  </svg>
);

export const BoxIcon = (props) => (
  <svg {...base} {...props}>
    <path d="m3 7.5 9-4.5 9 4.5v9L12 21l-9-4.5v-9Z" />
    <path d="m3 7.5 9 4.5 9-4.5M12 12v9" />
  </svg>
);

export const LockIcon = (props) => (
  <svg {...base} width={16} height={16} {...props}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const StoreIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M4 9 5.5 4h13L20 9M4 9v11h16V9M4 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3" />
  </svg>
);

export const HeartIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
  </svg>
);

export const TicketIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
    <path d="M14 6v12" strokeDasharray="2 2" />
  </svg>
);

export const BagIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M5 7h14l-1 13H6L5 7Z" />
    <path d="M9 7V6a3 3 0 0 1 6 0v1" />
  </svg>
);

export const TruckIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" />
    <circle cx="7" cy="17.5" r="1.5" />
    <circle cx="17" cy="17.5" r="1.5" />
  </svg>
);

export const GiftIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="4" y="9" width="16" height="11" rx="1" />
    <path d="M3 9h18v3H3zM12 9v11M12 9c-3 0-4-4-1.5-4C12 5 12 9 12 9Zm0 0c3 0 4-4 1.5-4C12 5 12 9 12 9Z" />
  </svg>
);

export const PinIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11Z" />
    <circle cx="12" cy="10" r="2.2" />
  </svg>
);

export const CardIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M3 10h18M7 15h3" />
  </svg>
);

export const HeadsetIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <rect x="3" y="14" width="4" height="6" rx="1.5" />
    <rect x="17" y="14" width="4" height="6" rx="1.5" />
  </svg>
);

export const MegaphoneIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M4 10v4h3l8 4V6L7 10H4ZM18 9.5a4 4 0 0 1 0 5" />
  </svg>
);

export const HelpIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" />
  </svg>
);

export const DocIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M7 3h7l4 4v14H7V3Z" />
    <path d="M14 3v4h4M10 12h5M10 16h5" />
  </svg>
);

export const ImageIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="m5 18 5-5 3 3 2-2 4 4" />
  </svg>
);

export const ClockIcon = (props) => (
  <svg {...base} width={16} height={16} {...props}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l2.5 1.5" />
  </svg>
);

export const CheckIcon = (props) => (
  <svg {...base} width={16} height={16} {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const SearchIcon = (props) => (
  <svg {...base} width={20} height={20} {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);

export const CopyIcon = (props) => (
  <svg {...base} width={16} height={16} {...props}>
    <rect x="8" y="8" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </svg>
);

export const ChatIcon = (props) => (
  <svg {...base} width={18} height={18} {...props}>
    <path d="M5 5h14v10H11l-4 4v-4H5V5Z" />
  </svg>
);

export const PhoneIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M6 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5L15 12.5l4 1.5v3a2 2 0 0 1-2 2A13 13 0 0 1 4 6a2 2 0 0 1 2-2Z" />
  </svg>
);

export const BankIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M3 9 12 4l9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />
  </svg>
);

export const WalletIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M4 7a2 2 0 0 1 2-2h11v4M4 7v11a2 2 0 0 0 2 2h13V9H6a2 2 0 0 1-2-2Z" />
    <circle cx="16" cy="14.5" r="1" />
  </svg>
);

export const InfoIcon = (props) => (
  <svg {...base} width={18} height={18} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
