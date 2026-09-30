export const reply = `## Streaming a chat reply in React Native

Rendering an LLM response as it arrives means the markdown is **always incomplete**.
This renderer handles the awkward in-between states, so \`**bol\` shows as *bold*
and an open code fence is already a code block.

\`\`\`tsx
const [text, setText] = useState('');

for await (const chunk of stream) {
  setText((prev) => prev + chunk);
}

return <StreamingMarkdown text={text} streaming={!done} />;
\`\`\`

### Why it stays smooth

1. Text is split into **blocks** first.
2. A block is frozen once the line that ended it has arrived.
3. Only the last block is parsed and rendered again:
   - completed blocks keep their object identity
   - \`React.memo\` skips them entirely

> Each update costs roughly the size of the last block, not the whole reply.

| Syntax | Mid-stream | Complete |
| :-- | :-: | :-: |
| \`**bold\` | bold | bold |
| \`[link](htt\` | link text | link |
| \`\`\`\` \`\`\`ts \`\`\`\` | code block | code block |

- [x] headings, lists, quotes, tables
- [ ] images (on the roadmap)

---

Read more in the [architecture notes](https://github.com/OwaisMunawar/react-native-streaming-markdown/blob/main/docs/ARCHITECTURE.md).
`;
