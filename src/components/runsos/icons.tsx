// Chunky ink-outlined desktop icons for runsOS.
type IconProps = { className?: string; tone?: string };

export function FolderIcon({ className, tone = "#ffd23f" }: IconProps) {
  return (
    <svg className={className} width="66" height="58" viewBox="0 0 66 58" aria-hidden="true">
      <path d="M3 10a5 5 0 0 1 5-5h16l6 7h28a5 5 0 0 1 5 5v31a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z" fill={tone} stroke="#1b1a17" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M3 20h60" stroke="#1b1a17" strokeWidth="2.5" />
    </svg>
  );
}

export function TextFileIcon({ className }: IconProps) {
  return (
    <svg className={className} width="52" height="62" viewBox="0 0 52 62" aria-hidden="true">
      <path d="M4 4h30l14 14v40H4z" fill="#fffdf7" stroke="#1b1a17" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M34 4v14h14" fill="none" stroke="#1b1a17" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M12 30h26M12 38h26M12 46h16" stroke="#1b1a17" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function PromptFileIcon({ className, tone = "#ffd23f" }: IconProps) {
  return (
    <svg className={className} width="52" height="62" viewBox="0 0 52 62" aria-hidden="true">
      <path d="M4 4h30l14 14v40H4z" fill="#fffdf7" stroke="#1b1a17" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M34 4v14h14z" fill={tone} stroke="#1b1a17" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="10" y="30" width="28" height="18" rx="4" fill={tone} stroke="#1b1a17" strokeWidth="2" />
      <path d="M16 36l4 3-4 3M23 42h8" fill="none" stroke="#1b1a17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}
