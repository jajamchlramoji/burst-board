import { useCallback, useEffect, useState } from 'react';
import { useAppState, useFlash } from './lib/hooks';
import Inbox from './views/Inbox';
import Shrink from './views/Shrink';
import Spin from './views/Spin';
import Burst from './views/Burst';
import ShipLog from './views/ShipLog';
import Settings from './views/Settings';
import Mark from './lib/Mark';

export type Tab = 'inbox' | 'shrink' | 'spin' | 'burst' | 'log' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'shrink', label: 'Shrink' },
  { id: 'spin', label: 'Spin' },
  { id: 'burst', label: 'Burst' },
  { id: 'log', label: 'Ship log' },
];

export default function App() {
  const state = useAppState();
  const [tab, setTab] = useState<Tab>('inbox');
  const [shrinkFrom, setShrinkFrom] = useState<string | null>(null);
  const [flash, setFlash] = useFlash();
  const clearFrom = useCallback(() => setShrinkFrom(null), []);
  const burstRunning = Boolean(state?.burst);
  const [sawBurst, setSawBurst] = useState(false);

  // The main process can ask us to go somewhere (tray, hotkey, notification).
  useEffect(() => window.burst.onNavigate((route) => setTab(route as Tab)), []);

  // A burst starting is the only thing that moves you off your tab, and it is
  // the main process that starts it. Edge-triggered during render rather than
  // in an effect, so there is no second render just to switch tab.
  if (burstRunning !== sawBurst) {
    setSawBurst(burstRunning);
    if (burstRunning) setTab('burst');
  }

  if (!state) {
    return (
      <div className="shell">
        <div className="titlebar">
          <div className="brand">
            <Mark /> Burst Board
          </div>
        </div>
        <div className="main">
          <div className="wrap">
            <p className="hint">Loading your board...</p>
          </div>
        </div>
      </div>
    );
  }

  const inboxCount = state.ideas.filter((i) => i.status === 'inbox').length;
  const activeCount = state.ships.filter((s) => s.status === 'active').length;
  const shippedCount = state.ships.filter((s) => s.status === 'shipped').length;
  const counts: Record<Tab, number | null> = {
    inbox: inboxCount,
    shrink: activeCount,
    spin: null,
    burst: null,
    log: shippedCount,
    settings: null,
  };

  return (
    <div className="shell">
      <div className="titlebar">
        <div className="brand">
          <Mark /> Burst Board
        </div>
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {counts[t.id] ? <span className="count">{counts[t.id]}</span> : null}
              {t.id === 'burst' && burstRunning ? <span className="count">&#9679;</span> : null}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <div className="nodrag btn-row">
          <button className="btn sm" onClick={() => void window.burst.openCapture()}>
            Quick capture
          </button>
          <button
            className={`tab ${tab === 'settings' ? 'active' : ''}`}
            onClick={() => setTab('settings')}
            title="Settings"
          >
            &#9881;
          </button>
        </div>
      </div>

      <div className="main">
        {tab === 'inbox' && (
          <Inbox
            state={state}
            flash={setFlash}
            goShrink={(ideaId) => {
              setShrinkFrom(ideaId ?? null);
              setTab('shrink');
            }}
          />
        )}
        {tab === 'shrink' && (
          <Shrink
            state={state}
            flash={setFlash}
            goSpin={() => setTab('spin')}
            fromIdeaId={shrinkFrom}
            clearFrom={clearFrom}
          />
        )}
        {tab === 'spin' && <Spin state={state} flash={setFlash} />}
        {tab === 'burst' && <Burst state={state} flash={setFlash} goSpin={() => setTab('spin')} />}
        {tab === 'log' && <ShipLog state={state} flash={setFlash} />}
        {tab === 'settings' && <Settings state={state} flash={setFlash} />}
      </div>

      {flash && <div className="toast">{flash}</div>}
    </div>
  );
}
