/**
 * iOS Add-to-Home-Screen instructions. iOS Safari has no install prompt API
 * (verified in docs/RESEARCH-SOURCES.md "PWA on iOS"), so the only install path is
 * Share → "Thêm vào MH chính" — shown once to iOS browser-tab visitors, dismissible,
 * remembered in localStorage (device-scoped by nature, so not a settings row).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const KEY = 'mls_ios_a2hs_dismissed';

// iPadOS 13+ Safari reports a desktop 'Macintosh' UA; maxTouchPoints separates it from a
// real Mac (which reports 0). Without the second clause, iPads never see this hint.
const isIos = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
const isStandalone = (): boolean =>
  (navigator as unknown as { standalone?: boolean }).standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

export function IosA2hs() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(KEY) === '1');

  if (dismissed || !isIos() || isStandalone()) return null;

  return (
    <div className="ios-a2hs" role="note">
      <p>{t('ios.hint')}</p>
      <p className="hint">{t('ios.steps')}</p>
      <button
        className="linklike"
        onClick={() => {
          localStorage.setItem(KEY, '1');
          setDismissed(true);
        }}
      >
        {t('media.dismiss')}
      </button>
    </div>
  );
}
