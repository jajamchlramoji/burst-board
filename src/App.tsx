import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppState, useFlash } from './lib/hooks';
import Inbox from './views/Inbox';
import Shrink from './views/Shrink';
import Spin from './views/Spin';
import Burst from './views/Burst';
import ShipLog from './views/ShipLog';
import Settings from './views/Settings';
import ShortcutSheet from './views/Shortcuts';
import Mark from './lib/Mark';
import { isTyping, useKeydown } from './lib/keys';
import { onUndoOffer } from './lib/undo';

const UNDO_MS = 6000;

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
  const [sheet, setSheet] = useState(false);
  const [captureFocus, setCaptureFocus] = useState(0);
  const [undoMsg, setUndoMsg] = useState<string | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);

  useEffect(
    () =>
      onUndoOffer((msg) => {
        window.clearTimeout(undoTimer.current);
        setUndoMsg(msg);
        undoTimer.current = window.setTimeout(() => setUndoMsg(null), UNDO_MS);
      }),
    [],
  );
  useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  const runUndo = async () => {
    window.clearTimeout(undoTimer.current);
    setUndoMsg(null);
    const res = await window.burst.undo();
    setFlash(res.ok ? 'Restored.' : res.error);
  };

  // The main process can ask us to go somewhere (tray, hotkey, notification,
  // or the app menu - which also carries the "new idea" and shortcuts items).
  useEffect(
    () =>
      window.burst.onNavigate((route) => {
        if (route === 'shortcuts') {
          setSheet((s) => !s);
        } else if (route === 'new-idea') {
          setTab('inbox');
          setCaptureFocus((n) => n + 1);
        } else {
          setTab(route as Tab);
        }
      }),
    [],
  );

  useKeydown((e) => {
    if (e.key === 'Escape' && sheet) {
      setSheet(false);
    } else if (e.key === '?' && !isTyping(e)) {
      e.preventDefault();
      setSheet((s) => !s);
    }
  });

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
        <TabBar tab={tab} setTab={setTab} counts={counts} burstRunning={burstRunning} />
        <div className="spacer" />
        <div className="nodrag btn-row">
          <button className="btn sm" onClick={() => void window.burst.openCapture()}>
            Quick capture
          </button>
          <button
            className={`tab settings-btn ${tab === 'settings' ? 'active' : ''}`}
            onClick={() => setTab('settings')}
            title="Settings  ⌘,"
            aria-label="Settings"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="main">
        {tab === 'inbox' && (
          <Inbox
            state={state}
            flash={setFlash}
            focusSignal={captureFocus}
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

      {sheet && <ShortcutSheet onClose={() => setSheet(false)} />}
      {undoMsg ? (
        <div className="toast with-action" role="status">
          <span>{undoMsg}</span>
          <button onClick={() => void runUndo()}>Undo</button>
        </div>
      ) : (
        flash && <div className="toast">{flash}</div>
      )}
    </div>
  );
}

/**
 * The tab bar. One glass pill sits behind the active tab and glides to the
 * next one: the edge in the direction of travel leaves first and the other
 * catches up, so it stretches and settles like a drop of liquid.
 */
function TabBar({
  tab,
  setTab,
  counts,
  burstRunning,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  counts: Record<Tab, number | null>;
  burstRunning: boolean;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; right: number; dir: 1 | -1 } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const bar = barRef.current;
      const el = bar?.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
      if (!bar || !el) {
        setPill(null);
        return;
      }
      const left = el.offsetLeft;
      const right = bar.clientWidth - (el.offsetLeft + el.offsetWidth);
      setPill((p) =>
        p && p.left === left && p.right === right
          ? p
          : { left, right, dir: p && left < p.left ? -1 : 1 },
      );
    };
    measure();
    window.addEventListener('resize', measure);
    void document.fonts?.ready.then(measure);
    return () => window.removeEventListener('resize', measure);
  }, [tab, counts, burstRunning]);

  const lead = '0ms';
  const lag = '90ms';
  return (
    <div className="tabs" ref={barRef}>
      {pill && (
        <span
          className="tab-glass"
          aria-hidden="true"
          style={{
            left: pill.left,
            right: pill.right,
            transitionDelay:
              pill.dir === 1 ? `${lag}, ${lead}, 0ms` : `${lead}, ${lag}, 0ms`,
          }}
        />
      )}
      {TABS.map((t, i) => (
        <button
          key={t.id}
          data-tab={t.id}
          className={`tab ${tab === t.id ? 'active' : ''}`}
          onClick={() => setTab(t.id)}
          title={`${t.label}  ⌘${i + 1}`}
        >
          {t.label}
          {counts[t.id] ? <span className="count">{counts[t.id]}</span> : null}
          {t.id === 'burst' && burstRunning ? <span className="count">&#9679;</span> : null}
        </button>
      ))}
    </div>
  );
}
