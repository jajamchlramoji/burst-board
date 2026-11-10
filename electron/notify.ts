import { Notification } from 'electron';
import { Store } from './store';
import { LOG_PROMPT_MS, SHIP_CHECKPOINT_MS, elapsedMs } from '../shared/burst';

export interface NotifyDeps {
  onShipCheckpoint: () => void;
  onLogPrompt: () => void;
  onWeeklyReminder: () => void;
  broadcast: () => void;
}

function notify(title: string, body: string, onClick: () => void): void {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, silent: false });
  n.on('click', onClick);
  n.show();
}

function todayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * One timer drives every scheduled nudge: the 2:00 ship checkpoint, the
 * final-10-minutes log prompt, and the weekly shrink reminder.
 */
export function startScheduler(store: Store, deps: NotifyDeps): () => void {
  const tick = () => {
    const state = store.get();
    const settings = state.settings;

    // --- Burst nudges ---
    const burst = state.burst;
    if (burst && !burst.pausedAt) {
      const ms = elapsedMs(burst);

      if (!burst.firedCheckpoint && !burst.shipped && ms >= SHIP_CHECKPOINT_MS) {
        store.update((s) => {
          if (s.burst) s.burst.firedCheckpoint = true;
        });
        if (settings.notificationsEnabled) {
          notify('Ship it now, ugly is fine.', 'Two hours in. Put it somewhere public and paste the link.', deps.onShipCheckpoint);
        }
        deps.onShipCheckpoint();
        deps.broadcast();
      }

      if (!burst.firedLogPrompt && ms >= LOG_PROMPT_MS) {
        store.update((s) => {
          if (s.burst) s.burst.firedLogPrompt = true;
        });
        if (settings.notificationsEnabled) {
          notify('Final 10 minutes.', 'One line on what went live, one line on a possible v2.', deps.onLogPrompt);
        }
        deps.broadcast();
      }
    }

    // --- Weekly shrink reminder ---
    if (settings.reminderEnabled) {
      const now = new Date();
      const key = todayKey(now);
      const [h, m] = settings.reminderTime.split(':').map((n) => Number(n));
      const due =
        now.getDay() === settings.reminderDay &&
        (now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m));
      if (due && settings.lastReminderDate !== key) {
        store.update((s) => {
          s.settings.lastReminderDate = key;
        });
        notify(
          '15 min: turn 5 inbox ideas into one-burst ships.',
          'No burst needed. Just make five things small enough to ship.',
          deps.onWeeklyReminder,
        );
        deps.broadcast();
      }
    }
  };

  const id = setInterval(tick, 15_000);
  setTimeout(tick, 2_000);
  return () => clearInterval(id);
}
