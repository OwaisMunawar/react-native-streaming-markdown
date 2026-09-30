import type { ReactNode } from 'react';
import { Text } from 'react-native';
import type { InlineNode } from '../types';
import type { RenderContextValue } from './context';

/** Renders inline nodes as nested `Text` elements. */
export function renderInline(
  nodes: readonly InlineNode[],
  ctx: RenderContextValue,
  prefix = ''
): ReactNode[] {
  const { styles } = ctx;
  return nodes.map((node, i) => {
    const key = `${prefix}${i}`;
    switch (node.type) {
      case 'text':
        return node.text;
      case 'break':
        return '\n';
      case 'code':
        return (
          <Text key={key} style={styles.inlineCode}>
            {node.text}
          </Text>
        );
      case 'strong':
      case 'em':
      case 'del':
        return (
          <Text key={key} style={styles[node.type]}>
            {renderInline(node.children, ctx, `${key}.`)}
          </Text>
        );
      case 'link': {
        const pressable = !node.partial && node.href !== '';
        return (
          <Text
            key={key}
            style={styles.link}
            accessibilityRole="link"
            accessibilityHint={pressable ? node.href : undefined}
            onPress={pressable ? () => ctx.onLinkPress(node.href) : undefined}
          >
            {renderInline(node.children, ctx, `${key}.`)}
          </Text>
        );
      }
    }
  });
}
