import { Platform } from 'react-native';

/** Colours used by the default renderers. */
export interface MarkdownColors {
  text: string;
  /** Secondary text: blockquotes, list markers, code language label. */
  muted: string;
  link: string;
  border: string;
  codeBackground: string;
  codeText: string;
  inlineCodeBackground: string;
  inlineCodeText: string;
  blockquoteBar: string;
  tableHeaderBackground: string;
}

/** Visual tokens for {@link StreamingMarkdown}. */
export interface MarkdownTheme {
  colors: MarkdownColors;
  /** Base font size for body text. */
  fontSize: number;
  /** Base line height for body text. */
  lineHeight: number;
  /** Body font family. `undefined` uses the platform default. */
  fontFamily?: string;
  /** Font family for code blocks and inline code. */
  monoFontFamily: string;
  /** Font size multipliers for heading levels 1 to 6. */
  headingScale: readonly [number, number, number, number, number, number];
  /** Vertical gap between blocks. */
  blockSpacing: number;
  /** Corner radius of code blocks and tables. */
  radius: number;
}

/** A theme override: every field optional, `colors` merged key by key. */
export type MarkdownThemeOverride = Partial<Omit<MarkdownTheme, 'colors'>> & {
  colors?: Partial<MarkdownColors>;
};

const mono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
});

const shared = {
  fontSize: 16,
  lineHeight: 24,
  monoFontFamily: mono,
  headingScale: [1.75, 1.5, 1.25, 1.125, 1, 0.875] as const,
  blockSpacing: 12,
  radius: 8,
};

/** Default light theme. */
export const lightTheme: MarkdownTheme = {
  ...shared,
  colors: {
    text: '#1f2328',
    muted: '#59636e',
    link: '#0969da',
    border: '#d1d9e0',
    codeBackground: '#f6f8fa',
    codeText: '#1f2328',
    inlineCodeBackground: '#eff1f3',
    inlineCodeText: '#1f2328',
    blockquoteBar: '#d1d9e0',
    tableHeaderBackground: '#f6f8fa',
  },
};

/** Default dark theme. */
export const darkTheme: MarkdownTheme = {
  ...shared,
  colors: {
    text: '#e6edf3',
    muted: '#9198a1',
    link: '#4493f8',
    border: '#3d444d',
    codeBackground: '#151b23',
    codeText: '#e6edf3',
    inlineCodeBackground: '#262c36',
    inlineCodeText: '#e6edf3',
    blockquoteBar: '#3d444d',
    tableHeaderBackground: '#151b23',
  },
};

/** Merges an override onto a base theme. Returns `base` itself when there is nothing to merge. */
export function mergeTheme(
  base: MarkdownTheme,
  override?: MarkdownThemeOverride
): MarkdownTheme {
  if (!override) return base;
  return {
    ...base,
    ...override,
    colors: { ...base.colors, ...override.colors },
  };
}
