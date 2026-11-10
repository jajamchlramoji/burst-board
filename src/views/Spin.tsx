import { useEffect, useRef, useState } from 'react';
import type { AppState, Ship } from '../../shared/types';

interface Props {
  state: AppState;
  flash: (msg: string | null) => void;
}

type Stage = 'idle' | 'rolling' | 'picked' | 'locked';

const ROLL_MS = 1500;
const FRAME_MS = 85;

export default function Spin({ state, flash }: Props) {
  const active = state.ships.filter((s) => s.status === 'active');
  const [stage, setStage] = useState<Stage>('idle');
  const [spins, setSpins] = useState(0);
  const [display, setDisplay] = useState('');
  const [pick, setPick] = useState<Ship | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearInterval(t));
    },
    [],
  );

  function roll() {
    if (active.length === 0) return;
    setStage('rolling');
    setPick(null);
    const frame = window.setInterval(() => {
      const r = active[Math.floor(Math.random() * active.length)];
      setDisplay(r.title);
    }, FRAME_MS);
    timers.current.push(frame);

    window.setTimeout(() => {
      window.clearInterval(frame);
      const chosen = active[Math.floor(Math.random() * active.length)];
      setPick(chosen);
      setDisplay(chosen.title);
      const used = spins + 1;
      setSpins(used);
      setStage(used >= 2 ? 'locked' : 'picked');
      if (used >= 2) flash('Locked in. That is the one.');
    }, ROLL_MS);
  }

  async function start() {
    if (!pick) return;
    const res = await window.burst.burst.start(pick.id);
    if (!res.ok) flash(res.error);
  }

  function reset() {
    setStage('idle');
    setSpins(0);
    setPick(null);
    setDisplay('');
  }

  if (state.burst) {
    const running = state.ships.find((s) => s.id === state.burst!.shipId);
    return (
      <div className="wrap">
        <h1>Spin</h1>
        <div className="banner info">
          A burst is already running on <strong>{running?.title ?? 'a ship'}</strong>. Finish or end
          it on the Burst tab first.
        </div>
      </div>
    );
  }

  if (active.length === 0) {
    return (
      <div className="wrap">
        <h1>Spin</h1>
        <p className="sub">Nothing to spin yet.</p>
        <div className="empty">
          <strong>No active ships.</strong>
          Shrink an idea first, then come back and let the wheel choose.
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <h1>Spin</h1>
      <p className="sub">
        Stop choosing. {active.length} active {active.length === 1 ? 'ship' : 'ships'} on the wheel.
        You get one re-spin.
      </p>

      <div className="spin-stage">
        <div
          className={`spin-slot ${stage === 'rolling' ? 'rolling' : ''} ${
            stage === 'locked' ? 'locked' : ''
          }`}
        >
          <span className={stage === 'idle' ? '' : 'picked'}>
            {stage === 'idle' ? 'Hit spin' : display}
          </span>
        </div>

        {stage === 'idle' && (
          <button className="btn primary huge" onClick={roll}>
            &#9889; Spin
          </button>
        )}

        {stage === 'rolling' && (
          <button className="btn huge" disabled>
            Spinning...
          </button>
        )}

        {(stage === 'picked' || stage === 'locked') && pick && (
          <>
            <div className="scope-card" style={{ textAlign: 'left', width: '100%', maxWidth: 560 }}>
              <div className="k">What will be live in 2 hours</div>
              <div className="v">{pick.liveIn2h}</div>
              {pick.uglyV1 && (
                <>
                  <div className="k" style={{ marginTop: 14 }}>
                    Ugly v1 is
                  </div>
                  <div className="v small">{pick.uglyV1}</div>
                </>
              )}
            </div>
            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <button className="btn primary huge" onClick={() => void start()}>
                Start the burst
              </button>
              {stage === 'picked' ? (
                <button className="btn big" onClick={roll}>
                  Re-spin (1 left)
                </button>
              ) : (
                <button className="btn big" onClick={reset} title="Clear and start over">
                  Reset wheel
                </button>
              )}
            </div>
            {stage === 'locked' && <p className="hint">No more re-spins. Go build it.</p>}
          </>
        )}
      </div>
    </div>
  );
}
