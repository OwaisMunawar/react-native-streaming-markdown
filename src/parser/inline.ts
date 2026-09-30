import type { InlineNode } from '../types';

/*
 * Inline parser.
 *
 * This is deliberately smaller than the CommonMark delimiter algorithm: it
 * matches emphasis runs by exact length and resolves them recursively. That
 * covers the markdown LLMs actually produce, and it makes the streaming rules
 * easy to state:
 *
 *   - an opener with no closer yet becomes a `partial` node that runs to the
 *     end of the input (`**bol` renders as bold),
 *   - a marker at the very end with nothing after it is hidden (`hello **`
 *     renders as `hello `), so raw asterisks never flash on screen,
 *   - with `streaming: false` both cases fall back to literal text.
 */

const PUNCT = /[!-/:-@[-`{-~]/;
const WS = /\s/;
const ALNUM = /[\p{L}\p{N}]/u;
const URL_RE = /^https?:\/\/[^\s<]*[^\s<?!.,:;*_~'")\]]/;

const isWs = (c: string | undefined) => c === undefined || WS.test(c);
const isPunct = (c: string | undefined) => c !== undefined && PUNCT.test(c);
const isAlnum = (c: string | undefined) => c !== undefined && ALNUM.test(c);

function runLength(s: string, i: number, ch: string): number {
  let j = i;
  while (s[j] === ch) j++;
  return j - i;
}

function leftFlanking(prev: string | undefined, next: string | undefined) {
  if (isWs(next)) return false;
  return !isPunct(next) || isWs(prev) || isPunct(prev);
}

function rightFlanking(prev: string | undefined, next: string | undefined) {
  if (isWs(prev)) return false;
  return !isPunct(prev) || isWs(next) || isPunct(next);
}

function canOpen(ch: string, prev: string | undefined, next?: string) {
  if (!leftFlanking(prev, next)) return false;
  return ch !== '_' || !isAlnum(prev);
}

function canClose(ch: string, prev: string | undefined, next?: string) {
  if (!rightFlanking(prev, next)) return false;
  return ch !== '_' || !isAlnum(next);
}

/** Index just past the backtick run that closes a code span opened at `i`, or -1. */
function codeSpanEnd(s: string, i: number, n: number): number {
  let k = i + n;
  while (k < s.length) {
    const at = s.indexOf('`', k);
    if (at === -1) return -1;
    const len = runLength(s, at, '`');
    if (len === n) return at;
    k = at + len;
  }
  return -1;
}

/** Skips an escape or a complete code span starting at `k`; returns the new index or `k`. */
function skipOpaque(s: string, k: number): number {
  if (s[k] === '\\') return k + 2;
  if (s[k] === '`') {
    const n = runLength(s, k, '`');
    const close = codeSpanEnd(s, k, n);
    return close === -1 ? k + n : close + n;
  }
  return k;
}

function findCloser(s: string, from: number, ch: string, n: number): number {
  let k = from;
  while (k < s.length) {
    const skipped = skipOpaque(s, k);
    if (skipped !== k) {
      k = skipped;
      continue;
    }
    if (s[k] === ch) {
      const len = runLength(s, k, ch);
      if (len === n && canClose(ch, s[k - 1], s[k + len])) return k;
      k += len;
      continue;
    }
    k++;
  }
  return -1;
}

function findBracketClose(s: string, from: number): number {
  let depth = 0;
  let k = from;
  while (k < s.length) {
    const skipped = skipOpaque(s, k);
    if (skipped !== k) {
      k = skipped;
      continue;
    }
    const c = s[k];
    if (c === '[') depth++;
    else if (c === ']') {
      if (depth === 0) return k;
      depth--;
    }
    k++;
  }
  return -1;
}

interface Destination {
  href: string;
  title?: string;
  /** Index just past `)`, or -1 when the destination is still open. */
  end: number;
}

/** Parses `(href "title")` starting at the `(` at index `i`. */
function parseDestination(s: string, i: number): Destination {
  let depth = 0;
  let k = i + 1;
  while (k < s.length) {
    const c = s[k];
    if (c === '\\') {
      k += 2;
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') {
      if (depth === 0) break;
      depth--;
    }
    k++;
  }
  const closed = k < s.length;
  const inner = s.slice(i + 1, closed ? k : s.length).trim();
  const m = /^<?([^\s>]*)>?(?:\s+["'(](.*)["')])?$/s.exec(inner);
  const href = m ? m[1]! : (inner.split(/\s/)[0] ?? '');
  const title = m?.[2];
  return {
    href,
    ...(title !== undefined ? { title } : null),
    end: closed ? k + 1 : -1,
  };
}

function pushText(out: InlineNode[], text: string) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.type === 'text') last.text += text;
  else out.push({ type: 'text', text });
}

type Wrapper = 'strong' | 'em' | 'del';

function wrap(kinds: Wrapper[], children: InlineNode[], partial: boolean): InlineNode {
  let node: InlineNode = { type: kinds[kinds.length - 1]!, children };
  for (let i = kinds.length - 2; i >= 0; i--) {
    node = { type: kinds[i]!, children: [node] };
  }
  if (partial) markPartial(node);
  return node;
}

function markPartial(node: InlineNode) {
  let cur: InlineNode | undefined = node;
  while (cur && (cur.type === 'strong' || cur.type === 'em' || cur.type === 'del')) {
    cur.partial = true;
    cur = cur.children.length === 1 ? cur.children[0] : undefined;
  }
}

function delimiterKinds(ch: string, n: number): Wrapper[] | null {
  if (ch === '~') return n === 2 ? ['del'] : null;
  if (n === 1) return ['em'];
  if (n === 2) return ['strong'];
  if (n === 3) return ['strong', 'em'];
  return null;
}

/**
 * Parses inline markdown into a flat-ish tree of {@link InlineNode}s.
 *
 * @param src - Text of a single block (paragraph, heading, list item or table cell).
 * @param streaming - When true, `src` is treated as a prefix that is still
 *   growing and unclosed syntax at the end is rendered optimistically.
 */
export function parseInline(src: string, streaming = false): InlineNode[] {
  const out: InlineNode[] = [];
  const s = src;
  const len = s.length;
  let text = '';
  let i = 0;

  const flush = () => {
    pushText(out, text);
    text = '';
  };

  while (i < len) {
    const c = s[i]!;
    const prev = i > 0 ? s[i - 1] : undefined;

    if (c === '\\') {
      const next = s[i + 1];
      if (next === undefined) {
        if (!streaming) text += c;
        i++;
      } else if (next === '\n') {
        flush();
        out.push({ type: 'break' });
        i += 2;
      } else if (isPunct(next)) {
        text += next;
        i += 2;
      } else {
        text += c;
        i++;
      }
      continue;
    }

    if (c === '\n') {
      if (/ {2,}$/.test(text)) {
        text = text.replace(/ +$/, '');
        flush();
        out.push({ type: 'break' });
      } else {
        text = text.replace(/ +$/, '') + ' ';
      }
      i++;
      while (s[i] === ' ') i++;
      continue;
    }

    if (c === '`') {
      const n = runLength(s, i, '`');
      const close = codeSpanEnd(s, i, n);
      if (close !== -1) {
        let code = s.slice(i + n, close).replace(/\n/g, ' ');
        if (/^ .*[^ ].* $/.test(code)) code = code.slice(1, -1);
        flush();
        out.push({ type: 'code', text: code });
        i = close + n;
      } else if (streaming) {
        flush();
        if (i + n < len) {
          out.push({ type: 'code', text: s.slice(i + n), partial: true });
        }
        i = len;
      } else {
        text += s.slice(i, i + n);
        i += n;
      }
      continue;
    }

    if (c === '*' || c === '_' || c === '~') {
      const n = runLength(s, i, c);
      const next = s[i + n];
      const kinds = delimiterKinds(c, n);
      if (streaming && i + n === len) {
        // Dangling marker at the end of the stream: wait for more input.
        i = len;
        continue;
      }
      if (kinds && canOpen(c, prev, next)) {
        const close = findCloser(s, i + n, c, n);
        if (close !== -1) {
          flush();
          out.push(wrap(kinds, parseInline(s.slice(i + n, close)), false));
          i = close + n;
          continue;
        }
        if (streaming && !isAlnum(prev)) {
          flush();
          out.push(wrap(kinds, parseInline(s.slice(i + n), true), true));
          i = len;
          continue;
        }
      }
      text += s.slice(i, i + n);
      i += n;
      continue;
    }

    if (c === '[' || (c === '!' && s[i + 1] === '[')) {
      const open = c === '!' ? i + 1 : i;
      if (streaming && open + 1 === len) {
        if (c === '!') text += '!';
        i = len;
        continue;
      }
      const close = findBracketClose(s, open + 1);
      const label = s.slice(open + 1, close === -1 ? len : close);
      if (close !== -1 && s[close + 1] === '(') {
        const dest = parseDestination(s, close + 1);
        if (dest.end !== -1 || streaming) {
          flush();
          const node: InlineNode = {
            type: 'link',
            href: dest.href,
            children: parseInline(label),
          };
          if (dest.title !== undefined) node.title = dest.title;
          if (dest.end === -1) node.partial = true;
          out.push(node);
          i = dest.end === -1 ? len : dest.end;
          continue;
        }
      } else if (streaming && (close === -1 || close + 1 === len)) {
        // `[label` or `[label]` at the end: very likely a link in progress.
        flush();
        out.push({
          type: 'link',
          href: '',
          children: parseInline(label, close === -1),
          partial: true,
        });
        i = len;
        continue;
      }
      text += s.slice(i, open + 1);
      i = open + 1;
      continue;
    }

    if (c === '<') {
      const m = /^<(https?:\/\/[^\s<>]+|mailto:[^\s<>]+)>/.exec(s.slice(i));
      if (m) {
        flush();
        out.push({
          type: 'link',
          href: m[1]!,
          children: [{ type: 'text', text: m[1]! }],
        });
        i += m[0].length;
        continue;
      }
    }

    if (c === 'h' && (prev === undefined || isWs(prev) || prev === '(')) {
      const m = URL_RE.exec(s.slice(i, i + 2048));
      if (m) {
        flush();
        const url = m[0];
        const node: InlineNode = {
          type: 'link',
          href: url,
          children: [{ type: 'text', text: url }],
        };
        if (streaming && i + url.length === len) node.partial = true;
        out.push(node);
        i += url.length;
        continue;
      }
    }

    text += c;
    i++;
  }

  flush();
  return out;
}

/** Concatenated plain text of an inline tree. Handy for accessibility labels and tests. */
export function inlineToText(nodes: readonly InlineNode[]): string {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text' || n.type === 'code') out += n.text;
    else if (n.type === 'break') out += '\n';
    else out += inlineToText(n.children);
  }
  return out;
}
