import { useMemo, useRef } from 'react';
import { createStreamingParser, type StreamingParser } from './parser';
import type { Block, ParseOptions } from './types';

/**
 * Parses streaming markdown with a parser that lives for the lifetime of the
 * component. Completed blocks keep their identity between renders, which is
 * what lets `React.memo` skip them.
 *
 * @param text - The full text received so far.
 * @param options - `streaming: false` once the response has finished, so
 *   unclosed syntax at the end is shown literally instead of optimistically.
 * @returns The parsed blocks.
 *
 * @example
 * ```tsx
 * const blocks = useStreamingMarkdown(reply);
 * return blocks.map((b) => <MyBlock key={b.key} block={b} />);
 * ```
 */
export function useStreamingMarkdown(text: string, options: ParseOptions = {}): Block[] {
  const streaming = options.streaming ?? true;
  const ref = useRef<{ parser: StreamingParser; streaming: boolean } | null>(null);
  if (ref.current === null || ref.current.streaming !== streaming) {
    ref.current = { parser: createStreamingParser({ streaming }), streaming };
  }
  const { parser } = ref.current;
  return useMemo(() => parser.update(text), [parser, text]);
}
