/**
 * The two things every acceptance script needs and that differ per machine.
 *
 * These scripts used to live in a scratch directory with the repo path and the Chrome path
 * hardcoded, which made every "Script: …" line in HANDOFF.md a dangling reference on any other
 * computer. They are in the repo now, so neither may be machine-specific.
 */
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

/** Repo root, derived from this file's own location (tools/e2e/ → ../../). */
export const REPO = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');

/** Where `pnpm dev` serves. Override for `vite preview` (4173) or the static server. */
export const BASE = process.env.MLS_BASE ?? 'http://localhost:5173';

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

/**
 * playwright-core ships no browser, so it needs a real Chrome. Set CHROME=/path/to/chrome to
 * override; otherwise the usual install locations are tried in order.
 */
export const CHROME =
  process.env.CHROME ?? CHROME_CANDIDATES.find((p) => existsSync(p)) ?? CHROME_CANDIDATES[0];
