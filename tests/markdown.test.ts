import { describe, expect, it } from 'vitest';
import type { AppState, Ship } from '../shared/types';
import { buildMarkdown, mdInline } from '../shared/markdown';

function ship(over: Partial<Ship> = {}): Ship {
  return {
    id: Math.random().toString(36).slice(2),
    ideaId: null,
    title: 'A ship',
    liveIn2h: 'A thing will be live',
    where: 'github',
    whereOther: '',
    uglyV1: '',
    status: 'shipped',
    createdAt: '2026-11-01T09:00:00.000Z',
    shippedAt: '2026-11-01T11:00:00.000Z',
    urls: ['https://github.com/me/thing'],
    win: 'It went out',
    v2: '',
    ...over,
  };
}

function state(ships: Ship[]): AppState {
  return {
    version: 2,
    ideas: [],
    ships,
    burst: null,
    history: [],
    settings: {
      theme: 'dark', notificationsEnabled: true, reminderEnabled: true, reminderDay: 0,
      reminderTime: '10:00', lastReminderDate: null, globalHotkeyEnabled: true,
    },
  };
}

describe('mdInline', () => {
  it('escapes emphasis so a title is not reformatted', () => {
    expect(mdInline('**bold** and _under_')).toBe('\\*\\*bold\\*\\* and \\_under\\_');
  });
  it('escapes a link so it stays visible text', () => {
    expect(mdInline('a [thing](http://x)')).toBe('a \\[thing\\]\\(http://x\\)');
  });
  it('escapes backticks and raw HTML brackets', () => {
    expect(mdInline('use `code` <b>x</b>')).toBe('use \\`code\\` \\<b\\>x\\</b\\>');
  });
  it('escapes a leading hash so it cannot become a heading', () => {
    expect(mdInline('#1 priority')).toBe('\\#1 priority');
  });
  it('escapes backslashes first, not twice', () => {
    expect(mdInline('a\\b')).toBe('a\\\\b');
  });
  it('collapses newlines, since these are one-line fields', () => {
    expect(mdInline('one\ntwo')).toBe('one two');
    expect(mdInline('one\r\n  two')).toBe('one two');
  });
  it('trims', () => {
    expect(mdInline('  x  ')).toBe('x');
  });
});

describe('buildMarkdown', () => {
  it('lists the newest ship first', () => {
    const md = buildMarkdown(state([
      ship({ title: 'Older', shippedAt: '2026-11-01T11:00:00.000Z' }),
      ship({ title: 'Newest', shippedAt: '2026-11-20T11:00:00.000Z' }),
      ship({ title: 'Middle', shippedAt: '2026-11-10T11:00:00.000Z' }),
    ]));
    expect(md.indexOf('Newest')).toBeLessThan(md.indexOf('Middle'));
    expect(md.indexOf('Middle')).toBeLessThan(md.indexOf('Older'));
  });

  it('is stable when two ships share a timestamp', () => {
    const ships = [ship({ title: 'A' }), ship({ title: 'B' })];
    expect(buildMarkdown(state(ships))).toBe(buildMarkdown(state(ships)));
  });

  it('escapes a title that would otherwise break the document', () => {
    const md = buildMarkdown(state([ship({ title: '## Fake heading **bold**' })]));
    expect(md).toContain('## \\#\\# Fake heading \\*\\*bold\\*\\*');
  });

  it('wraps URLs in angle brackets so parentheses survive', () => {
    const md = buildMarkdown(state([ship({ urls: ['https://x.com/a_(b)'] })]));
    expect(md).toContain('- <https://x.com/a_(b)>');
  });

  it('counts only shipped ships in the stats line', () => {
    const md = buildMarkdown(state([ship(), ship({ status: 'active', shippedAt: null })]));
    expect(md).toContain('**1 ship**');
  });

  it('pluralises', () => {
    expect(buildMarkdown(state([ship(), ship()]))).toContain('**2 ships**');
  });

  it('says so plainly when nothing has shipped', () => {
    const md = buildMarkdown(state([]));
    expect(md).toContain('Nothing shipped yet.');
    expect(md).toContain('**0 ships**');
  });

  it('omits the win and v2 lines when they are empty', () => {
    const md = buildMarkdown(state([ship({ win: '', v2: '' })]));
    expect(md).not.toContain('**Win:**');
    expect(md).not.toContain('**Possible v2:**');
  });

  it('includes the win and v2 lines when they are filled', () => {
    const md = buildMarkdown(state([ship({ win: 'live', v2: 'later' })]));
    expect(md).toContain('**Win:** live');
    expect(md).toContain('**Possible v2:** later');
  });

  it('names a custom ship surface', () => {
    const md = buildMarkdown(state([ship({ where: 'other', whereOther: 'Product Hunt' })]));
    expect(md).toContain('Product Hunt');
  });
});
