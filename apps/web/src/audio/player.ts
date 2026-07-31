/**
 * Audio playback for pack-bundled clips.
 *
 * Clips live as BLOBs inside content.db, so playing one means a query → Blob → object URL.
 * URLs are cached per audio ID: the pinyin chart replays the same handful of syllables
 * constantly, and re-creating a URL per click leaks one object URL per press.
 */
import type { Db } from '../db/provider';
import { getAudioBytes } from '../db/queries';

const urls = new Map<string, string>();
let current: HTMLAudioElement | null = null;

async function urlFor(db: Db, audioId: string): Promise<string | null> {
  const cached = urls.get(audioId);
  if (cached) return cached;
  const bytes = await getAudioBytes(db, audioId);
  if (!bytes) return null;
  // Copy into a fresh ArrayBuffer: the worker's view may be backed by a larger buffer.
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type: 'audio/mpeg' }));
  urls.set(audioId, url);
  return url;
}

/** Stop whatever clip is playing, if any. */
export function stopAudio(): void {
  if (!current) return;
  current.pause();
  current.currentTime = 0;
}

/** Play a clip, stopping whatever was playing. Resolves once playback has started. */
export async function playAudio(db: Db, audioId: string): Promise<void> {
  const url = await urlFor(db, audioId);
  if (!url) return;
  if (current) {
    current.pause();
    current.currentTime = 0;
  }
  const el = new Audio(url);
  current = el;
  try {
    await el.play();
  } catch {
    // Autoplay policy or a race with the next click — never worth breaking the UI over.
  }
}
