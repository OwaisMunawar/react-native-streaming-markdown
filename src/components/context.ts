import { createContext, useContext, type ComponentType, type ReactNode } from 'react';
import type { MarkdownTheme } from '../theme';
import type { MarkdownStyles } from './styles';

/** Props passed to a custom `code` renderer. */
export interface CodeBlockProps {
  /** Code without the surrounding fences. */
  code: string;
  /** First word of the info string, e.g. `ts`. Empty when absent. */
  language: string;
  /** False while the closing fence has not arrived. */
  closed: boolean;
  theme: MarkdownTheme;
  /** Present when `onCopyCode` was passed to `StreamingMarkdown`. */
  onCopy?: () => void;
}

/** Props passed to a custom `heading` renderer. */
export interface HeadingProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  /** Rendered inline content. */
  children: ReactNode;
  theme: MarkdownTheme;
}

/** Props passed to a custom `blockquote` renderer. */
export interface BlockquoteProps {
  /** Rendered child blocks. */
  children: ReactNode;
  theme: MarkdownTheme;
}

/** Props passed to a custom `hr` renderer. */
export interface HrProps {
  theme: MarkdownTheme;
}

/** Renderer overrides. Anything not provided uses the built-in component. */
export interface MarkdownComponents {
  code?: ComponentType<CodeBlockProps>;
  heading?: ComponentType<HeadingProps>;
  blockquote?: ComponentType<BlockquoteProps>;
  hr?: ComponentType<HrProps>;
}

export interface RenderContextValue {
  theme: MarkdownTheme;
  styles: MarkdownStyles;
  components: MarkdownComponents;
  selectable: boolean;
  onLinkPress: (href: string) => void;
  onCopyCode?: (code: string, language: string) => void;
}

export const RenderContext = createContext<RenderContextValue | null>(null);

export function useRenderContext(): RenderContextValue {
  const ctx = useContext(RenderContext);
  if (!ctx)
    throw new Error('Markdown blocks must be rendered inside <StreamingMarkdown>.');
  return ctx;
}
