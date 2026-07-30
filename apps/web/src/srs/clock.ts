/**
 * SRS clock. All scheduling reads time from here, never from `new Date()` directly,
 * so a debug offset can fast-forward FSRS (v0.2's acceptance test) without waiting
 * real days. Set from the console:
 *   localStorage.setItem('mls_debug_clock_offset_ms', String(3 * 864e5)) // +3 days
 * then reload. The review screen shows a badge whenever the offset is non-zero.
 */
const KEY = 'mls_debug_clock_offset_ms';

export function clockOffsetMs(): number {
  return Number(localStorage.getItem(KEY) ?? '0') || 0;
}

export function srsNow(): Date {
  return new Date(Date.now() + clockOffsetMs());
}

/** Local calendar date (device timezone) as YYYY-MM-DD — daily_stats / budget key. */
export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
