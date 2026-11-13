import { useEffect, useRef, useState } from 'react';
import type { AppState, IdeaTag } from '../../shared/types';
import { EMPTY_IDEA_MESSAGE, FOMO_TEMPLATE, IDEA_TAGS, TAG_LABELS } from '../../shared/types';
import { fmtDate } from '../lib/hooks';
import { offerUndo } from '../lib/undo';
import IconButton from '../lib/IconButton';

interface Props {
  state: AppState;
  flash: (msg: string | null) => void;
  goShrink: (ideaId?: string) => void;
  /** Bumped by the "New idea" shortcut to put the cursor in the capture line. */
  focusSignal: number;
}

export default function Inbox({ state, flash, goShrink, focusSignal }: Props) {
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [tag, setTag] = useState<IdeaTag>('own');
  const [showLink, setShowLink] = useState(false);
  const lineRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusSignal > 0) lineRef.current?.focus();
  }, [focusSignal]);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editTag, setEditTag] = useState<IdeaTag>('own');

  const ideas = state.ideas.filter((i) => i.status === 'inbox');
  const shrunk = state.ideas.filter((i) => i.status === 'shrunk').length;

  async function add() {
    if (!text.trim()) {
      flash(EMPTY_IDEA_MESSAGE);
      lineRef.current?.focus();
      return;
    }
    const res = await window.burst.ideas.add({ text, sourceLink: link, tag });
    if (!res.ok) {
      flash(res.error);
      return;
    }
    setText('');
    setLink('');
    setTag('own');
    setShowLink(false);
    lineRef.current?.focus();
    flash('Captured. Back to what you were doing.');
  }

  function startEdit(idea: (typeof ideas)[number]) {
    setEditingId(idea.id);
    setEditText(idea.text);
    setEditLink(idea.sourceLink ?? '');
    setEditTag(idea.tag);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit() {
    if (!editText.trim()) {
      flash('Idea text cannot be empty.');
      return;
    }
    const res = await window.burst.ideas.update(editingId!, {
      text: editText,
      sourceLink: editLink,
      tag: editTag,
    });
    if (!res.ok) {
      flash(res.error);
      return;
    }
    setEditingId(null);
    flash('Updated.');
  }

  return (
    <div className="wrap">
      <h1>Inbox</h1>
      <p className="sub">
        Dump it here and move on. Nothing in this list is a commitment.
        {' '}<kbd>&#8984;N</kbd> jumps here, <kbd>&#8984;&#8679;B</kbd> captures from any app.
      </p>

      <div className="capture-box">
        <div className="capture-line">
          <input
            ref={lineRef}
            type="text"
            value={text}
            aria-label="Idea"
            placeholder="Capture an idea…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add();
              if (e.key === 'Escape') e.currentTarget.blur();
            }}
          />
          <button
            className={`chip ${tag}`}
            title="Where it came from: your own idea, something you saw online, or other. Click to change."
            onClick={() => setTag(IDEA_TAGS[(IDEA_TAGS.indexOf(tag) + 1) % IDEA_TAGS.length])}
          >
            {TAG_LABELS[tag]}
          </button>
          <button
            className={`icon-btn ${showLink || link ? 'on' : ''}`}
            title="Add a source link"
            aria-label="Add a source link"
            aria-pressed={showLink}
            onClick={() => setShowLink(!showLink)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2.1-2.1a3 3 0 0 0-4.2-4.2l-.7.7M9.5 6.5a3 3 0 0 0-4.2 0L3.2 8.6a3 3 0 0 0 4.2 4.2l.7-.7" />
            </svg>
          </button>
          <button className="btn primary sm" onClick={() => void add()}>
            Capture
          </button>
        </div>

        {showLink && (
          <div className="capture-extra">
            <input
              type="text"
              autoFocus
              value={link}
              aria-label="Source link"
              placeholder="Source link, https://…"
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void add();
              }}
            />
          </div>
        )}

        {tag === 'fomo' && text.trim() && (
          <div className="capture-extra hint">
            Shrinks as: <strong>{FOMO_TEMPLATE(text.trim())}</strong>
          </div>
        )}
      </div>

      <h2>
        Unshrunk ideas {ideas.length > 0 && <span className="hint">({ideas.length})</span>}
      </h2>

      {ideas.length === 0 ? (
        <div className="empty">
          <strong>Inbox is empty.</strong>
          {shrunk > 0
            ? 'Everything captured has been shrunk into a ship. Nice.'
            : 'Capture the next thing that makes you go "ooh".'}
        </div>
      ) : (
        ideas.map((idea) =>
          editingId === idea.id ? (
            /* ── inline edit form ── */
            <div className="card" key={idea.id} style={{ marginBottom: 12 }}>
              <label className="field">
                <span className="label">Idea <span className="req">*</span></span>
                <textarea
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void saveEdit();
                    if (e.key === 'Escape') cancelEdit();
                  }}
                />
              </label>

              <label className="field">
                <span className="label">Source link (optional)</span>
                <input
                  type="text"
                  value={editLink}
                  placeholder="https://..."
                  onChange={(e) => setEditLink(e.target.value)}
                />
              </label>

              <label className="field">
                <span className="label">Where did it come from?</span>
                <div className="seg-toggle">
                  {IDEA_TAGS.map((t) => (
                    <button key={t} className={editTag === t ? 'on' : ''} onClick={() => setEditTag(t)}>
                      {TAG_LABELS[t]}
                    </button>
                  ))}
                </div>
              </label>

              <div className="btn-row">
                <button className="btn primary" onClick={() => void saveEdit()}>
                  Save
                </button>
                <button className="btn" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* ── normal idea card ── */
            <div className="item" key={idea.id}>
              <div className="body">
                <div className="title">{idea.text}</div>
                <div className="meta">
                  <span className={`pill ${idea.tag}`}>{idea.tag === 'own' ? 'Own idea' : TAG_LABELS[idea.tag]}</span>
                  <span>{fmtDate(idea.createdAt)}</span>
                  {idea.sourceLink && (
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        void window.burst.openExternal(idea.sourceLink);
                      }}
                    >
                      source
                    </a>
                  )}
                </div>
              </div>
              <div className="actions">
                <button className="btn sm primary" onClick={() => goShrink(idea.id)}>
                  Shrink
                </button>
                <IconButton icon="edit" label="Edit" onClick={() => startEdit(idea)} />
                <IconButton
                  icon="delete"
                  label="Delete"
                  tone="danger"
                  onClick={() => {
                    void window.burst.ideas.remove(idea.id).then(() => offerUndo('Idea deleted.'));
                  }}
                />
              </div>
            </div>
          ),
        )
      )}
    </div>
  );
}
