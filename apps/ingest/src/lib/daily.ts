/**
 * Shared plumbing for the `daily:*` modules (v0.6).
 *
 * Three things every daily module needs and must do the same way:
 *  - the target DATE, because `dailyItemId` is date-scoped and that is what makes re-running
 *    /daily-pull twice in one day replace rather than duplicate;
 *  - per-ITEM attribution, because every licence in play (CC BY, CC BY-SA, and VOA's
 *    public-domain-with-credit-requested) names a person or a page, not a corpus;
 *  - a wire-service screen, because "this source is public domain" is a claim about the source,
 *    not about every paragraph it published. VOA's own terms put only material produced
 *    *exclusively* by VOA in the public domain; an AP story a VOA writer adapted is neither.
 */
import { dailyItemId, type IdLang } from '@mls/shared';
import type { DB } from './staging';

// The screen itself lives in @mls/shared: it is a licence rule, and `pack verify` re-applies it
// over the finished pack so a module that forgets to call it still fails the build.
export { screenWire, type WireVerdict } from '@mls/shared';

/** Local calendar date, not UTC. "Today" is the user's today; at 01:00 in Hanoi those differ. */
export function todayIso(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function assertIsoDate(d: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`daily: bad --date ${d} (want YYYY-MM-DD)`);
  return d;
}

/**
 * The date a PULL may run for. Stricter than `assertIsoDate`, and the difference cost real data.
 *
 * Every daily source is a live feed with no historical access: VOA, Global Voices and Wikipedia's
 * current-events page all return what is current NOW. `--date` does not select a day's news — it
 * only decides which day the fetched items are FILED under. So `daily:all --date <yesterday>`
 * silently stamps today's articles with yesterday's date. On 2026-08-04 that produced 27 items
 * dated 2026-08-03 that had never appeared on 2026-08-03; they had to be deleted with
 * `daily:select` (empty `keep`) before the pack could be built.
 *
 * Missed a day? It is gone — the feed does not keep it. Pull today's and move on.
 *
 * `daily:select`, `daily:candidates` and `tips:add` are deliberately NOT restricted this way:
 * curating or correcting a past day operates on rows that already exist and invents nothing.
 */
export function assertPullDate(d: string, now = new Date()): string {
  const date = assertIsoDate(d);
  const today = todayIso(now);
  if (date > today)
    throw new Error(`daily: --date ${date} is in the future (today is ${today}) — nothing to pull yet`);
  if (date < today)
    throw new Error(
      `daily: refusing to pull for ${date} (today is ${today}).\n`
      + `  The sources are live feeds with no archive, so this would file TODAY's articles under\n`
      + `  ${date} — data that is well-formed and untrue. A missed day cannot be recovered.\n`
      + `  Run \`daily:all\` for today instead. (To fix a PAST day's curation, use daily:select,\n`
      + `  which only edits rows that already exist.)`,
    );
  return date;
}

export interface DailyItem {
  lang: IdLang;
  date: string; //          the day this item is FOR
  kind: 'news' | 'wotd' | 'tip-ref';
  slug: string; //          stable within (lang, source, date)
  title: string;
  url: string | null;
  bodyText: string | null;
  audioUrl: string | null;
  levelEst: string | null;
  /** Required. Whoever the licence says must be named, plus where it came from. */
  attribution: string;
  publishedAt: string | null;
  curatedNote?: string | null;
}

/**
 * Upsert daily items for one (source, lang, date) window.
 *
 * Deletes that window first: a second pull on the same day must be able to drop an item the first
 * pull stored (upstream pulled it, the wire screen changed, the feed reordered). `INSERT … ON
 * CONFLICT` alone never removes, which is the trap `seed:sentences` hit in v0.4.
 */
export function writeDailyItems(
  db: DB,
  sourceId: string,
  lang: IdLang,
  date: string,
  items: DailyItem[],
): number {
  const insert = db.prepare(`
    INSERT INTO daily_items
      (id, lang, date, kind, title, url, body_text, audio_url, level_est, source_id, curated_note, attribution, published_at)
    VALUES
      (@id, @lang, @date, @kind, @title, @url, @body_text, @audio_url, @level_est, @source_id, @curated_note, @attribution, @published_at)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, url = excluded.url, body_text = excluded.body_text,
      audio_url = excluded.audio_url, level_est = excluded.level_est,
      attribution = excluded.attribution, published_at = excluded.published_at`);

  let n = 0;
  db.transaction(() => {
    db.prepare(`DELETE FROM daily_items WHERE source_id = ? AND lang = ? AND date = ?`).run(sourceId, lang, date);
    for (const it of items) {
      if (!it.attribution.trim()) throw new Error(`daily: ${it.slug} has no attribution — every licence here requires one`);
      insert.run({
        id: dailyItemId(it.lang, sourceId, it.date, it.slug),
        lang: it.lang,
        date: it.date,
        kind: it.kind,
        title: it.title,
        url: it.url,
        body_text: it.bodyText,
        audio_url: it.audioUrl,
        level_est: it.levelEst,
        source_id: sourceId,
        curated_note: it.curatedNote ?? null,
        attribution: it.attribution,
        published_at: it.publishedAt,
      });
      n++;
    }
  })();
  return n;
}
