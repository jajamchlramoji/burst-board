import { useEffect, useMemo, useState } from 'react';
import type { AppState, ShipWhere } from '../../shared/types';
import { MAX_ACTIVE_SHIPS, WHERE_LABELS } from '../../shared/types';
import { suggestedTitleFor } from '../lib/title';
import { fmtDate } from '../lib/hooks';

interface Props {
  state: AppState;
  flash: (msg: string | null) => void;
  goSpin: () => void;
  fromIdeaId: string | null;
  clearFrom: () => void;
}

export default function Shrink({ state, flash, goSpin, fromIdeaId, clearFrom }: Props) {
  const inboxIdeas = useMemo(() => state.ideas.filter((i) => i.status === 'inbox'), [state.ideas]);
  const active = state.ships.filter((s) => s.status === 'active');
  const parked = state.ships.filter((s) => s.status === 'parked');
  const full = active.length >= MAX_ACTIVE_SHIPS;

  const [ideaId, setIdeaId] = useState<string | null>(fromIdeaId);
  const [title, setTitle] = useState('');
  const [liveIn2h, setLiveIn2h] = useState('');
  const [where, setWhere] = useState<ShipWhere>('github');
  const [whereOther, setWhereOther] = useState('');
  const [uglyV1, setUglyV1] = useState('');

  // Picking "Shrink" on an inbox idea prefills the form (FOMO gets the template title).
  useEffect(() => {
    if (!fromIdeaId) return;
    const idea = state.ideas.find((i) => i.id === fromIdeaId);
    setIdeaId(fromIdeaId);
    if (idea) setTitle(suggestedTitleFor(idea));
    clearFrom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromIdeaId]);

  function pickIdea(id: string) {
    const idea = state.ideas.find((i) => i.id === id);
    setIdeaId(id || null);
    if (idea) setTitle(suggestedTitleFor(idea));
  }

  async function create() {
    const res = await window.burst.ships.create({
      ideaId,
      title,
      liveIn2h,
      where,
      whereOther,
      uglyV1,
    });
    if (!res.ok) {
      flash(res.error);
      return;
    }
    setIdeaId(null);
    setTitle('');
    setLiveIn2h('');
    setWhere('github');
    setWhereOther('');
    setUglyV1('');
    flash('One-burst ship added.');
  }

  return (
    <div className="wrap">
      <h1>Shrink</h1>
      <p className="sub">
        Make it small enough to be live in two hours. {active.length} of {MAX_ACTIVE_SHIPS} active
        slots used.
      </p>

      {full && (
        <div className="banner warn">
          You have {MAX_ACTIVE_SHIPS} active ships. That is the ceiling. Park one below and the form
          opens back up.
        </div>
      )}

      <div className="card">
        <label className="field">
          <span className="label">From an inbox idea (optional)</span>
          <select value={ideaId ?? ''} onChange={(e) => pickIdea(e.target.value)} disabled={full}>
            <option value="">Straight from my head</option>
            {inboxIdeas.map((i) => (
              <option key={i.id} value={i.id}>
                {i.tag === 'fomo' ? '[FOMO] ' : ''}
                {i.text.slice(0, 70)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="label">
            Ship title <span className="req">*</span>
          </span>
          <input
            type="text"
            value={title}
            disabled={full}
            placeholder="Short name you will recognise at 11pm"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="label">
            What will be live in 2 hours? <span className="req">*</span>
          </span>
          <textarea
            value={liveIn2h}
            disabled={full}
            placeholder="One sentence. Something a stranger could open."
            onChange={(e) => setLiveIn2h(e.target.value)}
          />
        </label>

        <div className="row">
          <label className="field">
            <span className="label">Where will I ship it?</span>
            <select
              value={where}
              disabled={full}
              onChange={(e) => setWhere(e.target.value as ShipWhere)}
            >
              {(Object.keys(WHERE_LABELS) as ShipWhere[]).map((k) => (
                <option key={k} value={k}>
                  {WHERE_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          {where === 'other' && (
            <label className="field">
              <span className="label">Where exactly?</span>
              <input
                type="text"
                value={whereOther}
                disabled={full}
                placeholder="Reddit, newsletter, Gumroad..."
                onChange={(e) => setWhereOther(e.target.value)}
              />
            </label>
          )}
        </div>

        <label className="field">
          <span className="label">Ugly v1 is...</span>
          <textarea
            value={uglyV1}
            disabled={full}
            placeholder="One sentence. The version you would be slightly embarrassed by."
            onChange={(e) => setUglyV1(e.target.value)}
          />
        </label>

        <div className="btn-row">
          <button className="btn primary big" disabled={full} onClick={() => void create()}>
            Add one-burst ship
          </button>
          {active.length > 0 && (
            <button className="btn big" onClick={goSpin}>
              Go spin &rarr;
            </button>
          )}
        </div>
      </div>

      <h2>Active ships</h2>
      {active.length === 0 ? (
        <div className="empty">
          <strong>No active ships yet.</strong>
          Shrink one idea above and you have something to burst on.
        </div>
      ) : (
        active.map((s) => (
          <div className="item" key={s.id}>
            <div className="body">
              <div className="title">{s.title}</div>
              <div className="meta">
                <span className="pill active">Active</span>
                <span>{WHERE_LABELS[s.where]}{s.where === 'other' && s.whereOther ? `: ${s.whereOther}` : ''}</span>
                <span>{fmtDate(s.createdAt)}</span>
              </div>
              <div className="kv">
                <span className="k">In 2h</span>
                <span>{s.liveIn2h}</span>
                {s.uglyV1 && (
                  <>
                    <span className="k">Ugly v1</span>
                    <span>{s.uglyV1}</span>
                  </>
                )}
              </div>
            </div>
            <div className="actions">
              <button
                className="btn sm"
                onClick={() => {
                  void window.burst.ships.park(s.id);
                  flash('Parked. It will wait without nagging you.');
                }}
              >
                Park
              </button>
              <button
                className="btn sm ghost danger"
                title="Delete ship"
                onClick={() => {
                  void window.burst.ships.remove(s.id);
                  flash('Deleted.');
                }}
              >
                &#10005;
              </button>
            </div>
          </div>
        ))
      )}

      {parked.length > 0 && (
        <>
          <h2>Parked</h2>
          {parked.map((s) => (
            <div className="item" key={s.id}>
              <div className="body">
                <div className="title">{s.title}</div>
                <div className="meta">
                  <span className="pill parked">Parked</span>
                  <span>{s.liveIn2h}</span>
                </div>
              </div>
              <div className="actions">
                <button
                  className="btn sm"
                  onClick={async () => {
                    const res = await window.burst.ships.unpark(s.id);
                    if (!res.ok) flash(res.error);
                    else flash('Back in the active five.');
                  }}
                >
                  Unpark
                </button>
                <button
                  className="btn sm ghost danger"
                  onClick={() => void window.burst.ships.remove(s.id)}
                >
                  &#10005;
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
