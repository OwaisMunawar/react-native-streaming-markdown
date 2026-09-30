# Architecture

This document explains how the parser stays cheap while text streams in, and
records the alternatives that were considered and rejected. Each decision is
written as a short ADR: context, decision, consequences.

## Overview

```
text ──► Scanner ──► BlockRange[] ──► buildBlock ──► Block[] ──► <BlockView memo>
          (lines)     (start, end,      (inline parse          (one per block,
                       decidedBy)        per block)             keyed by index)
```

1. **Scanner** (`src/parser/scan.ts`) splits lines into block ranges. It never
   looks at inline syntax.
2. **Builder** (`src/parser/build.ts`) turns a range into a typed `Block`,
   running the inline parser on its content.
3. **Incremental parser** (`src/parser/index.ts`) decides which blocks are
   final and only re-scans the text after them.
4. **Renderer** (`src/components/BlockView.tsx`) is `React.memo`'d on the block
   object, so a block that keeps its identity is never rendered again.

---

## ADR 1: Freeze blocks by the line that decided them

**Context.** Streaming means every update is a prefix of the final document.
Most of that prefix cannot change any more, but "most" has to be exact: a
paragraph followed by `| a | b |` could still turn into a paragraph plus a
table, and a list followed by a blank line could still continue.

**Decision.** The scanner records, for every block, `decidedBy`: the furthest
line it had to inspect to know the block had ended (the blank line, the next
heading, the delimiter row of a table that interrupts a paragraph, and so on).
A block is frozen once that line is complete, meaning a `\n` follows it. The
last block is never frozen.

The parser keeps:

- `frozen`: blocks that will never be rebuilt,
- `frozenEnd`: where re-scanning starts (the line after the last frozen block),
- `guard`: the source up to and including every `decidedBy` line. If a new
  input does not start with `guard` it is not an append and the parser falls
  back to a full parse.

**Consequences.** Each update costs roughly the size of the trailing block, not
the document. Correctness is testable: for every prefix of a fixture the
incremental result must deep-equal a fresh `parse()`. That test runs on every
character of the fixture and on uneven chunk sizes.

## ADR 2: Hide pending lines, render unclosed inline syntax optimistically

**Context.** Flicker comes from states that briefly look like something else.
A line containing only `-` could become a list item, a rule or text. `**bol`
is bold text whose closing marker has not arrived yet.

**Decision.** Two rules apply only to the trailing block while `streaming` is
true:

- A trailing, unterminated line made only of markdown punctuation (`-`, `#`,
  `` ` ``, `|`, `1.` and similar) is hidden until more text arrives.
- An emphasis, code or link opener with no closer becomes a `partial` node that
  runs to the end of the text. A marker with nothing after it is dropped.
  Optimistic emphasis does not start in the middle of a word, so `2*x` stays
  literal.

When `streaming` is false the same input parses strictly, so a reply that
really does end in `**` shows the asterisks.

**Consequences.** Raw markers never flash on screen. The cost is a delay of a
few characters before a line such as `1990 was` appears, because `1` alone is
held back.

## ADR 3: Stable keys from block position

**Context.** React needs stable keys, and the parser needs a cache key for the
trailing blocks.

**Decision.** Keys are block indexes (`"0"`, `"1"`, nested `"3.0"`). Frozen
blocks never move, so their index is stable. The trailing blocks are also
cached by `(key, open, raw)` between updates, so an update that does not touch
a trailing block (a hidden pending line, for example) returns the same object.

**Consequences.** If the trailing block changes type (a paragraph becoming a
table) it keeps its key and React reconciles it in place. Non-append edits keep
the identity of every block whose source did not change.

## ADR 4: A small purpose-built inline parser

**Context.** The full CommonMark delimiter algorithm handles every edge case of
nested and overlapping emphasis. It also makes the streaming rules hard to
state, because the meaning of a delimiter depends on everything after it.

**Decision.** Emphasis runs are matched by exact length and resolved
recursively. Code spans and escapes are skipped when searching for closers.

**Consequences.** It covers the markdown LLMs produce. Some CommonMark corner
cases differ, for example `*a **b***` does not resolve to nested emphasis.
These are listed in the README roadmap.

## ADR 5: Callbacks through refs, props compared shallowly

**Context.** `React.memo` on blocks is useless if the context value changes on
every render. Callers routinely pass inline `onLinkPress={() => ...}` and
`components={{ code: X }}`.

**Decision.** Callbacks are read through refs and exposed as stable functions.
`theme` and `components` are compared shallowly (one level into `colors`) and
the previous object is kept when nothing changed.

**Consequences.** Inline props are safe. A test renders a streaming document
with a new `components` object and callback on every update and asserts that
completed headings render exactly once.

---

## Rejected alternatives

### Memoising the output of markdown-it, marked or remark

These parsers are built for complete documents. Feeding them each prefix means
a full parse per token, which is O(n²) over a reply. Memoising their output
does not help because the token stream or AST is rebuilt from scratch each
time, so nothing has stable identity to memoise on. Diffing the new tree
against the old one to recover identity costs another full traversal. They
also render unclosed syntax literally, which is the flicker this library
exists to remove. Wrapping them would need a pre-processor that "closes" open
syntax, and that pre-processor is most of the work anyway.

### Splitting on blank lines and parsing each chunk

This is the obvious first step and it is wrong often enough to matter: fenced
code contains blank lines, lists continue across them, and tables and headings
can follow a paragraph without one. ADR 1 is the precise version of this idea.

### Parsing deltas instead of the full text

An API that takes only the new chunk forces callers to keep the parser and
their state in sync, and breaks on retries or edits. Taking the full text and
detecting appends internally is simpler to use and costs one string comparison
(see below).

### `String.prototype.startsWith` for append detection

Strings built by `prev + chunk` are ropes in V8, and `startsWith` on them was
measured at roughly 100x slower than comparing a slice with `===`. The parser
uses the slice comparison.

### Measuring table columns with `onLayout`

Measuring gives exact column widths but needs a second render pass per update,
which shows up as jitter while rows stream in. Widths are estimated from
content length instead and clamped to a range.
