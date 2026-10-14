import type { ReactNode } from 'react';

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; rows: string[][] };

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line);
}

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }
    if (line.startsWith('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1].trim())) {
      const rows = [cells(line)];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(cells(lines[index]));
        index += 1;
      }
      blocks.push({ kind: 'table', rows });
      continue;
    }
    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = /^[-*+]\s+(.+)$/.exec(lines[index].trim());
        if (!item) break;
        items.push(item[1]);
        index += 1;
      }
      blocks.push({ kind: 'list', items });
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || /^(#{1,6})\s+/.test(next) || /^[-*+]\s+/.test(next) || next.startsWith('|')) break;
      paragraph.push(next);
      index += 1;
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
  }
  return blocks;
}

const safeLink = (raw: string): string | null => {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

function inline(text: string, keyPrefix: string): ReactNode[] {
  const result: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) result.push(text.slice(cursor, match.index));
    if (match[1] !== undefined) {
      result.push(<strong key={`${keyPrefix}-${key++}`}>{match[1]}</strong>);
    } else {
      const href = safeLink(match[3]);
      result.push(href
        ? <a key={`${keyPrefix}-${key++}`} href={href} target="_blank" rel="noopener noreferrer">{match[2]}</a>
        : match[0]);
    }
    cursor = pattern.lastIndex;
  }
  if (cursor < text.length) result.push(text.slice(cursor));
  return result;
}

export default function TermsDocument({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  return (
    <article className="mx-auto w-full max-w-4xl space-y-5 text-base leading-7 text-slate-800">
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          const Tag = (block.level === 1 ? 'h1' : 'h2') as 'h1' | 'h2';
          return <Tag key={index} className={block.level === 1 ? 'text-3xl font-bold tracking-tight text-slate-950' : 'pt-3 text-xl font-semibold text-slate-950'}>{inline(block.text, `heading-${index}`)}</Tag>;
        }
        if (block.kind === 'list') {
          return <ul key={index} className="list-disc space-y-2 pl-6">{block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item, `list-${index}-${itemIndex}`)}</li>)}</ul>;
        }
        if (block.kind === 'table') {
          const [headers = [], ...rows] = block.rows;
          return <div key={index} className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100"><tr>{headers.map((header, cellIndex) => <th key={cellIndex} scope="col" className="px-3 py-2 font-semibold">{inline(header, `th-${index}-${cellIndex}`)}</th>)}</tr></thead>
              <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-slate-200">{headers.map((_, cellIndex) => <td key={cellIndex} className="px-3 py-2 align-top">{inline(row[cellIndex] ?? '', `td-${index}-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody>
            </table>
          </div>;
        }
        return <p key={index}>{inline(block.text, `paragraph-${index}`)}</p>;
      })}
    </article>
  );
}
