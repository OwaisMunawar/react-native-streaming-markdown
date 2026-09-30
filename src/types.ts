/** A node inside a paragraph, heading, list item or table cell. `partial` marks syntax whose closing marker has not arrived. */
export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: InlineNode[]; partial?: boolean }
  | { type: 'em'; children: InlineNode[]; partial?: boolean }
  | { type: 'del'; children: InlineNode[]; partial?: boolean }
  | { type: 'code'; text: string; partial?: boolean }
  | {
      type: 'link';
      href: string;
      title?: string;
      children: InlineNode[];
      /** The closing `)` has not arrived yet, so `href` may be truncated. */
      partial?: boolean;
    }
  | { type: 'break' };

/** Column alignment from a GFM delimiter row (`:--`, `:-:`, `--:`). */
export type TableAlign = 'left' | 'center' | 'right' | null;

/** One item of a {@link ListBlock}. */
export interface ListItem {
  children: InlineNode[];
  /** GFM task list state; undefined for a normal item. */
  checked?: boolean;
  /** One level of nesting is supported. */
  sublist?: ListBlock;
}

interface BlockBase {
  /** Stable React key. Derived from position, so it never changes once a block is complete. */
  key: string;
  /** Source text of the block. */
  raw: string;
  /**
   * True for the trailing block of a streaming parse: it may still grow, and
   * unclosed syntax inside it was rendered optimistically.
   */
  open: boolean;
}

/** ATX heading, `#` to `######`. */
export interface HeadingBlock extends BlockBase {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: InlineNode[];
}

/** A paragraph of inline content. */
export interface ParagraphBlock extends BlockBase {
  type: 'paragraph';
  children: InlineNode[];
}

/** Fenced code block. */
export interface CodeBlock extends BlockBase {
  type: 'code';
  lang: string;
  text: string;
  /** False while the closing fence has not been received. */
  closed: boolean;
}

/** Ordered or unordered list, optionally with task items. */
export interface ListBlock extends BlockBase {
  type: 'list';
  ordered: boolean;
  start: number;
  items: ListItem[];
}

/** Blockquote; its content is parsed as nested blocks. */
export interface BlockquoteBlock extends BlockBase {
  type: 'blockquote';
  children: Block[];
}

/** GFM table. Every row has exactly as many cells as the header. */
export interface TableBlock extends BlockBase {
  type: 'table';
  align: TableAlign[];
  header: InlineNode[][];
  rows: InlineNode[][][];
}

/** Horizontal rule. */
export interface HrBlock extends BlockBase {
  type: 'hr';
}

/** Any top-level or nested block produced by the parser. Discriminated on `type`. */
export type Block =
  | HeadingBlock
  | ParagraphBlock
  | CodeBlock
  | ListBlock
  | BlockquoteBlock
  | TableBlock
  | HrBlock;

/** Options for {@link parse}, {@link createStreamingParser} and {@link useStreamingMarkdown}. */
export interface ParseOptions {
  /**
   * Treat the input as a prefix of a document that is still arriving.
   * The last block is parsed leniently: unclosed emphasis renders as
   * in-progress formatting and dangling markers are hidden.
   * @default true
   */
  streaming?: boolean;
}
