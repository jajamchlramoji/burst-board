import { useEffect, useRef, useState } from 'react';
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
import { isTyping, useKeydown } from '../lib/keys';
import { primeAudio, swoosh } from '../lib/sound';
import { confetti } from '../lib/confetti';

const CELEBRATE_MS = 1100;

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
  const [parkReason, setParkReason] = useState('');
  const [shipOpen, setShipOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [sending, setSending] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const liveBtn = useRef<HTMLButtonElement>(null);
  const celebrateTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(celebrateTimer.current), []);

  useKeydown((e) => {
    if (!burst || celebrating) return;
    if (e.key === 's' && e.metaKey) {
      e.preventDefault();
      if (burst.shipped) setEndConfirm(true);
      else if (!endConfirm) setShipOpen(true);
    } else if (e.key === 'Escape') {
      setShipOpen(false);
      if (endConfirm) {
        setEndConfirm(false);
        setParkReason('');
      }
    } else if (e.key === ' ' && !isTyping(e) && !document.querySelector('.modal')) {
      e.preventDefault();
      void (burst.pausedAt ? window.burst.burst.resume() : window.burst.burst.pause());
    }
  });

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
  const showShip =
    celebrating || sending || (!burst.shipped && !endConfirm && (shipOpen || showCheckpoint));
  const logDue = ms >= LOG_PROMPT_MS;

  const shipNow = async (raw: string) => {
    if (celebrating || sending) return;
    primeAudio();
    // Measure now: the shipped state can arrive before this call returns,
    // and the dialog must not vanish under the celebration.
    const from = liveBtn.current?.getBoundingClientRect();
    setSending(true);
    const res = await window.burst.burst.shipNow(raw);
    setSending(false);
    if (!res.ok) {
      flash(res.error);
      return;
    }
    if (from) confetti(from);
    swoosh();
    setCelebrating(true);
    setUrlDraft('');
    celebrateTimer.current = window.setTimeout(() => {
      setCelebrating(false);
      setShipOpen(false);
    }, CELEBRATE_MS);
  };

  const addUrl = async () => {
    const res = await window.burst.ships.addUrl(ship.id, extraUrl);
    if (!res.ok) {
      flash(res.error);
      return;
    }
    setExtraUrl('');
    setAddingLink(false);
  };

  const removeUrl = async (u: string) => {
    const res = await window.burst.ships.removeUrl(ship.id, u);
    if (!res.ok) flash(res.error);
    else if (ship.urls.length === 1) flash('Link removed. Not shipped until a link is back.');
  };

  const hint = paused
    ? 'Paused. The clock waits for you.'
    : burst.shipped && phase !== 'log' && phase !== 'done'
      ? 'Shipped. Polish and reship, or finish whenever you like.'
      : PHASE_HINT[phase];

  const end = async (outcome: 'shipped' | 'parked') => {
    if (outcome === 'parked' && !burst.shipped && !parkReason.trim()) {
      flash('Write why you stopped first — that is the blocker field.');
      return;
    }
    if (win || v2) await window.burst.ships.update(ship.id, { win, v2 });
    const res = await window.burst.burst.end(
      outcome,
      outcome === 'parked' && !burst.shipped ? parkReason : undefined,
    );
    if (!res.ok) flash(res.error);
    else flash(outcome === 'shipped' ? 'Burst logged. Go rest.' : 'Parked. Nothing lost.');
    setEndConfirm(false);
    setParkReason('');
  };

  return (
    <div className="wrap burst">
      <div className="burst-head">
        <div className="phase-name">{PHASE_LABEL[phase]}</div>
        <div className={`clock ${paused ? 'paused' : ''}`}>{formatClock(ms)}</div>
        <div className="phase-hint">{hint}</div>
      </div>

      <div className="track" title={`${formatShort(remaining)} left in the burst`}>
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

      <div className="burst-ship">
        <div className="burst-title">{ship.title}</div>
        <div className="burst-goal">{ship.liveIn2h}</div>
        <div className="burst-meta">
          {WHERE_LABELS[ship.where]}
          {ship.where === 'other' && ship.whereOther ? `: ${ship.whereOther}` : ''}
          {' · '}
          {formatShort(remaining)} left
        </div>

        {burst.shipped && (
          <div className="link-chips">
            {ship.urls.map((u) => (
              <span className="link-chip" key={u}>
                <a
                  href="#"
                  title={u}
                  onClick={(e) => {
                    e.preventDefault();
                    void window.burst.openExternal(u);
                  }}
                >
                  {u.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
                <button aria-label={`Remove ${u}`} title="Remove link" onClick={() => void removeUrl(u)}>
                  &#10005;
                </button>
              </span>
            ))}
            {addingLink ? (
              <input
                className="link-add"
                type="text"
                autoFocus
                value={extraUrl}
                aria-label="Another public link"
                placeholder="https://… then Enter"
                onChange={(e) => setExtraUrl(e.target.value)}
                onBlur={() => !extraUrl && setAddingLink(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addUrl();
                  if (e.key === 'Escape') {
                    setExtraUrl('');
                    setAddingLink(false);
                  }
                }}
              />
            ) : (
              <button className="link-chip add" onClick={() => setAddingLink(true)}>
                + Add link
              </button>
            )}
          </div>
        )}
      </div>

      <div className="burst-actions">
        <div className="btn-row">
          <button
            className="btn ghost"
            onClick={() => void (paused ? window.burst.burst.resume() : window.burst.burst.pause())}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            className="btn ghost"
            onClick={() => void window.burst.burst.setMini(!burst.miniTimer)}
          >
            {burst.miniTimer ? 'Hide mini' : 'Mini timer'}
          </button>
        </div>
        <div className="btn-row">
          {burst.shipped ? (
            <button className="btn primary big" onClick={() => setEndConfirm(true)}>
              Finish &amp; log
            </button>
          ) : (
            <>
              <button className="btn ghost" onClick={() => setEndConfirm(true)}>
                End burst
              </button>
              <button className="btn primary big" onClick={() => setShipOpen(true)}>
                Ship it
              </button>
            </>
          )}
        </div>
      </div>

      {logDue && !endConfirm && (
        <p className="hint" style={{ textAlign: 'center', marginTop: 18 }}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setEndConfirm(true);
            }}
          >
            {burst.shipped ? 'Finish and log your win' : 'Wrap it up'}
          </a>
        </p>
      )}

      {showShip && (
        <div className="modal-back">
          <div className={`modal ${celebrating ? 'shipped' : ''}`}>
            <h3>
              {celebrating ? 'Shipped.' : showCheckpoint ? 'Ship it now, ugly is fine.' : 'Ship it.'}
            </h3>
            <p className="modal-sub">
              {celebrating
                ? 'That counts, however ugly.'
                : showCheckpoint
                  ? 'Two hours in. Put the ugly version somewhere public and paste the link. Ugly and live beats polished and private.'
                  : 'Paste the public link to what went live. That link is what makes it shipped.'}
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
                  if (e.key === 'Escape' && !showCheckpoint) setShipOpen(false);
                }}
              />
            </label>
            <div className="btn-row">
              <button
                ref={liveBtn}
                className={`btn primary big ${celebrating ? 'done' : ''}`}
                onClick={() => void shipNow(urlDraft)}
              >
                {celebrating ? (
                  <>
                    <svg className="check" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M3.5 8.5l3 3 6-7" />
                    </svg>
                    Live
                  </>
                ) : (
                  'It is live'
                )}
              </button>
              {showCheckpoint ? (
                <button
                  className="btn"
                  onClick={() => {
                    setShipOpen(false);
                    void window.burst.burst.snooze(SNOOZE_MINUTES);
                    flash('Back in 5 minutes.');
                  }}
                >
                  5 more minutes
                </button>
              ) : (
                <button className="btn" onClick={() => setShipOpen(false)}>
                  Not yet
                </button>
              )}
              <button
                className="btn ghost"
                onClick={() => {
                  setShipOpen(false);
                  setEndConfirm(true);
                }}
              >
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
            <h3>{burst.shipped ? 'Finish and log it.' : 'End without shipping?'}</h3>
            <p className="modal-sub">
              {burst.shipped
                ? 'Two lines for the ship log. Both are optional.'
                : 'This goes down as parked. Not failed, not a streak break - just parked.'}
            </p>

            {burst.shipped && (
              <>
                <label className="field">
                  <span className="label">One-line win</span>
                  <input
                    type="text"
                    autoFocus
                    value={win}
                    placeholder="What actually went live?"
                    onChange={(e) => setWin(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void end('shipped');
                    }}
                  />
                </label>
                <label className="field" style={{ marginBottom: 18 }}>
                  <span className="label">Possible v2</span>
                  <input
                    type="text"
                    value={v2}
                    placeholder="One thing you would do next time. Not a promise."
                    onChange={(e) => setV2(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void end('shipped');
                    }}
                  />
                </label>
              </>
            )}

            {/* Blocker reason required when parking without having shipped */}
            {!burst.shipped && (
              <label className="field" style={{ marginBottom: 16 }}>
                <span className="label">
                  What stopped you? <span className="req">*</span>
                </span>
                <textarea
                  autoFocus
                  rows={2}
                  value={parkReason}
                  placeholder="e.g. blocked on API key, need to redesign the data model..."
                  onChange={(e) => setParkReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void end('parked');
                    if (e.key === 'Escape') {
                      setEndConfirm(false);
                      setParkReason('');
                    }
                  }}
                />
                <span className="hint">Required — this is what you will read when you come back.</span>
              </label>
            )}

            <div className="btn-row">
              <button
                className="btn primary big"
                onClick={() => void end(burst.shipped ? 'shipped' : 'parked')}
              >
                {burst.shipped ? 'Log the ship' : 'Park it'}
              </button>
              <button className="btn" onClick={() => { setEndConfirm(false); setParkReason(''); }}>
                Keep going
              </button>
              {!burst.shipped && (
                <button
                  className="btn ghost"
                  onClick={() => {
                    setEndConfirm(false);
                    setParkReason('');
                    setShipOpen(true);
                  }}
                >
                  Actually, I shipped it
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
