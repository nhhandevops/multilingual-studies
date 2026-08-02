/**
 * Durable-storage request + state.
 *
 * OPFS data (content pack, media pack, user.db) is evictable under storage pressure unless
 * the origin is "persisted". Chrome grants silently for installed/engaged origins; Safari 17+
 * and Firefox may prompt — so we ask when the user has something to lose (first card) or on
 * app install, when the prompt makes sense to a person.
 */

export type PersistState = 'persisted' | 'not-persisted' | 'unsupported';

export async function persistState(): Promise<PersistState> {
  if (!navigator.storage?.persisted) return 'unsupported';
  try {
    return (await navigator.storage.persisted()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'unsupported';
  }
}

/** Request persistence (idempotent, cheap). Returns the resulting state. */
export async function ensurePersisted(): Promise<PersistState> {
  if (!navigator.storage?.persist) return 'unsupported';
  try {
    if (await navigator.storage.persisted()) return 'persisted';
    return (await navigator.storage.persist()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'unsupported';
  }
}

/** Storage usage estimate in MB, null when unsupported. */
export async function usageMb(): Promise<number | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const { usage } = await navigator.storage.estimate();
    return usage !== undefined ? Math.round(usage / 1024 / 1024) : null;
  } catch {
    return null;
  }
}
