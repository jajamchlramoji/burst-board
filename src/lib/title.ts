import type { Idea } from '../../shared/types';
import { FOMO_TEMPLATE } from '../../shared/types';

/** FOMO ideas get the "My tiny take on X" title template. */
export function suggestedTitleFor(idea: Pick<Idea, 'text' | 'tag'>): string {
  const text = idea.text.trim();
  return idea.tag === 'fomo' ? FOMO_TEMPLATE(text) : text;
}
