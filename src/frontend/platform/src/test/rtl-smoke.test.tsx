// @vitest-environment jsdom
/**
 * RTL 基础设施冒烟测试 —— 证明 @testing-library/react + jest-dom 匹配器就绪。
 *
 * 本测试长期保留（非一次性验证），任何后续引入 RTL 的测试均依赖这条链路：
 *   vite.config.test.setupFiles → src/test/setup.ts → jest-dom 注册。
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('RTL 冒烟', () => {
    it('render + getByTestId + jest-dom toBeInTheDocument 匹配器可用', () => {
        render(<div data-testid="x">hello</div>);
        expect(screen.getByTestId('x')).toBeInTheDocument();
    });

    it('toHaveTextContent 匹配器可用', () => {
        render(<span data-testid="y">world</span>);
        expect(screen.getByTestId('y')).toHaveTextContent('world');
    });
});
