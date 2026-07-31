/** Per-host rate limiting + retry. Every remote fetch in ingest goes through polite(). */
import PQueue from 'p-queue';
import { fetch, type Response } from 'undici';

export const USER_AGENT =
  'multilingual-studies-ingest/0.1 (personal study app; nguyenhuuhoangan2504@gmail.com)';

const queues = new Map<string, PQueue>();

function queueFor(host: string): PQueue {
  let q = queues.get(host);
  if (!q) {
    // Conservative default: 2 concurrent, ≥250ms apart per host.
    //
    // Measured, not guessed: raising this to 8 for upload.wikimedia.org during the Lingua Libre
    // crawl made throughput *worse* (0.5 → 0.3 files/s) because the host answered with 429s and
    // the retries ate the gain. Wikimedia's documented "~15,000 files/hour" applies to their
    // bulk tooling, not to hammering transcode URLs. Leave this alone.
    q = new PQueue({ concurrency: 2, interval: 250, intervalCap: 1 });
    queues.set(host, q);
  }
  return q;
}

export async function polite(url: string, init?: { headers?: Record<string, string> }): Promise<Response> {
  const host = new URL(url).host;
  const result = await queueFor(host).add(async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      try {
        const res = await fetch(url, {
          headers: { 'user-agent': USER_AGENT, ...init?.headers },
          redirect: 'follow',
        });
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`HTTP ${res.status} for ${url}`);
          continue;
        }
        return res;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  });
  return result as Response;
}
