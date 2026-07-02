import { describe, it, expect } from 'vitest';
import {
  PREDEFINED_REGEX_MAP,
  PREDEFINED_REGEX_KEYS,
  buildPredefinedStrategy,
} from '../predefinedRules';

const fakeT = (key: string) => key; // 返回 key 作占位，便于断言 desc 走 i18n

describe('A2 切分预定义规则数据与翻译分离', () => {
  it('PREDEFINED_REGEX_MAP 含 9 项含 articleRule', () => {
    expect(PREDEFINED_REGEX_KEYS).toContain('第.{1,3}条');
    expect(PREDEFINED_REGEX_KEYS.length).toBe(9);
  });

  it('每条预定义键都能在 map 命中', () => {
    for (const k of PREDEFINED_REGEX_KEYS) {
      expect(PREDEFINED_REGEX_MAP[k]).toBeTruthy();
    }
  });

  it('buildPredefinedStrategy 存原始正则而非 i18n label', () => {
    const s = buildPredefinedStrategy('\\n', 'after', fakeT);
    expect(s.regex).toBe('\\n'); // 原始正则，非翻译值
    expect(s.position).toBe('after');
    expect(s.rule).toContain('singleNewlineRule'); // desc 走 i18n key
  });

  it('buildPredefinedStrategy 对 chapter 规则存原始正则', () => {
    const s = buildPredefinedStrategy('第.{1,3}章', 'before', fakeT);
    expect(s.regex).toBe('第.{1,3}章');
    expect(s.position).toBe('before');
  });

  it('未知 regex 回退 rule 为 regex 自身', () => {
    const s = buildPredefinedStrategy('foo', 'after', fakeT);
    expect(s.regex).toBe('foo');
    expect(s.rule).toBe('foo');
  });
});
