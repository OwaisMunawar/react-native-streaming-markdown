import { reply } from '../__fixtures__/reply';
import { createStreamingParser, parse } from '../parser';
import type { Block } from '../types';

describe('createStreamingParser', () => {
  it('matches a full parse at every prefix of a streamed reply', () => {
    const parser = createStreamingParser();
    for (let i = 0; i <= reply.length; i++) {
      const prefix = reply.slice(0, i);
      expect(parser.update(prefix)).toEqual(parse(prefix));
    }
  });

  it('matches a full parse when fed in uneven chunks', () => {
    const parser = createStreamingParser();
    let i = 0;
    let step = 1;
    while (i < reply.length) {
      i = Math.min(reply.length, i + step);
      step = (step * 7) % 23 || 1;
      const prefix = reply.slice(0, i);
      expect(parser.update(prefix)).toEqual(parse(prefix));
    }
  });

  it('keeps completed blocks referentially identical across appends', () => {
    const parser = createStreamingParser();
    const first = parser.update('# Title\n\nFirst paragraph.\n\n- a\n- b\n\nStill typ');
    expect(first.map((b) => b.type)).toEqual([
      'heading',
      'paragraph',
      'list',
      'paragraph',
    ]);

    const second = parser.update(
      '# Title\n\nFirst paragraph.\n\n- a\n- b\n\nStill typing **now'
    );
    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
    expect(second[2]).toBe(first[2]);
    expect(second[3]).not.toBe(first[3]);
    expect(second[3]).toMatchObject({ open: true });
  });

  it('never rebuilds a block whose source did not change between updates', () => {
    const parser = createStreamingParser();
    let prev = new Map<string, Block>();
    let reused = 0;
    for (let i = 0; i <= reply.length; i++) {
      const blocks = parser.update(reply.slice(0, i));
      for (const b of blocks) {
        const old = prev.get(b.key);
        if (old && old.raw === b.raw && old.open === b.open) {
          expect(b).toBe(old);
          reused++;
        }
      }
      prev = new Map(blocks.map((b) => [b.key, b]));
    }
    // Sanity check that the loop exercised the identity path.
    expect(reused).toBeGreaterThan(reply.length * 3);
  });

  it('returns the same array when called with identical text', () => {
    const parser = createStreamingParser();
    const a = parser.update('hello');
    expect(parser.update('hello')).toBe(a);
  });

  it('re-parses on non-append edits but reuses unchanged blocks', () => {
    const parser = createStreamingParser();
    const before = parser.update('# Title\n\nold text\n\nmore');
    const after = parser.update('# Title\n\nnew text\n\nmore');
    expect(after).toEqual(parse('# Title\n\nnew text\n\nmore'));
    expect(after[0]).toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
  });

  it('does not freeze a paragraph when a pending line could still change it', () => {
    const parser = createStreamingParser();
    parser.update('Intro\n| a | b |');
    const blocks = parser.update('Intro\n| a | b |\n| - | - |\n');
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'table']);
    expect(parser.update('Intro\nplain')).toEqual(parse('Intro\nplain'));
  });

  it('respects streaming: false', () => {
    const parser = createStreamingParser({ streaming: false });
    expect(parser.update('**open')).toEqual(parse('**open', { streaming: false }));
  });

  it('starts over after reset', () => {
    const parser = createStreamingParser();
    const a = parser.update('# a\n\nb');
    parser.reset();
    const b = parser.update('# a\n\nb');
    expect(b).toEqual(a);
    expect(b[0]).not.toBe(a[0]);
  });
});
