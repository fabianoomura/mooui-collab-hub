import { describe, it, expect } from 'vitest';
import {
  todayISO, addDaysISO, isOverdue, toMs, groupByDay, withinWindow, humanDayLabel,
  type AgendaItem,
} from '@/lib/personalAgenda';

const NOW = new Date('2026-05-12T12:00:00Z');

describe('personalAgenda — helpers', () => {
  it('todayISO returns YYYY-MM-DD', () => {
    expect(todayISO(new Date('2026-05-12T23:59:00'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('addDaysISO handles month boundaries', () => {
    expect(addDaysISO('2026-01-30', 5)).toBe('2026-02-04');
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('isOverdue handles ISO date and full datetime', () => {
    expect(isOverdue('2020-01-01', NOW)).toBe(true);
    expect(isOverdue('2099-01-01', NOW)).toBe(false);
    expect(isOverdue(null, NOW)).toBe(false);
    expect(isOverdue(undefined, NOW)).toBe(false);
    // a date-only on the same day should NOT be overdue (uses 23:59:59)
    expect(isOverdue('2026-05-12', NOW)).toBe(false);
  });

  it('toMs supports date-only and datetime', () => {
    expect(toMs('2026-05-12')).toBeGreaterThan(0);
    expect(toMs('2026-05-12T15:00:00Z')).toBeGreaterThan(toMs('2026-05-12'));
  });

  it('humanDayLabel returns Hoje/Amanhã/weekday', () => {
    const today = todayISO(NOW);
    expect(humanDayLabel(today, NOW)).toBe('Hoje');
    expect(humanDayLabel(addDaysISO(today, 1), NOW)).toBe('Amanhã');
    expect(humanDayLabel(addDaysISO(today, 5), NOW)).toMatch(/[a-zçãê]/i);
  });
});

const mkItem = (id: string, kind: AgendaItem['kind'], when: string): AgendaItem => ({
  id, kind, title: `t-${id}`, when, sortKey: toMs(when), href: '/x',
});

describe('personalAgenda — groupByDay & withinWindow', () => {
  it('groups items by day and sorts within day', () => {
    const items: AgendaItem[] = [
      mkItem('a', 'task', '2026-05-12T15:00:00Z'),
      mkItem('b', 'task', '2026-05-12T09:00:00Z'),
      mkItem('c', 'event', '2026-05-13'),
    ];
    const groups = groupByDay(items);
    expect(groups).toHaveLength(2);
    expect(groups[0].items.map(i => i.id)).toEqual(['b', 'a']);
    expect(groups[1].items[0].id).toBe('c');
  });

  it('withinWindow filters inclusive boundaries', () => {
    const items: AgendaItem[] = [
      mkItem('a', 'task', '2026-05-10'),
      mkItem('b', 'task', '2026-05-12'),
      mkItem('c', 'task', '2026-05-19'),
      mkItem('d', 'task', '2026-05-20'),
    ];
    const out = withinWindow(items, '2026-05-12', '2026-05-19');
    expect(out.map(i => i.id)).toEqual(['b', 'c']);
  });
});

describe('personalAgenda — stress', () => {
  // Generate a large pseudo-random dataset and ensure the helpers are fast
  // and stable.
  const N = 20_000;
  const items: AgendaItem[] = [];
  for (let i = 0; i < N; i++) {
    const day = new Date(Date.UTC(2026, 0, 1));
    day.setUTCDate(day.getUTCDate() + (i % 365));
    const iso = day.toISOString().slice(0, 10);
    items.push(mkItem(String(i), (['task', 'stage', 'booking', 'event', 'checklist'] as const)[i % 5], iso));
  }

  it('groupByDay handles 20k items under 500ms', () => {
    const t0 = performance.now();
    const groups = groupByDay(items);
    const dt = performance.now() - t0;
    expect(groups.length).toBeGreaterThan(300);
    expect(groups.length).toBeLessThanOrEqual(366);
    // every item is bucketed
    expect(groups.reduce((s, g) => s + g.items.length, 0)).toBe(N);
    expect(dt).toBeLessThan(500);
  });

  it('withinWindow on 20k items returns only window members', () => {
    const t0 = performance.now();
    const out = withinWindow(items, '2026-02-01', '2026-02-28');
    const dt = performance.now() - t0;
    expect(out.length).toBeGreaterThan(0);
    out.forEach((it) => {
      const day = new Date(it.sortKey).toISOString().slice(0, 10);
      expect(day >= '2026-02-01' && day <= '2026-02-28').toBe(true);
    });
    expect(dt).toBeLessThan(200);
  });

  it('groupByDay is stable (same input → same output ordering)', () => {
    const a = groupByDay(items.slice(0, 1000));
    const b = groupByDay(items.slice(0, 1000));
    expect(a.map(g => g.day)).toEqual(b.map(g => g.day));
  });

  it('isOverdue correct for 10k synthetic dates', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    let overdue = 0;
    for (let i = 0; i < 10_000; i++) {
      const d = new Date(Date.UTC(2026, 0, 1));
      d.setUTCDate(d.getUTCDate() + (i % 365));
      const iso = d.toISOString().slice(0, 10);
      if (isOverdue(iso, now)) overdue++;
    }
    // ~5/12 of the year is before June 1 = roughly 41%
    expect(overdue).toBeGreaterThan(3500);
    expect(overdue).toBeLessThan(5500);
  });
});
