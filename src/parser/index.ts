import type { Block, ParseOptions } from '../types';
import { buildBlock, parseBlocks } from './build';
import { Scanner } from './scan';

/**
 * Parses a markdown string into blocks in one pass.
 *
 * Pure and stateless. For text that grows over time prefer
 * {@link createStreamingParser}, which returns the same result but only
 * re-parses the trailing block on each call.
 *
 * @example
 * ```ts
 * const blocks = parse('# Hello\n\nSome **bold** text');
 * ```
 */
export function parse(text: string, options: ParseOptions = {}): Block[] {
  return parseBlocks(text, options.streaming ?? true);
}

/** Incremental parser returned by {@link createStreamingParser}. */
export interface StreamingParser {
  /**
   * Parses `text` and returns its blocks. When `text` extends the previous
   * input, completed blocks are returned as the same object instances.
   */
  update(text: string): Block[];
  /** Drops all cached state. */
  reset(): void;
}

/**
 * Creates a stateful parser for text that is appended to over time, such as
 * an LLM response.
 *
 * A block is frozen once the line that ended it has been fully received; it is
 * never parsed again and keeps its object identity, so memoised renderers skip
 * it. Each update therefore costs roughly the size of the last block rather
 * than the size of the document.
 *
 * Input that is not an append (the text was edited or replaced) is handled
 * with a full re-parse, still reusing any block whose source is unchanged.
 */
export function createStreamingParser(options: ParseOptions = {}): StreamingParser {
  const streaming = options.streaming ?? true;

  let lastText: string | null = null;
  let lastResult: Block[] = [];
  /** Blocks that can no longer change. */
  let frozen: Block[] = [];
  /** Length of source covered by `frozen`: up to the line after the last frozen block. */
  let frozenEnd = 0;
  /**
   * Source that must be unchanged for `frozen` to stay valid. Longer than
   * `frozenEnd` when a block's end was decided by looking at later lines.
   */
  let guard = '';
  /** Unfrozen blocks from the previous update, keyed for reuse. */
  let tailCache = new Map<string, Block>();

  const reset = () => {
    lastText = null;
    lastResult = [];
    frozen = [];
    frozenEnd = 0;
    guard = '';
    tailCache = new Map();
  };

  const update = (text: string): Block[] => {
    if (text === lastText) return lastResult;

    // Equality on a slice is much faster than startsWith in V8 for long,
    // non-flat strings (which is what `prev + chunk` produces).
    if (text.length < guard.length || text.slice(0, guard.length) !== guard) {
      // Not an append. Re-parse everything, but keep previous blocks in the
      // cache so unchanged ones retain their identity.
      for (const b of lastResult) tailCache.set(cacheKey(b), b);
      frozen = [];
      frozenEnd = 0;
      guard = '';
    }

    const offset = frozenEnd;
    const lines = text.slice(offset).split('\n');
    const ranges = Scanner.create(lines, streaming).scan();
    const complete = lines.length - 1;

    const nextCache = new Map<string, Block>();
    const tail: Block[] = [];
    let freezeCount = 0;
    let freezeLine = 0;
    let guardLine = 0;

    ranges.forEach((range, i) => {
      const isLast = i === ranges.length - 1;
      const key = String(frozen.length + i);
      const open = streaming && isLast;
      const raw = lines.slice(range.start, range.end).join('\n');
      const cached = tailCache.get(cacheKey({ key, raw, open }));
      const block = cached ?? buildBlock(range, lines, key, open);
      nextCache.set(cacheKey(block), block);
      tail.push(block);

      if (!isLast && freezeCount === i && range.decidedBy < complete) {
        freezeCount = i + 1;
        freezeLine = range.end;
        guardLine = Math.max(guardLine, range.decidedBy + 1);
      }
    });

    if (freezeCount > 0) {
      let chars = 0;
      let guardChars = 0;
      for (let l = 0; l < guardLine; l++) {
        if (l < freezeLine) chars += lines[l]!.length + 1;
        guardChars += lines[l]!.length + 1;
      }
      frozen = frozen.concat(tail.slice(0, freezeCount));
      frozenEnd = offset + chars;
      if (offset + guardChars > guard.length) guard = text.slice(0, offset + guardChars);
    }

    tailCache = nextCache;
    lastText = text;
    lastResult = frozen.concat(tail.slice(freezeCount));
    return lastResult;
  };

  return { update, reset };
}

function cacheKey(b: Pick<Block, 'key' | 'raw' | 'open'>): string {
  return `${b.key}\u0000${b.open ? 1 : 0}\u0000${b.raw}`;
}

export { parseInline, inlineToText } from './inline';
