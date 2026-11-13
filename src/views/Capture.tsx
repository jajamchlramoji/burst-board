import { useEffect, useState } from 'react';
import type { IdeaTag } from '../../shared/types';
import { EMPTY_IDEA_MESSAGE, FOMO_TEMPLATE, IDEA_TAGS, TAG_LABELS } from '../../shared/types';
import Mark from '../lib/Mark';

/** The tiny always-on-top window opened by the global hotkey or the tray. */
export default function Capture() {
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [tag, setTag] = useState<IdeaTag>('own');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void window.burst.closeCapture();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function save() {
    if (!text.trim()) {
      setError(EMPTY_IDEA_MESSAGE);
      return;
    }
    const res = await window.burst.ideas.add({ text, sourceLink: link, tag });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    window.setTimeout(() => void window.burst.closeCapture(), 650);
  }

  if (saved) {
    return (
      <div className="capture">
        <div className="cap-bar">Burst Board</div>
        <div
          className="cap-body"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <strong>Captured. Carry on. &#9889;</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="capture">
      <div className="cap-bar">
        <Mark /> Quick capture
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11 }}>esc to close &middot; &#8984;&#9166; to save</span>
      </div>
      <div className="cap-body">
        <input
          type="text"
          autoFocus
          value={text}
          placeholder="Idea (required)"
          onChange={(e) => {
            setText(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !link)) void save();
          }}
        />
        <input
          type="text"
          value={link}
          placeholder="Source link (optional)"
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
          }}
        />
        <div className="seg-toggle" style={{ marginTop: 4 }}>
          {IDEA_TAGS.map((t) => (
            <button key={t} className={tag === t ? 'on' : ''} onClick={() => setTag(t)}>
              {t === 'own' ? 'Own idea' : TAG_LABELS[t]}
            </button>
          ))}
        </div>
        {tag === 'fomo' && text.trim() && (
          <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
            Title: {FOMO_TEMPLATE(text.trim())}
          </p>
        )}
        {error && (
          <p className="hint" style={{ color: 'var(--warn)', marginBottom: 0 }}>
            {error}
          </p>
        )}
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn primary" style={{ flex: 1 }} onClick={() => void save()}>
            Capture
          </button>
        </div>
      </div>
    </div>
  );
}
