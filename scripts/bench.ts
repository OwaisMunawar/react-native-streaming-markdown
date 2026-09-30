/*
 * Streams a ~5k token markdown document into the parser one character at a
 * time and compares the incremental parser against a full re-parse on every
 * update.
 *
 *   yarn bench
 *
 * Each strategy runs ROUNDS times and every statistic is the median across
 * rounds, which keeps the numbers stable on a busy machine.
 */
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { reply } from '../src/__fixtures__/reply';
import { createStreamingParser, parse } from '../src/parser';

const TARGET_CHARS = 20_000; // ~5k tokens at ~4 characters per token
const ROUNDS = 3;

function buildDocument(): string {
  const parts: string[] = [];
  let length = 0;
  for (let i = 1; length < TARGET_CHARS; i++) {
    const section = reply.replace(/^## (.*)$/m, `## ${i}. $1`);
    parts.push(section);
    length += section.length + 1;
  }
  return parts.join('\n');
}

interface Stats {
  total: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

function stats(samples: Float64Array): Stats {
  const sorted = Array.from(samples).sort((a, b) => a - b);
  const pick = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
  const total = sorted.reduce((a, b) => a + b, 0);
  return {
    total,
    mean: total / sorted.length,
    p50: pick(0.5),
    p95: pick(0.95),
    p99: pick(0.99),
    max: sorted[sorted.length - 1]!,
  };
}

function run(doc: string, update: (text: string) => unknown): Stats {
  const samples = new Float64Array(doc.length);
  for (let i = 1; i <= doc.length; i++) {
    const text = doc.slice(0, i);
    const start = performance.now();
    update(text);
    samples[i - 1] = performance.now() - start;
  }
  return stats(samples);
}

const doc = buildDocument();
const blocks = parse(doc, { streaming: false }).length;

// Warm up the JIT on a shorter run of each path.
{
  const warm = doc.slice(0, 4000);
  const p = createStreamingParser();
  for (let i = 1; i <= warm.length; i++) p.update(warm.slice(0, i));
  for (let i = 1; i <= warm.length; i += 7) parse(warm.slice(0, i));
}

function median(rounds: Stats[]): Stats {
  const mid = (key: keyof Stats) =>
    rounds.map((r) => r[key]).sort((a, b) => a - b)[Math.floor(rounds.length / 2)]!;
  return {
    total: mid('total'),
    mean: mid('mean'),
    p50: mid('p50'),
    p95: mid('p95'),
    p99: mid('p99'),
    max: mid('max'),
  };
}

const incrementalRounds: Stats[] = [];
const fullRounds: Stats[] = [];
for (let r = 0; r < ROUNDS; r++) {
  const parser = createStreamingParser();
  incrementalRounds.push(run(doc, (t) => parser.update(t)));
  fullRounds.push(run(doc, (t) => parse(t)));
}
const incremental = median(incrementalRounds);
const full = median(fullRounds);

const fmt = (ms: number) =>
  ms < 1 ? `${(ms * 1000).toFixed(1)} µs` : `${ms.toFixed(2)} ms`;
const row = (name: string, s: Stats) =>
  `| ${name} | ${fmt(s.mean)} | ${fmt(s.p50)} | ${fmt(s.p95)} | ${fmt(s.p99)} | ${fmt(s.max)} | ${(s.total / 1000).toFixed(2)} s |`;

console.log(
  `Document: ${doc.length.toLocaleString('en-US')} chars (~${Math.round(doc.length / 4).toLocaleString('en-US')} tokens), ${blocks} blocks, ${doc.length.toLocaleString('en-US')} updates`
);
console.log(`Machine:  ${os.cpus()[0]?.model ?? 'unknown CPU'}, Node ${process.version}`);
console.log(`Rounds:   ${ROUNDS}, median of each statistic\n`);
console.log('| Strategy | mean / update | p50 | p95 | p99 | max | total |');
console.log('| --- | --- | --- | --- | --- | --- | --- |');
console.log(row('Incremental (`createStreamingParser`)', incremental));
console.log(row('Full re-parse (`parse`)', full));
console.log(
  `\nIncremental is ${(full.mean / incremental.mean).toFixed(1)}x faster on average.`
);
