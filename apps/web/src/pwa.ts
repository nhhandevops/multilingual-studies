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
  /**
   * Ask the browser to look for a new service worker NOW. Needed when the app itself is
   * too old for the server's pack: in prompt mode a plain reload keeps serving the old
   * precached shell, so something has to go fetch the new one first.
   *
   * Returns whether a registration HANDLED the check. reg.update() resolves at
   * "installing" — before precaching finishes and onNeedRefresh fires — so the caller
   * must not poll getNeedRefresh() right after it; when this returns true, wait for the
   * needRefresh flip instead of reloading (a reload here re-serves the OLD shell).
   */
  async checkForUpdate(): Promise<boolean> {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (!reg) return false;
      await reg.update();
      return true;
    } catch {
      return false; // no SW (dev, or unsupported) — the caller's reload is then the whole story
    }
  },
};
