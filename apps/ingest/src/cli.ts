/**
 * Ingest CLI. Conventions:
 *  - `seed:*`  one-time bulk imports (idempotent; skip when input hash unchanged)
 *  - `daily:*` per-date pulls driven by the /daily-pull skill (idempotent per date)
 *  - `pack …`  build / verify / publish the content pack
 */
import { Command } from 'commander';
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildPack, nextPackVersion, verifyPack } from '@mls/content-pack';
import { openStaging } from './lib/staging';
import { PACKS_DIR, STAGING_DB, WEB_PACKS_DIR } from './lib/paths';

const program = new Command('ingest');

type SeedFn = (db: ReturnType<typeof openStaging>) => Promise<void>;

const SEEDS: Record<string, () => Promise<{ run: SeedFn }>> = {
  'zh-cedict': () => import('./sources/zh/cedict'),
  // 0.1 (coming): 'zh-hsk', 'en-ngsl', 'en-cefrj', 'en-kaikki', 'fr-lexique', 'fr-kaikki-en', 'freq', 'fr-cefr-derive'
};

for (const name of Object.keys(SEEDS)) {
  program
    .command(`seed:${name}`)
    .description(`one-time seed: ${name}`)
    .action(async () => {
      console.log(`seed:${name}`);
      const db = openStaging();
      try {
        const mod = await SEEDS[name]!();
        await mod.run(db);
      } finally {
        db.close();
      }
    });
}

program
  .command('seed:all')
  .description('run every registered seed in order')
  .action(async () => {
    const db = openStaging();
    try {
      for (const [name, load] of Object.entries(SEEDS)) {
        console.log(`seed:${name}`);
        const mod = await load();
        await mod.run(db);
      }
    } finally {
      db.close();
    }
  });

const pack = program.command('pack').description('content pack operations');

pack
  .command('build')
  .description('build packs/<version> from build/staging.db')
  .option('--version <v>', 'explicit pack version (default: next for today)')
  .action((opts: { version?: string }) => {
    const version = opts.version ?? nextPackVersion(PACKS_DIR, new Date());
    const { manifest, outDir } = buildPack({ stagingDbPath: STAGING_DB, packsDir: PACKS_DIR, packVersion: version });
    console.log(`✓ built pack ${manifest.packVersion} → ${outDir}`);
    console.log(`  db ${(manifest.dbBytes / 1024 / 1024).toFixed(1)} MB, counts: ${JSON.stringify(manifest.counts)}`);
  });

pack
  .command('verify')
  .description('verify the newest pack (integrity, attribution, license modes, ID churn)')
  .option('--version <v>', 'pack version to verify (default: newest)')
  .action((opts: { version?: string }) => {
    const version = opts.version ?? newestPack();
    const issues = verifyPack(join(PACKS_DIR, version), PACKS_DIR);
    const errors = issues.filter((i) => i.level === 'error');
    for (const i of issues) console.log(`  ${i.level === 'error' ? '✗' : '⚠'} [${i.check}] ${i.detail}`);
    if (errors.length > 0) {
      console.error(`✗ pack ${version} FAILED verification (${errors.length} errors)`);
      process.exit(1);
    }
    console.log(`✓ pack ${version} verified${issues.length ? ` (${issues.length} warnings)` : ''}`);
  });

pack
  .command('publish')
  .description('copy newest pack manifest + db.gz into apps/web/public/packs/')
  .option('--version <v>', 'pack version to publish (default: newest)')
  .action((opts: { version?: string }) => {
    const version = opts.version ?? newestPack();
    mkdirSync(WEB_PACKS_DIR, { recursive: true });
    cpSync(join(PACKS_DIR, version, 'manifest.json'), join(WEB_PACKS_DIR, 'manifest.json'));
    // Neutral extension on purpose: servers special-case *.gz (Content-Encoding) and corrupt
    // the byte stream; .pack is served as opaque bytes everywhere. Still gzip inside.
    cpSync(join(PACKS_DIR, version, 'content.db.gz'), join(WEB_PACKS_DIR, 'content.pack'));
    console.log(`✓ published pack ${version} → apps/web/public/packs/`);
  });

function newestPack(): string {
  const dirs = readdirSync(PACKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => {
      const [da = '', na = '0'] = a.split('-');
      const [db_ = '', nb = '0'] = b.split('-');
      return da === db_ ? Number(na) - Number(nb) : da.localeCompare(db_);
    });
  const newest = dirs.at(-1);
  if (!newest) throw new Error(`no packs in ${PACKS_DIR} — run 'pack build' first`);
  return newest;
}

await program.parseAsync(process.argv);
