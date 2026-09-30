import type {
  Block,
  InlineNode,
  ListBlock,
  ListItem,
  TableAlign,
  TableBlock,
} from '../types';
import { parseInline } from './inline';
import {
  DELIM_RE,
  FENCE_RE,
  LIST_RE,
  Scanner,
  countCells,
  type BlockRange,
} from './scan';

/**
 * Turns a scanned range into a {@link Block}.
 *
 * @param open - The block is the trailing block of a streaming parse.
 */
export function buildBlock(
  range: BlockRange,
  lines: readonly string[],
  key: string,
  open: boolean
): Block {
  const body = lines.slice(range.start, range.end);
  const raw = body.join('\n');
  const base = { key, raw, open };

  switch (range.kind) {
    case 'heading': {
      const line = body[0]!;
      const level = /#{1,6}/.exec(line)![0].length as 1 | 2 | 3 | 4 | 5 | 6;
      const text = line
        .replace(/^ {0,3}#{1,6}[ \t]*/, '')
        .replace(/(?:^|[ \t]+)#+[ \t]*$/, '')
        .trim();
      return { ...base, type: 'heading', level, children: parseInline(text, open) };
    }
    case 'hr':
      return { ...base, type: 'hr' };
    case 'code':
      return buildCode(base, body);
    case 'blockquote': {
      const inner = body.map((l) => l.replace(/^ {0,3}> ?/, '')).join('\n');
      return {
        ...base,
        type: 'blockquote',
        children: parseBlocks(inner, open, `${key}.`),
      };
    }
    case 'list':
      return buildList(base, body);
    case 'table':
      return buildTable(base, body);
    case 'paragraph':
      return {
        ...base,
        type: 'paragraph',
        children: parseInline(body.map((l) => l.trimStart()).join('\n'), open),
      };
  }
}

type Base = { key: string; raw: string; open: boolean };

function buildCode(base: Base, body: string[]): Block {
  const m = FENCE_RE.exec(body[0]!)!;
  const indent = m[1]!.length;
  const fence = m[2]!;
  const lang = m[3]!.trim().split(/\s+/)[0] ?? '';
  const last = body.length > 1 ? body[body.length - 1]! : '';
  const closeRe = new RegExp(`^ {0,3}\\${fence[0]}{${fence.length},}[ \\t]*$`);
  const closed = body.length > 1 && closeRe.test(last);
  const content = body.slice(1, closed ? -1 : undefined).map((l) => {
    let k = 0;
    while (k < indent && l[k] === ' ') k++;
    return l.slice(k);
  });
  return { ...base, type: 'code', lang, text: content.join('\n'), closed };
}

interface DraftItem {
  lines: string[];
  checked?: boolean;
  sub?: { ordered: boolean; start: number; items: DraftItem[] };
}

function splitMarker(line: string) {
  const m = LIST_RE.exec(line);
  if (!m) return null;
  let rest = line.slice(m[0].length);
  let checked: boolean | undefined;
  const task = /^\[([ xX])\](?:[ \t]+|$)/.exec(rest);
  if (task) {
    checked = task[1] !== ' ';
    rest = rest.slice(task[0].length);
  }
  const marker = m[2]!;
  const ordered = /\d/.test(marker);
  return {
    indent: m[1]!.length,
    ordered,
    start: ordered ? parseInt(marker, 10) : 1,
    rest,
    checked,
  };
}

function buildList(base: Base, body: string[]): ListBlock {
  const first = splitMarker(body[0]!)!;
  const items: DraftItem[] = [];
  let current: DraftItem | undefined;
  // The item that received the most recent line; only it may still be growing.
  let tail: DraftItem | undefined;

  for (const line of body) {
    if (line.trim() === '') continue;
    const m = splitMarker(line);
    if (m && m.indent < first.indent + 2) {
      current = { lines: [m.rest] };
      if (m.checked !== undefined) current.checked = m.checked;
      items.push(current);
      tail = current;
    } else if (m && current) {
      current.sub ??= { ordered: m.ordered, start: m.start, items: [] };
      const item: DraftItem = { lines: [m.rest] };
      if (m.checked !== undefined) item.checked = m.checked;
      current.sub.items.push(item);
      tail = item;
    } else if (tail) {
      tail.lines.push(line.trim());
    }
  }

  const finish = (d: DraftItem, key: string): ListItem => {
    const item: ListItem = {
      children: parseInline(d.lines.join('\n'), base.open && d === tail),
    };
    if (d.checked !== undefined) item.checked = d.checked;
    if (d.sub) {
      item.sublist = {
        key: `${key}.sub`,
        raw: '',
        open: base.open,
        type: 'list',
        ordered: d.sub.ordered,
        start: d.sub.start,
        items: d.sub.items.map((s, i) => finish(s, `${key}.${i}`)),
      };
    }
    return item;
  };

  return {
    ...base,
    type: 'list',
    ordered: first.ordered,
    start: first.start,
    items: items.map((d, i) => finish(d, `${base.key}.${i}`)),
  };
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells: string[] = [];
  let cell = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '\\' && s[i + 1] === '|') {
      cell += '|';
      i++;
    } else if (c === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += c;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function buildTable(base: Base, body: string[]): TableBlock {
  const headerCells = splitRow(body[0]!);
  const width = headerCells.length;
  const hasDelim =
    body.length > 1 &&
    DELIM_RE.test(body[1]!) &&
    countCells(body[1]!) === countCells(body[0]!);

  const align: TableAlign[] = hasDelim
    ? splitRow(body[1]!).map((c) => {
        const l = c.startsWith(':');
        const r = c.endsWith(':');
        return l && r ? 'center' : r ? 'right' : l ? 'left' : null;
      })
    : headerCells.map(() => null);

  const rowLines = hasDelim ? body.slice(2) : [];
  const lastRow = rowLines.length - 1;

  const cells = (line: string, streamLast: boolean): InlineNode[][] => {
    const raw = splitRow(line).slice(0, width);
    const lastReal = raw.length - 1;
    while (raw.length < width) raw.push('');
    return raw.map((c, i) => parseInline(c, streamLast && i === lastReal));
  };

  return {
    ...base,
    type: 'table',
    align,
    header: cells(body[0]!, base.open && lastRow < 0),
    rows: rowLines.map((l, i) => cells(l, base.open && i === lastRow)),
  };
}

/**
 * Stateless block parse used for nested content (blockquotes) and by
 * {@link parse}.
 */
export function parseBlocks(text: string, streaming: boolean, prefix = ''): Block[] {
  const lines = text.split('\n');
  const ranges = Scanner.create(lines, streaming).scan();
  return ranges.map((r, i) =>
    buildBlock(r, lines, `${prefix}${i}`, streaming && i === ranges.length - 1)
  );
}
