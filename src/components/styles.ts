import { StyleSheet } from 'react-native';
import type { MarkdownTheme } from '../theme';

export function createStyles(t: MarkdownTheme) {
  const { colors } = t;
  const body = {
    color: colors.text,
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    ...(t.fontFamily ? { fontFamily: t.fontFamily } : null),
  };
  return StyleSheet.create({
    root: { gap: t.blockSpacing },
    text: body,
    strong: { fontWeight: '700' },
    em: { fontStyle: 'italic' },
    del: { textDecorationLine: 'line-through' },
    link: { color: colors.link, textDecorationLine: 'underline' },
    inlineCode: {
      fontFamily: t.monoFontFamily,
      fontSize: t.fontSize * 0.875,
      color: colors.inlineCodeText,
      backgroundColor: colors.inlineCodeBackground,
    },
    heading: { ...body, fontWeight: '700' },
    hr: { height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.border },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: colors.blockquoteBar,
      paddingLeft: 12,
      gap: t.blockSpacing,
    },
    list: { gap: 4 },
    listItem: { flexDirection: 'row' },
    listMarker: { ...body, color: colors.muted, minWidth: 22, paddingRight: 6 },
    listBody: { flex: 1, gap: 4 },
    checkbox: {
      width: 14,
      height: 14,
      marginTop: (t.lineHeight - 14) / 2,
      marginRight: 8,
      borderRadius: 3,
      borderWidth: 1.5,
      borderColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxFill: { width: 7, height: 7, borderRadius: 1, backgroundColor: colors.link },
    code: {
      backgroundColor: colors.codeBackground,
      borderRadius: t.radius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    codeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingTop: 8,
    },
    codeLang: { color: colors.muted, fontSize: 12, fontFamily: t.monoFontFamily },
    codeCopy: { color: colors.muted, fontSize: 12, fontWeight: '600' },
    codeCopyDisabled: { opacity: 0.4 },
    codeBody: { padding: 12 },
    codeText: {
      color: colors.codeText,
      fontFamily: t.monoFontFamily,
      fontSize: t.fontSize * 0.8125,
      lineHeight: t.lineHeight * 0.875,
    },
    table: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: t.radius,
      overflow: 'hidden',
    },
    tableRow: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    tableHeaderRow: {
      flexDirection: 'row',
      backgroundColor: colors.tableHeaderBackground,
    },
    tableCell: { paddingHorizontal: 10, paddingVertical: 6 },
    tableHeaderText: { fontWeight: '700' },
  });
}

export type MarkdownStyles = ReturnType<typeof createStyles>;
