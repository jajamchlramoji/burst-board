const EVENT = 'burst:undo-offer';

/** Show a toast with an Undo button for the delete that just happened. */
export function offerUndo(message: string): void {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }));
}

export function onUndoOffer(cb: (message: string) => void): () => void {
  const on = (e: Event) => cb((e as CustomEvent<string>).detail);
  window.addEventListener(EVENT, on);
  return () => window.removeEventListener(EVENT, on);
}
