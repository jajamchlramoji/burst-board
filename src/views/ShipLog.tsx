import { useState } from 'react';
import type { AppState, Ship } from '../../shared/types';
import { WHERE_LABELS } from '../../shared/types';
import { burstDayCount, daysSinceLastBurst, shipStreak, shipsThisMonth } from '../../shared/burst';
import { fmtDateTime } from '../lib/hooks';

interface Props {
  state: AppState;
  flash: (msg: string | null) => void;
}

export default function ShipLog({ state, flash }: Props) {
  const shipped = state.ships
    .filter((s) => s.status === 'shipped' && s.shippedAt)
    .sort((a, b) => b.shippedAt!.localeCompare(a.shippedAt!));

  const streak = shipStreak(state.history);
  const month = shipsThisMonth(state.ships);
  const burstDays = burstDayCount(state.history);
  const sinceLast = daysSinceLastBurst(state.history);
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const visible = q
    ? shipped.filter((s) =>
        [s.title, s.win, s.v2, s.liveIn2h, s.whereOther, ...s.urls]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    : shipped;

  const lastBurstLabel =
    sinceLast === null
      ? null
      : sinceLast === 0
        ? 'Last burst today.'
        : sinceLast === 1
          ? 'Last burst yesterday.'
          : `Last burst ${sinceLast} days ago.`;

  async function doExport() {
    const res = await window.burst.exportMarkdown();
    if (res.ok) flash(`Exported to ${res.path}`);
    else if ('canceled' in res) flash('Export cancelled.');
    // A read-only folder or a full disk used to fail in total silence.
    else flash(`Could not write the file: ${res.error}`);
  }

  return (
    <div className="wrap wide">
      <h1>Ship log</h1>
      <p className="sub">Everything you put in public. This is the only scoreboard that counts.</p>

      <div className="stats">
        <div className="stat hero">
          <div className="n">{streak}</div>
          <div className="k">Ship streak (burst days)</div>
        </div>
        <div className="stat">
          <div className="n">{shipped.length}</div>
          <div className="k">Total ships</div>
        </div>
        <div className="stat">
          <div className="n">{month}</div>
          <div className="k">Shipped this month</div>
        </div>
      </div>

      <p className="hint" style={{ marginTop: -12, marginBottom: 20 }}>
        {burstDays} burst {burstDays === 1 ? 'day' : 'days'} logged.{' '}
        {lastBurstLabel ? `${lastBurstLabel} ` : ''}Days without a burst are skipped, not counted
        against you - the streak only breaks on a burst day that shipped nothing.
      </p>

      <div className="btn-row" style={{ marginBottom: 22 }}>
        <button className="btn" onClick={() => void doExport()} disabled={shipped.length === 0}>
          Export log as Markdown
        </button>
        {shipped.length > 4 && (
          <input
            type="search"
            value={query}
            placeholder="Search ships…"
            aria-label="Search the ship log"
            onChange={(e) => setQuery(e.target.value)}
            style={{ maxWidth: 260 }}
          />
        )}
      </div>

      {q && visible.length === 0 && shipped.length > 0 ? (
        <div className="empty">
          <strong>Nothing matches "{query}".</strong>
          Every other ship is still there.
        </div>
      ) : shipped.length === 0 ? (
        <div className="empty">
          <strong>Nothing shipped yet.</strong>
          The first entry here is the hard one. After that it is just a list.
        </div>
      ) : (
        visible.map((s) => (
          <LogRow
            key={s.id}
            ship={s}
            editing={editing === s.id}
            onEdit={() => setEditing(editing === s.id ? null : s.id)}
            flash={flash}
          />
        ))
      )}

      {state.history.length > 0 && (
        <>
          <h2>Burst history</h2>
          {state.history.slice(0, 20).map((h) => (
            <div className="item" key={h.id}>
              <div className="body">
                <div className="title">{h.shipTitle}</div>
                <div className="meta">
                  <span className={`pill ${h.outcome === 'shipped' ? 'shipped' : 'parked'}`}>
                    {h.outcome}
                  </span>
                  <span>{fmtDateTime(h.startedAt)}</span>
                  <span>{h.minutes} min of burst</span>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function LogRow({
  ship,
  editing,
  onEdit,
  flash,
}: {
  ship: Ship;
  editing: boolean;
  onEdit: () => void;
  flash: (m: string | null) => void;
}) {
  const [win, setWin] = useState(ship.win);
  const [v2, setV2] = useState(ship.v2);
  const [extra, setExtra] = useState('');

  async function save() {
    await window.burst.ships.update(ship.id, { win, v2 });
    if (extra.trim()) {
      const res = await window.burst.ships.addUrl(ship.id, extra);
      if (!res.ok) {
        flash(res.error);
        return;
      }
      setExtra('');
    }
    flash('Log updated.');
    onEdit();
  }

  return (
    <div className="item log-entry">
      <div className="body">
        <div className="title">{ship.title}</div>
        <div className="meta">
          <span className="pill shipped">Shipped</span>
          <span>{ship.shippedAt ? fmtDateTime(ship.shippedAt) : ''}</span>
          <span>{WHERE_LABELS[ship.where]}</span>
        </div>

        <div className="urls">
          {ship.urls.map((u) => (
            <a
              key={u}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                void window.burst.openExternal(u);
              }}
            >
              {u}
            </a>
          ))}
        </div>

        {editing ? (
          <div style={{ marginTop: 12 }}>
            <label className="field">
              <span className="label">One-line win</span>
              <input type="text" value={win} onChange={(e) => setWin(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Possible v2</span>
              <input type="text" value={v2} onChange={(e) => setV2(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Add another public URL</span>
              <input
                type="text"
                value={extra}
                placeholder="https://..."
                onChange={(e) => setExtra(e.target.value)}
              />
            </label>
            <div className="btn-row">
              <button className="btn primary" onClick={() => void save()}>
                Save
              </button>
              <button className="btn ghost" onClick={onEdit}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          (ship.win || ship.v2) && (
            <div className="kv">
              {ship.win && (
                <>
                  <span className="k">Win</span>
                  <span className="win">{ship.win}</span>
                </>
              )}
              {ship.v2 && (
                <>
                  <span className="k">v2</span>
                  <span>{ship.v2}</span>
                </>
              )}
            </div>
          )
        )}
      </div>
      {!editing && (
        <div className="actions">
          <button className="btn sm" onClick={onEdit}>
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
