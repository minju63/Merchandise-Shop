export default function Icon({ name, size = 21, ...props }) {
  const paths = {
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 5 5" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-2 8-2 8h16s-2-1-2-8Z" />
        <path d="M10 20h4" />
      </>
    ),
    cart: (
      <>
        <path d="M2 4h2l2.3 11h12.5l2.2-8H5" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </>
    ),
    back: <path d="m15 4-8 8 8 8" />,
    right: <path d="m9 4 8 8-8 8" />,
    heart: (
      <path d="M20.8 8.2c0 4.4-8.8 10.4-8.8 10.4S3.2 12.6 3.2 8.2a4.7 4.7 0 0 1 8.8-2.2 4.7 4.7 0 0 1 8.8 2.2Z" />
    ),
    chevron: <path d="m6 9 6 6 6-6" />,
    pin: (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l4 2" />
      </>
    ),
    bag: (
      <>
        <path d="M5 9h14l1 12H4L5 9Z" />
        <path d="M9 10V7a3 3 0 0 1 6 0v3" />
      </>
    ),
    truck: (
      <>
        <path d="M2 6h12v11H2zM14 10h4l3 3v4h-7z" />
        <circle cx="6" cy="18" r="1.5" />
        <circle cx="18" cy="18" r="1.5" />
      </>
    ),
    home: <path d="m3 11 9-8 9 8v10h-7v-6h-4v6H3z" />,
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    store: (
      <>
        <path d="M3 10 5 4h14l2 6v11H3V10Z" />
        <path d="M3 10c0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0M9 21v-6h6v6" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="1" />
        <path d="m4 17 5-4 3 2 4-4 5 5" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
