import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AppState, Settings } from '../shared/types';

const STATE_VERSION = 3;

function defaultSettings(): Settings {
  return {
    theme: 'dark',
    notificationsEnabled: true,
    reminderEnabled: true,
    reminderDay: 0, // Sunday
    reminderTime: '10:00',
    lastReminderDate: null,
    globalHotkeyEnabled: true,
  };
}

/**
 * Forward migrations, oldest first. Every stored file passes through here on
 * the way in, so a board written by any earlier build lands on the current
 * shape instead of arriving with holes in it.
 */
function migrate(raw: Partial<AppState>): Partial<AppState> {
  const from = typeof raw.version === 'number' ? raw.version : 1;
  const out: Partial<AppState> = { ...raw };

  // v1 -> v2: the ship-checkpoint snooze moved out of the view and onto the
  // session, so it survives a tab switch and a restart.
  if (from < 2 && out.burst && out.burst.snoozeUntil === undefined) {
    out.burst = { ...out.burst, snoozeUntil: null };
  }

  // v2 -> v3: added blockedReason to Ship so a parked ship records why it stopped.
  if (from < 3 && Array.isArray(out.ships)) {
    out.ships = (out.ships as unknown as Record<string, unknown>[]).map((s) => ({
      ...s,
      blockedReason: typeof s.blockedReason === 'string' ? s.blockedReason : '',
    })) as unknown as typeof out.ships;
  }

  return out;
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

  /** The data file as it stood at the last good launch. */
  get backupFile(): string {
    return `${this.file}.bak`;
  }

  /** Fill in anything a stored file is missing, without trusting its shape. */
  private hydrate(raw: Partial<AppState>): AppState {
    const parsed = migrate(raw);
    return {
      ...defaultState(),
      ...parsed,
      settings: { ...defaultSettings(), ...(parsed.settings ?? {}) },
      ideas: parsed.ideas ?? [],
      ships: parsed.ships ?? [],
      history: parsed.history ?? [],
      burst: parsed.burst ?? null,
      version: STATE_VERSION,
    };
  }

  /** Parse a state file. Returns null when it is missing or unreadable. */
  private readState(file: string): Partial<AppState> | null {
    try {
      if (!fs.existsSync(file)) return null;
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return parsed as Partial<AppState>;
    } catch (err) {
      console.error(`[burst-board] could not read ${path.basename(file)}:`, err);
      return null;
    }
  }

  /**
   * The ship log is the whole point of the app and it lives in a single file,
   * so keep the last good launch's copy beside it. If the live file ever turns
   * up unreadable, that copy is what we fall back to instead of starting over.
   */
  private writeBackup(): void {
    try {
      fs.copyFileSync(this.file, this.backupFile);
    } catch (err) {
      console.error('[burst-board] could not write the backup:', err);
    }
  }

  /**
   * A file from a newer build can hold fields this one does not know about,
   * and loading it would drop them on the next write. Keep a copy first.
   */
  private guardNewerVersion(parsed: Partial<AppState>): void {
    const v = parsed.version;
    if (typeof v !== 'number' || v <= STATE_VERSION) return;
    const aside = `${this.file}.v${v}`;
    try {
      if (!fs.existsSync(aside)) fs.copyFileSync(this.file, aside);
    } catch {
      /* ignore */
    }
    console.warn(
      `[burst-board] data file is version ${v} but this build understands ${STATE_VERSION}. ` +
        `Kept an untouched copy at ${path.basename(aside)}.`,
    );
  }

  private load(): void {
    if (!fs.existsSync(this.file)) {
      this.state = defaultState();
      this.flush();
      return;
    }

    const live = this.readState(this.file);
    if (live) {
      this.guardNewerVersion(live);
      this.state = this.hydrate(live);
      this.writeBackup();
      return;
    }

    // Unreadable. Keep the evidence, then try the backup before giving up.
    try {
      fs.copyFileSync(this.file, `${this.file}.corrupt-${Date.now()}`);
    } catch {
      /* ignore */
    }

    const backup = this.readState(this.backupFile);
    if (backup) {
      this.state = this.hydrate(backup);
      console.warn('[burst-board] data file was unreadable - recovered from the backup.');
      this.flush();
      return;
    }

    console.error('[burst-board] no readable data file or backup, starting fresh.');
    this.state = defaultState();
    this.flush();
  }

  /** Atomic write via temp file + rename. Debounced. */
  private flush(): void {
    const tmp = `${this.file}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      // Flush to disk before renaming. The rename is atomic, the write behind
      // it is not, so without this a power cut can publish a truncated file.
      const fd = fs.openSync(tmp, 'w');
      try {
        fs.writeFileSync(fd, JSON.stringify(this.state, null, 2), 'utf8');
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
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
