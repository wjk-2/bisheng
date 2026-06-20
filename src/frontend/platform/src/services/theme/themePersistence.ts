/**
 * themePersistence —— 主题持久化层（theme-service 三浅接口的第三层）。
 *
 * 层次定位：
 *   themeConfig（纯函数，数据层）→ themeRuntime（DOM 注入）
 *   → **themePersistence（本模块，网络 + debounce + 错误处理）**。
 *
 * 本模块只负责把 ThemeValue 字符串可靠地写到后端 web_config，并处理 C7 多 admin
 * 并发乐观锁冲突。不含 DOM 操作、不含业务校验（那些在 themeConfig/themeRuntime）。
 *
 * C7 乐观锁契约：
 *   - save 前调 getCurrentVersion 拉取「当前 version」（存于 value JSON 内）
 *   - save 时带上该 version，后端比对 DB version：
 *       一致 → 写入成功，后端 version+1
 *       不一致 → 业务码 10032（WebConfigConflictError），本模块 catch 后弹冲突 toast
 *         并触发 onConflict 回调（调用方可在此重新拉取主题刷新 UI）
 *
 * 为何用独立 axios 实例而非项目 customAxios：
 *   项目 customAxios 的响应拦截器（controllers/request.ts L28-58）对非 200 业务码
 *   会 reject 出「i18n 后的字符串」，丢失 status_code，导致本模块无法区分 10032 冲突
 *   与其他错误。持久化层需要细粒度错误控制，独立实例（不经业务码拦截器）是最小侵入
 *   正道——不污染全局拦截器、不影响其他调用方。仅本实例自行解析 response.data.status_code。
 *
 * 制式约定：value 是 themeConfig.parseWebConfig 反向序列化的 JSON 字符串
 * （{light, dark, bg, version?}），本模块不解析其语义，只透传。
 */
import axios, { AxiosError } from 'axios';
import { toast } from '@/components/bs-ui/toast/use-toast';
import i18n from '@/i18n';

/** web_config 接口路径。 */
const WEB_CONFIG_URL = '/api/v1/web/config';
/** C7 冲突业务码（与后端 WebConfigConflictError.Code 对齐）。 */
const CONFLICT_STATUS_CODE = 10032;
/** save debounce 时长（ms），与现有 theme/index.tsx debouncedSaveTheme 的 300ms 对齐。 */
const SAVE_DEBOUNCE_MS = 300;

/**
 * 持久化专用 axios 实例。
 *
 * 与 customAxios 对齐两点：withCredentials（cookie 认证）、baseURL（__APP_ENV__.BASE_URL
 * 或 import.meta.env.BASE_URL）。不带业务码拦截器——由本模块调用方自行解析 status_code。
 *
 * 注意：不带 customAxios 的 ws_token 注入逻辑（那是非 eagent API 的 WebSocket fallback），
 * web_config 是普通 REST API，cookie 即可，无需 ws_token。
 */
const persistenceAxios = axios.create({
    baseURL: import.meta.env.BASE_URL,
    withCredentials: true,
});

/**
 * 从 web_config 接口响应解析当前锁版本（_lock_version）。
 *
 * 后端 get_web_config 返回 {value: <JSON 字符串>}，value 内含 _lock_version 字段
 * （3B.2 起 C7 锁版本独立字段）。老数据可能仍是 version 字段（迁移期），回退读 version。
 * 无 _lock_version / version 字段（旧数据 / 首次）视为 0，与后端 current_version 兜底逻辑对齐。
 *
 * 失败（网络错 / 解析错）一律返回 0，绝不抛错——让 save 以 version=0 尝试，由后端判定。
 */
export async function getCurrentVersion(): Promise<number> {
    try {
        const resp = await persistenceAxios.get(WEB_CONFIG_URL);
        const data = resp.data;
        // 后端响应包裹：{status_code, status_message, data: {value: string}} 或 {data: ''}
        const outer = data?.data;
        if (!outer) return 0;
        const raw = typeof outer === 'string' ? outer : outer.value;
        if (!raw) return 0;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            // 优先 _lock_version（新 schema），回退 version（老 schema 迁移期锁版本字段）
            if (typeof parsed._lock_version === 'number') {
                return parsed._lock_version;
            }
            if (typeof parsed.version === 'number') {
                return parsed.version;
            }
        }
        return 0;
    } catch {
        // 拉取失败不阻断 save，返回 0 让后端做最终判定（last-write-wins 兜底）
        return 0;
    }
}

/** 保存结果：区分成功、冲突、其他失败，供调用方差异化处理。 */
export type SaveThemeResult =
    | { ok: true; version: number }
    | { ok: false; conflict: true }
    | { ok: false; conflict: false };

/**
 * 内部：带 version 的 save 调用，自行解析业务码。
 *
 * 成功（status_code=200）→ {ok:true, version: 后端返回的新 version}
 * 冲突（status_code=10032）→ {ok:false, conflict:true}
 * 其他失败（网络错 / 其他业务码）→ {ok:false, conflict:false}
 *
 * 不弹 toast、不抛错——错误展示由 saveThemeDebounced 统一处理。
 */
async function saveWithVersion(value: string, version: number): Promise<SaveThemeResult> {
    try {
        const resp = await persistenceAxios.post(WEB_CONFIG_URL, { value, version });
        const data = resp.data;
        if (data?.status_code === 200) {
            // 后端 data: {value, version}，version 是自增后的新值
            const newVersion = typeof data.data?.version === 'number' ? data.data.version : version + 1;
            return { ok: true, version: newVersion };
        }
        if (data?.status_code === CONFLICT_STATUS_CODE) {
            return { ok: false, conflict: true };
        }
        return { ok: false, conflict: false };
    } catch (err) {
        // HTTP 层非 200（如 401/500）——axios 自动 reject，检查是否有业务码 status_code
        const axiosErr = err as AxiosError<{ status_code: number }>;
        const bizCode = axiosErr.response?.data?.status_code;
        if (bizCode === CONFLICT_STATUS_CODE) {
            return { ok: false, conflict: true };
        }
        return { ok: false, conflict: false };
    }
}

/**
 * 模块级 debounce 状态。多个连续调用合并为最后一次（last-write-wins）。
 *
 * 选模块级而非 useRef：themePersistence 是纯服务模块（非 React 组件），
 * 无 hook 上下文；模块级单 timer 与 theme/index.tsx 的 saveTimerRef 行为等价，
 * 且能跨组件实例共享（整个平台同一时刻只有一个挂起的 save）。
 *
 * pendingResolve：保存当前挂起请求对应的外层 Promise resolve。
 *   - 新调用覆盖旧 timer 时，先 resolve 旧 Promise（静默丢弃，不发请求），
 *     避免被覆盖的调用方 Promise 永不 settle（内存泄漏 / 调用方死等）。
 *   - 仅「最后一次」调用真正发请求并在完成后 resolve。
 */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingResolve: (() => void) | null = null;

/**
 * 防抖保存主题配置（C7 乐观锁）。
 *
 * 行为：
 *   - debounce 300ms（与现有 theme/index.tsx 对齐），多次调用只发最后一次
 *   - 成功 → resolve，无 toast（静默成功，与现有体验一致）
 *   - 冲突（10032）→ toast「主题已被其他管理员更新，请刷新后重试」+ 调 onConflict 回调
 *     （调用方应在回调里 getCurrentVersion + 重新拉取主题刷新 UI）
 *   - 其他失败 → toast「主题保存失败」（与现有 captureAndAlertRequestErrorHop 体验一致）
 *   - 被新调用覆盖的旧调用 → 立即 resolve（静默丢弃，不发请求）
 *
 * 多实例隐患（模块级单 timer）：
 *   本函数用模块级单 timer（saveTimer / pendingResolve，见上方模块级注释），意味着
 *   整个平台同一时刻只有一个挂起的 save——**跨所有组件实例共享**，而非每调用方一个 timer。
 *   当前唯一调用方是 theme/index.tsx，行为正常。但若阶段3 新增 BrandPicker 等组件也调
 *   saveThemeDebounced，会与 theme/index.tsx 抢同一个 timer：后调的覆盖先调的（先调的被
 *   静默丢弃、立即 resolve）。多实例场景下需要评估是否：
 *     (a) 收敛 timer 到调用方（每调用方各自 useRef 持有 timer，各自 last-write-wins）
 *     (b) 调用方串行化（统一经 theme store / index.tsx 汇聚后再调本函数）
 *   在阶段3 落地前不预先选型，本注释只标记该约束为「已知语义」。
 *
 * Promise 语义：
 *   - 返回的 Promise 在「被新调用覆盖时」立即 resolve（静默丢弃，不发请求），
 *     resolve 仅代表「这次调用已离开队列」，**不代表保存成功**。
 *   - 真正完成保存的最后一次调用，其 Promise 在 saveWithVersion 落定后才 resolve。
 *   - 综上：调用方**不应在 .then 里做「已保存」UI 反馈**——无法仅凭 resolve 区分
 *     「被丢弃」与「已落库」。如需基于「保存成功」的 UI 反馈，应由调用方在 onConflict
 *     之外的回调路径单独约定（当前未提供 onSuccess 回调；如需要阶段3 再补）。
 *
 * @param value    ThemeValue 序列化后的 JSON 字符串
 * @param version  调用方以为的当前 version（由 getCurrentVersion 取得）
 * @param onConflict  冲突时的回调（可选），参数为重新拉取的 version
 */
export function saveThemeDebounced(
    value: string,
    version: number,
    onConflict?: (latestVersion: number) => void,
): Promise<void> {
    return new Promise<void>((resolve) => {
        // 覆盖挂起请求：先 resolve 旧 Promise（静默丢弃），再换上新调用方
        if (saveTimer) {
            clearTimeout(saveTimer);
            const prev = pendingResolve;
            pendingResolve = null;
            saveTimer = null;
            if (prev) prev();
        }
        pendingResolve = resolve;
        saveTimer = setTimeout(async () => {
            const settle = pendingResolve;
            saveTimer = null;
            pendingResolve = null;
            // saveWithVersion 契约：全路径 return SaveThemeResult，不抛错（HTTP 异常内已 catch），
            // 故无需外层 try/catch——此处所有分支必落到 result.ok/conflict/其他失败之一。
            const result = await saveWithVersion(value, version);
            if (result.ok) {
                settle?.();
                return;
            }
            if (result.conflict) {
                toast({
                    title: i18n.t('prompt'),
                    variant: 'error',
                    description: i18n.t('theme.saveConflictRefresh'),
                });
                // 冲突后拉取最新 version 供调用方刷新 UI；拉取失败给 0 兜底
                const latest = await getCurrentVersion();
                onConflict?.(latest);
                settle?.();
                return;
            }
            // 其他失败：通用失败 toast
            toast({
                title: i18n.t('prompt'),
                variant: 'error',
                description: i18n.t('theme.saveFailed'),
            });
            settle?.();
        }, SAVE_DEBOUNCE_MS);
    });
}

/**
 * 取消挂起的 debounce save（若存在）。
 *
 * 场景：组件卸载或主动「恢复默认」时，取消尚未发出的 save，避免旧请求后到覆盖新状态
 * （对应 theme/index.tsx applyTheme 中 C4 取消 saveTimerRef 的诉求）。
 *
 * 取消时 resolve 挂起的 Promise（静默丢弃），避免调用方死等。
 */
export function cancelPendingSave(): void {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    const prev = pendingResolve;
    pendingResolve = null;
    if (prev) prev();
}
