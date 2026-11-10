import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AppState, Settings } from '../shared/types';

const STATE_VERSION = 1;

function defaultSettings(): Settings {
  return {
    notificationsEnabled: true,
    reminderEnabled: true,
    reminderDay: 0, // Sunday
    reminderTime: '10:00',
    lastReminderDate: null,
    globalHotkeyEnabled: true,
  };
}

function defaultState(): AppState {
  return {
    version: STATE_VERSION,
    ideas: [],
    ships: [],
    burst: null,
    history: [],
    settings: defaultSettings(),
  };
}

export class Store {
  private state: AppState = defaultState();
  private file: string;
  private writeTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.file = path.join(app.getPath('userData'), 'burst-board-data.json');
    this.load();
  }

  get dataFile(): string {
    return this.file;
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.file)) {
        this.state = defaultState();
        this.flush();
        return;
      }
      const raw = fs.readFileSync(this.file, 'utf8');
      const parsed = JSON.parse(raw) as Partial<AppState>;
      this.state = {
        ...defaultState(),
        ...parsed,
        settings: { ...defaultSettings(), ...(parsed.settings ?? {}) },
        ideas: parsed.ideas ?? [],
        ships: parsed.ships ?? [],
        history: parsed.history ?? [],
        burst: parsed.burst ?? null,
        version: STATE_VERSION,
      };
    } catch (err) {
      // Never lose data silently: keep a copy of the unreadable file.
      try {
        fs.copyFileSync(this.file, `${this.file}.corrupt-${Date.now()}`);
      } catch {
        /* ignore */
      }
      console.error('[burst-board] could not read data file, starting fresh:', err);
      this.state = defaultState();
      this.flush();
    }
  }

  /** Atomic write via temp file + rename. Debounced. */
  private flush(): void {
    const tmp = `${this.file}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('[burst-board] write failed:', err);
    }
  }

  save(): void {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      this.flush();
    }, 120);
  }

  saveNow(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.flush();
  }

  get(): AppState {
    return this.state;
  }

  /** Mutate state, persist, return the new state. */
  update(fn: (s: AppState) => void): AppState {
    fn(this.state);
    this.save();
    return this.state;
  }

  static id(): string {
    return randomUUID();
  }
}
