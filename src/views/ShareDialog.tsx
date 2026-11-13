import { useEffect, useRef, useState } from 'react';
import type { CardData } from '../lib/shareCard';
import { drawShareCard, shareText } from '../lib/shareCard';
import { useKeydown } from '../lib/keys';

interface Props {
  card: CardData;
  onClose: () => void;
  flash: (msg: string | null) => void;
}

/** Preview of the share image, with ways to get it onto LinkedIn or X. */
export default function ShareDialog({ card, onClose, flash }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    void drawShareCard(canvas, card).then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [card]);

  useKeydown((e) => {
    if (e.key === 'Escape') onClose();
  });

  const dataUrl = () => canvasRef.current?.toDataURL('image/png') ?? '';

  const copy = async () => {
    const ok = await window.burst.share.copyImage(dataUrl());
    flash(ok ? 'Image copied.' : 'Could not copy the image.');
    return ok;
  };

  const save = async () => {
    const res = await window.burst.share.saveImage(dataUrl(), card.title);
    if (res.ok) flash(`Saved to ${res.path}`);
    else if (!('canceled' in res)) flash(`Could not save: ${res.error}`);
  };

  // Neither site takes an image through a link, so the image goes on the
  // clipboard and the post opens with the text filled in, ready for Cmd+V.
  const post = async (site: 'x' | 'linkedin') => {
    const ok = await window.burst.share.copyImage(dataUrl());
    const text = encodeURIComponent(shareText(card));
    const url =
      site === 'x'
        ? `https://x.com/intent/post?text=${text}`
        : `https://www.linkedin.com/feed/?shareActive=true&text=${text}`;
    await window.burst.openExternal(url);
    flash(ok ? 'Image copied. Paste it into the post with ⌘V.' : 'Opened the post. The image could not be copied.');
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal share" onClick={(e) => e.stopPropagation()}>
        <h3>Share this ship</h3>
        <p className="modal-sub">A clean card for LinkedIn or X. The post opens with the text filled in.</p>
        <canvas ref={canvasRef} className={`share-canvas ${ready ? 'ready' : ''}`} aria-label="Share image preview" />
        <div className="btn-row" style={{ marginTop: 18 }}>
          <button className="btn primary" disabled={!ready} onClick={() => void copy()}>
            Copy image
          </button>
          <button className="btn" disabled={!ready} onClick={() => void save()}>
            Save PNG…
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn" disabled={!ready} onClick={() => void post('x')}>
            Post on X
          </button>
          <button className="btn" disabled={!ready} onClick={() => void post('linkedin')}>
            Post on LinkedIn
          </button>
        </div>
      </div>
    </div>
  );
}
