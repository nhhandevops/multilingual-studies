/** React context over the SQLite worker: init lifecycle + promise-based query RPC. */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type DbStatus =
  | { state: 'loading'; phase: string }
  | { state: 'ready'; packVersion: string }
  | { state: 'error'; message: string };

export interface Db {
  status: DbStatus;
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
}

const DbContext = createContext<Db | null>(null);

export function DbProvider({ children }: { children: ReactNode }) {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, { resolve: (v: never) => void; reject: (e: Error) => void }>());
  const nextId = useRef(1);
  const [status, setStatus] = useState<DbStatus>({ state: 'loading', phase: 'start' });

  useEffect(() => {
    const worker = new Worker(new URL('./sqlite.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as { id?: number; ok?: boolean; type?: string; phase?: string; error?: string; rows?: unknown; bytes?: ArrayBuffer; packVersion?: string };
      if (msg.type === 'progress') {
        setStatus((s) => (s.state === 'loading' ? { state: 'loading', phase: msg.phase ?? '' } : s));
        return;
      }
      if (msg.id === undefined) return;
      const p = pending.current.get(msg.id);
      if (!p) return;
      pending.current.delete(msg.id);
      if (msg.ok) p.resolve((msg.rows ?? msg.bytes ?? msg) as never);
      else p.reject(new Error(msg.error ?? 'worker error'));
    };

    const id = nextId.current++;
    pending.current.set(id, {
      resolve: (v: never) => setStatus({ state: 'ready', packVersion: (v as { packVersion: string }).packVersion }),
      reject: (e) => setStatus({ state: 'error', message: e.message }),
    });
    worker.postMessage({ id, type: 'init' });

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

    return {
      status,
      query: <T,>(sql: string, params: unknown[] = []) => request<T[]>({ type: 'query', sql, params }),
      userQuery: <T,>(sql: string, params: unknown[] = []) => request<T[]>({ type: 'user-query', sql, params }),
      userExec: async (statements) => {
        await request<unknown[]>({ type: 'user-exec', statements });
      },
      userExport: () => request<ArrayBuffer>({ type: 'user-export' }),
      userImport: async (bytes) => {
        await request<unknown[]>({ type: 'user-import', bytes }, [bytes]);
      },
    };
  }, [status]);

  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): Db {
  const db = useContext(DbContext);
  if (!db) throw new Error('useDb outside DbProvider');
  return db;
}
