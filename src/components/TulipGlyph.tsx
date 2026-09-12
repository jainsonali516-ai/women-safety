export function TulipGlyph({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden="true">
      <path d="M12 2c-3 2-4.5 5.5-3.5 9 .8 2.5 2.5 3.5 3.5 4 1-.5 2.7-1.5 3.5-4 1-3.5-.5-7-3.5-9z" />
      <path d="M12 7c-2.5 1.5-5.5 3-7 6.5-.9 2.1-.15 4.1 1.7 4.8 1.8.7 3.7-.2 5.3-2.3-.8-2.6-.7-6.1 0-9z" />
      <path d="M12 7c2.5 1.5 5.5 3 7 6.5.9 2.1.15 4.1-1.7 4.8-1.8.7-3.7-.2-5.3-2.3.8-2.6.7-6.1 0-9z" />
      <rect x="10.7" y="15" width="2.6" height="8" rx="1.3" />
    </svg>
  );
}
