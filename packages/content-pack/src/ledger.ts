/**
 * packs.lock.json — the committed ledger of pack versions that have been published.
 *
 * WHY IT EXISTS. A pack version is `YYYY.MM.DD-N`, and N used to be derived only from the local
 * `build/packs/` directory. `build/` is gitignored, so a second clone starts that counter from
 * scratch: on 2026-08-04 two machines each minted `2026.08.04-1` for different content
 * (sha `6643d065…` vs `ee622228…`). The app's update check compares the version STRING, so a
 * learner holding one would have been told they were current while the other was live.
 *
 * This file is the one part of the pack pipeline that travels with the repository, which is what
 * makes it the right place to record what has already gone out. It is deliberately small and
 * append-only: it records what was published, never what was merely built (a throwaway local
 * build colliding with another throwaway local build harms nobody).
 *
 * It records the sha too, so the collision is DETECTABLE after the fact and not only avoidable:
 * republishing a version with different bytes is a different failure from reusing the name.
 *
 * Same shape and intent as `sources.lock.json` — a committed ledger of what has been taken.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export interface PublishedPack {
  packVersion: string;
  /** sha256 of the UNCOMPRESSED content database, as recorded in the pack's manifest. */
  dbSha256: string;
  /** ISO date the pack was published from this repo. */
  publishedAt: string;
  /**
   * Daily-item count at publication. Recorded because it is the one number that can go DOWN
   * without anything failing: `pack verify`'s ID-churn gate deliberately excludes `daily_items`
   * (a pull replacing the day's items is the feature), so a clone whose `build/staging.db` never
   * saw another machine's pulls publishes a smaller archive in silence. It has happened:
   * 212 → 166 between `2026.08.03-1` and `2026.08.03-2`, unnoticed at the time.
   */
  dailyItems?: number;
  /** Optional note — e.g. which clone cut it, or what it shipped. */
  note?: string;
}

interface Ledger {
  published: PublishedPack[];
}

const EMPTY: Ledger = { published: [] };

export function readLedger(path: string): Ledger {
  if (!existsSync(path)) return { ...EMPTY, published: [] };
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<Ledger>;
    return { published: Array.isArray(parsed.published) ? parsed.published : [] };
  } catch {
    // A corrupt ledger must not block a build; it degrades to "reserves nothing", which is the
    // behaviour that existed before this file. It is still worth being loud about.
    console.warn(`⚠ ${path} is unreadable — pack versions are not reserved for this build`);
    return { published: [] };
  }
}

/** Every version name the ledger says is spoken for. */
export function reservedVersions(path: string): Set<string> {
  return new Set(readLedger(path).published.map((p) => p.packVersion));
}

/**
 * A warning if this pack ships FEWER daily items than the last one published, or null.
 *
 * This is a warning and not an error on purpose: the shrink is sometimes correct (a `/curate-pack`
 * prune at 90 days), and the older items are usually unrecoverable anyway — the feeds keep no
 * archive. What must not happen is that it goes unnoticed.
 */
export function dailyItemWarning(path: string, dailyItems: number): string | null {
  const prior = readLedger(path).published.filter((p) => typeof p.dailyItems === 'number');
  const last = prior.at(-1);
  if (!last || last.dailyItems === undefined || dailyItems >= last.dailyItems) return null;
  return `daily items ${last.dailyItems} → ${dailyItems} (−${last.dailyItems - dailyItems}) since ${last.packVersion}. `
    + `If this clone has not pulled every day the last one did, those items are gone from the pack — `
    + `build/staging.db is gitignored and does not travel. Intentional (a curate-pack prune) is fine; `
    + `accidental is not, and pack verify cannot tell the difference.`;
}

/**
 * Record a publication. Returns null on success, or a description of the conflict when the
 * version is already in the ledger under a DIFFERENT sha — the case that must never ship.
 */
export function recordPublished(path: string, entry: PublishedPack): string | null {
  const ledger = readLedger(path);
  const prior = ledger.published.find((p) => p.packVersion === entry.packVersion);
  if (prior) {
    if (prior.dbSha256 !== entry.dbSha256)
      return `${entry.packVersion} was already published with a different database `
        + `(${prior.dbSha256.slice(0, 16)}… on ${prior.publishedAt}, now ${entry.dbSha256.slice(0, 16)}…). `
        + `Rebuild under a new version rather than reusing the name — the app compares version strings.`;
    return null; // idempotent: re-publishing identical bytes is fine
  }
  ledger.published.push(entry);
  ledger.published.sort((a, b) => a.packVersion.localeCompare(b.packVersion));
  writeFileSync(path, `${JSON.stringify(ledger, null, 2)}\n`);
  return null;
}
