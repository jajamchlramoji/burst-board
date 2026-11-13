const GROUPS: { title: string; keys: [string[], string][] }[] = [
  {
    title: 'Anywhere',
    keys: [
      [['⌘', '1–5'], 'Inbox, Shrink, Spin, Burst, Ship log'],
      [['⌘', ','], 'Settings'],
      [['⌘', 'N'], 'New idea in Inbox'],
      [['⌘', '⇧', 'B'], 'Quick capture from any app'],
      [['⌘', 'B'], 'Start a burst'],
      [['⌘', 'E'], 'Export ship log'],
      [['?'], 'This sheet'],
    ],
  },
  {
    title: 'Spin',
    keys: [
      [['Space'], 'Spin, or use the re-spin'],
      [['⌘', '↩'], 'Start the burst'],
    ],
  },
  {
    title: 'Burst',
    keys: [
      [['⌘', 'S'], 'Ship it, or finish once shipped'],
      [['Space'], 'Pause or resume'],
      [['Esc'], 'Close a dialog'],
    ],
  },
];

export default function ShortcutSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Keyboard shortcuts</h3>
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h4>{g.title}</h4>
            {g.keys.map(([combo, what]) => (
              <div className="sheet-row" key={what}>
                <span>{what}</span>
                <span className="keys">
                  {combo.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </span>
              </div>
            ))}
          </section>
        ))}
        <p className="hint" style={{ marginTop: 16, marginBottom: 0 }}>
          Press <kbd>Esc</kbd> to close.
        </p>
      </div>
    </div>
  );
}
