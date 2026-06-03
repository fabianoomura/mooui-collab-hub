// Pure utilities for the personal panel — easy to unit-test.

export type AgendaKind = 'task' | 'stage' | 'booking' | 'event' | 'checklist' | 'melhoria' | 'conteudo' | 'sessao' | 'produto';

export interface AgendaItem {
  id: string;
  kind: AgendaKind;
  title: string;
  subtitle?: string | null;
  /** ISO datetime or YYYY-MM-DD */
  when: string;
  href: string;
  /** Sort key (epoch ms) */
  sortKey: number;
}

const startOfDayMs = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

export const todayISO = (now: Date = new Date()) => {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const addDaysISO = (iso: string, days: number) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return todayISO(d);
};

export const isOverdue = (dateLike: string | null | undefined, now: Date = new Date()) => {
  if (!dateLike) return false;
  const d = dateLike.length === 10 ? new Date(dateLike + 'T23:59:59') : new Date(dateLike);
  return d.getTime() < now.getTime();
};

/** Returns ms timestamp for either YYYY-MM-DD or full ISO */
export const toMs = (dateLike: string) =>
  dateLike.length === 10 ? new Date(dateLike + 'T09:00:00').getTime() : new Date(dateLike).getTime();

/** Group items by day (YYYY-MM-DD) preserving order */
export function groupByDay(items: AgendaItem[]): Array<{ day: string; items: AgendaItem[] }> {
  const map = new Map<string, AgendaItem[]>();
  for (const it of items) {
    const day = new Date(it.sortKey);
    const key = todayISO(day);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, items]) => ({ day, items: items.sort((x, y) => x.sortKey - y.sortKey) }));
}

/** Filter items inside an inclusive date window (ISO YYYY-MM-DD) */
export function withinWindow(items: AgendaItem[], startISO: string, endISO: string): AgendaItem[] {
  const startMs = startOfDayMs(new Date(startISO + 'T00:00:00'));
  const endMs = startOfDayMs(new Date(endISO + 'T00:00:00')) + 86_400_000 - 1;
  return items.filter((it) => it.sortKey >= startMs && it.sortKey <= endMs);
}

export function humanDayLabel(iso: string, now: Date = new Date()): string {
  const today = todayISO(now);
  const tomorrow = addDaysISO(today, 1);
  if (iso === today) return 'Hoje';
  if (iso === tomorrow) return 'Amanhã';
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'short',
  });
}
