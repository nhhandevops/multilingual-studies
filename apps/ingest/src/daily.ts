/**
 * The `daily:*` / `tips:*` command surface — the contract .claude/skills/daily-pull/SKILL.md drives.
 *
 * Shape of a pull:
 *   daily:all --date D          fetch every source into staging (partial failure is not fatal)
 *   daily:candidates --date D   print JSON: what was pulled + which words it would teach
 *   daily:select --file f.json  keep the chosen items, attach Vietnamese notes, write the word plan
 *   tips:add --file t.json      add the day's tip
 *
 * Two properties the acceptance run checks, and which the code below is arranged around:
 *  - RUNNING TWICE ON ONE DAY CHANGES NOTHING. Item ids are date-scoped and each module clears its
 *    own (source, lang, date) window before writing, so a second pull replaces rather than doubles.
 *  - A NETWORK FAILURE DEGRADES, IT DOES NOT ABORT. Each module is awaited separately and its
 *    error recorded; the run reports what it got and what it lost. A daily habit that dies because
 *    one host was unreachable is a daily habit you stop having.
 */
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { tipId, type IdLang } from '@mls/shared';
import { openStaging, type DB } from './lib/staging';
import { assertIsoDate, assertPullDate, todayIso } from './lib/daily';
import { wordMatcher } from './lib/level';
import { DAILY_TIP_PREFIX, registerTipsSource } from './sources/shared/tips';

/** Sources that a daily pull owns. `daily:select` may only ever prune these. */
const DAILY_SOURCES = ['voa-chinese', 'global-voices', 'wikipedia-itn'] as const;

interface ModuleResult {
  source: string;
  lang: string;
  stored: number;
  skipped: { url: string; why: string }[];
}

const MODULES: Record<string, () => Promise<{ run: (db: DB, o: { date: string }) => Promise<ModuleResult | ModuleResult[]> }>> = {
  'voa-zh': () => import('./sources/zh/daily-voa'),
  globalvoices: () => import('./sources/shared/daily-globalvoices'),
  'wiki-itn': () => import('./sources/shared/daily-wiki-itn'),
};

export function registerDaily(program: Command): void {
  for (const name of Object.keys(MODULES)) {
    program
      .command(`daily:${name}`)
      .description(`daily pull: ${name}`)
      .option('--date <iso>', 'the day to pull for (default: today)')
      .action(async (opts: { date?: string }) => {
        const date = assertPullDate(opts.date ?? todayIso()); // a pull may only fetch TODAY
        const db = openStaging();
        try {
          const mod = await MODULES[name]!();
          await mod.run(db, { date });
        } finally {
          db.close();
        }
      });
  }

  program
    .command('daily:all')
    .description('run every daily source; a failing source is reported, not fatal')
    .option('--date <iso>', 'the day to pull for (default: today)')
    .action(async (opts: { date?: string }) => {
      const date = assertPullDate(opts.date ?? todayIso()); // see assertPullDate — feeds have no archive
      const db = openStaging();
      const ok: ModuleResult[] = [];
      const failed: { module: string; error: string }[] = [];
      try {
        for (const [name, load] of Object.entries(MODULES)) {
          console.log(`daily:${name}`);
          try {
            // Verification seam, same idea as the `mls_debug_clock_offset_ms` debug clock: the
            // acceptance suite has to *demonstrate* graceful degradation, and the only honest way
            // is to make a module fail on purpose. Unset in normal use.
            if (process.env['MLS_DAILY_FAIL']?.split(',').includes(name)) {
              throw new Error(`simulated failure (MLS_DAILY_FAIL=${process.env['MLS_DAILY_FAIL']})`);
            }
            const mod = await load();
            const res = await mod.run(db, { date });
            ok.push(...(Array.isArray(res) ? res : [res]));
          } catch (e) {
            // Deliberately swallowed. One unreachable host must not cost the user the other two.
            const message = e instanceof Error ? e.message : String(e);
            failed.push({ module: name, error: message });
            console.error(`  ✗ ${name}: ${message}`);
          }
        }
      } finally {
        db.close();
      }

      console.log(`\n=== daily:all ${date} ===`);
      for (const r of ok) console.log(`  ✓ ${r.source} [${r.lang}] ${r.stored} items`);
      if (ok.length > 0) {
        const db2 = openStaging();
        try {
          const n = provisionalPlan(db2, date);
          if (n > 0) console.log(`  + ${n} provisional word(s) planned (daily:select replaces them)`);
        } finally {
          db2.close();
        }
      }
      for (const f of failed) console.log(`  ✗ ${f.module}: ${f.error}`);
      const total = ok.reduce((a, r) => a + r.stored, 0);
      console.log(`  ${total} items stored, ${failed.length}/${Object.keys(MODULES).length} sources failed`);
      // Partial success is success: the report above is the deliverable. Only a total wipe-out is
      // an error worth failing the shell on.
      if (ok.length === 0) process.exitCode = 1;
    });

  program
    .command('daily:candidates')
    .description('print JSON of what was pulled for a date, plus the words it would teach')
    .option('--date <iso>', 'the day to inspect (default: today)')
    .option('--words <n>', 'candidate words per language', '30')
    .action((opts: { date?: string; words: string }) => {
      const date = assertIsoDate(opts.date ?? todayIso());
      const db = openStaging();
      try {
        console.log(JSON.stringify(candidates(db, date, Number(opts.words) || 30), null, 2));
      } finally {
        db.close();
      }
    });

  program
    .command('daily:select')
    .description('apply a curation: keep chosen items, attach notes, write the day’s word plan')
    .requiredOption('--file <path>', 'JSON produced by the /daily-pull skill')
    .action((opts: { file: string }) => {
      const db = openStaging();
      try {
        const report = select(db, JSON.parse(readFileSync(opts.file, 'utf8')) as Selection);
        console.log(JSON.stringify(report, null, 2));
      } finally {
        db.close();
      }
    });

  program
    .command('tips:add')
    .description('add the day’s study tip (one object or an array)')
    .requiredOption('--file <path>', 'JSON tip(s)')
    .action((opts: { file: string }) => {
      const db = openStaging();
      try {
        const parsed = JSON.parse(readFileSync(opts.file, 'utf8')) as TipInput | TipInput[];
        const n = addTips(db, Array.isArray(parsed) ? parsed : [parsed]);
        console.log(`✓ ${n} tip(s) added`);
      } finally {
        db.close();
      }
    });
}

// --- candidates -------------------------------------------------------------------------------

interface CandidateItem {
  id: string;
  lang: string;
  title: string;
  url: string | null;
  level_est: string | null;
  source_id: string;
  published_at: string | null;
  attribution: string;
  excerpt: string;
}

export function candidates(db: DB, date: string, wordsPerLang: number) {
  const items = db
    .prepare(
      `SELECT id, lang, title, url, level_est, source_id, published_at, attribution,
              substr(COALESCE(body_text, ''), 1, 400) AS excerpt
         FROM daily_items
        WHERE date = ? AND source_id IN (${DAILY_SOURCES.map(() => '?').join(',')})
        ORDER BY lang, source_id, id`,
    )
    .all(date, ...DAILY_SOURCES) as CandidateItem[];

  const byLang: Record<string, { items: CandidateItem[]; words: unknown[] }> = {};
  for (const lang of ['zh', 'en', 'fr'] as const) {
    const mine = items.filter((i) => i.lang === lang);
    byLang[lang] = { items: mine, words: mine.length ? wordCandidates(db, lang, mine, wordsPerLang) : [] };
  }
  return { date, sources: DAILY_SOURCES, items: items.length, langs: byLang };
}

/**
 * Words the day's reading actually contains, hardest-first within the easier bands.
 *
 * Ordering matters more than it looks: offering the 30 commonest words in today's articles would
 * offer 的/the/le every single day. Ordering by level descending inside the levelled set, then by
 * frequency, surfaces the words a learner at that level is plausibly meeting for the first time.
 */
function wordCandidates(db: DB, lang: 'zh' | 'en' | 'fr', items: CandidateItem[], limit: number) {
  const match = wordMatcher(db, lang);
  const text = items.map((i) => `${i.title}\n${i.excerpt}`).join('\n');
  const heads = match(text);
  if (heads.length === 0) return [];
  const holes = heads.map(() => '?').join(',');
  return db
    .prepare(
      `SELECT w.id, w.headword, w.reading, w.level, w.freq_rank,
              (SELECT s.gloss_en FROM senses s WHERE s.word_id = w.id ORDER BY s.ord LIMIT 1) AS gloss_en
         FROM words w
        WHERE w.lang = ? AND w.headword IN (${holes}) AND w.level IS NOT NULL
        ORDER BY w.level DESC, w.freq_rank IS NULL, w.freq_rank
        LIMIT ?`,
    )
    .all(lang, ...heads, limit);
}

/**
 * A word plan derived from the day's own reading, written only where curation has not happened.
 *
 * Without this the Today screen has no words on any day the /daily-pull skill was not run, which
 * would make the whole feature conditional on remembering to run a skill. With it, a plain
 * `daily:all` already produces a usable day and curation makes it better — and because it writes
 * only for (date, lang) pairs that have no plan yet, re-running `daily:all` after `daily:select`
 * cannot overwrite Claude's choices with its own.
 */
export function provisionalPlan(db: DB, date: string, perLang = 8): number {
  const cand = candidates(db, date, perLang);
  let n = 0;
  db.transaction(() => {
    const has = db.prepare(`SELECT 1 AS hit FROM daily_plan WHERE date = ? AND lang = ? LIMIT 1`);
    const plan = db.prepare(`INSERT OR REPLACE INTO daily_plan (date, lang, word_id, reason) VALUES (?, ?, ?, NULL)`);
    for (const [lang, bucket] of Object.entries(cand.langs)) {
      if (bucket.words.length === 0 || has.get(date, lang)) continue;
      for (const w of bucket.words as { id: string }[]) {
        plan.run(date, lang, w.id);
        n++;
      }
    }
  })();
  return n;
}

// --- selection --------------------------------------------------------------------------------

interface Selection {
  date: string;
  /** Item ids to KEEP. Everything else pulled that day, from a daily source, is dropped. */
  keep: string[];
  /** Vietnamese one-liners, keyed by item id. */
  notes?: Record<string, string>;
  /** The day's new-word plan, per language. */
  words?: Record<string, { id: string; reason?: string }[]>;
}

export function select(db: DB, sel: Selection) {
  const date = assertIsoDate(sel.date);
  const keep = new Set(sel.keep ?? []);
  const report = { date, kept: 0, dropped: 0, notes: 0, planned: 0, unknownWords: [] as string[] };

  db.transaction(() => {
    const pulled = db
      .prepare(
        `SELECT id FROM daily_items WHERE date = ? AND source_id IN (${DAILY_SOURCES.map(() => '?').join(',')})`,
      )
      .all(date, ...DAILY_SOURCES) as { id: string }[];
    const drop = db.prepare(`DELETE FROM daily_items WHERE id = ?`);
    for (const row of pulled) {
      if (keep.has(row.id)) report.kept++;
      else {
        drop.run(row.id);
        report.dropped++;
      }
    }

    const note = db.prepare(`UPDATE daily_items SET curated_note = ? WHERE id = ?`);
    for (const [id, text] of Object.entries(sel.notes ?? {})) {
      if (!keep.has(id)) continue;
      note.run(text, id);
      report.notes++;
    }

    // The plan is replaced wholesale for the day: a second curation is a correction, not an append.
    db.prepare(`DELETE FROM daily_plan WHERE date = ?`).run(date);
    const plan = db.prepare(`INSERT OR REPLACE INTO daily_plan (date, lang, word_id, reason) VALUES (?, ?, ?, ?)`);
    const exists = db.prepare(`SELECT 1 AS hit FROM words WHERE id = ?`);
    for (const [lang, words] of Object.entries(sel.words ?? {})) {
      for (const w of words) {
        // A card keyed on a word that is not in the pack would be a dead row forever.
        if (!exists.get(w.id)) {
          report.unknownWords.push(w.id);
          continue;
        }
        plan.run(date, lang, w.id, w.reason ?? null);
        report.planned++;
      }
    }
  })();
  return report;
}

// --- tips -------------------------------------------------------------------------------------

interface TipInput {
  lang?: string;
  date?: string;
  slug: string;
  title: string;
  body: string;
  technique?: string;
  links?: { label: string; url: string }[];
}

export function addTips(db: DB, tips: TipInput[]): number {
  registerTipsSource(db, todayIso());
  const insert = db.prepare(`
    INSERT INTO tips (id, lang, date_added, title, body_md, technique, links, source_id)
    VALUES (@id, @lang, @date_added, @title, @body_md, @technique, @links, 'mls-tips')
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, body_md = excluded.body_md,
      technique = excluded.technique, links = excluded.links`);
  let n = 0;
  db.transaction(() => {
    for (const t of tips) {
      const lang = (t.lang ?? 'all') as IdLang;
      const date = assertIsoDate(t.date ?? todayIso());
      if (!t.title?.trim() || !t.body?.trim()) throw new Error(`tips:add — "${t.slug}" needs a title and a body`);
      insert.run({
        // The prefix is not decoration: it is what lets `seed:tips` replace the evergreen set
        // without deleting the tips written by daily pulls.
        id: tipId(lang, date, `${DAILY_TIP_PREFIX}${t.slug}`),
        lang,
        date_added: date,
        title: t.title.trim(),
        body_md: t.body.trim(),
        technique: t.technique ?? null,
        links: t.links ? JSON.stringify(t.links) : null,
      });
      n++;
    }
  })();
  return n;
}
