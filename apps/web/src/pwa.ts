/**
 * Service-worker registration (vite-plugin-pwa, registerType 'prompt').
 *
 * A tiny subscribable store instead of the react hook: the update banner (P3) and any
 * future consumer read one shared registration — React re-render plumbing stays in the
 * component. In dev the plugin serves no SW and registerSW resolves to a no-op.
 */
import { registerSW } from 'virtual:pwa-register';

type Listener = () => void;
let needRefresh = false;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

const update = registerSW({
  immediate: true,
  onNeedRefresh() {
    needRefresh = true;
    notify();
  },
});

export const pwa = {
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** True when a new app shell is waiting — the banner offers the reload. */
  getNeedRefresh: (): boolean => needRefresh,
  /** Activate the waiting SW and reload with the new shell. */
  applyUpdate: (): Promise<void> => update(true),
};
