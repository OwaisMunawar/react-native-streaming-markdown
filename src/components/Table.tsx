import { ScrollView, Text, View } from 'react-native';
import { inlineToText } from '../parser/inline';
import type { InlineNode, TableAlign, TableBlock } from '../types';
import { useRenderContext } from './context';
import { renderInline } from './Inline';

const MIN_COL = 72;
const MAX_COL = 280;
/** Average glyph width relative to font size; slightly generous so bold headers fit. */
const CHAR_RATIO = 0.62;
const CELL_PADDING = 28;

/**
 * Column widths are estimated from content length rather than measured, so
 * a streaming table lays out in one pass without onLayout round trips.
 */
function columnWidths(block: TableBlock, fontSize: number): number[] {
  return block.header.map((_, col) => {
    let longest = inlineToText(block.header[col]!).length;
    for (const row of block.rows) {
      longest = Math.max(longest, inlineToText(row[col] ?? []).length);
    }
    return Math.min(
      MAX_COL,
      Math.max(MIN_COL, longest * fontSize * CHAR_RATIO + CELL_PADDING)
    );
  });
}

const textAlign = (a: TableAlign) => a ?? 'left';

export function Table({ block }: { block: TableBlock }) {
  const ctx = useRenderContext();
  const { styles, selectable, theme } = ctx;
  const widths = columnWidths(block, theme.fontSize);

  const renderRow = (cells: InlineNode[][], header: boolean, key: string) => (
    <View key={key} role="row" style={header ? styles.tableHeaderRow : styles.tableRow}>
      {cells.map((cell, col) => (
        <View
          key={col}
          role={header ? 'columnheader' : 'cell'}
          style={[styles.tableCell, { width: widths[col] }]}
        >
          <Text
            selectable={selectable}
            style={[
              styles.text,
              header && styles.tableHeaderText,
              { textAlign: textAlign(block.align[col] ?? null) },
            ]}
          >
            {renderInline(cell, ctx)}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View role="table" style={styles.table}>
        {renderRow(block.header, true, 'h')}
        {block.rows.map((row, i) => renderRow(row, false, String(i)))}
      </View>
    </ScrollView>
  );
}
