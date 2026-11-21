const icons = {
  file: (
    <>
      <path d="M8 5H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" />
      <path d="M10 2h6l5 5v10a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
      <path d="M16 2v4a1 1 0 0 0 1 1h4M11 11h7m-7 4h7" />
    </>
  ),
  folder: (
    <>
      <path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 2h9" />
      <path d="M4 20h14a2 2 0 0 0 1.9-1.4L22 11c.2-.7-.3-1.4-1-1.4H8L4.8 19c-.2.6-.5 1-1 1Z" />
    </>
  ),
  reset: <path d="M3 4v6h6M3.6 10a8.5 8.5 0 1 1 1.5 7.2" />,
  rotate: <path d="M20 4v5h-5M4 20v-5h5M20 9a8.5 8.5 0 0 0-15.5-1M4 15a8.5 8.5 0 0 0 15.5 1" />,
  light: <path d="M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19" />,
  fullscreen: <path d="M9 3H3v6m12-6h6v6m0 6v6h-6m-6 0H3v-6" />,
  exitFullscreen: <path d="M3 9h6V3m12 6h-6V3m0 18v-6h6M3 15h6v6" />,
};

export default function IconButton({ icon, label, ...props }) {
  return (
    <button type="button" aria-label={label} title={label} {...props}>
      <svg className="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {icons[icon]}
      </svg>
    </button>
  );
}
