export function TulipGlyph({
  className,
  style,
  withStem = false,
}: {
  className?: string;
  style?: React.CSSProperties;
  withStem?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Tulip"
      role="img"
      className={className}
      style={style}
    >
      {withStem && (
        <path
          d="M12 15v13"
          stroke="var(--tulip-stem-color, #22c55e)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
      {/* Soft rounded bulb base */}
      <path
        d="M12 2C8.5 2 6 5.5 6 9c0 4 3 6.5 6 9 3-2.5 6-5 6-9 0-3.5-2.5-7-6-7z"
        fill="currentColor"
      />
      {/* Overlapping side petals for a cute, layered bloom */}
      <path
        d="M12 5c-2.5 1.2-5 3-5.5 6.5-.5 2.5.8 4.5 3 5-1-2.5-1-6 0-9 .8-1 1.6-1.8 2.5-2.5z"
        fill="currentColor"
        opacity="0.85"
      />
      <path
        d="M12 5c2.5 1.2 5 3 5.5 6.5.5 2.5-.8 4.5-3 5 1-2.5 1-6 0-9-.8-1-1.6-1.8-2.5-2.5z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}
