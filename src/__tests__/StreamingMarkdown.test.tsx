import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { reply } from '../__fixtures__/reply';
import type { HeadingProps } from '../components/context';
import { StreamingMarkdown, darkTheme } from '../index';

describe('<StreamingMarkdown />', () => {
  it('renders every block type in the fixture', async () => {
    await render(<StreamingMarkdown text={reply} streaming={false} />);
    expect(
      screen.getByRole('header', { name: 'Debouncing a search input' })
    ).toBeTruthy();
    expect(screen.getByText(/useDebounced/)).toBeTruthy();
    expect(screen.getByText('Approach')).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'React docs' })).toBeTruthy();
  });

  it('calls onLinkPress with the href', async () => {
    const onLinkPress = jest.fn();
    await render(
      <StreamingMarkdown
        text="Read [the docs](https://x.dev)."
        onLinkPress={onLinkPress}
      />
    );
    await fireEvent.press(screen.getByRole('link', { name: 'the docs' }));
    expect(onLinkPress).toHaveBeenCalledWith('https://x.dev');
  });

  it('does not make a half-typed link pressable', async () => {
    const onLinkPress = jest.fn();
    await render(
      <StreamingMarkdown text="[the docs](https://x." onLinkPress={onLinkPress} />
    );
    await fireEvent.press(screen.getByRole('link', { name: 'the docs' }));
    expect(onLinkPress).not.toHaveBeenCalled();
  });

  it('shows the copy button only when onCopyCode is provided', async () => {
    const onCopyCode = jest.fn();
    const code = '```sh\nyarn add x\n```';
    const { rerender } = await render(<StreamingMarkdown text={code} />);
    expect(screen.queryByRole('button', { name: 'Copy code' })).toBeNull();

    // While the closing fence is still arriving the button is disabled.
    await rerender(<StreamingMarkdown text={code} onCopyCode={onCopyCode} />);
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeDisabled();

    await rerender(
      <StreamingMarkdown text={code} streaming={false} onCopyCode={onCopyCode} />
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Copy code' }));
    expect(onCopyCode).toHaveBeenCalledWith('yarn add x', 'sh');
    expect(screen.getByText('Copied')).toBeTruthy();
  });

  it('never shows raw asterisks for an unfinished bold span', async () => {
    await render(<StreamingMarkdown text="This is **import" />);
    expect(screen.queryByText(/\*\*/)).toBeNull();
    expect(screen.getByText('import')).toBeTruthy();
  });

  it('only re-renders the growing block while streaming', async () => {
    const renders = new Map<string, number>();
    function CountingHeading({ children }: HeadingProps) {
      const label = String(Array.isArray(children) ? children.join('') : children);
      renders.set(label, (renders.get(label) ?? 0) + 1);
      return <Text accessibilityRole="header">{children}</Text>;
    }
    const components = { heading: CountingHeading };
    const doc = '# First\n\n# Second\n\n# Thi';

    const { rerender } = await render(
      <StreamingMarkdown text={doc} components={components} />
    );
    for (const next of ['# Third', '# Third\n', '# Third\n\nBody']) {
      await rerender(
        <StreamingMarkdown
          text={doc.replace('# Thi', next)}
          // A fresh object and callback every render must not defeat memoisation.
          components={{ heading: CountingHeading }}
          onLinkPress={() => {}}
        />
      );
    }

    expect(renders.get('First')).toBe(1);
    expect(renders.get('Second')).toBe(1);
    expect(renders.get('Thi')).toBe(1);
    expect(renders.get('Third')).toBeGreaterThanOrEqual(1);
  });

  it('applies the dark theme and overrides', async () => {
    await render(
      <StreamingMarkdown
        text="hello"
        colorScheme="dark"
        theme={{ colors: { text: '#ff0000' } }}
      />
    );
    expect(screen.getByText('hello')).toHaveStyle({ color: '#ff0000' });

    await render(<StreamingMarkdown text="dark" colorScheme="dark" />);
    expect(screen.getByText('dark')).toHaveStyle({ color: darkTheme.colors.text });
  });
});
