// The runsIT mark: a tiny runsOS window with a prompt. Mirrors src/app/icon.svg.
export function BrandMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="#fffdf7" />
      <path d="M1.5 8.5a7 7 0 0 1 7-7h15a7 7 0 0 1 7 7v3h-29z" fill="#ff5a36" />
      <path d="M1.5 11.25h29" stroke="#1b1a17" strokeWidth="2.5" />
      <path d="M8.5 16.5l5.5 4-5.5 4" fill="none" stroke="#1b1a17" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 24.5h6.5" stroke="#1b1a17" strokeWidth="3" strokeLinecap="round" />
      <rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="none" stroke="#1b1a17" strokeWidth="2.5" />
    </svg>
  );
}
