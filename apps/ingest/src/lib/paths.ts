import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // apps/ingest/src/lib
export const REPO_ROOT = join(here, '..', '..', '..', '..');
export const DATA_CACHE = join(REPO_ROOT, 'apps', 'ingest', 'data-cache');
export const BUILD_DIR = join(REPO_ROOT, 'build');
export const STAGING_DB = join(BUILD_DIR, 'staging.db');
export const PACKS_DIR = join(BUILD_DIR, 'packs');
export const WEB_PACKS_DIR = join(REPO_ROOT, 'apps', 'web', 'public', 'packs');
export const SOURCES_LOCK = join(REPO_ROOT, 'sources.lock.json');
export const SCHEMA_SQL = join(REPO_ROOT, 'packages', 'content-pack', 'src', 'schema.sql');
