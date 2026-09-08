import type { CSSProperties } from "react";
export function Icon({
  name,
  size = 18,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  const paths: Record<string, React.ReactNode> = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5" />
      </>
    ),
    onboarding: (
      <>
        <path d="M9 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
        <path d="m9 13 3 3 9-9M16 3v6h6" />
      </>
    ),
    access: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
      </>
    ),
    applications: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <path d="M17.5 14v7M14 17.5h7" />
      </>
    ),
    permissions: (
      <>
        <path d="m12 3 8 4v5c0 5-8 9-8 9S4 17 4 12V7l8-4Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    integrations: (
      <>
        <path d="m8 12-2 2a4 4 0 0 0 6 6l3-3a4 4 0 0 0 0-6M16 12l2-2a4 4 0 0 0-6-6L9 7a4 4 0 0 0 0 6m0 2 6-6" />
      </>
    ),
    audit: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    settings: (
      <>
        <path d="m9 3-1 3-3 1v4l-2 1 2 2v4l3 1 1 3h5l1-3 3-1v-4l2-2-2-1V7l-3-1-1-3Z" />
        <circle cx="11.5" cy="12.5" r="3" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    down: <path d="m7 10 5 5 5-5" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    exit: (
      <>
        <path d="M9 3H4v18h5M12 12h10m-4-4 4 4-4 4" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v.1" />
      </>
    ),
    templates: (
      <>
        <rect x="5" y="3" width="15" height="17" rx="2" />
        <path d="M5 7H2v15h14M9 8h7M9 12h7M9 16h4" />
      </>
    ),
    import: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />
      </>
    ),
    building: (
      <>
        <path d="M4 21V5l12-2v18M2 21h20M16 10h4v11M8 8h4M8 12h4M8 16h4" />
      </>
    ),
    alert: (
      <>
        <path d="m12 3 10 18H2L12 3Z" />
        <path d="M12 9v5m0 3v.1" />
      </>
    ),
    spark: <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name] || paths.overview}
    </svg>
  );
}
export function Mark() {
  return (
    <svg
      width="29"
      height="29"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path d="M7 25V7h5l8 12V7h5v18h-5L12 13v12H7Z" fill="currentColor" />
      <circle cx="25" cy="6" r="3" fill="#b4ed86" />
    </svg>
  );
}
