import { memo } from 'react';
import { Text, View } from 'react-native';
import type { Block, ListBlock, ListItem } from '../types';
import { DefaultCodeBlock } from './CodeBlock';
import { useRenderContext } from './context';
import { renderInline } from './Inline';
import { Table } from './Table';

/**
 * Renders one block. Memoised on the block object: the incremental parser
 * hands back the same instance for completed blocks, so only the growing
 * block re-renders while text streams in.
 */
export const BlockView = memo(function MarkdownBlock({ block }: { block: Block }) {
  const ctx = useRenderContext();
  const { styles, theme, components, selectable } = ctx;

  switch (block.type) {
    case 'paragraph':
      return (
        <Text style={styles.text} selectable={selectable}>
          {renderInline(block.children, ctx)}
        </Text>
      );

    case 'heading': {
      const content = renderInline(block.children, ctx);
      if (components.heading) {
        const Heading = components.heading;
        return (
          <Heading level={block.level} theme={theme}>
            {content}
          </Heading>
        );
      }
      const scale = theme.headingScale[block.level - 1]!;
      return (
        <Text
          accessibilityRole="header"
          selectable={selectable}
          style={[
            styles.heading,
            { fontSize: theme.fontSize * scale, lineHeight: theme.lineHeight * scale },
          ]}
        >
          {content}
        </Text>
      );
    }

    case 'code': {
      const Code = components.code ?? DefaultCodeBlock;
      const { onCopyCode } = ctx;
      return (
        <Code
          code={block.text}
          language={block.lang}
          closed={block.closed}
          theme={theme}
          onCopy={onCopyCode ? () => onCopyCode(block.text, block.lang) : undefined}
        />
      );
    }

    case 'blockquote': {
      const children = block.children.map((b) => <BlockView key={b.key} block={b} />);
      if (components.blockquote) {
        const Quote = components.blockquote;
        return <Quote theme={theme}>{children}</Quote>;
      }
      return <View style={styles.blockquote}>{children}</View>;
    }

    case 'list':
      return <List list={block} />;

    case 'table':
      return <Table block={block} />;

    case 'hr': {
      if (components.hr) {
        const Hr = components.hr;
        return <Hr theme={theme} />;
      }
      return <View role="separator" style={styles.hr} />;
    }
  }
});

function List({ list }: { list: ListBlock }) {
  return (
    <View role="list" style={useRenderContext().styles.list}>
      {list.items.map((item, i) => (
        <Item key={i} item={item} marker={list.ordered ? `${list.start + i}.` : '•'} />
      ))}
    </View>
  );
}

function Item({ item, marker }: { item: ListItem; marker: string }) {
  const ctx = useRenderContext();
  const { styles, selectable } = ctx;
  return (
    <View role="listitem" style={styles.listItem}>
      {item.checked === undefined ? (
        <Text style={styles.listMarker}>{marker}</Text>
      ) : (
        <View
          style={styles.checkbox}
          accessible
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.checked }}
        >
          {item.checked && <View style={styles.checkboxFill} />}
        </View>
      )}
      <View style={styles.listBody}>
        <Text style={styles.text} selectable={selectable}>
          {renderInline(item.children, ctx)}
        </Text>
        {item.sublist && <List list={item.sublist} />}
      </View>
    </View>
  );
}
