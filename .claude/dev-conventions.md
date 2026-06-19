# E-Agent 开发规范

> **版本**: v3.0
> **建立**: 2026-04-27
> **执行**: 所有代码提交前必须通过本规范自检，Code Review 以本文档为基准

---

## 约定说明

- **MUST**：硬性要求，违反即不合规，不得提交
- **MUST NOT**：明确禁止，存在即不合规，不得提交
- **SHOULD**：推荐做法，有充分理由时可偏离，但需在 PR 中说明

---

## 1. 后端

### 1.1 分层

- **MUST** 新功能按 `models → schemas → services → api/router` 四层实现，不得跨层调用
- **MUST NOT** 在 `api/router` 层直接操作 ORM 对象或执行 SQL

### 1.2 数据库会话

- **MUST** 在端点函数体内使用 `with get_sync_db_session() as session:` 管理会话
- **MUST NOT** 通过 `Depends(get_sync_db_session)` 注入会话

### 1.3 认证

- **MUST** 需要认证的端点声明 `login_user: UserPayload = Depends(UserPayload.get_login_user)`
- **MUST NOT** 在端点内自行解析 token 或 cookie

### 1.4 响应封装

- **MUST** 所有端点成功响应使用 `resp_200(data=...)` 封装
- **MUST** 响应 payload 通过 Schema `model_dump()` 序列化
- **MUST NOT** 在 router 层手动构造响应 dict

### 1.5 错误处理

- **MUST** Service 层业务异常只抛 `ValueError`
- **MUST** Router 层捕获 `ValueError` 并转换为 `HTTPException(status_code=404)`
- **MUST NOT** 在 Service 层抛出 `HTTPException`

### 1.6 导入路径

- **MUST** 使用 `dev-guide.md §3` 中的验证路径清单
- **MUST NOT** 参照 `bisheng-feature-tangshunew/` 旧版代码的导入路径

### 1.7 命名

- **MUST** ORM 类名格式：`{模块前缀}{业务名}`，如 `EduCourse`
- **MUST** DAO 类名格式：`{ORM类名}Dao`，如 `EduCourseDao`
- **MUST** Schema 响应类名格式：`{业务名}Out`；请求类名格式：`{业务名}Req`
- **MUST** 时间戳字段使用 `create_time` / `update_time`
- **MUST NOT** 使用 `created_at` / `updated_at`

---

## 2. 数据模型

### 2.1 ORM 基类

- **MUST** 所有 ORM 模型继承 `SQLModelSerializable`

### 2.2 字段类型

- **MUST** JSON 类型字段使用 `sa_column=Column(JSON)` 声明
- **MUST NOT** 使用 `sa_type='JSON'`

### 2.3 DAO 方法

- **MUST** DAO 方法声明为 `@staticmethod`，第一个参数为 `session: Session`

---

## 3. 数据库迁移（Alembic）

### 3.1 文件组织

- **MUST** 结构迁移与数据初始化（seed）分文件
- **MUST** 结构迁移文件命名：`{module}_v{N}_{YYYYMMDD}.py`
- **MUST** seed 文件命名：`{module}_v{N}_seed_{YYYYMMDD}.py`
- **MUST** `revision` ID 与文件名保持一致

### 3.2 upgrade / downgrade 顺序

- **MUST** `upgrade()` 中 drop 旧表时子表先于父表
- **MUST** `upgrade()` 中 create 新表时父表先于子表
- **MUST** `downgrade()` 删表顺序与 `upgrade()` drop 顺序一致

---

## 4. 前端（Platform）

### 4.1 HTTP 客户端

- **MUST** 从 `@/controllers/request` 导入 axios 实例
- **MUST NOT** 直接 `import axios from 'axios'`
- **MUST NOT** 在 `.then()` 回调中二次访问 `.data`（拦截器已完成解包）

### 4.2 错误处理

- **MUST** 每个 API 调用包含 `.catch()` 分支，使组件回退至明确的 error/empty 状态

### 4.3 useEffect

- **MUST** `useEffect` 依赖数组完整声明所有外部变量

### 4.4 路由

- **MUST** 路由文件中页面组件使用 `lazy()` 异步加载
- **MUST** Platform 与 Workspace 之间的跳转使用 `window.location.href` 硬跳转
- **MUST NOT** 跨应用跳转使用 React Router `navigate()`

### 4.5 UI

- **MUST NOT** 业务页面顶层容器设置背景色（由 MainLayout 统一承载）
- **SHOULD** 优先使用 `@/components/bs-ui/` 组件，不直接引用 Radix UI

### 4.6 TypeScript 接口

- **MUST** 前端接口字段名与后端 Schema 字段名保持一致（`snake_case`）
- **MUST NOT** 在前端将后端字段名转为 `camelCase`

---

## 5. 提交规范

### 5.1 提交前自检

提交前按以下清单逐项核查，所有项目通过后方可提交。

**后端**

| # | 检查项 | 验证方式 |
|---|--------|---------|
| B1 | 端点使用 `with get_sync_db_session()` | 全文搜索 `Depends(get_sync_db_session)` 应无结果 |
| B2 | 端点返回 `resp_200(data=...)` | 全文搜索新增端点函数，确认每个 return 有 resp_200 |
| B3 | 响应用 `model_dump()` | 全文搜索新增端点，确认无裸 dict `{}` 返回 |
| B4 | JSON 字段用 `sa_column=Column(JSON)` | 全文搜索 `sa_type=` 应无结果 |
| B5 | Service 层无 `HTTPException` | 全文搜索 service 文件，`HTTPException` 应无结果 |
| B6 | 导入路径合规 | 对照 `dev-guide.md §3` 验证路径清单 |

**前端**

| # | 检查项 | 验证方式 |
|---|--------|---------|
| F1 | `npm run build` 通过 | 0 errors，0 TypeScript 类型错误 |
| F2 | `.then()` 无二次 `.data` | 全文搜索 `.then(` 回调体，无 `.data.` 访问 |
| F3 | 每个 API 调用有 `.catch()` | 全文搜索 `Api.` 调用，确认均有 `.catch(` |
| F4 | `useEffect` 依赖完整 | 检查所有新增 `useEffect` 的依赖数组 |

### 5.2 部署

- **MUST** 前后端同时有变更时，一次性部署，不拆分多次
- **MUST NOT** 依赖部署环境验证逻辑正确性（部署前本地自检必须通过）

---

## 6. Git Worktree 规范

### 6.1 Worktree 目录结构

| worktree | 本地路径 | 分支 | 用途 |
|---------|---------|------|------|
| 主工作树 | `eagent-v3/v2.0/` | `analysis-v2.3.0` | 稳定基线，只接受合并，不直接开发 |
| 功能开发 | `eagent-v3/{feature-name}/` | `feature/{feature-name}` | 每个 Milestone 独立 worktree |

### 6.2 创建与切换

- **MUST** 每个新 Milestone 从主分支最新提交新建 worktree：
  ```bash
  git worktree add "../{feature-name}" -b feature/{feature-name}
  ```
- **MUST NOT** 在主工作树直接开发新功能，主工作树只做合并和热修复
- **MUST** 功能分支合并进主分支后，立即删除对应 worktree 和 feature 分支：
  ```bash
  git worktree remove "../{feature-name}"
  git branch -d feature/{feature-name}
  ```

### 6.3 Claude Code 工作目录约定

- Claude Code 会话无法自动切换 worktree（`EnterWorktree` 要求会话启动目录在 git 仓库内）
- **MUST** 在所有文件操作和 bash 命令中使用 worktree 的**绝对路径**，明确指向当前开发的 worktree
- **MUST** 在会话开始时通过 `git worktree list` 确认当前有哪些 worktree，以及各自的分支和 HEAD
- 当前活跃 worktree 记录在 `context.md` 的「开发状态」节中

### 6.4 .claude/ 文件同步

- **MUST** worktree 中对 `.claude/context.md`、`.claude/lessons.md` 的修改，在合并前同步复制回主工作树
- **MUST NOT** 将 `.claude/` 目录的修改遗留在废弃 worktree 中
