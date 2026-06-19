> **[文档状态：已废弃 / DEPRECATED]**
> 本方案已被取代，仅保留作历史决策记录，请勿据此实现。
> - 取代文档：[2026-04-28-education-route-fix.md](2026-04-28-education-route-fix.md)
> - 废弃原因：route-fix-review 指出本方案存在阻塞性事实错误，详见 [route-fix-review.md](2026-04-28-education-route-fix-review.md) 第 104-109 行 D4 条目——Task 7 的 INSERT 语句引用了 `edu_course.estimated_minutes` 列，但该列在表中根本不存在（仅 `EduUnit` 有），MySQL 会抛 `Unknown column 'estimated_minutes' in 'field list'`，迁移会中断；review 第 221-229 行阻塞问题清单另列 B1–B5 共 5 项必改缺陷。已由 route-fix（修订版 v2）按 review 修订后取代。
> - 废弃日期：2026-04-28
> - 当前权威方案见取代文档。

# Education Course Structure v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将教育模块课程结构从两层（Course → Unit）重构为三层（Path → Course → Unit），同时保持用户感知以"课程"为单位，Path 作为 Tab 筛选维度不进路由。

**Architecture:**
新增 `EduPath` 表作为顶层组织单位；`EduCourse` 新增 `path_id/stage/stage_order` 字段；`EduUnit` FK 不变（仍指向 `EduCourse`）。前端课程列表页用 Path 的 type+industry 渲染 Tab，用户直接看到课程卡片。进度表 `EduUnitProgress` 保持 unit 粒度，不变。

**Tech Stack:** FastAPI + SQLModel + Pydantic v2（后端）；React 18 + TypeScript + Tailwind CSS（前端）；Alembic（迁移）

---

## Task 0: 创建 Feature Worktree（前置，必须先执行）

**依据：** dev-conventions.md §6.2 MUST — 每个新 Milestone 在独立 worktree 开发，不得在主工作树直接开发新功能。

**Step 1: 在主工作树根目录下创建 worktree**

```bash
cd "C:\Users\Administrator\projects\eagent-v3\v2.3.0 官方版本"
git worktree add "../education-course-v2" -b feature/education-course-v2
```

Expected 输出：`Preparing worktree (new branch 'feature/education-course-v2')`

**Step 2: 确认 worktree 已创建**

```bash
git worktree list
```

Expected：列表中出现 `education-course-v2` 条目，分支为 `feature/education-course-v2`。

**Step 3: 后续所有操作使用 worktree 绝对路径**

- 后端文件根路径：`C:\Users\Administrator\projects\eagent-v3\education-course-v2\src\backend\`
- 前端文件根路径：`C:\Users\Administrator\projects\eagent-v3\education-course-v2\src\frontend\platform\`
- Alembic 路径：`C:\Users\Administrator\projects\eagent-v3\education-course-v2\src\backend\bisheng\core\database\alembic\versions\`

> 注意：Task 1～Task 10 中所有文件路径均指 worktree 下的路径，不是主工作树。

---

## Task 1: 后端数据模型扩展

**Files:**
- Modify: `src/backend/bisheng/education/domain/models/education.py`

**Step 1: 在文件顶部新增 EduPath ORM 模型，在 EduCourse 新增三个字段**

在 `EduCourse` 类之前插入：

```python
class EduPath(SQLModelSerializable, table=True):
    __tablename__ = 'edu_path'

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(max_length=255)
    type: str = Field(max_length=20)        # general / professional / project
    industry: Optional[str] = Field(default=None, max_length=50)  # logistics / ecommerce / ...
    description: Optional[str] = None
    cover: Optional[str] = Field(default=None, max_length=500)
    school_type: str = Field(default='vocational', max_length=20)  # vocational / undergraduate
    order: int = Field(default=0)
    status: int = Field(default=0)
    create_time: Optional[datetime] = Field(default=None)
    update_time: Optional[datetime] = Field(default=None)
```

在 `EduCourse` 类新增三个字段（紧接 `type` 字段后）：

```python
    path_id: Optional[int] = Field(default=None, foreign_key='edu_path.id')
    stage: Optional[str] = Field(default=None, max_length=100)
    stage_order: int = Field(default=0)
```

**Step 2: 新增 EduPathDao**

在文件末尾 `EduPortfolioDao` 之前插入：

```python
class EduPathDao:
    @staticmethod
    def list_paths(session: Session, school_type: Optional[str] = None) -> List[EduPath]:
        stmt = select(EduPath).where(EduPath.status == 0).order_by(EduPath.order)
        if school_type:
            stmt = stmt.where(EduPath.school_type == school_type)
        return session.exec(stmt).all()

    @staticmethod
    def get_path(session: Session, path_id: int) -> Optional[EduPath]:
        return session.get(EduPath, path_id)
```

在 `EduCourseDao` 中新增按 path_id 查询方法，同时给现有 `list_courses` 补充 `order_by(EduCourse.id)` 保证稳定顺序：

```python
    @staticmethod
    def list_courses(session: Session, course_type: Optional[str] = None) -> List[EduCourse]:
        stmt = select(EduCourse).where(EduCourse.status == 0).order_by(EduCourse.id)  # 补充 order_by
        if course_type:
            stmt = stmt.where(EduCourse.type == course_type)
        return session.exec(stmt).all()

    @staticmethod
    def list_courses_by_path(session: Session, path_id: int) -> List[EduCourse]:
        stmt = (
            select(EduCourse)
            .where(EduCourse.path_id == path_id, EduCourse.status == 0)
            .order_by(EduCourse.stage_order, EduCourse.id)
        )
        return session.exec(stmt).all()
```

**Step 3: 手动验证**

```bash
cd "src/backend"
python -c "from bisheng.education.domain.models.education import EduPath, EduCourse; print('OK')"
```

Expected: `OK`

**Step 4: Commit**

```bash
git add src/backend/bisheng/education/domain/models/education.py
git commit -m "feat(education): add EduPath model and extend EduCourse with path_id/stage fields"
```

---

## Task 2: Alembic 迁移脚本

**Files:**
- Create: `src/backend/bisheng/core/database/alembic/versions/education_v4_path_20260428.py`

**Step 1: 创建迁移脚本**

```python
"""education v4: add edu_path table, extend edu_course with path fields

Revision ID: education_v4_path_20260428
Revises: education_teacher_role_seed_20260427
Create Date: 2026-04-28
"""
from alembic import op
import sqlalchemy as sa

revision = 'education_v4_path_20260428'
down_revision = 'education_teacher_role_seed_20260427'
branch_labels = None
depends_on = None


def upgrade():
    # 1. 创建 edu_path 表
    op.create_table(
        'edu_path',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('type', sa.String(20), nullable=False),
        sa.Column('industry', sa.String(50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('cover', sa.String(500), nullable=True),
        sa.Column('school_type', sa.String(20), nullable=False, server_default='vocational'),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('create_time', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('update_time', sa.DateTime(), nullable=False, server_default=sa.func.now(),
                  onupdate=sa.func.now()),
    )

    # 2. edu_course 新增字段（允许 NULL，不破坏存量数据）
    op.add_column('edu_course', sa.Column('path_id', sa.Integer(), sa.ForeignKey('edu_path.id'), nullable=True))
    op.add_column('edu_course', sa.Column('stage', sa.String(100), nullable=True))
    op.add_column('edu_course', sa.Column('stage_order', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    op.drop_column('edu_course', 'stage_order')
    op.drop_column('edu_course', 'stage')
    op.drop_column('edu_course', 'path_id')
    op.drop_table('edu_path')
```

**Step 2: Commit**

```bash
git add src/backend/bisheng/core/database/alembic/versions/education_v4_path_20260428.py
git commit -m "feat(education): alembic migration v4 - add edu_path table and extend edu_course"
```

---

## Task 3: 后端 Schema 扩展

**Files:**
- Modify: `src/backend/bisheng/education/domain/schemas/education_schema.py`

**Step 1: 新增 PathOut，扩展 CourseOut**

在文件顶部 `CourseOut` 之前插入：

```python
# ===== Path =====

class PathOut(BaseModel):
    id: int
    title: str
    type: str
    industry: Optional[str] = None
    description: Optional[str] = None
    cover: Optional[str] = None
    school_type: str
    order: int
    total_courses: int = 0


class PathListResp(BaseModel):
    paths: List[PathOut]
```

在 `CourseOut` 中新增字段：

```python
class CourseOut(BaseModel):
    id: int
    path_id: Optional[int] = None
    title: str
    type: str
    stage: Optional[str] = None
    stage_order: int = 0
    description: Optional[str] = None
    cover: Optional[str] = None
    estimated_minutes: int = 0   # 新增：课程总学时（所有 unit 之和）
    total_units: int = 0
    completed_units: int = 0
```

将 `CourseDetailOut` 的 `units` 字段类型由 `List[UnitOut]` 改为 `List[UnitDetailOut]`，确保前端拿到 `content` 字段：

```python
class CourseDetailOut(BaseModel):
    course: CourseOut
    units: List[UnitDetailOut]   # 改为 UnitDetailOut（含 content 字段）
```

**Step 2: Commit**

```bash
git add src/backend/bisheng/education/domain/schemas/education_schema.py
git commit -m "feat(education): add PathOut schema and extend CourseOut with path/stage fields"
```

---

## Task 4: 后端 PathService + CourseService 扩展

**Files:**
- Create: `src/backend/bisheng/education/domain/services/path_service.py`
- Modify: `src/backend/bisheng/education/domain/services/course_service.py`

**Step 1: 创建 PathService**

```python
from typing import Optional, List
from sqlmodel import Session
from bisheng.education.domain.models.education import EduPathDao, EduCourseDao, EduUnitDao, EduUnitProgress
from bisheng.education.domain.schemas.education_schema import PathOut
from sqlmodel import select


class PathService:

    @staticmethod
    def list_paths(session: Session) -> List[PathOut]:
        paths = EduPathDao.list_paths(session)
        result = []
        for p in paths:
            courses = EduCourseDao.list_courses_by_path(session, p.id)
            result.append(PathOut(
                id=p.id,
                title=p.title,
                type=p.type,
                industry=p.industry,
                description=p.description,
                cover=p.cover,
                school_type=p.school_type,
                order=p.order,
                total_courses=len(courses),
            ))
        return result
```

**Step 2: 扩展 CourseService.list_courses 支持 path_id 筛选，并修正 get_course_detail 返回 UnitDetailOut**

`course_service.py` 中修改 `list_courses`：

```python
@staticmethod
def list_courses(session: Session, student_id: int, course_type: Optional[str] = None,
                 path_id: Optional[int] = None) -> List[CourseOut]:
    if path_id:
        courses = EduCourseDao.list_courses_by_path(session, path_id)
    else:
        courses = EduCourseDao.list_courses(session, course_type)
    result = []
    for c in courses:
        units = EduUnitDao.list_units_by_course(session, c.id)
        total = len(units)
        completed = 0
        if total > 0:
            unit_ids = {u.id for u in units}
            progresses = session.exec(
                select(EduUnitProgress).where(
                    EduUnitProgress.student_id == student_id,
                    EduUnitProgress.unit_id.in_(unit_ids),
                    EduUnitProgress.status == 1,
                )
            ).all()
            completed = len({p.unit_id for p in progresses})
        estimated_minutes = sum(u.estimated_minutes for u in units)
        result.append(CourseOut(
            id=c.id,
            path_id=c.path_id,
            title=c.title,
            type=c.type,
            stage=c.stage,
            stage_order=c.stage_order,
            description=c.description,
            cover=c.cover,
            estimated_minutes=estimated_minutes,
            total_units=total,
            completed_units=completed,
        ))
    return result
```

**Step 3: 修正 get_course_detail — 将 UnitOut 改为 UnitDetailOut，补充 content 字段**

在 `course_service.py` 的 `get_course_detail` 方法中（当前第59-68行），将 `UnitOut(...)` 构造替换为 `UnitDetailOut(...)`，并补充 `content=u.content`：

```python
# 顶部 import 补充 UnitDetailOut
from bisheng.education.domain.schemas.education_schema import (
    CourseOut, CourseDetailOut, UnitOut, UnitDetailOut, UnitLearningOut, MarkCompleteResp,
)

# get_course_detail 中，units_out.append 改为：
units_out.append(UnitDetailOut(
    id=u.id,
    course_id=u.course_id,
    title=u.title,
    order=u.order,
    estimated_minutes=u.estimated_minutes,
    right_panel_type=u.right_panel_type,
    right_panel_config=u.right_panel_config,
    content=u.content,          # 新增，确保前端拿到图文内容
    is_completed=is_completed,
))
```

**Step 4: Commit**

```bash
git add src/backend/bisheng/education/domain/services/path_service.py
git add src/backend/bisheng/education/domain/services/course_service.py
git commit -m "feat(education): add PathService, extend CourseService with path_id filter and fix UnitDetailOut"
```

---

## Task 5: 后端路由扩展

**Files:**
- Modify: `src/backend/bisheng/education/api/router.py`

**Step 1: 新增 path 端点，更新 courses 端点**

在文件顶部 import 中补充：

```python
from bisheng.education.domain.services.path_service import PathService
from bisheng.education.domain.schemas.education_schema import PathListResp
```

新增端点（放在 `list_courses` 之前）：

```python
@router.get('/paths')
def list_paths(
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        paths = PathService.list_paths(session)
        return resp_200(data=PathListResp(paths=paths).model_dump())
```

修改 `list_courses` 端点，新增 `path_id` 查询参数：

```python
@router.get('/courses')
def list_courses(
    course_type: Optional[str] = None,
    path_id: Optional[int] = None,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        courses = CourseService.list_courses(session, login_user.user_id, course_type, path_id)
        return resp_200(data=CourseListResp(courses=courses).model_dump())
```

**Step 2: Commit**

```bash
git add src/backend/bisheng/education/api/router.py
git commit -m "feat(education): add /paths endpoint and path_id filter to /courses"
```

---

## Task 6: 前端 API 层更新

**Files:**
- Modify: `src/frontend/platform/src/pages/EducationPage/api/educationApi.ts`

**Step 1: 新增 PathOut 类型和 listPaths 方法，扩展 CourseOut**

在文件顶部新增：

```typescript
export interface PathOut {
  id: number;
  title: string;
  type: string;
  industry: string | null;
  description: string | null;
  cover: string | null;
  school_type: string;
  order: number;
  total_courses: number;
}
```

在 `CourseOut` 中新增字段：

```typescript
export interface CourseOut {
  id: number;
  path_id: number | null;
  title: string;
  type: string;
  stage: string | null;
  stage_order: number;
  description: string | null;
  cover: string | null;
  estimated_minutes: number;
  total_units: number;
  completed_units: number;
}
```

补充 `UnitDetailOut` 前端接口（继承 `UnitOut` 并加 `content`），并更新 `CourseDetailOut.units` 类型：

```typescript
export interface UnitDetailOut extends UnitOut {
  content: string | null;
}

export interface CourseDetailOut {
  course: CourseOut;
  units: UnitDetailOut[];   // 改为 UnitDetailOut，确保前端能访问 content
}
```

在 `educationApi` 对象中新增：

```typescript
listPaths: (): Promise<PathOut[]> =>
  axios.get(`${BASE}/paths`).then((d: { paths: PathOut[] }) => d.paths),

listCourses: (params?: { courseType?: string; pathId?: number }): Promise<CourseOut[]> =>
  axios.get(`${BASE}/courses`, {
    params: {
      ...(params?.courseType ? { course_type: params.courseType } : {}),
      ...(params?.pathId ? { path_id: params.pathId } : {}),
    },
  }).then((data: { courses: CourseOut[] }) => data.courses),
```

**Step 2: Commit**

```bash
git add src/frontend/platform/src/pages/EducationPage/api/educationApi.ts
git commit -m "feat(education): add PathOut type and listPaths API, extend CourseOut"
```

---

## Task 7: 前端 CoursesPage 重构

**Files:**
- Modify: `src/frontend/platform/src/pages/EducationPage/CoursesPage.tsx`

**Step 1: 重构为 Path-Tab 驱动的课程列表**

整体逻辑：启动时调 `listPaths` 拿到所有路径，按 type+industry 渲染 Tab；选中 Tab 后调 `listCourses({ pathId })` 拿课程卡片。

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { educationApi, PathOut, CourseOut } from './api/educationApi';

export default function CoursesPage() {
  const [paths, setPaths] = useState<PathOut[]>([]);
  const [activePathId, setActivePathId] = useState<number | null>(null);
  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [loadingPaths, setLoadingPaths] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // 初始化：拉取所有路径
  useEffect(() => {
    educationApi.listPaths()
      .then(data => {
        setPaths(data);
        if (data.length > 0) setActivePathId(data[0].id);
      })
      .finally(() => setLoadingPaths(false));
  }, []);

  // 切换 Tab：拉取对应路径的课程
  useEffect(() => {
    if (activePathId === null) return;
    setLoadingCourses(true);
    educationApi.listCourses({ pathId: activePathId })
      .then(setCourses)
      .finally(() => setLoadingCourses(false));
  }, [activePathId]);

  const PATH_TYPE_LABEL: Record<string, string> = {
    general: '通识',
    professional: '专业核心',
    project: '项目实操',
  };

  const getTabLabel = (path: PathOut) => {
    if (path.industry) return `${PATH_TYPE_LABEL[path.type] || path.type}·${path.industry === 'logistics' ? '物流' : path.industry === 'ecommerce' ? '电商' : path.industry}`;
    return PATH_TYPE_LABEL[path.type] || path.title;
  };

  return (
    <div className="min-h-full p-6">
      <h1 className="text-2xl font-semibold text-[#140E35] mb-6">课程学习</h1>

      {/* Path Tabs */}
      {!loadingPaths && (
        <div className="flex gap-2 mb-6 border-b border-[#E5EAF4]">
          {paths.map(path => (
            <button
              key={path.id}
              onClick={() => setActivePathId(path.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activePathId === path.id
                  ? 'border-[#4658FF] text-[#4658FF]'
                  : 'border-transparent text-[#9498AC] hover:text-[#140E35]'
              }`}
            >
              {getTabLabel(path)}
            </button>
          ))}
        </div>
      )}

      {/* Course Grid */}
      {loadingCourses ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 bg-white rounded-xl border border-[#E5EAF4] animate-pulse" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center text-[#9498AC] py-16">暂无课程</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {courses.map(course => (
            <Link
              key={course.id}
              to={`/education/courses/${course.id}`}
              className="group bg-white rounded-xl border border-[#E5EAF4] overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="h-32 bg-gradient-to-br from-[#4658FF]/10 to-[#6B7FFF]/10 flex items-center justify-center">
                {course.cover ? (
                  <img src={course.cover} alt={course.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#4658FF]/40 text-4xl">📚</span>
                )}
              </div>
              <div className="p-4">
                {course.stage && (
                  <div className="text-xs text-[#9498AC] mb-1">{course.stage}</div>
                )}
                <h3 className="text-sm font-semibold text-[#140E35] mb-2 line-clamp-2">{course.title}</h3>
                <div className="flex items-center justify-between text-xs text-[#9498AC]">
                  <span>{Math.ceil(course.estimated_minutes / 60)} 学时</span>
                  <span>{course.completed_units}/{course.total_units} 已完成</span>
                </div>
                <div className="mt-2 h-1 bg-[#E5EAF4] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#4658FF] rounded-full"
                    style={{ width: course.total_units > 0 ? `${(course.completed_units / course.total_units) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/frontend/platform/src/pages/EducationPage/CoursesPage.tsx
git commit -m "feat(education): redesign CoursesPage with Path-Tab navigation"
```

---

## Task 8: 前端路由更新

**Files:**
- Modify: `src/frontend/platform/src/routes/index.tsx`

**Step 1: 简化教育路由树，移除 unitId 层**

将现有教育路由块：

```tsx
{
  path: "education",
  children: [
    { path: "courses", element: <CoursesPage /> },
    { path: "courses/:courseId", element: <CourseDetailPage /> },
    { path: "courses/:courseId/:unitId", element: <UnitLearningPage /> },
    { path: "portfolio", element: <PortfolioPage /> },
    { path: "classes", element: <ClassesPage /> },
    { path: "classes/:classId", element: <ClassesPage /> },
    { path: "accounts", element: <AccountsPage /> },
  ],
},
```

替换为：

```tsx
{
  path: "education",
  children: [
    { path: "courses", element: <CoursesPage /> },
    { path: "courses/:courseId", element: <CourseLearningPage /> },
    { path: "portfolio", element: <PortfolioPage /> },
    { path: "classes", element: <ClassesPage /> },
    { path: "classes/:classId", element: <ClassesPage /> },
    { path: "accounts", element: <AccountsPage /> },
  ],
},
```

同步更新顶部 import，将 `CourseDetailPage` 和 `UnitLearningPage` 的 lazy 导入替换为 `CourseLearningPage`（保持 lazy 风格，使用相对路径，与现有教育组件一致）：

```tsx
// 删除这两行：
// const CourseDetailPage = lazy(() => import("../pages/EducationPage/CourseDetailPage"));
// const UnitLearningPage = lazy(() => import("../pages/EducationPage/UnitLearningPage"));

// 新增：
const CourseLearningPage = lazy(() => import("../pages/EducationPage/CourseLearningPage"));
```

**Step 2: Commit**

```bash
git add src/frontend/platform/src/routes/index.tsx
git commit -m "feat(education): simplify route tree, merge CourseDetail+UnitLearning into CourseLearningPage"
```

---

## Task 9: 新建 CourseLearningPage（合并原 CourseDetailPage + UnitLearningPage）

**Files:**
- Create: `src/frontend/platform/src/pages/EducationPage/CourseLearningPage.tsx`
- Delete（逻辑删除，保留文件但清空为重定向）: `CourseDetailPage.tsx`, `UnitLearningPage.tsx`

**Step 1: 创建 CourseLearningPage**

页面逻辑：进入后调 `getCourseDetail` 拿课程信息和 unit 列表，取第一个（或唯一一个）unit 渲染双栏内容。若课程有多个 unit，左栏顶部显示 unit 切换目录，通过前端 state 切换，URL 不变。

```tsx
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { educationApi, CourseDetailOut, UnitDetailOut } from './api/educationApi';
import DialogPanel from './panels/DialogPanel';
import TextSubmitPanel from './panels/TextSubmitPanel';

const PANEL_LABEL: Record<string, string> = {
  dialog: '对话练习',
  prompt_debugger: 'Prompt 调试',
  knowledge_upload: '知识库上传',
  agent_form: '智能体配置',
  knowledge_bind: '知识库绑定',
  text_submit: '提交作品',
};

function RightPanel({ type, config, unitId, classId, onMarkComplete }: {
  type: string;
  config: Record<string, unknown> | null;
  unitId: number;
  classId?: number;
  onMarkComplete?: () => void;
}) {
  switch (type) {
    case 'dialog':
      return <DialogPanel config={config} />;
    case 'text_submit':
      return <TextSubmitPanel unitId={unitId} classId={classId} onSubmitted={onMarkComplete} />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-[#9498AC] text-sm">
          {PANEL_LABEL[type] || type} — 即将开放
        </div>
      );
  }
}

export default function CourseLearningPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const classId = searchParams.get('class_id') ? Number(searchParams.get('class_id')) : undefined;

  const [data, setData] = useState<CourseDetailOut | null>(null);
  const [activeUnitIndex, setActiveUnitIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    educationApi.getCourseDetail(Number(courseId), classId)
      .then(d => { setData(d); setActiveUnitIndex(0); })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [courseId, classId]);

  const handleMarkComplete = async () => {
    if (!data || !classId) return;
    const unit = data.units[activeUnitIndex];
    if (!unit) return;
    setMarking(true);
    try {
      await educationApi.markUnitComplete(unit.id, classId);
      setData(prev => {
        if (!prev) return prev;
        const units = prev.units.map((u, i) =>
          i === activeUnitIndex ? { ...u, is_completed: true } : u
        );
        const completed = units.filter(u => u.is_completed).length;
        return { ...prev, units, course: { ...prev.course, completed_units: completed } };
      });
    } finally {
      setMarking(false);
    }
  };

  if (loading) return <div className="p-8 text-[#9498AC]">加载中...</div>;
  if (!data) return <div className="p-8 text-[#9498AC]">课程不存在</div>;

  const { course, units } = data;
  const activeUnit = units[activeUnitIndex];
  const hasMultipleUnits = units.length > 1;

  return (
    <div className="flex flex-col h-screen">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-[#E5EAF4] flex-shrink-0">
        <div className="text-xs text-[#9498AC] flex items-center gap-1">
          <Link to="/education/courses" className="hover:text-[#4658FF]">课程学习</Link>
          <span>/</span>
          <span className="text-[#140E35]">{course.title}</span>
          {hasMultipleUnits && activeUnit && (
            <>
              <span>/</span>
              <span className="text-[#140E35]">{activeUnit.title}</span>
            </>
          )}
        </div>
        {hasMultipleUnits && (
          <div className="flex items-center gap-2">
            {activeUnitIndex > 0 && (
              <button
                onClick={() => setActiveUnitIndex(i => i - 1)}
                className="text-xs text-[#9498AC] hover:text-[#4658FF] px-2 py-1"
              >
                ← 上一章节
              </button>
            )}
            {activeUnitIndex < units.length - 1 && (
              <button
                onClick={() => setActiveUnitIndex(i => i + 1)}
                className="text-xs text-[#9498AC] hover:text-[#4658FF] px-2 py-1"
              >
                下一章节 →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dual Column */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Markdown Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-white border-r border-[#E5EAF4]">
          {/* Unit tabs（多章节时显示） */}
          {hasMultipleUnits && (
            <div className="flex gap-2 mb-6 border-b border-[#E5EAF4]">
              {units.map((u, i) => (
                <button
                  key={u.id}
                  onClick={() => setActiveUnitIndex(i)}
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                    i === activeUnitIndex
                      ? 'border-[#4658FF] text-[#4658FF]'
                      : 'border-transparent text-[#9498AC] hover:text-[#140E35]'
                  }`}
                >
                  {i + 1}. {u.title}
                  {u.is_completed && <span className="ml-1 text-[#4658FF]">✓</span>}
                </button>
              ))}
            </div>
          )}

          <h1 className="text-xl font-semibold text-[#140E35] mb-6">
            {activeUnit?.title || course.title}
          </h1>

          {activeUnit?.content ? (
            <div className="prose prose-sm max-w-none text-[#565772]">
              <ReactMarkdown>{activeUnit.content}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-[#9498AC]">本章节内容待更新</div>
          )}

          {/* Mark Complete */}
          {activeUnit && (
            <div className="mt-10 pt-6 border-t border-[#E5EAF4]">
              <div className="flex items-center gap-3">
                {activeUnit.is_completed ? (
                  <div className="flex items-center gap-2 text-sm text-[#4658FF]">
                    <span>✅</span>
                    <span>已完成</span>
                  </div>
                ) : (
                  <button
                    onClick={handleMarkComplete}
                    disabled={marking || !classId}
                    className="px-6 py-2 bg-[#4658FF] text-white text-sm rounded-lg disabled:opacity-50 hover:bg-[#3748EF]"
                  >
                    {marking ? '标记中...' : '标记本章节已完成'}
                  </button>
                )}
              </div>
              {!classId && (
                <p className="text-xs text-[#9498AC] mt-2">加入班级后可记录进度</p>
              )}
            </div>
          )}
        </div>

        {/* Right — Operation Panel */}
        {activeUnit && (
          <div className="w-96 flex-shrink-0 flex flex-col bg-white">
            <div className="px-4 py-3 border-b border-[#E5EAF4]">
              <span className="text-sm font-medium text-[#140E35]">
                {PANEL_LABEL[activeUnit.right_panel_type] || '操作区'}
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <RightPanel
                type={activeUnit.right_panel_type}
                config={activeUnit.right_panel_config}
                unitId={activeUnit.id}
                classId={classId}
                onMarkComplete={handleMarkComplete}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/frontend/platform/src/pages/EducationPage/CourseLearningPage.tsx
git commit -m "feat(education): add CourseLearningPage merging course detail and unit learning"
```

---

## Task 10: 种子数据脚本

**Files:**
- Create: `src/backend/bisheng/core/database/alembic/versions/education_v4_seed_20260428.py`

**Step 1: 创建 4 条路径种子数据**

```python
"""education v4 seed: insert 4 EduPath records

Revision ID: education_v4_seed_20260428
Revises: education_v4_path_20260428
Create Date: 2026-04-28
"""
from alembic import op
from sqlalchemy.sql import text

revision = 'education_v4_seed_20260428'
down_revision = 'education_v4_path_20260428'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(text("""
        INSERT INTO edu_path (title, type, industry, description, school_type, `order`, status, create_time, update_time)
        VALUES
        ('AI通识路径', 'general', NULL, '面向全体高职学生，零基础入门AI工具使用', 'vocational', 1, 0, NOW(), NOW()),
        ('AI专业核心路径', 'professional', NULL, '面向高职AI/计算机专业学生，掌握智能体开发全栈能力', 'vocational', 2, 0, NOW(), NOW()),
        ('项目实操路径·物流方向', 'project', 'logistics', '面向高职物流管理、供应链等专业学生', 'vocational', 3, 0, NOW(), NOW()),
        ('项目实操路径·电商方向', 'project', 'ecommerce', '面向高职电子商务、市场营销等专业学生', 'vocational', 4, 0, NOW(), NOW())
    """))


def downgrade():
    op.execute(text("DELETE FROM edu_path WHERE school_type = 'vocational'"))
```

**Step 2: Commit**

```bash
git add src/backend/bisheng/core/database/alembic/versions/education_v4_seed_20260428.py
git commit -m "feat(education): seed 4 EduPath records for vocational school"
```

---

## 验收清单

执行完所有 Task 后，逐项确认：

- [ ] `python -c "from bisheng.education.domain.models.education import EduPath; print('OK')"` 输出 OK
- [ ] Alembic 迁移链完整：`education_teacher_role_seed_20260427` → `education_v4_path_20260428` → `education_v4_seed_20260428`
- [ ] `GET /api/v1/education/paths` 返回 4 条路径
- [ ] `GET /api/v1/education/courses?path_id=1` 返回对应路径的课程列表
- [ ] 前端课程列表页 Tab 按路径切换，课程卡片正确渲染
- [ ] 点击课程卡片进入 `/education/courses/:courseId`，双栏正常显示
- [ ] 多 unit 课程：左栏顶部显示章节切换 Tab，URL 不变
- [ ] 标记完成按钮正常工作，进度数据写入 `edu_unit_progress`

---

## 执行结果（2026-04-28）

### 执行方式

原计划使用 `superpowers:subagent-driven-development` 技能，但技能接口在当前环境未注册。改为手动按 SKILL.md 规范执行：主 agent 逐 Task 完成实现 + AST 语法验证 + commit，全程 10 个独立提交。

### Git 提交记录（feature/education-course-v2）

```
5524a4338  feat(education): seed 4 EduPath records for vocational school
832239a68  feat(education): add CourseLearningPage merging course detail and unit learning
269727a2f  feat(education): simplify route tree, replace CourseDetail+UnitLearning with CourseLearningPage
c4fa156bf  feat(education): redesign CoursesPage with Path-Tab navigation
899bb9c0d  feat(education): add PathOut type and listPaths API, extend CourseOut, fix CourseDetailOut units type
7fceb6eb1  feat(education): add /paths endpoint and path_id filter to /courses
bbe0d3209  feat(education): add PathService, extend CourseService with path_id filter and fix UnitDetailOut in get_course_detail
5a5c9c4d6  feat(education): add PathOut schema and extend CourseOut with path/stage fields; fix CourseDetailOut to use UnitDetailOut
d46ceb61c  feat(education): alembic migration v4 - add edu_path table and extend edu_course
48076cf21  feat(education): add EduPath model and extend EduCourse with path_id/stage fields
```

### Worktree 信息

- 分支：`feature/education-course-v2`
- 路径：`C:\Users\Administrator\projects\eagent-v3\education-course-v2`
- 主工作树：`C:\Users\Administrator\projects\eagent-v3\v2.3.0 官方版本`

### 关键偏差记录

| 偏差 | 原因 | 处理方式 |
|------|------|---------|
| Python import 验证失败（langchain 版本不匹配） | 本地开发环境缺 langchain 依赖，与代码改动无关 | 改用 `python -c "import ast; ast.parse(src)"` 语法验证替代，所有文件通过 |
| `TextSubmitPanel.onSubmitted` 类型不匹配 | 接口签名为 `(content: string) => void`，而 `onMarkComplete` 为 `() => void` | CourseLearningPage 中用 lambda 适配：`onSubmitted={() => onMarkComplete?.()}` |
| Write 工具拒绝写入 CoursesPage.tsx | Write 工具要求先读取文件 | 先 Read 前 5 行，再 Write 全量覆盖 |

### Alembic 迁移链

```
education_teacher_role_seed_20260427
  └─ education_v4_path_20260428     （建 edu_path 表，edu_course 加 3 列）
       └─ education_v4_seed_20260428 （插入 4 条 EduPath 种子数据）
```

### 待执行（容器内验收）

- [ ] `python -c "from bisheng.education.domain.models.education import EduPath; print('OK')"` 输出 OK
- [ ] `alembic upgrade head` 迁移成功
- [ ] `GET /api/v1/education/paths` 返回 4 条路径
- [ ] `GET /api/v1/education/courses?path_id=1` 返回对应路径的课程列表
- [ ] 前端 Tab 切换 + 课程卡片渲染正常
- [ ] CourseLearningPage 双栏正常显示，多 unit 切换 URL 不变
- [ ] 标记完成写入 `edu_unit_progress`
