import { useState } from 'react';
import type { AppState, IdeaTag } from '../../shared/types';
import { FOMO_TEMPLATE } from '../../shared/types';
import { fmtDate } from '../lib/hooks';

interface Props {
  state: AppState;
  flash: (msg: string | null) => void;
  goShrink: (ideaId?: string) => void;
}

export default function Inbox({ state, flash, goShrink }: Props) {
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [tag, setTag] = useState<IdeaTag>('own');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editTag, setEditTag] = useState<IdeaTag>('own');

  const ideas = state.ideas.filter((i) => i.status === 'inbox');
  const shrunk = state.ideas.filter((i) => i.status === 'shrunk').length;

  async function add() {
    if (!text.trim()) {
      flash('Type the idea first.');
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
        {' '}Press <strong>&#8984;&#8679;B</strong> from anywhere for the quick capture window.
      </p>

      <div className="card">
        <label className="field">
          <span className="label">
            Idea <span className="req">*</span>
          </span>
          <textarea
            value={text}
            placeholder="A thing you might ship..."
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void add();
            }}
          />
        </label>

        <label className="field">
          <span className="label">Source link (optional)</span>
          <input
            type="text"
            value={link}
            placeholder="https://..."
            onChange={(e) => setLink(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="label">Where did it come from?</span>
          <div className="seg-toggle">
            <button className={tag === 'own' ? 'on' : ''} onClick={() => setTag('own')}>
              My own idea
            </button>
            <button className={tag === 'fomo' ? 'on' : ''} onClick={() => setTag('fomo')}>
              FOMO (saw it online)
            </button>
          </div>
        </label>

        {tag === 'fomo' && text.trim() && (
          <div className="banner info">
            This will be shrunk as: <strong>{FOMO_TEMPLATE(text.trim())}</strong>
          </div>
        )}

        <div className="btn-row">
          <button className="btn primary big" onClick={() => void add()}>
            Capture idea
          </button>
          <span className="hint">&#8984;&#9166; also saves</span>
        </div>
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
                  <button className={editTag === 'own' ? 'on' : ''} onClick={() => setEditTag('own')}>
                    My own idea
                  </button>
                  <button className={editTag === 'fomo' ? 'on' : ''} onClick={() => setEditTag('fomo')}>
                    FOMO (saw it online)
                  </button>
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
                  <span className={`pill ${idea.tag}`}>{idea.tag === 'fomo' ? 'FOMO' : 'Own idea'}</span>
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
                <button
                  className="btn sm"
                  title="Edit idea"
                  onClick={() => startEdit(idea)}
                >
                  Edit
                </button>
                <button
                  className="btn sm ghost danger"
                  title="Delete idea"
                  onClick={() => {
                    void window.burst.ideas.remove(idea.id);
                    flash('Deleted. No guilt.');
                  }}
                >
                  &#10005;
                </button>
              </div>
            </div>
          ),
        )
      )}
    </div>
  );
}
