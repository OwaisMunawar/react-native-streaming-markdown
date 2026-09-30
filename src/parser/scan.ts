/*
 * Block scanner.
 *
 * Splits lines into block ranges without looking at inline syntax. Every range
 * records `decidedBy`: the furthest line that had to be inspected to know the
 * block had ended. If that line is complete (terminated by `\n`) no future
 * input can change the range, and the incremental parser may freeze it.
 */

export type BlockKind =
  'heading' | 'paragraph' | 'code' | 'list' | 'blockquote' | 'table' | 'hr';

export interface BlockRange {
  kind: BlockKind;
  /** First line of the block. */
  start: number;
  /** One past the last line of the block. */
  end: number;
  /** Line whose content decided where the block ends. `lines.length` means end of input. */
  decidedBy: number;
}

export const FENCE_RE = /^( {0,3})(`{3,}|~{3,})(.*)$/;
export const HEADING_RE = /^ {0,3}#{1,6}(?:[ \t]|$)/;
export const HR_RE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
export const QUOTE_RE = /^ {0,3}>/;
export const LIST_RE = /^( *)([-*+]|\d{1,9}[.)])(?:[ \t]+|$)/;
export const DELIM_RE = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

/**
 * A trailing, unterminated line made only of markdown punctuation. While
 * streaming we hide it, because we cannot know yet whether `-` becomes a list
 * item, a rule or plain text, and showing it would flicker.
 */
const PENDING_RE = /^[ \t]*(?:[-*_+=#`~>|:]+|\d{1,9}[.)]?)?[ \t]*$/;

const isBlank = (l: string) => l.trim() === '';

function isFence(line: string): boolean {
  const m = FENCE_RE.exec(line);
  return !!m && !(m[2]![0] === '`' && m[3]!.includes('`'));
}

/** Number of cells in a table row, ignoring optional outer pipes and escaped pipes. */
export function countCells(line: string): number {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  let n = 1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') i++;
    else if (s[i] === '|') n++;
  }
  return n;
}

function listMarker(line: string) {
  const m = LIST_RE.exec(line);
  if (!m) return null;
  const marker = m[2]!;
  const ordered = /\d/.test(marker[0]!);
  return {
    indent: m[1]!.length,
    ordered,
    // Different bullet characters or ordered delimiters start a new list.
    family: ordered ? marker[marker.length - 1]! : marker,
    number: ordered ? parseInt(marker, 10) : 0,
    hasContent: line.length > m[0].length && !isBlank(line.slice(m[0].length)),
  };
}

export class Scanner {
  constructor(
    private readonly lines: readonly string[],
    /** Number of lines to consider; trailing pending lines are excluded. */
    private readonly n: number,
    private readonly streaming: boolean
  ) {}

  static create(lines: readonly string[], streaming: boolean): Scanner {
    let n = lines.length;
    if (streaming && n > 0 && PENDING_RE.test(lines[n - 1]!)) n--;
    return new Scanner(lines, n, streaming);
  }

  private get eof() {
    return this.lines.length;
  }

  scan(from = 0): BlockRange[] {
    const out: BlockRange[] = [];
    let i = from;
    while (i < this.n) {
      const line = this.lines[i]!;
      if (isBlank(line)) {
        i++;
        continue;
      }
      const range = this.scanBlock(i, line);
      out.push(range);
      i = range.end;
    }
    return out;
  }

  private scanBlock(i: number, line: string): BlockRange {
    if (isFence(line)) return this.scanFence(i, line);
    if (HEADING_RE.test(line)) {
      return { kind: 'heading', start: i, end: i + 1, decidedBy: i };
    }
    if (HR_RE.test(line)) return { kind: 'hr', start: i, end: i + 1, decidedBy: i };
    if (QUOTE_RE.test(line)) return this.scanQuote(i);
    const marker = listMarker(line);
    if (marker && marker.indent <= 3) return this.scanList(i, marker.family);
    const table = this.tableAt(i);
    if (table !== -1) return this.scanTable(i, table);
    return this.scanParagraph(i);
  }

  /**
   * If a table starts at line `i`, returns the line that confirmed it (the
   * delimiter row, or end of input for a pending header), otherwise -1.
   */
  private tableAt(i: number): number {
    const header = this.lines[i]!;
    if (!header.includes('|')) return -1;
    if (i + 1 < this.n) {
      const delim = this.lines[i + 1]!;
      return DELIM_RE.test(delim) && countCells(delim) === countCells(header)
        ? i + 1
        : -1;
    }
    // Header is the last visible line. While streaming, a line that starts
    // with a pipe is almost always a table header whose delimiter row is
    // about to arrive.
    return this.streaming && /^\s*\|/.test(header) ? this.eof : -1;
  }

  /** Returns the decisive line if `line` starts a block that interrupts a paragraph, else -1. */
  private interrupts(j: number, inList = false): number {
    const line = this.lines[j]!;
    if (isFence(line) || HEADING_RE.test(line) || HR_RE.test(line)) return j;
    if (QUOTE_RE.test(line)) return j;
    if (!inList) {
      const m = listMarker(line);
      if (m && m.indent <= 3 && m.hasContent && (!m.ordered || m.number === 1)) {
        return j;
      }
    }
    return this.tableAt(j);
  }

  private scanParagraph(i: number): BlockRange {
    for (let j = i + 1; j < this.n; j++) {
      if (isBlank(this.lines[j]!)) {
        return { kind: 'paragraph', start: i, end: j, decidedBy: j };
      }
      const by = this.interrupts(j);
      if (by !== -1) return { kind: 'paragraph', start: i, end: j, decidedBy: by };
    }
    return { kind: 'paragraph', start: i, end: this.n, decidedBy: this.eof };
  }

  private scanFence(i: number, line: string): BlockRange {
    const m = FENCE_RE.exec(line)!;
    const fence = m[2]!;
    const close = new RegExp(
      `^ {0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}[ \\t]*$`
    );
    for (let j = i + 1; j < this.n; j++) {
      if (close.test(this.lines[j]!)) {
        return { kind: 'code', start: i, end: j + 1, decidedBy: j };
      }
    }
    return { kind: 'code', start: i, end: this.n, decidedBy: this.eof };
  }

  private scanQuote(i: number): BlockRange {
    for (let j = i + 1; j < this.n; j++) {
      const line = this.lines[j]!;
      if (QUOTE_RE.test(line)) continue;
      if (isBlank(line)) return { kind: 'blockquote', start: i, end: j, decidedBy: j };
      const by = this.interrupts(j);
      if (by !== -1) return { kind: 'blockquote', start: i, end: j, decidedBy: by };
      // Anything else is a lazy continuation of the quoted paragraph.
    }
    return { kind: 'blockquote', start: i, end: this.n, decidedBy: this.eof };
  }

  private scanList(i: number, family: string): BlockRange {
    let j = i + 1;
    while (j < this.n) {
      const line = this.lines[j]!;
      if (isBlank(line)) {
        let k = j + 1;
        while (k < this.n && isBlank(this.lines[k]!)) k++;
        if (k >= this.n) return { kind: 'list', start: i, end: j, decidedBy: this.eof };
        const next = this.lines[k]!;
        const m = listMarker(next);
        const continues =
          (m && m.indent <= 1 && m.family === family && !HR_RE.test(next)) ||
          /^ {2,}\S/.test(next);
        if (!continues) return { kind: 'list', start: i, end: j, decidedBy: k };
        j = k;
        continue;
      }
      if (/^ {2,}\S/.test(line)) {
        j++;
        continue;
      }
      if (HR_RE.test(line)) return { kind: 'list', start: i, end: j, decidedBy: j };
      const m = listMarker(line);
      if (m) {
        if (m.family !== family) return { kind: 'list', start: i, end: j, decidedBy: j };
        j++;
        continue;
      }
      const by = this.interrupts(j, true);
      if (by !== -1) return { kind: 'list', start: i, end: j, decidedBy: by };
      j++;
    }
    return { kind: 'list', start: i, end: this.n, decidedBy: this.eof };
  }

  private scanTable(i: number, confirmedBy: number): BlockRange {
    if (confirmedBy === this.eof) {
      return { kind: 'table', start: i, end: this.n, decidedBy: this.eof };
    }
    for (let j = i + 2; j < this.n; j++) {
      const line = this.lines[j]!;
      if (isBlank(line) || !line.includes('|')) {
        return { kind: 'table', start: i, end: j, decidedBy: j };
      }
    }
    return { kind: 'table', start: i, end: this.n, decidedBy: this.eof };
  }
}
