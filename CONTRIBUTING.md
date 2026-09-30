# Contributing

Bug reports and pull requests are welcome. For anything larger than a fix,
please open an issue first so we can agree on the approach.

## Setup

The repo is a Yarn workspace: the library lives in the root and the Expo
example app in `example/`. Use the Node version in `.nvmrc`.

```sh
yarn            # install everything, including the example
yarn example start   # run the example (press i, a or w)
```

The example resolves the library from `src/`, so edits show up with fast
refresh and no rebuild.

## Checks

These all run in CI and must pass before merging:

```sh
yarn lint           # ESLint, zero warnings allowed
yarn format:check   # Prettier
yarn typecheck      # tsc, strict
yarn test:coverage  # Jest with coverage thresholds
yarn prepare        # build with react-native-builder-bob
yarn size           # bundle size budget
```

`yarn bench` runs the streaming benchmark. Please include before and after
numbers in PRs that touch `src/parser/`.

## Parser changes

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first. Two tests guard the
incremental parser and should keep passing unchanged:

- every prefix of the fixture must parse the same incrementally and from
  scratch,
- a block whose source did not change between updates must be the same object.

A bug report that says "this renders wrong mid-stream" is easiest to fix with
the exact prefix. Add it as a case in `src/__tests__/parse.test.ts` under
"partial input while streaming".

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/)
(`fix(parser): ...`, `feat: ...`, `docs: ...`). Keep commits small and focused.
