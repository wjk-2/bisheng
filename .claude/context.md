# 项目上下文

## 当前开发状态（2026-04-27）

### 活跃 Worktree

| worktree | 本地路径 | 分支 | 状态 |
|---------|---------|------|------|
| 主工作树 | `eagent-v3/v2.3.0 官方版本/` | `analysis-v2.3.0` | 稳定，HEAD=6932768 |
| Milestone 2 | `eagent-v3/education-m2/` | `feature/education-milestone2` | 后端已完成，待合并 |

### 里程碑进度

| 里程碑 | 状态 | 说明 |
|--------|------|------|
| Milestone 1 — 课程学习（学生端静态） | 已完成并验证 | 课程列表/详情/单元学习页，已合并至主分支 |
| Milestone 2 — 班级、进度、作品集 | 前端已完成，待前端构建验证 | 后端在 `education-m2/` worktree，前端改动已提交主分支 |
| Milestone 3 | 待规划 | DialogPanel 真实对话接入，教师学情看板 |

### Milestone 2 完成内容

**后端（education-m2/ worktree）**
- EduClassDao、EduClassMemberDao、EduPortfolioDao（含批量查询防 N+1）
- ClassService、PortfolioService
- 班级 API（6 个端点）、Portfolio API（2 个端点）
- TeacherRole=3 常量 + is_teacher() + get_teacher_user() + seed migration
- Alembic 链修复（down_revision 指向正确版本）

**前端（主工作树）**
- educationApi.ts：班级 + 作品集 8 个接口
- CoursesPage/CourseDetailPage/UnitLearningPage：class_id URL query param 传播
- ClassesPage：教师端列表视图（创建班级）+ 详情视图（添加/移除学生、进入课程）
- PortfolioPage：学生作品集提交 + 历史查看
- UnitLearningPage："提交作品"按钮入口

### 下一步

- Task 10：前端构建验证（npm run build）— 用户已暂缓，需要时执行
- education-m2 后端代码合并至主分支（待构建验证通过后）

---

## 已完成里程碑摘要

| 里程碑 | 完成时间 | 说明 |
|--------|---------|------|
| 双前端视觉重构（AI Studio 风格） | 2026-04-25 | 设计 Token 落地，颜色规范见 `dev-guide.md §8` |
| 教育模块 Milestone 1（学生端静态） | 2026-04-27 | 课程列表/详情/单元学习，已合并至主分支 |
| 教育模块 Milestone 2（班级、进度、作品集） | 2026-04-27 | 后端在 education-m2 分支，前端已提交主分支，待构建验证 |
