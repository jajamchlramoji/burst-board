import { useEffect, useRef, useState } from 'react';
import type { AppState, Ship } from '../../shared/types';
import { isTyping, useKeydown } from '../lib/keys';
import { land, primeAudio, tick } from '../lib/sound';

interface Props {
  state: AppState;
  flash: (msg: string | null) => void;
}

type Stage = 'idle' | 'rolling' | 'picked' | 'locked';

const ROW = 76;
const TRAVEL_ROWS = 30;
const ROLL_MS = 3400;
const RESPIN_MS = 2800;

function pickOther(titles: string[], avoid: string): string {
  const others = titles.filter((t) => t !== avoid);
  const pool = others.length > 0 ? others : titles;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * The reel strip, top to bottom. Row 1 starts on the payline and row
 * `TRAVEL_ROWS + 1` (the pick) ends there, with a neighbour above and below
 * so the window always shows three names.
 */
function buildStrip(titles: string[], start: string, chosen: string): string[] {
  const rows = [pickOther(titles, start), start];
  const target = TRAVEL_ROWS + 1;
  while (rows.length < target) {
    let next = pickOther(titles, rows[rows.length - 1]);
    if (rows.length === target - 1 && next === chosen) next = pickOther(titles, chosen);
    rows.push(next);
  }
  rows.push(chosen, pickOther(titles, chosen));
  return rows;
}

/** Wind back, accelerate with motion blur, coast, ease off, overshoot, snap back. */
function reelKeyframes(end: number, reduced: boolean): Keyframe[] {
  if (reduced) return [{ transform: 'translateY(0)' }, { transform: `translateY(${end}px)` }];
  const at = (f: number) => `translateY(${end * f}px)`;
  return [
    { offset: 0, transform: 'translateY(0)', filter: 'blur(0)', easing: 'cubic-bezier(.4,0,.6,1)' },
    { offset: 0.06, transform: `translateY(${ROW * 0.35}px)`, filter: 'blur(0)', easing: 'cubic-bezier(.5,0,1,1)' },
    { offset: 0.2, transform: at(0.15), filter: 'blur(3px)', easing: 'linear' },
    { offset: 0.55, transform: at(0.68), filter: 'blur(3px)', easing: 'cubic-bezier(.3,.5,.4,1)' },
    { offset: 0.9, transform: `translateY(${end - ROW * 0.22}px)`, filter: 'blur(0)', easing: 'cubic-bezier(.3,0,.3,1)' },
    { offset: 1, transform: `translateY(${end}px)`, filter: 'blur(0)' },
  ];
}

export default function Spin({ state, flash }: Props) {
  const active = state.ships.filter((s) => s.status === 'active');
  const titles = active.map((s) => s.title);
  const [stage, setStage] = useState<Stage>('idle');
  const [spins, setSpins] = useState(0);
  const [pick, setPick] = useState<Ship | null>(null);
  const [strip, setStrip] = useState<string[]>([]);
  const [rollId, setRollId] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const anim = useRef<Animation | null>(null);
  const pending = useRef<{ ship: Ship; used: number } | null>(null);
  const startedRoll = useRef(0);

  useEffect(() => () => anim.current?.cancel(), []);

  // Runs once the new strip is on screen, so the reel starts from the row
  // that was already showing.
  useEffect(() => {
    const el = stripRef.current;
    const landing = pending.current;
    if (rollId === 0 || rollId === startedRoll.current || !el || !landing) return;
    startedRoll.current = rollId;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const end = -TRAVEL_ROWS * ROW;
    const a = el.animate(reelKeyframes(end, reduced), {
      duration: reduced ? 500 : landing.used > 1 ? RESPIN_MS : ROLL_MS,
      easing: reduced ? 'ease-out' : 'linear',
      fill: 'forwards',
    });
    anim.current = a;

    // Click once for every name that crosses the payline.
    let row = 0;
    const listen = () => {
      if (a.playState !== 'running') return;
      const y = new DOMMatrix(getComputedStyle(el).transform).m42;
      const now = Math.round(-y / ROW);
      if (now !== row) {
        row = now;
        tick();
      }
      requestAnimationFrame(listen);
    };
    requestAnimationFrame(listen);

    a.onfinish = () => {
      land(landing.used >= 2);
      pending.current = null;
      setPick(landing.ship);
      setStage(landing.used >= 2 ? 'locked' : 'picked');
      if (landing.used >= 2) flash('Locked in. That is the one.');
    };
  }, [rollId, flash]);

  function roll() {
    if (active.length <= 1 || stage === 'rolling' || stage === 'locked') return;
    primeAudio();
    anim.current?.cancel();
    const chosen = active[Math.floor(Math.random() * active.length)];
    const showing = strip.length > 0 ? strip[strip.length - 2] : titles[0];
    const used = spins + 1;
    pending.current = { ship: chosen, used };
    setSpins(used);
    setPick(null);
    setStage('rolling');
    setStrip(buildStrip(titles, showing, chosen.title));
    setRollId((n) => n + 1);
  }

  useKeydown((e) => {
    if (state.burst || document.querySelector('.modal')) return;
    if (e.key === ' ' && !isTyping(e)) {
      e.preventDefault();
      roll();
    } else if (e.key === 'Enter' && e.metaKey && (pick || active.length === 1)) {
      e.preventDefault();
      void start();
    }
  });

  async function start() {
    const target = pick ?? (active.length === 1 ? active[0] : null);
    if (!target) return;
    const res = await window.burst.burst.start(target.id);
    if (!res.ok) flash(res.error);
  }

  function reset() {
    anim.current?.cancel();
    setStage('idle');
    setSpins(0);
    setPick(null);
    setStrip([]);
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

  if (active.length === 1) {
    const only = active[0];
    return (
      <div className="wrap">
        <h1>Spin</h1>
        <p className="sub">Nothing to choose between. One ship on the board.</p>
        <div className="spin-stage">
          <div className="reel landed locked" style={{ ['--row' as string]: `${ROW}px` }}>
            <i className="pointer l" aria-hidden="true" />
            <i className="pointer r" aria-hidden="true" />
            <div className="reel-strip">
              <div className="reel-row" aria-hidden="true" />
              <div className="reel-row win">{only.title}</div>
              <div className="reel-row" aria-hidden="true" />
            </div>
          </div>
          <p className="only-line">Only this one left. Let&rsquo;s go.</p>
          <div className="scope-card" style={{ textAlign: 'left', width: '100%', maxWidth: 560 }}>
            <div className="k">What will be live in 2 hours</div>
            <div className="v">{only.liveIn2h}</div>
            {only.uglyV1 && (
              <>
                <div className="k" style={{ marginTop: 14 }}>
                  Ugly v1 is
                </div>
                <div className="v small">{only.uglyV1}</div>
              </>
            )}
          </div>
          <button className="btn primary huge" onClick={() => void start()}>
            Start the burst
          </button>
        </div>
      </div>
    );
  }

  const rows =
    strip.length > 0
      ? strip
      : [titles[titles.length - 1], titles[0], titles[1 % titles.length]];
  const landed = stage === 'picked' || stage === 'locked';
  const winRow = strip.length > 0 ? strip.length - 2 : -1;

  return (
    <div className="wrap">
      <h1>Spin</h1>
      <p className="sub">
        Stop choosing. {active.length} active {active.length === 1 ? 'ship' : 'ships'} on the wheel.
        You get one re-spin.
      </p>

      <div className="spin-stage">
        <div
          className={`reel ${stage === 'idle' ? 'idle' : ''} ${landed ? 'landed' : ''} ${
            stage === 'locked' ? 'locked' : ''
          }`}
          style={{ ['--row' as string]: `${ROW}px` }}
          aria-live="polite"
        >
          <i className="pointer l" aria-hidden="true" />
          <i className="pointer r" aria-hidden="true" />
          <div className="reel-strip" ref={stripRef}>
            {rows.map((t, i) => (
              <div
                key={`${rollId}-${i}`}
                className={`reel-row ${landed && i === winRow ? 'win' : ''}`}
                aria-hidden={landed && i === winRow ? undefined : true}
              >
                {t}
              </div>
            ))}
          </div>
        </div>

        {stage === 'idle' && (
          <button className="btn primary huge" onClick={roll}>
            Spin
          </button>
        )}

        {stage === 'rolling' && (
          <button className="btn huge" disabled>
            Spinning...
          </button>
        )}

        {landed && pick && (
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
