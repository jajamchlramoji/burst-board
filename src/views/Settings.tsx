import { useEffect, useState } from 'react';
import type { AppState, ThemeChoice } from '../../shared/types';

interface Props {
  state: AppState;
  flash: (msg: string | null) => void;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
];

export default function Settings({ state, flash }: Props) {
  const s = state.settings;
  const [dataFile, setDataFile] = useState('');

  useEffect(() => {
    void window.burst.dataFile().then(setDataFile);
  }, []);

  async function set(patch: Partial<AppState['settings']>, msg?: string) {
    await window.burst.settings.update(patch);
    if (msg) flash(msg);
  }

  return (
    <div className="wrap">
      <h1>Settings</h1>
      <p className="sub">Everything stays on this laptop. No account, no sync, no backend.</p>

      <h2>Appearance</h2>
      <div className="card">
        <label className="field">
          <span className="label">Theme</span>
          <div className="seg-toggle">
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={s.theme === t.id ? 'on' : ''}
                onClick={() => void set({ theme: t.id })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </label>
        <p className="hint">
          System follows macOS. Changes apply straight away, in every window.
        </p>
      </div>

      <h2>Weekly shrink reminder</h2>
      <div className="card">
        <label className="field">
          <span className="label">Remind me to shrink ideas</span>
          <div className="seg-toggle">
            <button
              className={s.reminderEnabled ? 'on' : ''}
              onClick={() => void set({ reminderEnabled: true }, 'Reminder on.')}
            >
              On
            </button>
            <button
              className={!s.reminderEnabled ? 'on' : ''}
              onClick={() => void set({ reminderEnabled: false }, 'Reminder off.')}
            >
              Off
            </button>
          </div>
        </label>

        <div className="row">
          <label className="field">
            <span className="label">Day</span>
            <select
              value={s.reminderDay}
              onChange={(e) => void set({ reminderDay: Number(e.target.value) })}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Time</span>
            <input
              type="time"
              value={s.reminderTime}
              onChange={(e) => void set({ reminderTime: e.target.value })}
            />
          </label>
        </div>
        <p className="hint">
          "15 min: turn 5 inbox ideas into one-burst ships." Fires once on {DAYS[s.reminderDay]} at{' '}
          {s.reminderTime} when the app is open.
        </p>
      </div>

      <h2>Notifications &amp; hotkey</h2>
      <div className="card">
        <label className="field">
          <span className="label">System notifications (ship checkpoint, log prompt)</span>
          <div className="seg-toggle">
            <button
              className={s.notificationsEnabled ? 'on' : ''}
              onClick={() => void set({ notificationsEnabled: true })}
            >
              On
            </button>
            <button
              className={!s.notificationsEnabled ? 'on' : ''}
              onClick={() => void set({ notificationsEnabled: false })}
            >
              Off
            </button>
          </div>
        </label>

        <label className="field">
          <span className="label">Global capture hotkey (&#8984;&#8679;B)</span>
          <div className="seg-toggle">
            <button
              className={s.globalHotkeyEnabled ? 'on' : ''}
              onClick={() => void set({ globalHotkeyEnabled: true }, 'Hotkey registered.')}
            >
              On
            </button>
            <button
              className={!s.globalHotkeyEnabled ? 'on' : ''}
              onClick={() => void set({ globalHotkeyEnabled: false }, 'Hotkey released.')}
            >
              Off
            </button>
          </div>
        </label>
      </div>

      <h2>Your data</h2>
      <div className="card">
        <p className="hint" style={{ marginTop: 0 }}>
          One plain JSON file. Back it up, read it, edit it - it is yours.
        </p>
        <code style={{ fontSize: 12, color: 'var(--muted)', overflowWrap: 'anywhere' }}>
          {dataFile || '...'}
        </code>
      </div>
    </div>
  );
}
