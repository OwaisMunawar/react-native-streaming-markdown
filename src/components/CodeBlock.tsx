import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { CodeBlockProps } from './context';
import { useRenderContext } from './context';

/** Built-in fenced code block: language label, optional copy button, horizontal scroll. */
export function DefaultCodeBlock({ code, language, closed, onCopy }: CodeBlockProps) {
  const { styles, selectable } = useRenderContext();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = () => {
    onCopy?.();
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  const showHeader = language !== '' || onCopy !== undefined;

  return (
    <View style={styles.code}>
      {showHeader && (
        <View style={styles.codeHeader}>
          <Text style={styles.codeLang}>{language}</Text>
          {onCopy && (
            <Pressable
              onPress={handleCopy}
              disabled={!closed}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Copy code"
              accessibilityState={{ disabled: !closed }}
            >
              <Text style={[styles.codeCopy, !closed && styles.codeCopyDisabled]}>
                {copied ? 'Copied' : 'Copy'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.codeBody}>
          <Text style={styles.codeText} selectable={selectable}>
            {code}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
