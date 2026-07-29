/** React context over the SQLite worker: init lifecycle + promise-based query RPC. */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type DbStatus =
  | { state: 'loading'; phase: string }
  | { state: 'ready'; packVersion: string }
  | { state: 'error'; message: string };

export interface Db {
  status: DbStatus;
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
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
      const msg = ev.data as { id?: number; ok?: boolean; type?: string; phase?: string; error?: string; rows?: unknown; packVersion?: string };
      if (msg.type === 'progress') {
        setStatus((s) => (s.state === 'loading' ? { state: 'loading', phase: msg.phase ?? '' } : s));
        return;
      }
      if (msg.id === undefined) return;
      const p = pending.current.get(msg.id);
      if (!p) return;
      pending.current.delete(msg.id);
      if (msg.ok) p.resolve((msg.rows ?? msg) as never);
      else p.reject(new Error(msg.error ?? 'worker error'));
    };

    const id = nextId.current++;
    pending.current.set(id, {
      resolve: (v: never) => setStatus({ state: 'ready', packVersion: (v as { packVersion: string }).packVersion }),
      reject: (e) => setStatus({ state: 'error', message: e.message }),
    });
    worker.postMessage({ id, type: 'init' });

    return () => worker.terminate();
  }, []);

  const db = useMemo<Db>(
    () => ({
      status,
      query: <T,>(sql: string, params: unknown[] = []) =>
        new Promise<T[]>((resolve, reject) => {
          const worker = workerRef.current;
          if (!worker) return reject(new Error('worker gone'));
          const id = nextId.current++;
          pending.current.set(id, { resolve: resolve as (v: never) => void, reject });
          worker.postMessage({ id, type: 'query', sql, params });
        }),
    }),
    [status],
  );

  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): Db {
  const db = useContext(DbContext);
  if (!db) throw new Error('useDb outside DbProvider');
  return db;
}
