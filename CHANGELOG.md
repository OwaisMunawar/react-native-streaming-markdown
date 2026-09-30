# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-09-30

### Added

- `StreamingMarkdown` component with light and dark themes, theme overrides and
  renderer overrides for code blocks, headings, blockquotes and rules.
- `createStreamingParser()` incremental parser that freezes completed blocks and
  re-parses only the trailing block on each update.
- `parse()` and `parseInline()` pure functions, and the `useStreamingMarkdown()`
  hook.
- Streaming rules for partial input: unclosed emphasis, code spans, links, code
  fences and table rows render as they will look once complete, and dangling
  markers are hidden.
- Headings, paragraphs, emphasis, strikethrough, inline code, links, autolinks,
  ordered, unordered and task lists (one nesting level), blockquotes, fenced
  code, GFM tables and horizontal rules.
- Accessibility roles for headings, links, lists, tables, checkboxes and the
  copy button.
- Expo SDK 57 example app that simulates a streaming reply.
- Benchmark script comparing incremental and full re-parsing.

[Unreleased]: https://github.com/OwaisMunawar/react-native-streaming-markdown/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/OwaisMunawar/react-native-streaming-markdown/releases/tag/v0.1.0
