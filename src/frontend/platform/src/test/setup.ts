/**
 * Vitest 全局 setup —— 注册 @testing-library/jest-dom 自定义匹配器。
 *
 * 设计：依赖 vite.config.mts 中 test.globals:true。jest-dom v6 默认入口在
 * import 时直接调 expect.extend(matchers)，需要全局 expect 可用，因此 globals
 * 必须开启。现有测试文件里的显式 `import { expect } from 'vitest'` 在 globals
 * 模式下指向同一实例，无冲突，仅作冗余保留即可。
 *
 * environment 不设（保持默认 node），现有 jsdom 测试继续靠文件首行
 * `// @vitest-environment jsdom` 注释声明。
 */
import '@testing-library/jest-dom';
