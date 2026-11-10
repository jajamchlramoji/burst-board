import { useState } from 'react';
import type { AppState } from '../../shared/types';
import { WHERE_LABELS } from '../../shared/types';
import {
  BURST_END_MS,
  LOG_PROMPT_MS,
  PHASE_HINT,
  PHASE_LABEL,
  PHASE_SEGMENTS,
  SHIP_CHECKPOINT_MS,
  elapsedMs,
  formatClock,
  formatShort,
  phaseOf,
} from '../../shared/burst';
import { useNow } from '../lib/hooks';

interface Props {
  state: AppState;
  flash: (msg: string | null) => void;
  goSpin: () => void;
}

const SNOOZE_MINUTES = 5;

export default function Burst({ state, flash, goSpin }: Props) {
  const now = useNow(1000);
  const burst = state.burst;
  const ship = burst ? state.ships.find((s) => s.id === burst.shipId) : undefined;

  const [urlDraft, setUrlDraft] = useState('');
  const [extraUrl, setExtraUrl] = useState('');
  const [win, setWin] = useState('');
  const [v2, setV2] = useState('');
  const [logFor, setLogFor] = useState<string | null>(null);
  const [endConfirm, setEndConfirm] = useState(false);

  if (!burst || !ship) {
    return (
      <div className="wrap">
        <h1>Burst</h1>
        <p className="sub">No burst running. That is completely fine.</p>
        <div className="empty">
          <strong>Ready when you are.</strong>
          Spin the wheel to pick a ship, then the four-hour burst starts.
          <div className="btn-row" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button className="btn primary big" onClick={goSpin}>
              Go to Spin
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Seed the log fields from whichever ship the burst is on, and only when
  // that ship changes. This used to be an effect keyed on win and v2 as well,
  // which meant any save - including one from the ship log - overwrote what
  // was being typed here. Adjusting state during render is the supported way
  // to reset local state when a prop changes.
  if (logFor !== ship.id) {
    setLogFor(ship.id);
    setWin(ship.win);
    setV2(ship.v2);
  }

  const ms = elapsedMs(burst, now);
  const phase = phaseOf(ms);
  const paused = Boolean(burst.pausedAt);
  const remaining = Math.max(0, BURST_END_MS - ms);
  const checkpointDue = ms >= SHIP_CHECKPOINT_MS && !burst.shipped;
  // Read off the session, so "5 more minutes" survives a tab switch and a
  // restart instead of snapping the modal straight back.
  const snoozedUntil = burst.snoozeUntil ? new Date(burst.snoozeUntil).getTime() : 0;
  const showCheckpoint = checkpointDue && now > snoozedUntil && !paused;
  const logDue = ms >= LOG_PROMPT_MS;

  const shipNow = async (raw: string) => {
    const res = await window.burst.burst.shipNow(raw);
    if (!res.ok) {
      flash(res.error);
      return;
    }
    setUrlDraft('');
    flash('Shipped. That counts, however ugly.');
  };

  const addUrl = async () => {
    const res = await window.burst.ships.addUrl(ship.id, extraUrl);
    if (!res.ok) {
      flash(res.error);
      return;
    }
    setExtraUrl('');
    flash('Added.');
  };

  const saveLog = async () => {
    await window.burst.ships.update(ship.id, { win, v2 });
    await window.burst.burst.ackLogPrompt();
    flash('Logged.');
  };

  const end = async (outcome: 'shipped' | 'parked') => {
    if (win || v2) await window.burst.ships.update(ship.id, { win, v2 });
    const res = await window.burst.burst.end(outcome);
    if (!res.ok) flash(res.error);
    else flash(outcome === 'shipped' ? 'Burst logged. Go rest.' : 'Parked. Nothing lost.');
    setEndConfirm(false);
  };

  return (
    <div className="wrap wide">
      <div className="burst-head">
        <div className="phase-name">{PHASE_LABEL[phase]}</div>
        <div className={`clock ${paused ? 'paused' : ''}`}>{formatClock(ms)}</div>
        <div className="phase-hint">
          {paused ? 'Paused. The clock waits for you.' : PHASE_HINT[phase]}
        </div>
      </div>

      <div className="track">
        {PHASE_SEGMENTS.map((seg) => {
          const span = seg.to - seg.from;
          const done = Math.min(Math.max(ms - seg.from, 0), span);
          return (
            <div
              className="seg"
              key={seg.phase}
              style={{ flexGrow: span }}
              title={PHASE_LABEL[seg.phase]}
            >
              <div className="fill" style={{ width: `${(done / span) * 100}%` }} />
            </div>
          );
        })}
      </div>
      <div className="track-labels">
        <span>0:00 scope</span>
        <span>0:15 build</span>
        <span>2:00 ship</span>
        <span>3:50 log</span>
        <span>4:00</span>
      </div>

      <div className="scope-card">
        <div className="k">{ship.title}</div>
        <div className="v">{ship.liveIn2h}</div>
        {ship.uglyV1 && (
          <>
            <div className="k" style={{ marginTop: 14 }}>
              Ugly v1 is
            </div>
            <div className="v small">{ship.uglyV1}</div>
          </>
        )}
        <div className="meta" style={{ marginTop: 14, fontSize: 12.5, color: 'var(--muted-2)' }}>
          Shipping to {WHERE_LABELS[ship.where]}
          {ship.where === 'other' && ship.whereOther ? `: ${ship.whereOther}` : ''}
          {' · '}
          {formatShort(remaining)} left in the burst
        </div>
      </div>

      <div className="btn-row">
        {paused ? (
          <button className="btn primary big" onClick={() => void window.burst.burst.resume()}>
            Resume
          </button>
        ) : (
          <button className="btn big" onClick={() => void window.burst.burst.pause()}>
            Pause
          </button>
        )}
        <button
          className="btn big"
          onClick={() => void window.burst.burst.setMini(!burst.miniTimer)}
        >
          {burst.miniTimer ? 'Hide mini timer' : 'Mini timer on top'}
        </button>
        {!burst.shipped && ms >= SHIP_CHECKPOINT_MS && (
          <button className="btn primary big" onClick={() => void window.burst.burst.snooze(0)}>
            Ship it now
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button className="btn big ghost" onClick={() => setEndConfirm(true)}>
          End burst
        </button>
      </div>

      {burst.shipped && (
        <>
          <h2>Shipped links</h2>
          <div className="card">
            {ship.urls.length === 0 ? (
              <p className="hint">No links yet.</p>
            ) : (
              <div className="urls" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ship.urls.map((u) => (
                  <div
                    key={u}
                    style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        void window.burst.openExternal(u);
                      }}
                    >
                      {u}
                    </a>
                    <button
                      className="btn sm ghost danger"
                      onClick={() => void window.burst.ships.removeUrl(ship.id, u)}
                    >
                      &#10005;
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="row tight" style={{ marginTop: 14 }}>
              <input
                type="text"
                value={extraUrl}
                placeholder="Add another public URL (reship, tweet, repo...)"
                onChange={(e) => setExtraUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addUrl();
                }}
              />
              <button className="btn" style={{ flex: '0 0 auto' }} onClick={() => void addUrl()}>
                Add
              </button>
            </div>
          </div>
        </>
      )}

      {(logDue || burst.shipped) && (
        <>
          <h2>{logDue ? 'Final 10 minutes: log it' : 'Log it (whenever)'}</h2>
          <div className="card">
            <label className="field">
              <span className="label">One-line win</span>
              <input
                type="text"
                value={win}
                placeholder="What actually went live?"
                onChange={(e) => setWin(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="label">Possible v2</span>
              <input
                type="text"
                value={v2}
                placeholder="One thing you would do next time. Not a promise."
                onChange={(e) => setV2(e.target.value)}
              />
            </label>
            <button className="btn primary" onClick={() => void saveLog()}>
              Save to log
            </button>
          </div>
        </>
      )}

      {showCheckpoint && (
        <div className="modal-back">
          <div className="modal">
            <h3>Ship it now, ugly is fine.</h3>
            <p className="modal-sub">
              Two hours in. Put the ugly version somewhere public and paste the link. Ugly and live
              beats polished and private.
            </p>
            <label className="field">
              <span className="label">
                Public URL <span className="req">*</span>
              </span>
              <input
                type="text"
                autoFocus
                value={urlDraft}
                placeholder="https://github.com/you/thing"
                onChange={(e) => setUrlDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void shipNow(urlDraft);
                }}
              />
            </label>
            <div className="btn-row">
              <button className="btn primary big" onClick={() => void shipNow(urlDraft)}>
                It is live
              </button>
              <button
                className="btn"
                onClick={() => {
                  void window.burst.burst.snooze(SNOOZE_MINUTES);
                  flash('Back in 5 minutes.');
                }}
              >
                5 more minutes
              </button>
              <button className="btn ghost" onClick={() => void end('parked')}>
                Park it instead
              </button>
            </div>
            <p className="hint" style={{ marginTop: 12 }}>
              Parking is a normal outcome. It stays on your board with no penalty.
            </p>
          </div>
        </div>
      )}

      {endConfirm && (
        <div className="modal-back">
          <div className="modal">
            <h3>{burst.shipped ? 'End the burst?' : 'End without shipping?'}</h3>
            <p className="modal-sub">
              {burst.shipped
                ? 'It is already shipped, so this goes in the log as a ship.'
                : 'This goes down as parked. Not failed, not a streak break - just parked.'}
            </p>
            <div className="btn-row">
              <button
                className="btn primary big"
                onClick={() => void end(burst.shipped ? 'shipped' : 'parked')}
              >
                {burst.shipped ? 'End and log the ship' : 'Park it'}
              </button>
              <button className="btn" onClick={() => setEndConfirm(false)}>
                Keep going
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
