export function TulipLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Tulip logo"
      role="img"
    >
      <path
        d="M32 6c-6 4-9 11-7 18 1.5 5 5 7 7 8 2-1 5.5-3 7-8 2-7-1-14-7-18z"
        fill="#000000"
      />
      <path
        d="M32 14c-5 3-11 6-14 13-1.8 4.2-.3 8.2 3.4 9.6 3.6 1.4 7.4-.4 10.6-4.6-1.6-5.2-1.4-12.3 0-18z"
        fill="#000000"
      />
      <path
        d="M32 14c5 3 11 6 14 13 1.8 4.2.3 8.2-3.4 9.6-3.6 1.4-7.4-.4-10.6-4.6 1.6-5.2 1.4-12.3 0-18z"
        fill="#000000"
      />
      <rect x="29.5" y="30" width="5" height="24" rx="2.5" fill="#000000" />
      <path
        d="M32 42c-4 0-9 2-10 8 4 1 9-1 10-8z"
        fill="#000000"
      />
      <path
        d="M32 46c4 0 9 2 10 8-4 1-9-1-10-8z"
        fill="#000000"
      />
    </svg>
  );
}
