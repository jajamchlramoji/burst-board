import { useRef } from 'react';
import { BURST_END_MS, PHASE_LABEL, elapsedMs, formatClock, phaseOf } from '../../shared/burst';
import { useAppState, useNow } from '../lib/hooks';

/** Movement under this many pixels counts as a click, not a drag. */
const CLICK_SLOP = 4;

/**
 * The small always-on-top timer. The whole card drags, and a click anywhere on
 * it hides the timer and brings the app back. The round button on its corner
 * only hides it.
 */
export default function Mini() {
  const state = useAppState();
  const now = useNow(1000);
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);
  const burst = state?.burst ?? null;
  const ms = burst ? elapsedMs(burst, now) : 0;
  const ship = burst ? state?.ships.find((s) => s.id === burst.shipId) : undefined;
  const label = !burst ? 'No burst' : burst.pausedAt ? 'Paused' : PHASE_LABEL[phaseOf(ms)];

  // Show the app first: hiding the mini timer closes this very window, so
  // anything sent after it never arrives.
  const open = async () => {
    await window.burst.showMain();
    await window.burst.burst.setMini(false);
  };

  return (
    <div className="mini-wrap">
      <div
        className="mini"
        role="button"
        tabIndex={0}
        title="Open Burst Board"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.screenX, y: e.screenY, moved: 0 };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.screenX - d.x;
          const dy = e.screenY - d.y;
          if (dx === 0 && dy === 0) return;
          d.moved += Math.abs(dx) + Math.abs(dy);
          d.x = e.screenX;
          d.y = e.screenY;
          window.burst.moveMini(dx, dy);
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          if (d && d.moved < CLICK_SLOP) void open();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') void open();
        }}
      >
        <span className="m-phase">{label}</span>
        <span className="m-clock">{formatClock(ms)}</span>
        <span className="m-ship">{ship?.title ?? ''}</span>
        <span className="m-bar">
          <i style={{ width: `${Math.min(100, (ms / BURST_END_MS) * 100)}%` }} />
        </span>
      </div>
      <button
        className="m-hide"
        title="Hide mini timer"
        aria-label="Hide mini timer"
        onClick={() => void window.burst.burst.setMini(false)}
      >
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 6h6" />
        </svg>
      </button>
    </div>
  );
}
