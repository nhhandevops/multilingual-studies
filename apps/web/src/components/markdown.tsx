/**
 * A deliberately tiny markdown renderer for grammar bodies.
 *
 * It emits React elements and never touches `dangerouslySetInnerHTML`, so bundled prose cannot
 * inject markup no matter what a future source ships — the same reasoning that made the IPA
 * diagrams render as `<img src="data:…">` instead of inline SVG.
 *
 * It supports exactly what the grammar seeds produce: headings, `- ` list items, `**bold**`,
 * `*italic*`, and blank-line paragraphs. Anything else renders as its own literal text, which is
 * the right failure mode for a reader — visible and harmless.
 */
import type { ReactNode } from 'react';

/** Split on ** and * without a regex-replace-into-HTML step. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={`${keyPrefix}-b${i}`}>{m[1]}</strong>);
    else out.push(<em key={`${keyPrefix}-i${i}`}>{m[2]}</em>);
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ body }: { body: string }) {
  const blocks: ReactNode[] = [];
  const lines = body.split('\n');
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    const key = `p${blocks.length}`;
    blocks.push(<p key={key}>{inline(para.join(' '), key)}</p>);
    para = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    const key = `ul${blocks.length}`;
    blocks.push(
      <ul key={key} className="md-list">
        {list.map((item, i) => (
          <li key={i}>{inline(item, `${key}-${i}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{2,5})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (heading) {
      flushPara();
      flushList();
      const level = Math.min(heading[1]!.length, 5);
      const key = `h${blocks.length}`;
      const Tag = (['h2', 'h3', 'h4', 'h5'] as const)[level - 2] ?? 'h5';
      blocks.push(<Tag key={key}>{inline(heading[2]!, key)}</Tag>);
    } else if (bullet) {
      flushPara();
      list.push(bullet[1]!);
    } else if (line === '') {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return <div className="md">{blocks}</div>;
}
