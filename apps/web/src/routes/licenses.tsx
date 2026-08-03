import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDb } from '../db/provider';
import { listSources, type SourceRow } from '../db/queries';
import { assetUrl } from '../lib/url';

export function Licenses() {
  const { t } = useTranslation();
  const db = useDb();
  const [sources, setSources] = useState<SourceRow[]>([]);

  useEffect(() => {
    void listSources(db).then(setSources);
  }, [db]);

  return (
    <main>
      <h2>{t('licenses.title')}</h2>
      <p>{t('licenses.intro')}</p>
      {sources.map((s) => (
        <div className="card" key={s.id}>
          <h3>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.name}
            </a>
          </h3>
          <p>{s.attribution_text}</p>
          <p className="hint">
            {t('licenses.license')}:{' '}
            {s.license_url ? (
              <a href={assetUrl(s.license_url)} target="_blank" rel="noreferrer">
                {s.license}
              </a>
            ) : (
              s.license
            )}{' '}
            · {t('licenses.retrieved')}: {s.retrieved_at}
          </p>
        </div>
      ))}
      <p className="hint">{t('licenses.packNote')}</p>
    </main>
  );
}
