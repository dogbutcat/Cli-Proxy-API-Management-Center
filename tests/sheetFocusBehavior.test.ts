import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(import.meta.dir, '../src/components/ui/Sheet/Sheet.tsx'),
  'utf8'
);

const focusEffect = source.slice(
  source.indexOf('previouslyFocusedRef.current ='),
  source.indexOf('useEffect(() => {', source.indexOf('previouslyFocusedRef.current?.focus'))
);

describe('Sheet focus and scroll behavior', () => {
  test('resets the body scroll at the start of each open before focusing', () => {
    const scrollResetIndex = focusEffect.indexOf('bodyRef.current.scrollTop = 0');
    const focusIndex = focusEffect.indexOf('?.focus({ preventScroll: true })');

    expect(scrollResetIndex).toBeGreaterThanOrEqual(0);
    expect(focusIndex).toBeGreaterThan(scrollResetIndex);
  });

  test('uses preventScroll for deferred initial focus and fallbacks', () => {
    expect(focusEffect).toContain(
      '(first ?? closeBtnRef.current ?? sheetRef.current)?.focus({ preventScroll: true })'
    );
  });

  test('uses preventScroll when restoring focus after close', () => {
    expect(source).toContain('previouslyFocusedRef.current?.focus({ preventScroll: true })');
  });

  test('uses preventScroll for fallback and wrapped focus trap moves', () => {
    expect(source).toContain('sheetRef.current?.focus({ preventScroll: true })');
    expect(source).toContain('lastEl.focus({ preventScroll: true })');
    expect(source).toContain('firstEl.focus({ preventScroll: true })');
  });

  test('does not keep bare focus calls that can move scroll containers', () => {
    expect(source).not.toMatch(/\.focus\(\)/);
  });
});
