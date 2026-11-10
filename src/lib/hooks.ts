import { useEffect, useRef, useState } from 'react';
import type { AppState } from '../../shared/types';

/** Live app state, kept in sync with the main process. */
export function useAppState(): AppState | null {
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    let alive = true;
    void window.burst.getState().then((s) => {
      if (alive) setState(s);
    });
    const off = window.burst.onStateChanged((s) => setState(s));
    return () => {
      alive = false;
      off();
    };
  }, []);

  return state;
}

/** A ticking clock. Returns Date.now() every `ms`. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Transient message, auto-clears. */
export function useFlash(timeout = 3200): [string | null, (msg: string | null) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const show = (m: string | null) => {
    if (timer.current) window.clearTimeout(timer.current);
    setMsg(m);
    if (m) {
      timer.current = window.setTimeout(() => setMsg(null), timeout);
    }
  };

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  return [msg, show];
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
