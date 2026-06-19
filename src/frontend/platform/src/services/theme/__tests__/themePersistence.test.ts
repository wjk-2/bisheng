// @vitest-environment jsdom
/**
 * themePersistence 单元测试 —— 锁定持久化层契约。
 *
 * 覆盖：
 *   - getCurrentVersion：从 value JSON 解析 version；无/损坏/失败 → 0（永不抛错）
 *   - saveThemeDebounced：
 *       · debounce 300ms（快进快出合并、定时器到期才发）
 *       · 成功 → resolve 无 toast
 *       · 冲突（status_code=10032）→ toast 冲突文案 + onConflict 回调带 latest version
 *       · 其他失败 → toast 失败文案
 *   - cancelPendingSave：取消挂起 timer
 *
 * mock 策略：
 *   - axios.create 返回 vi 控制的假实例，get/post 由 vi.fn 按用例定制
 *   - toast / i18n.t mock 掉（验证调用，不依赖真实 i18n 加载）
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ---- 用 vi.hoisted 提升 mock fn，避开 vi.mock factory 的 TDZ ----
const { mockPost, mockGet, mockToast } = vi.hoisted(() => ({
    mockPost: vi.fn(),
    mockGet: vi.fn(),
    mockToast: vi.fn(),
}));

// ---- mock axios：拦截 create 返回的实例 ----
vi.mock('axios', () => {
    return {
        default: {
            create: () => ({ post: mockPost, get: mockGet }),
        },
    };
});

// ---- mock toast：记录调用 ----
vi.mock('@/components/bs-ui/toast/use-toast', () => ({
    toast: (...args: unknown[]) => mockToast(...args),
}));

// ---- mock i18n：t 直接回 key，便于断言命中哪个文案 ----
vi.mock('@/i18n', () => ({
    default: { t: (key: string) => key },
}));

import {
    saveThemeDebounced,
    getCurrentVersion,
    cancelPendingSave,
} from '../themePersistence';

// 让 fake timers 可控 + 仅推进必要时长
beforeEach(() => {
    vi.useFakeTimers();
    mockPost.mockReset();
    mockGet.mockReset();
    mockToast.mockReset();
});
afterEach(() => {
    cancelPendingSave();
    vi.useRealTimers();
});

describe('getCurrentVersion', () => {
    it('value 含 version → 返回该数字', async () => {
        mockGet.mockResolvedValueOnce({
            data: { status_code: 200, data: { value: JSON.stringify({ light: {}, version: 5 }) } },
        });
        await expect(getCurrentVersion()).resolves.toBe(5);
    });

    it('value 无 version 字段（旧数据）→ 返回 0', async () => {
        mockGet.mockResolvedValueOnce({
            data: { status_code: 200, data: { value: JSON.stringify({ light: {} }) } },
        });
        await expect(getCurrentVersion()).resolves.toBe(0);
    });

    it('data 为空串（首次无记录）→ 返回 0', async () => {
        mockGet.mockResolvedValueOnce({ data: { status_code: 200, data: '' } });
        await expect(getCurrentVersion()).resolves.toBe(0);
    });

    it('value 损坏 JSON → 返回 0（不抛错）', async () => {
        mockGet.mockResolvedValueOnce({
            data: { status_code: 200, data: { value: '{invalid' } },
        });
        await expect(getCurrentVersion()).resolves.toBe(0);
    });

    it('网络错（reject）→ 返回 0（不抛错，让 save 以 0 兜底）', async () => {
        mockGet.mockRejectedValueOnce(new Error('network'));
        await expect(getCurrentVersion()).resolves.toBe(0);
    });
});

describe('saveThemeDebounced', () => {
    it('debounce：连续调用只发最后一次（300ms 内合并）', async () => {
        mockPost.mockResolvedValueOnce({ data: { status_code: 200, data: { version: 2 } } });

        const p1 = saveThemeDebounced('{"v":1}', 1);
        const p2 = saveThemeDebounced('{"v":2}', 1); // 覆盖 p1
        // 未到 300ms：不应已调用 post
        expect(mockPost).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(300);

        await Promise.all([p1, p2]);
        expect(mockPost).toHaveBeenCalledTimes(1);
        expect(mockPost).toHaveBeenCalledWith('/api/v1/web/config', { value: '{"v":2}', version: 1 });
    });

    it('成功（status_code=200）→ resolve，无 toast', async () => {
        mockPost.mockResolvedValueOnce({ data: { status_code: 200, data: { version: 2 } } });
        const p = saveThemeDebounced('{}', 1);
        await vi.advanceTimersByTimeAsync(300);
        await expect(p).resolves.toBeUndefined();
        expect(mockToast).not.toHaveBeenCalled();
    });

    it('冲突（status_code=10032）→ toast 冲突文案 + onConflict 带最新 version', async () => {
        mockPost.mockResolvedValueOnce({ data: { status_code: 10032, status_message: 'conflict' } });
        // 冲突后会再调 getCurrentVersion 拉最新 version
        mockGet.mockResolvedValueOnce({
            data: { status_code: 200, data: { value: JSON.stringify({ version: 9 }) } },
        });
        const onConflict = vi.fn();
        const p = saveThemeDebounced('{}', 1, onConflict);
        await vi.advanceTimersByTimeAsync(300);
        await p;

        // 冲突 toast 命中（description 为 theme.saveConflictRefresh）
        expect(mockToast).toHaveBeenCalledTimes(1);
        const call = mockToast.mock.calls[0][0];
        expect(call.description).toBe('theme.saveConflictRefresh');
        // onConflict 被回调，参数为拉取到的最新 version 9
        expect(onConflict).toHaveBeenCalledWith(9);
    });

    it('其他业务码失败 → toast 通用失败文案，不回调 onConflict', async () => {
        mockPost.mockResolvedValueOnce({ data: { status_code: 500, status_message: 'oops' } });
        const onConflict = vi.fn();
        const p = saveThemeDebounced('{}', 1, onConflict);
        await vi.advanceTimersByTimeAsync(300);
        await p;

        expect(mockToast).toHaveBeenCalledTimes(1);
        expect(mockToast.mock.calls[0][0].description).toBe('theme.saveFailed');
        expect(onConflict).not.toHaveBeenCalled();
    });

    it('HTTP 层 reject（如 500 网络错）→ toast 通用失败文案，不当作冲突', async () => {
        mockPost.mockRejectedValueOnce({
            response: { data: { status_code: 500 } },
            isAxiosError: true,
        });
        const onConflict = vi.fn();
        const p = saveThemeDebounced('{}', 1, onConflict);
        await vi.advanceTimersByTimeAsync(300);
        await p;

        expect(mockToast).toHaveBeenCalledTimes(1);
        expect(mockToast.mock.calls[0][0].description).toBe('theme.saveFailed');
        expect(onConflict).not.toHaveBeenCalled();
    });

    it('HTTP 层 reject 且业务码恰为 10032 → 识别为冲突', async () => {
        // 后端理论上走业务码（HTTP 200），此用例锁死「即便 HTTP 层抛错也按 status_code 识别」的兜底
        mockPost.mockRejectedValueOnce({
            response: { data: { status_code: 10032 } },
            isAxiosError: true,
        });
        mockGet.mockResolvedValueOnce({
            data: { status_code: 200, data: { value: JSON.stringify({ version: 3 }) } },
        });
        const onConflict = vi.fn();
        const p = saveThemeDebounced('{}', 1, onConflict);
        await vi.advanceTimersByTimeAsync(300);
        await p;

        expect(mockToast).toHaveBeenCalledTimes(1);
        expect(mockToast.mock.calls[0][0].description).toBe('theme.saveConflictRefresh');
        expect(onConflict).toHaveBeenCalledWith(3);
    });
});

describe('cancelPendingSave', () => {
    it('取消挂起 timer → 300ms 后 post 不被调用', async () => {
        mockPost.mockResolvedValue({ data: { status_code: 200, data: { version: 2 } } });
        const p = saveThemeDebounced('{}', 1);
        cancelPendingSave(); // 立即取消
        await vi.advanceTimersByTimeAsync(300);
        await p;
        expect(mockPost).not.toHaveBeenCalled();
    });
});
