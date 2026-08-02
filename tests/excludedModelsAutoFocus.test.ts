import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(import.meta.dir, '../src/components/excludedModels/ExcludedModelsPanel.tsx'),
  'utf8'
);

const inputFocusEffect = source.slice(
  source.indexOf('useLayoutEffect(() => {'),
  source.indexOf('useEffect(() => {', source.indexOf('useLayoutEffect(() => {'))
);

const activeOptionScrollEffect = source.slice(
  source.indexOf('useEffect(() => {', source.indexOf('inputRef.current?.focus')),
  source.indexOf('const toggleAt')
);

describe('ExcludedModelsPanel autoFocus behavior', () => {
  test('focuses the search input only when autoFocus is enabled', () => {
    expect(inputFocusEffect).toContain('if (!autoFocus) return;');
    expect(inputFocusEffect).toContain('inputRef.current?.focus({ preventScroll: true })');
    expect(inputFocusEffect).toContain('}, [autoFocus]);');
  });

  test('scrolls the active option only when autoFocus is enabled and an option is active', () => {
    expect(activeOptionScrollEffect).toContain('if (!autoFocus || activeIndex < 0) return;');
    expect(activeOptionScrollEffect).toContain('?.scrollIntoView({ block: \'nearest\' })');
    expect(activeOptionScrollEffect).toContain('}, [activeIndex, autoFocus, listboxId]);');
  });

  test('does not call scrollIntoView outside the autoFocus-gated active option effect', () => {
    expect(source.match(/scrollIntoView/g)?.length ?? 0).toBe(1);
  });
});
