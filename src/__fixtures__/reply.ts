/** A representative assistant reply exercising every supported block type. */
export const reply = `## Debouncing a search input

You usually want to **debounce** the query so the API is only hit once the user
stops typing. The *simplest* version keeps the timer in a \`ref\`:

\`\`\`tsx
function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
\`\`\`

A few things to watch for:

1. Cancel in-flight requests with an \`AbortController\`.
2. Keep the **latest** response only:
   - compare a request id, or
   - ignore results after unmount.
3. Show a spinner after ~150 ms, not immediately.

> Tip: on Android the soft keyboard can fire extra \`onChangeText\` events,
> so a delay under 200 ms often feels jittery.

| Approach | Requests per word | Complexity |
| :-- | :-: | --: |
| No debounce | 6 | low |
| Debounce 300 ms | 1 | low |
| Debounce + abort | 1 | medium |

- [x] debounce the value
- [ ] abort stale requests

---

See the [React docs](https://react.dev/reference/react/useEffect "useEffect") or
https://developer.mozilla.org/docs/Web/API/AbortController for details. ~~Old API~~ is deprecated.
`;
