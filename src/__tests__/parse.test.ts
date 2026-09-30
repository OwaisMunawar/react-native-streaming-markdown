import { inlineToText, parse, parseInline } from '../parser';
import type { Block, InlineNode } from '../types';

const final = (text: string) => parse(text, { streaming: false });
const only = (blocks: Block[]) => {
  expect(blocks).toHaveLength(1);
  return blocks[0]!;
};
const inline = (text: string, streaming = false) => parseInline(text, streaming);
const t = (text: string): InlineNode => ({ type: 'text', text });

describe('blocks (complete input)', () => {
  it('parses ATX headings and strips closing hashes', () => {
    const blocks = final('# One\n### Three ###\n###### Six');
    expect(blocks.map((b) => b.type === 'heading' && b.level)).toEqual([1, 3, 6]);
    expect(blocks[1]).toMatchObject({ children: [t('Three')] });
  });

  it('requires a space after the hashes', () => {
    expect(only(final('#hashtag')).type).toBe('paragraph');
  });

  it('joins paragraph lines with a space and splits on blank lines', () => {
    const blocks = final('one\ntwo\n\nthree');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'paragraph', children: [t('one two')] });
  });

  it('keeps hard line breaks', () => {
    expect(only(final('one  \ntwo'))).toMatchObject({
      children: [t('one'), { type: 'break' }, t('two')],
    });
  });

  it('parses fenced code with a language', () => {
    expect(only(final('```ts\nconst a = 1;\n\nconst b = 2;\n```'))).toMatchObject({
      type: 'code',
      lang: 'ts',
      text: 'const a = 1;\n\nconst b = 2;',
      closed: true,
    });
  });

  it('does not close a fence with a shorter one or a different character', () => {
    const block = only(final('````\n```\n~~~\n````'));
    expect(block).toMatchObject({ type: 'code', text: '```\n~~~', closed: true });
  });

  it('parses tilde fences and ignores markdown inside code', () => {
    expect(only(final('~~~\n# not a heading\n**x**\n~~~'))).toMatchObject({
      type: 'code',
      lang: '',
      text: '# not a heading\n**x**',
    });
  });

  it('parses unordered lists with one level of nesting', () => {
    const list = only(final('- a\n- b\n  - b1\n  - b2\n- c'));
    expect(list).toMatchObject({ type: 'list', ordered: false });
    if (list.type !== 'list') throw new Error();
    expect(list.items.map((i) => inlineToText(i.children))).toEqual(['a', 'b', 'c']);
    expect(list.items[1]!.sublist?.items.map((i) => inlineToText(i.children))).toEqual([
      'b1',
      'b2',
    ]);
  });

  it('parses ordered lists and keeps the start number', () => {
    expect(only(final('3. three\n4. four'))).toMatchObject({
      type: 'list',
      ordered: true,
      start: 3,
    });
  });

  it('keeps a list together across blank lines and lazy continuation', () => {
    const list = only(final('- a\n\n- b\ncontinued'));
    if (list.type !== 'list') throw new Error();
    expect(list.items).toHaveLength(2);
    expect(inlineToText(list.items[1]!.children)).toBe('b continued');
  });

  it('starts a new list when the bullet character changes', () => {
    expect(final('- a\n* b').map((b) => b.type)).toEqual(['list', 'list']);
  });

  it('parses task list items', () => {
    const list = only(final('- [x] done\n- [ ] todo'));
    if (list.type !== 'list') throw new Error();
    expect(list.items.map((i) => i.checked)).toEqual([true, false]);
  });

  it('parses blockquotes recursively, including lazy lines', () => {
    const quote = only(final('> # Title\n> body\nlazy\n\nafter').slice(0, 1));
    expect(quote).toMatchObject({ type: 'blockquote' });
    if (quote.type !== 'blockquote') throw new Error();
    expect(quote.children.map((b) => b.type)).toEqual(['heading', 'paragraph']);
    expect(quote.children[1]).toMatchObject({ children: [t('body lazy')] });
  });

  it('parses GFM tables with alignment and escaped pipes', () => {
    const table = only(final('| a | b | c |\n|:--|:-:|--:|\n| 1 | x \\| y | 3 |'));
    expect(table).toMatchObject({
      type: 'table',
      align: ['left', 'center', 'right'],
      header: [[t('a')], [t('b')], [t('c')]],
      rows: [[[t('1')], [t('x | y')], [t('3')]]],
    });
  });

  it('pads short rows and truncates long ones to the header width', () => {
    const table = only(final('a | b\n--- | ---\n| 1 |\n1 | 2 | 3'));
    if (table.type !== 'table') throw new Error();
    expect(table.rows.map((r) => r.length)).toEqual([2, 2]);
    expect(table.rows[0]![1]).toEqual([]);
  });

  it('lets a table interrupt a paragraph', () => {
    expect(final('Results:\n| a | b |\n| - | - |\n| 1 | 2 |').map((b) => b.type)).toEqual(
      ['paragraph', 'table']
    );
  });

  it('treats pipes without a delimiter row as a paragraph', () => {
    expect(only(final('a | b\nc | d')).type).toBe('paragraph');
  });

  it('parses horizontal rules in all three styles', () => {
    expect(final('---\n\n* * *\n\n___').map((b) => b.type)).toEqual(['hr', 'hr', 'hr']);
  });

  it('assigns positional keys', () => {
    expect(final('# a\n\nb\n\n---').map((b) => b.key)).toEqual(['0', '1', '2']);
  });
});

describe('inline (complete input)', () => {
  it('parses strong, em, strikethrough and code', () => {
    expect(inline('**b** *i* _u_ ~~d~~ `c`')).toEqual([
      { type: 'strong', children: [t('b')] },
      t(' '),
      { type: 'em', children: [t('i')] },
      t(' '),
      { type: 'em', children: [t('u')] },
      t(' '),
      { type: 'del', children: [t('d')] },
      t(' '),
      { type: 'code', text: 'c' },
    ]);
  });

  it('nests emphasis and handles triple delimiters', () => {
    expect(inline('**a *b* c**')).toEqual([
      {
        type: 'strong',
        children: [t('a '), { type: 'em', children: [t('b')] }, t(' c')],
      },
    ]);
    expect(inline('***x***')).toEqual([
      { type: 'strong', children: [{ type: 'em', children: [t('x')] }] },
    ]);
  });

  it('does not treat intraword underscores as emphasis', () => {
    expect(inline('snake_case_name')).toEqual([t('snake_case_name')]);
  });

  it('keeps unmatched delimiters literal', () => {
    expect(inline('a ** b and 2*3')).toEqual([t('a ** b and 2*3')]);
  });

  it('does not parse emphasis inside code spans', () => {
    expect(inline('`**x**` and ``a ` b``')).toEqual([
      { type: 'code', text: '**x**' },
      t(' and '),
      { type: 'code', text: 'a ` b' },
    ]);
  });

  it('parses links with titles, autolinks and bare URLs', () => {
    expect(inline('[docs](https://a.dev "Title")')).toEqual([
      { type: 'link', href: 'https://a.dev', title: 'Title', children: [t('docs')] },
    ]);
    expect(inline('<https://b.dev>')[0]).toMatchObject({
      type: 'link',
      href: 'https://b.dev',
    });
    expect(inline('see https://c.dev/x.')).toEqual([
      t('see '),
      { type: 'link', href: 'https://c.dev/x', children: [t('https://c.dev/x')] },
      t('.'),
    ]);
  });

  it('keeps balanced parentheses in link destinations', () => {
    expect(inline('[w](https://en.wikipedia.org/wiki/A_(b))')[0]).toMatchObject({
      href: 'https://en.wikipedia.org/wiki/A_(b)',
    });
  });

  it('renders images as links to the image', () => {
    expect(inline('![alt](https://x.dev/i.png)')).toEqual([
      { type: 'link', href: 'https://x.dev/i.png', children: [t('alt')] },
    ]);
  });

  it('handles backslash escapes', () => {
    expect(inline('\\*not em\\* \\[x]')).toEqual([t('*not em* [x]')]);
  });

  it('supports backslash line breaks, mailto autolinks and padded code spans', () => {
    expect(inline('a\\\nb')).toEqual([t('a'), { type: 'break' }, t('b')]);
    expect(inline('<mailto:me@x.dev>')[0]).toMatchObject({ href: 'mailto:me@x.dev' });
    expect(inline('`` `x` ``')).toEqual([{ type: 'code', text: '`x`' }]);
  });

  it('keeps a bracket that is not a link', () => {
    expect(inline('[1] and [x] y')).toEqual([t('[1] and [x] y')]);
  });
});

describe('partial input while streaming', () => {
  const tail = (text: string) => {
    const blocks = parse(text);
    return blocks[blocks.length - 1]!;
  };

  it('renders an unclosed **bold as bold in progress', () => {
    expect(tail('Hello **wor')).toMatchObject({
      open: true,
      children: [t('Hello '), { type: 'strong', partial: true, children: [t('wor')] }],
    });
  });

  it('hides a dangling delimiter with nothing after it', () => {
    expect(tail('Hello **')).toMatchObject({ children: [t('Hello ')] });
    expect(tail('Hello *')).toMatchObject({ children: [t('Hello ')] });
    expect(tail('Hello `')).toMatchObject({ children: [t('Hello ')] });
  });

  it('never shows the first asterisk of a closing pair', () => {
    expect(tail('**bold*')).toMatchObject({
      children: [{ type: 'strong', partial: true, children: [t('bold')] }],
    });
  });

  it('renders unclosed italic and nested partial emphasis', () => {
    expect(tail('a *b **c')).toMatchObject({
      children: [
        t('a '),
        {
          type: 'em',
          partial: true,
          children: [t('b '), { type: 'strong', partial: true, children: [t('c')] }],
        },
      ],
    });
  });

  it('does not start optimistic emphasis in the middle of a word', () => {
    expect(tail('2*x + 3')).toMatchObject({ children: [t('2*x + 3')] });
  });

  it('renders an unclosed inline code span as code', () => {
    expect(tail('run `npm i')).toMatchObject({
      children: [t('run '), { type: 'code', text: 'npm i', partial: true }],
    });
  });

  it('shows link text while the label is being typed', () => {
    expect(tail('see [React do')).toMatchObject({
      children: [
        t('see '),
        { type: 'link', partial: true, href: '', children: [t('React do')] },
      ],
    });
  });

  it('shows a link with a truncated href while the URL is being typed', () => {
    expect(tail('[React](https://rea')).toMatchObject({
      children: [
        { type: 'link', partial: true, href: 'https://rea', children: [t('React')] },
      ],
    });
  });

  it('keeps an unclosed code fence open and hides a half-typed closing fence', () => {
    expect(tail('```py\nprint(1)\n``')).toMatchObject({
      type: 'code',
      lang: 'py',
      text: 'print(1)',
      closed: false,
      open: true,
    });
  });

  it('treats a lone opening fence as an empty code block', () => {
    expect(tail('```js\n')).toMatchObject({ type: 'code', lang: 'js', text: '' });
  });

  it('shows a table header before the delimiter row arrives', () => {
    expect(tail('| Name | Age |\n|---')).toMatchObject({
      type: 'table',
      header: [[t('Name')], [t('Age')]],
      rows: [],
    });
  });

  it('renders a partial table row padded to the header width', () => {
    const table = tail('| a | b |\n|---|---|\n| 1 | **tw');
    expect(table).toMatchObject({
      type: 'table',
      rows: [[[t('1')], [{ type: 'strong', partial: true, children: [t('tw')] }]]],
    });
  });

  it('hides a trailing line that is only a marker', () => {
    expect(parse('- one\n- ').map((b) => b.type)).toEqual(['list']);
    expect(parse('Intro\n-').map((b) => b.type)).toEqual(['paragraph']);
    expect(parse('Intro\n\n#').map((b) => b.type)).toEqual(['paragraph']);
    expect(parse('Intro\n\n1.').map((b) => b.type)).toEqual(['paragraph']);
  });

  it('streams the last list item only', () => {
    const list = tail('- **a** done\n- work *in');
    if (list.type !== 'list') throw new Error();
    expect(list.items[1]!.children).toEqual([
      t('work '),
      { type: 'em', partial: true, children: [t('in')] },
    ]);
  });

  it('parses only the last block leniently', () => {
    const blocks = parse('a **b\n\nc **d');
    expect(blocks[0]).toMatchObject({ open: false, children: [t('a **b')] });
    expect(blocks[1]).toMatchObject({ open: true });
  });

  it('falls back to literal text once streaming is over', () => {
    expect(only(final('Hello **wor'))).toMatchObject({ children: [t('Hello **wor')] });
    expect(only(final('see [React docs'))).toMatchObject({
      children: [t('see [React docs')],
    });
    expect(only(final('`npm i'))).toMatchObject({ children: [t('`npm i')] });
    expect(only(final('| a | b |'))).toMatchObject({ type: 'paragraph' });
  });

  it('marks a streaming heading as open', () => {
    expect(tail('## Getting sta')).toMatchObject({
      type: 'heading',
      level: 2,
      open: true,
      children: [t('Getting sta')],
    });
  });

  it('passes streaming into the last block of a blockquote', () => {
    const quote = tail('> Note: **impo');
    if (quote.type !== 'blockquote') throw new Error();
    expect(quote.children[0]).toMatchObject({
      children: [t('Note: '), { type: 'strong', partial: true }],
    });
  });
});
