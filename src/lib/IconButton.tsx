const PATHS = {
  share: (
    <>
      <path d="M12 15V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M6 12v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6" />
    </>
  ),
  edit: (
    <>
      <path d="M15.5 5.5l3 3" />
      <path d="M4.5 19.5l1-4.2L16 4.8a1.6 1.6 0 0 1 2.3 0l.9.9a1.6 1.6 0 0 1 0 2.3L8.7 18.5z" />
    </>
  ),
  delete: (
    <>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
      <path d="M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7" />
      <path d="M10.5 11v5M13.5 11v5" />
    </>
  ),
};

interface Props {
  icon: keyof typeof PATHS;
  /** Shown on hover and read out by screen readers. */
  label: string;
  onClick: () => void;
  tone?: 'accent' | 'danger';
}

export default function IconButton({ icon, label, onClick, tone }: Props) {
  return (
    <button
      className={`icon-action ${tone ?? ''}`}
      aria-label={label}
      data-tip={label}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {PATHS[icon]}
      </svg>
    </button>
  );
}
