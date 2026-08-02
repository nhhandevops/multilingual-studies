/** React context over the SQLite worker: init lifecycle + promise-based query RPC. */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MediaState, UpdateCheck } from './sqlite.worker';

export type DbStatus =
  | { state: 'loading'; phase: string; mb?: number }
  | { state: 'ready'; packVersion: string }
  | { state: 'error'; message: string };

/** UI-facing media-pack state: what init reported, plus install progress. */
export interface MediaUi extends MediaState {
  /** Non-null while an install is running ('download' | 'verify' | 'install'). */
  busy: string | null;
}

export interface Db {
  status: DbStatus;
  /** Optional media pack (word pronunciation recordings) — install state + controls. */
  media: MediaUi;
  /** Post-boot pack-update check result (null until a check finds something to say). */
  update: UpdateCheck | null;
  /** Re-check packs/manifest.json now (also runs hourly while the tab is visible). */
  checkUpdate: () => Promise<void>;
  /** SELECT against content.db (read-only pack). */
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
  /** SELECT against user.db (SRS state). */
  userQuery: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
  /** Write statements against user.db — all run in ONE transaction. */
  userExec: (statements: { sql: string; params?: unknown[] }[]) => Promise<void>;
  /** Serialize user.db to bytes (backup download). */
  userExport: () => Promise<ArrayBuffer>;
  /** Replace user.db from bytes (validated in the worker; restores on failure). */
  userImport: (bytes: ArrayBuffer) => Promise<void>;
  /** Audio blob for an id, from media.db then content.db; null when neither has it. */
  audioBytes: (audioId: string) => Promise<Uint8Array | null>;
  /** Cheap presence check for an audio blob (either DB) — drives recorded-vs-TTS labelling. */
  audioHas: (audioId: string) => Promise<boolean>;
  /** Download + install the optional media pack (~tens of MB). */
  installMedia: () => Promise<void>;
  /** Delete the media pack; content + user data untouched. */
  removeMedia: () => Promise<void>;
}

const DbContext = createContext<Db | null>(null);

export function DbProvider({ children }: { children: ReactNode }) {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, { resolve: (v: never) => void; reject: (e: Error) => void }>());
  const nextId = useRef(1);
  const [status, setStatus] = useState<DbStatus>({ state: 'loading', phase: 'start' });
  const [media, setMedia] = useState<MediaUi>({ installed: false, availableBytes: null, busy: null });
  const [update, setUpdate] = useState<UpdateCheck | null>(null);
  const lastCheck = useRef(0);

  useEffect(() => {
    const worker = new Worker(new URL('./sqlite.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as {
        id?: number; ok?: boolean; type?: string; phase?: string; error?: string;
        rows?: unknown; bytes?: ArrayBuffer | null; has?: boolean; packVersion?: string;
        media?: MediaState;
      };
      if (msg.type === 'progress') {
        // progress carries bytes as a NUMBER (pack size); RPC replies reuse `bytes` for buffers
        const detail = msg as unknown as { phase?: string; bytes?: number };
        setStatus((s) =>
          s.state === 'loading'
            ? {
                state: 'loading',
                phase: detail.phase ?? '',
                ...(detail.bytes ? { mb: Math.round(detail.bytes / 1024 / 1024) } : {}),
              }
            : s,
        );
        return;
      }
      if (msg.type === 'media-progress') {
        setMedia((m) => ({ ...m, busy: msg.phase === 'done' ? null : (msg.phase ?? null) }));
        return;
      }
      if (msg.id === undefined) return;
      const p = pending.current.get(msg.id);
      if (!p) return;
      pending.current.delete(msg.id);
      if (msg.ok) p.resolve(msg as never);
      else p.reject(new Error(msg.error ?? 'worker error'));
    };

    const id = nextId.current++;
    pending.current.set(id, {
      resolve: (v: never) => {
        const r = v as { packVersion: string; media?: MediaState };
        setStatus({ state: 'ready', packVersion: r.packVersion });
        if (r.media) setMedia({ ...r.media, busy: null });
      },
      reject: (e) => setStatus({ state: 'error', message: e.message }),
    });
    worker.postMessage({ id, type: 'init', base: import.meta.env.BASE_URL });

    // Back/forward cache: a frozen page keeps this worker alive, and opfs-sahpool handles are
    // exclusive per origin — so a second document could never open the DB, and pressing Back
    // would restore a page whose worker had lost the race. Hand the handles back while frozen.
    const send = (type: 'suspend' | 'resume') => {
      const w = workerRef.current;
      if (!w) return;
      const rpcId = nextId.current++;
      pending.current.set(rpcId, { resolve: () => {}, reject: () => {} });
      w.postMessage({ id: rpcId, type });
    };
    const onPageHide = (e: PageTransitionEvent) => {
      if (e.persisted) send('suspend'); //  a real unload needs nothing: the worker dies with us
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) send('resume');
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      worker.terminate();
    };
  }, []);

  const db = useMemo<Db>(() => {
    const request = <T,>(msg: Record<string, unknown>, transfer?: Transferable[]) =>
      new Promise<T>((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker) return reject(new Error('worker gone'));
        const id = nextId.current++;
        pending.current.set(id, { resolve: resolve as (v: never) => void, reject });
        worker.postMessage({ id, ...msg }, transfer ?? []);
      });
    type Reply = { rows?: unknown; bytes?: ArrayBuffer | null; has?: boolean; media?: MediaState; update?: UpdateCheck };

    const doCheckUpdate = async () => {
      lastCheck.current = Date.now();
      const r = await request<Reply>({ type: 'check-update' });
      if (r.update && (r.update.available || r.update.needsAppUpdate)) setUpdate(r.update);
    };

    return {
      status,
      media,
      update,
      checkUpdate: doCheckUpdate,
      query: <T,>(sql: string, params: unknown[] = []) =>
        request<Reply>({ type: 'query', sql, params }).then((r) => r.rows as T[]),
      userQuery: <T,>(sql: string, params: unknown[] = []) =>
        request<Reply>({ type: 'user-query', sql, params }).then((r) => r.rows as T[]),
      userExec: async (statements) => {
        await request<Reply>({ type: 'user-exec', statements });
      },
      userExport: () => request<Reply>({ type: 'user-export' }).then((r) => r.bytes as ArrayBuffer),
      userImport: async (bytes) => {
        await request<Reply>({ type: 'user-import', bytes }, [bytes]);
      },
      audioBytes: (audioId) =>
        request<Reply>({ type: 'audio-bytes', audioId }).then((r) => (r.bytes ? new Uint8Array(r.bytes) : null)),
      audioHas: (audioId) => request<Reply>({ type: 'audio-has', audioId }).then((r) => r.has === true),
      installMedia: async () => {
        setMedia((m) => ({ ...m, busy: 'download' }));
        try {
          const r = await request<Reply>({ type: 'install-media' });
          if (r.media) setMedia({ ...r.media, busy: null });
        } catch (e) {
          setMedia((m) => ({ ...m, busy: null }));
          throw e;
        }
      },
      removeMedia: async () => {
        const r = await request<Reply>({ type: 'remove-media' });
        if (r.media) setMedia({ ...r.media, busy: null });
      },
    };
  }, [status, media, update]);

  // Long-lived PWA sessions: look for a newer pack when the tab becomes visible, at most hourly.
  // The boot path already self-updates, so this only matters for sessions that never reload.
  useEffect(() => {
    if (status.state !== 'ready') return;
    const check = () => {
      if (Date.now() - lastCheck.current > 60 * 60 * 1000) void db.checkUpdate().catch(() => {});
    };
    check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- db identity churns with status; keyed on readiness
  }, [status.state]);

  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): Db {
  const db = useContext(DbContext);
  if (!db) throw new Error('useDb outside DbProvider');
  return db;
}
