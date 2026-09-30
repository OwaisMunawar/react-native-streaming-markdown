import { useCallback, useMemo, useRef } from 'react';
import {
  Linking,
  View,
  useColorScheme,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlockView } from './components/BlockView';
import {
  RenderContext,
  type MarkdownComponents,
  type RenderContextValue,
} from './components/context';
import { createStyles } from './components/styles';
import { darkTheme, lightTheme, mergeTheme, type MarkdownThemeOverride } from './theme';
import { useStreamingMarkdown } from './useStreamingMarkdown';

/** Props for {@link StreamingMarkdown}. */
export interface StreamingMarkdownProps {
  /** Markdown received so far. Pass the whole string on every update, not the delta. */
  text: string;
  /**
   * Whether more text may still arrive. Set to `false` when the response is
   * complete so a trailing unclosed `**` or backtick renders literally.
   * @default true
   */
  streaming?: boolean;
  /** Overrides merged over the light or dark base theme. */
  theme?: MarkdownThemeOverride;
  /** Picks the base theme. Defaults to the system colour scheme. */
  colorScheme?: 'light' | 'dark';
  /** Replace built-in renderers for specific block types. */
  components?: MarkdownComponents;
  /** Called when a link is pressed. Defaults to `Linking.openURL`. */
  onLinkPress?: (href: string) => void;
  /**
   * Called by the copy button on code blocks. The library has no clipboard
   * dependency, so the button only appears when this is provided.
   */
  onCopyCode?: (code: string, language: string) => void;
  /** Allow text selection in paragraphs and code. @default true */
  selectable?: boolean;
  /** Style for the outer container. */
  style?: StyleProp<ViewStyle>;
}

function defaultLinkPress(href: string) {
  Linking.openURL(href).catch(() => {});
}

/** Keeps the previous object when the new one is shallowly equal (one level into `colors`). */
function useShallowStable<T extends object | undefined>(value: T): T {
  const ref = useRef(value);
  if (!shallowEqual(ref.current, value)) ref.current = value;
  return ref.current;
}

function shallowEqual(a: object | undefined, b: object | undefined, depth = 1): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a) as (keyof typeof a)[];
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => {
    const va: unknown = a[k];
    const vb: unknown = b[k];
    if (va === vb) return true;
    return (
      depth > 0 &&
      typeof va === 'object' &&
      typeof vb === 'object' &&
      va !== null &&
      vb !== null &&
      shallowEqual(va, vb, depth - 1)
    );
  });
}

/**
 * Markdown renderer for text that is still being generated.
 *
 * Completed blocks are parsed once and memoised; each update only re-parses
 * and re-renders the trailing block. Unclosed syntax at the end of the stream
 * (`**bol`, an open code fence, a half-typed link or table row) renders the
 * way it will look once complete, instead of flashing raw markdown.
 *
 * @example
 * ```tsx
 * <StreamingMarkdown
 *   text={reply}
 *   streaming={!done}
 *   onCopyCode={(code) => Clipboard.setStringAsync(code)}
 * />
 * ```
 */
export function StreamingMarkdown({
  text,
  streaming = true,
  theme: themeOverride,
  colorScheme,
  components,
  onLinkPress,
  onCopyCode,
  selectable = true,
  style,
}: StreamingMarkdownProps) {
  const system = useColorScheme();
  const scheme = colorScheme ?? (system === 'dark' ? 'dark' : 'light');
  const override = useShallowStable(themeOverride);
  const stableComponents = useShallowStable(components);

  const theme = useMemo(
    () => mergeTheme(scheme === 'dark' ? darkTheme : lightTheme, override),
    [scheme, override]
  );
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Callbacks are read through refs so inline arrow functions do not
  // invalidate the context and re-render every block.
  const linkRef = useRef(onLinkPress);
  linkRef.current = onLinkPress;
  const copyRef = useRef(onCopyCode);
  copyRef.current = onCopyCode;
  const handleLink = useCallback(
    (href: string) => (linkRef.current ?? defaultLinkPress)(href),
    []
  );
  const handleCopy = useCallback(
    (code: string, lang: string) => copyRef.current?.(code, lang),
    []
  );
  const hasCopy = onCopyCode !== undefined;

  const ctx = useMemo<RenderContextValue>(
    () => ({
      theme,
      styles,
      components: stableComponents ?? {},
      selectable,
      onLinkPress: handleLink,
      ...(hasCopy ? { onCopyCode: handleCopy } : null),
    }),
    [theme, styles, stableComponents, selectable, handleLink, handleCopy, hasCopy]
  );

  const blocks = useStreamingMarkdown(text, { streaming });

  return (
    <RenderContext.Provider value={ctx}>
      <View style={[styles.root, style]}>
        {blocks.map((block) => (
          <BlockView key={block.key} block={block} />
        ))}
      </View>
    </RenderContext.Provider>
  );
}
