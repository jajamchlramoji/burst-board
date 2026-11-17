import { useEffect, useState } from 'react';

const query = () => window.matchMedia('(prefers-color-scheme: dark)');

/** Sun/moon switch. Shows the mode you would switch to and flips the stored theme. */
export default function ThemeToggle() {
  const [dark, setDark] = useState(() => query().matches);

  useEffect(() => {
    const mq = query();
    const on = () => setDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const label = dark ? 'Light mode' : 'Dark mode';
  return (
    <button
      className={`tab theme-btn ${dark ? 'is-dark' : 'is-light'}`}
      onClick={() => void window.burst.settings.update({ theme: dark ? 'light' : 'dark' })}
      title={label}
      aria-label={label}
    >
      <svg className="sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
      </svg>
      <svg className="moon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
    </button>
  );
}
