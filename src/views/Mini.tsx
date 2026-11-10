import { BURST_END_MS, PHASE_LABEL, elapsedMs, formatClock, phaseOf } from '../../shared/burst';
import { useAppState, useNow } from '../lib/hooks';

/** The small always-on-top timer window. */
export default function Mini() {
  const state = useAppState();
  const now = useNow(1000);

  if (!state?.burst) {
    return (
      <div className="mini">
        <div className="m-phase">No burst</div>
        <div className="m-clock">0:00:00</div>
      </div>
    );
  }

  const ms = elapsedMs(state.burst, now);
  const ship = state.ships.find((s) => s.id === state.burst!.shipId);
  const paused = Boolean(state.burst.pausedAt);

  return (
    <div className="mini">
      <div className="m-phase">{paused ? 'Paused' : PHASE_LABEL[phaseOf(ms)]}</div>
      <div className="m-clock">{formatClock(ms)}</div>
      <div className="m-ship">{ship?.title ?? ''}</div>
      <div className="m-bar">
        <i style={{ width: `${Math.min(100, (ms / BURST_END_MS) * 100)}%` }} />
      </div>
    </div>
  );
}
