import { StreamingMarkdown } from '@owaismunawar/react-native-streaming-markdown';
import * as Clipboard from 'expo-clipboard';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { reply } from './reply';

const TICK_MS = 35;

/** Splits text into token-sized chunks (2 to 6 characters), like an LLM stream. */
function chunk(text: string): string[] {
  const out: string[] = [];
  let seed = 7;
  for (let i = 0; i < text.length;) {
    seed = (seed * 16807) % 2147483647;
    const size = 2 + (seed % 5);
    out.push(text.slice(i, i + size));
    i += size;
  }
  return out;
}

const chunks = chunk(reply);

/** On web, `?progress=0.6` starts the stream at 60%; used for README screenshots. */
function initialProgress(): number {
  const search = (globalThis as { location?: { search?: string } }).location?.search;
  const value = Number(new URLSearchParams(search ?? '').get('progress'));
  return value > 0 && value <= 1 ? Math.round(value * chunks.length) : 0;
}

function useSimulatedStream() {
  const [count, setCount] = useState(initialProgress);
  const [running, setRunning] = useState(() => initialProgress() === 0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (!running) return;
    timer.current = setInterval(() => {
      setCount((c) => {
        if (c >= chunks.length) {
          setRunning(false);
          return c;
        }
        return c + 1;
      });
    }, TICK_MS);
    return () => clearInterval(timer.current);
  }, [running]);

  const restart = useCallback(() => {
    setCount(0);
    setRunning(true);
  }, []);

  return {
    text: chunks.slice(0, count).join(''),
    done: count >= chunks.length,
    running,
    toggle: () => setRunning((r) => !r),
    restart,
  };
}

function Demo() {
  const system = useColorScheme();
  const [dark, setDark] = useState(system === 'dark');
  const stream = useSimulatedStream();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const scheme = dark ? 'dark' : 'light';
  const c = dark ? palette.dark : palette.light;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.screen }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={[styles.toolbar, { borderColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Assistant</Text>
        <View style={styles.actions}>
          <Button
            label={dark ? 'Light' : 'Dark'}
            onPress={() => setDark((d) => !d)}
            c={c}
          />
          <Button
            label={stream.done ? 'Replay' : stream.running ? 'Pause' : 'Resume'}
            onPress={stream.done ? stream.restart : stream.toggle}
            c={c}
          />
        </View>
      </View>
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        onContentSizeChange={() => stream.running && scroll.current?.scrollToEnd()}
      >
        <View style={[styles.userBubble, { backgroundColor: c.user }]}>
          <Text style={[styles.userText, { color: c.text }]}>
            How do I render a streaming AI reply in React Native?
          </Text>
        </View>
        <View
          style={[styles.reply, { backgroundColor: c.bubble, borderColor: c.border }]}
        >
          <StreamingMarkdown
            text={stream.text}
            streaming={!stream.done}
            colorScheme={scheme}
            onCopyCode={(code) => Clipboard.setStringAsync(code)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Button({
  label,
  onPress,
  c,
}: {
  label: string;
  onPress: () => void;
  c: (typeof palette)['light'];
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.button, { borderColor: c.border }]}
    >
      <Text style={[styles.buttonText, { color: c.text }]}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Demo />
    </SafeAreaProvider>
  );
}

const palette = {
  light: {
    screen: '#f3f4f6',
    bubble: '#ffffff',
    user: '#dbeafe',
    border: '#e5e7eb',
    text: '#111827',
  },
  dark: {
    screen: '#0b0d10',
    bubble: '#0d1117',
    user: '#1e3a5f',
    border: '#30363d',
    text: '#e6edf3',
  },
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  button: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  buttonText: { fontSize: 14, fontWeight: '500' },
  content: { padding: 16, gap: 12, maxWidth: 760, width: '100%', alignSelf: 'center' },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: { fontSize: 15, lineHeight: 21 },
  reply: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
});
