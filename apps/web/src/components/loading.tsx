/**
 * The one loading indicator. Every screen used to render a bare `…`, which a new learner reads
 * as "the page is broken" rather than "wait a moment" — and a bare ellipsis says nothing about
 * whether anything is actually happening.
 *
 * Why a real indicator is honest here rather than decoration: every query is a serial
 * postMessage RPC into the worker, which runs `selectObjects` synchronously over a ~56 MB
 * OPFS-backed database (sqlite.worker.ts). The busiest screens issue 6–13 of them back to back,
 * so the wait is real and worth acknowledging.
 *
 * `label` overrides the default line — the app-level boot loader has richer text (which pack
 * phase, how many MB) and still wants this component's spinner.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function Loading({ label, inline = false }: { label?: ReactNode; inline?: boolean }) {
  const { t } = useTranslation();
  return (
    // role=status + aria-live: a screen reader announces the wait instead of hitting silence.
    // The spinner itself is aria-hidden — it carries no information the text does not.
    <p className={`loading${inline ? ' inline' : ''}`} role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label ?? t('ui.loading')}</span>
    </p>
  );
}
