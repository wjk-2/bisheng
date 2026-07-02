/** 切分预定义规则：正则模式作为数据常量，与 i18n 翻译分离。
 *
 * 正道（A2 防御性重构）：正则模式是数据，i18n label/desc 仅用于 UI 显示。
 * 旧实现把 t('...label')（i18n 翻译值）当 regex 存进 strategy，虽当前 label 恰为
 * 正则模式碰巧生效，但若有人改 label 文案为中文描述则失效。本文件把数据抽离，
 * buildPredefinedStrategy 存原始正则，i18n 仅取 desc 作 UI 提示。
 */

/** 预定义正则 → i18n key 映射（数据真理源，9 项） */
export const PREDEFINED_REGEX_MAP: Record<string, string> = {
  '\\n': 'singleNewlineRule',
  '\\n\\n': 'doubleNewlineRule',
  '第.{1,3}章': 'chapterRule',
  '第.{1,3}条': 'articleRule',
  '。': 'chinesePeriodRule',
  '！': 'chineseExclamationRule',
  '？': 'chineseQuestionRule',
  '；': 'chineseSemicolonRule',
  '\\.': 'englishPeriodRule',
};

export const PREDEFINED_REGEX_KEYS = Object.keys(PREDEFINED_REGEX_MAP);

/** 预定义规则配置（regexKey + 切分位置） */
export const PREDEFINED_RULES: { regexKey: string; mode: 'before' | 'after' }[] = [
  { regexKey: '\\n', mode: 'after' },
  { regexKey: '\\n\\n', mode: 'after' },
  { regexKey: '第.{1,3}章', mode: 'before' },
  { regexKey: '第.{1,3}条', mode: 'before' },
  { regexKey: '。', mode: 'after' },
  { regexKey: '！', mode: 'after' },
  { regexKey: '？', mode: 'after' },
  { regexKey: '；', mode: 'after' },
  { regexKey: '\\.', mode: 'after' },
];

/** 构造预定义切分策略：存原始正则（非 i18n label），rule 取 i18n desc 仅作 UI 提示。
 * 被测即生产：handleRegexClick 调本函数。 */
export function buildPredefinedStrategy(
  regex: string,
  mode: string,
  t: (key: string) => string,
): { regex: string; position: string; rule: string } {
  const i18nKey = PREDEFINED_REGEX_MAP[regex];
  return {
    regex,
    position: mode,
    rule: i18nKey ? t(`predefinedRules.${i18nKey}.desc`) : regex,
  };
}
