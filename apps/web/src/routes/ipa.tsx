import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDb } from '../db/provider';
import { getAssetSvg, listIpaPhones, type PhoneRow } from '../db/queries';

const CATEGORIES = ['consonant', 'vowel', 'glottis', 'airstream'] as const;

/** Inert data URL for an SVG string; encodeURIComponent keeps `#` and `&` from truncating it. */
const svgDataUrl = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** notes_md is '<description> · <category>' — split rather than adding a column for it. */
function describe(row: PhoneRow): { name: string; category: string } {
  const [name = '', category = ''] = (row.notes_md ?? '').split(' · ');
  return { name, category };
}

export function IpaChart() {
  const { t } = useTranslation();
  const db = useDb();
  const [phones, setPhones] = useState<PhoneRow[] | null>(null);
  const [selected, setSelected] = useState<PhoneRow | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [tooOld, setTooOld] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listIpaPhones(db)
      .then((p) => {
        if (cancelled) return;
        setPhones(p);
        setSelected((s) => s ?? p[0] ?? null);
        if (p.length === 0) setTooOld(true); //  pre-v0.3 pack: graphemes exists but is empty
      })
      .catch(() => {
        if (!cancelled) { setPhones([]); setTooOld(true); }
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    if (!selected?.diagram_ref) return;
    void getAssetSvg(db, selected.diagram_ref).then((s) => {
      if (!cancelled) setSvg(s);
    });
    return () => {
      cancelled = true;
    };
  }, [selected, db]);

  const groups = useMemo(() => {
    const byCategory = new Map<string, PhoneRow[]>();
    for (const p of phones ?? []) {
      const { category } = describe(p);
      const list = byCategory.get(category);
      if (list) list.push(p);
      else byCategory.set(category, [p]);
    }
    return CATEGORIES.map((c) => ({ category: c, rows: byCategory.get(c) ?? [] })).filter((g) => g.rows.length > 0);
  }, [phones]);

  if (!phones) return <p className="status">…</p>;
  if (phones.length === 0)
    return (
      <main className="ipa-chart">
        <h2>{t('ipa.title')}</h2>
        <p className={tooOld ? 'error' : 'status'}>{tooOld ? t('db.packTooOld') : t('ipa.empty')}</p>
      </main>
    );

  return (
    <main className="ipa-chart">
      <h2>{t('ipa.title')}</h2>
      <p className="hint">{t('ipa.intro', { n: phones.length })}</p>

      {groups.map((g) => (
        <section key={g.category}>
          <h3>{t(`ipa.category.${g.category}`, g.category)}</h3>
          <ul className="glyph-grid phone-grid">
            {g.rows.map((p) => {
              const { name } = describe(p);
              return (
                <li key={p.id}>
                  <button
                    className={`phone-btn${selected?.id === p.id ? ' active' : ''}`}
                    onClick={() => setSelected(p)}
                    title={name}
                  >
                    <span className="glyph">{p.glyph}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {selected && (
        <section className="diagram-pane">
          <h3>
            {selected.glyph} <span className="hint">{describe(selected).name}</span>
          </h3>
          {/* The diagrams are line art on a transparent background, so they need a light
              surface in both themes — inverting them would mislabel anatomy shading.
              Rendered as <img>, never injected as markup: an SVG in an <img> cannot run
              scripts, so no sanitiser is needed even if upstream art changes. */}
          <div className="diagram">
            {svg ? <img src={svgDataUrl(svg)} alt={describe(selected).name} /> : t('ipa.loading')}
          </div>
        </section>
      )}
    </main>
  );
}
