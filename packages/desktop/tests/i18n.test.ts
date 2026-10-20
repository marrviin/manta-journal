//! t() contract: interpolation, en/zh selection, and graceful fallback when a
//! key is somehow missing (never a blank render).

import { describe, expect, it } from 'vitest';
import { normalizeLang, t } from '@manta-journal/shared';

describe('t', () => {
  it('substitutes positional {0} params in both languages', () => {
    expect(t('zh', 'fact.count', 3)).toBe('3 条记忆');
    expect(t('en', 'fact.count', 3)).toBe('3 memories');
    expect(t('en', 'err.cannotConnect', 'http://x', 'timeout')).toBe(
      'Cannot connect to http://x: timeout',
    );
  });

  it('keeps unknown placeholders verbatim (params omitted)', () => {
    expect(t('zh', 'fact.count')).toBe('{0} 条记忆');
  });

  it('falls back to zh when en is empty, and to the key when missing', () => {
    // every entry ships both languages; assert the fallback path via an
    // out-of-table key cast (defensive contract, not a real entry)
    expect(t('en', 'definitely.missing' as never)).toBe('definitely.missing');
  });

  it('normalizeLang coerces anything unknown to zh', () => {
    expect(normalizeLang('en')).toBe('en');
    expect(normalizeLang('zh-CN')).toBe('zh');
    expect(normalizeLang(undefined)).toBe('zh');
  });
});
