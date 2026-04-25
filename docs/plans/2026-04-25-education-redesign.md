# Education 模块重构实现计划（Milestone 1 — 学生主流程）

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重构 Education 模块，交付学生完整学习主流程：课程列表 → 课程详情 → 单元学习（双栏界面）

**Architecture:** 后端采用 DDD 分层（models → schemas → services → api），6 张新表替换旧 4 张表；前端清空旧 EducationPage 目录，新建基于角色的多视图路由树；权限通过扩展 WebMenuResource 枚举与现有 web_menu 体系对接。

**Tech Stack:** Python 3.10 + FastAPI + SQLModel + Alembic | React 18 + TypeScript 5.4 + Tailwind CSS 3.4 + Zustand | Design Token: #4658FF / #140E35 / #F7F9FF / #E5EAF4

---

## 前置说明

- **工作目录**：`C:/Users/Administrator/projects/eagent-v3/v2.3.0 官方版本/`（下文简称项目根）
- **git 操作**：仅本地操作，**不推送 GitHub**
- **开发模式**：单人全栈，后端先行，前端后行，Milestone 1 只做学生主流程
- **Milestone 1 范围**：
  - 学生视图：课程列表 + 课程详情 + 单元学习（双栏）+ 标记完成
  - 教师/管理员视图：暂不实现（路由占位即可）
  - 右栏面板：Milestone 1 只实现「对话框」和「文本提交」两种，其余 4 种留 Milestone 2

---

## Task 0：清理旧代码，建立工作分支

### Files
- Delete: `src/backend/bisheng/education/`（全目录）
- Delete: `src/frontend/platform/src/pages/EducationPage/`（全目录）
- Modify: `src/frontend/platform/src/routes/index.tsx`（删除旧导入）

### Step 1：本地建分支

```bash
cd "C:/Users/Administrator/projects/eagent-v3/v2.3.0 官方版本"
git checkout -b feature/education-redesign
```

Expected: Switched to a new branch 'feature/education-redesign'

### Step 2：导出旧视频 URL（删表前备份）

在 MySQL 中执行（替换为实际连接参数）：

```sql
SELECT id, title, video_url FROM education_chapters WHERE video_url IS NOT NULL AND video_url != '';
```

将结果导出为 CSV 或 JSON 存档，路径：`docs/education_video_backup_20260425.csv`

### Step 3：删除旧后端代码

```bash
rm -rf src/backend/bisheng/education/
```

Expected: 目录已删除，无错误

### Step 4：删除旧前端代码

```bash
rm -rf src/frontend/platform/src/pages/EducationPage/
```

Expected: 目录已删除，无错误

### Step 5：清除 routes/index.tsx 中的旧 education 导入

修改 `src/frontend/platform/src/routes/index.tsx`，删除以下导入（约 44-51 行范围，根据实际行号确认）：

```ts
// 删除这些旧导入：
import EducationLayout from "../pages/EducationPage/EducationLayout";
import EducationPage from "../pages/EducationPage";
import CourseDetail from "../pages/EducationPage/CourseDetail";
import ChapterLearning from "../pages/EducationPage/ChapterLearning";
import ProgressPage from "../pages/EducationPage/ProgressPage";
import PracticeEnvironment from "../pages/EducationPage/PracticeEnvironment";
import GuidedBuilder from "../pages/EducationPage/GuidedBuilder";
import CreationSuccess from "../pages/EducationPage/CreationSuccess";
```

同时将路由段（103-115 行）替换为临时占位：

```ts
{
  path: "education",
  element: <div>Education Module — Under Construction</div>,
},
```

### Step 6：确认前端编译不报错

```bash
cd src/frontend/platform && npm run build 2>&1 | tail -20
```

Expected: build 成功（0 errors），或仅有 warning

### Step 7：提交清理状态

```bash
cd "C:/Users/Administrator/projects/eagent-v3/v2.3.0 官方版本"
git add -A
git commit -m "chore: remove old education module (backend + frontend)"
```

---

## Task 1：扩展 WebMenuResource 枚举

### Files
- Modify: `src/backend/bisheng/database/models/role_access.py`（lines 35-47）

### Step 1：确认当前内容

```bash
sed -n '35,47p' src/backend/bisheng/database/models/role_access.py
```

Expected output（当前值）：
```
class WebMenuResource(Enum):
    """Front-end menu bar resources"""
    BUILD = 'build'
    KNOWLEDGE = 'knowledge'
    MODEL = 'model'
    EVALUATION = 'evaluation'
    FRONTEND = 'frontend'
    BACKEND = 'backend'
    CREATE_DASHBOARD = 'create_dashboard'
```

### Step 2：添加两个新枚举值

在 `CREATE_DASHBOARD = 'create_dashboard'` 一行之后追加：

```python
    EDUCATION_STUDENT = 'education_student'  # 学生：课程学习、作品集
    EDUCATION_TEACHER = 'education_teacher'  # 教师：班级管理
```

修改后文件内容（35-50 行）：

```python
class WebMenuResource(Enum):
    """Front-end menu bar resources"""

    BUILD = 'build'  # Build Menu
    KNOWLEDGE = 'knowledge'  # Knowledge Menu
    MODEL = 'model'  # Model Menu
    EVALUATION = 'evaluation'  # Evaluation Menu

    FRONTEND = 'frontend'  # Front-end permissions
    BACKEND = 'backend'  # Backend Access

    CREATE_DASHBOARD = 'create_dashboard'  # Create board permissions

    EDUCATION_STUDENT = 'education_student'  # 学生：课程学习、作品集
    EDUCATION_TEACHER = 'education_teacher'  # 教师：班级管理
```

### Step 3：验证 Python 语法

```bash
cd src/backend && python -c "from bisheng.database.models.role_access import WebMenuResource; print([e.value for e in WebMenuResource])"
```

Expected: `['build', 'knowledge', 'model', 'evaluation', 'frontend', 'backend', 'create_dashboard', 'education_student', 'education_teacher']`

### Step 4：提交

```bash
git add src/backend/bisheng/database/models/role_access.py
git commit -m "feat: add education_student and education_teacher to WebMenuResource"
```

---

## Task 2：Alembic 数据库迁移

### Files
- Create: `src/backend/bisheng/core/database/alembic/versions/education_v3_20260425.py`

### Step 1：确认 alembic 版本链的最新版本

```bash
grep -r "revision = " src/backend/bisheng/core/database/alembic/versions/ | grep -v "down_revision"
```

记录最新的 revision ID（用于下一步的 `down_revision`）。

### Step 2：获取当前数据库中旧表是否存在

```bash
# 若能连接数据库，检查旧表
mysql -u root -p bisheng -e "SHOW TABLES LIKE 'education_%';"
```

Expected: 显示 `education_courses`, `education_chapters`, `education_user_progress`, `education_guided_progress`

### Step 3：编写迁移脚本

创建文件 `src/backend/bisheng/core/database/alembic/versions/education_v3_20260425.py`：

```python
"""education v3 redesign: drop old 4 tables, create new 6 tables

Revision ID: education_v3_20260425
Revises: education_v2_seed_20260208
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision = 'education_v3_20260425'
down_revision = 'education_v2_seed_20260208'
branch_labels = None
depends_on = None


def upgrade():
    # === 删除旧表（顺序：先子表后父表）===
    op.drop_table('education_guided_progress')
    op.drop_table('education_user_progress')
    op.drop_table('education_chapters')
    op.drop_table('education_courses')

    # === 创建新表 ===

    # 1. edu_course
    op.create_table(
        'edu_course',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('type', sa.String(20), nullable=False),  # general / professional / project
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('cover', sa.String(500), nullable=True),
        sa.Column('status', sa.Integer(), nullable=False, server_default='0'),  # 0=启用 1=禁用
        sa.Column('create_time', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('update_time', sa.DateTime(), nullable=False, server_default=sa.func.now(),
                  onupdate=sa.func.now()),
    )

    # 2. edu_unit
    op.create_table(
        'edu_unit',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('course_id', sa.Integer(), sa.ForeignKey('edu_course.id'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('right_panel_type', sa.String(30), nullable=False, server_default='dialog'),
        sa.Column('right_panel_config', mysql.JSON(), nullable=True),
        sa.Column('estimated_minutes', sa.Integer(), nullable=False, server_default='60'),
        sa.Column('status', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('create_time', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('update_time', sa.DateTime(), nullable=False, server_default=sa.func.now(),
                  onupdate=sa.func.now()),
    )

    # 3. edu_class
    op.create_table(
        'edu_class',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('semester', sa.String(20), nullable=False),
        sa.Column('teacher_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.Integer(), nullable=False, server_default='0'),  # 0=进行中 1=已结束
        sa.Column('create_time', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('update_time', sa.DateTime(), nullable=False, server_default=sa.func.now(),
                  onupdate=sa.func.now()),
    )

    # 4. edu_class_member
    op.create_table(
        'edu_class_member',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('class_id', sa.Integer(), sa.ForeignKey('edu_class.id'), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.Integer(), nullable=False, server_default='0'),  # 0=正常 1=已移除
        sa.Column('join_time', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # 5. edu_unit_progress
    op.create_table(
        'edu_unit_progress',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('class_id', sa.Integer(), sa.ForeignKey('edu_class.id'), nullable=False),
        sa.Column('unit_id', sa.Integer(), sa.ForeignKey('edu_unit.id'), nullable=False),
        sa.Column('status', sa.Integer(), nullable=False, server_default='0'),  # 0=未完成 1=已完成
        sa.Column('complete_time', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('student_id', 'unit_id', 'class_id', name='uq_progress_student_unit_class'),
    )

    # 6. edu_portfolio
    op.create_table(
        'edu_portfolio',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('unit_id', sa.Integer(), sa.ForeignKey('edu_unit.id'), nullable=False),
        sa.Column('class_id', sa.Integer(), sa.ForeignKey('edu_class.id'), nullable=True),
        sa.Column('asset_type', sa.String(20), nullable=False),  # agent/knowledge/workflow/text
        sa.Column('asset_id', sa.Integer(), nullable=True),
        sa.Column('text_content', sa.Text(), nullable=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('submit_time', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table('edu_portfolio')
    op.drop_table('edu_unit_progress')
    op.drop_table('edu_class_member')
    op.drop_table('edu_class')
    op.drop_table('edu_unit')
    op.drop_table('edu_course')
    # 注：降级不恢复旧表，旧表数据已由 Task 0 Step 2 备份
```

### Step 4：运行迁移

```bash
cd src/backend
alembic upgrade head
```

Expected: `Running upgrade ... -> education_v3_20260425`

如报错 `Table 'education_guided_progress' doesn't exist`，说明旧表不存在，在 `upgrade()` 中给对应 `drop_table` 调用加 `if_exists=True`：

```python
op.drop_table('education_guided_progress', if_exists=True)
op.drop_table('education_user_progress', if_exists=True)
op.drop_table('education_chapters', if_exists=True)
op.drop_table('education_courses', if_exists=True)
```

### Step 5：验证新表存在

```bash
mysql -u root -p bisheng -e "SHOW TABLES LIKE 'edu_%';"
```

Expected: 列出 6 张新表

### Step 6：提交

```bash
git add src/backend/bisheng/core/database/alembic/versions/education_v3_20260425.py
git commit -m "feat: alembic migration education_v3 — drop old 4 tables, create new 6 tables"
```

---

## Task 3：后端数据模型

### Files
- Create: `src/backend/bisheng/education/` （重建目录结构）
- Create: `src/backend/bisheng/education/__init__.py`
- Create: `src/backend/bisheng/education/api/__init__.py`
- Create: `src/backend/bisheng/education/domain/__init__.py`
- Create: `src/backend/bisheng/education/domain/models/__init__.py`
- Create: `src/backend/bisheng/education/domain/schemas/__init__.py`
- Create: `src/backend/bisheng/education/domain/services/__init__.py`
- Create: `src/backend/bisheng/education/domain/models/education.py`

### Step 1：建目录结构

```bash
mkdir -p src/backend/bisheng/education/{api,domain/{models,schemas,services}}
touch src/backend/bisheng/education/__init__.py
touch src/backend/bisheng/education/api/__init__.py
touch src/backend/bisheng/education/domain/__init__.py
touch src/backend/bisheng/education/domain/models/__init__.py
touch src/backend/bisheng/education/domain/schemas/__init__.py
touch src/backend/bisheng/education/domain/services/__init__.py
```

### Step 2：编写模型文件

创建 `src/backend/bisheng/education/domain/models/education.py`：

```python
from datetime import datetime
from typing import Optional, List
from sqlmodel import Field, SQLModel
from bisheng.common.models.base import SQLModelSerializable


class EduCourse(SQLModelSerializable, table=True):
    __tablename__ = 'edu_course'

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(max_length=255)
    type: str = Field(max_length=20)  # general / professional / project
    description: Optional[str] = None
    cover: Optional[str] = Field(default=None, max_length=500)
    status: int = Field(default=0)  # 0=启用 1=禁用
    create_time: Optional[datetime] = Field(default=None)
    update_time: Optional[datetime] = Field(default=None)


class EduUnit(SQLModelSerializable, table=True):
    __tablename__ = 'edu_unit'

    id: Optional[int] = Field(default=None, primary_key=True)
    course_id: int = Field(foreign_key='edu_course.id')
    title: str = Field(max_length=255)
    order: int = Field(default=0)
    content: Optional[str] = None  # Markdown
    right_panel_type: str = Field(default='dialog', max_length=30)
    right_panel_config: Optional[dict] = Field(default=None, sa_type='JSON')
    estimated_minutes: int = Field(default=60)
    status: int = Field(default=0)
    create_time: Optional[datetime] = Field(default=None)
    update_time: Optional[datetime] = Field(default=None)


class EduClass(SQLModelSerializable, table=True):
    __tablename__ = 'edu_class'

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=255)
    semester: str = Field(max_length=20)
    teacher_id: int
    status: int = Field(default=0)  # 0=进行中 1=已结束
    create_time: Optional[datetime] = Field(default=None)
    update_time: Optional[datetime] = Field(default=None)


class EduClassMember(SQLModelSerializable, table=True):
    __tablename__ = 'edu_class_member'

    id: Optional[int] = Field(default=None, primary_key=True)
    class_id: int = Field(foreign_key='edu_class.id')
    student_id: int
    status: int = Field(default=0)  # 0=正常 1=已移除
    join_time: Optional[datetime] = Field(default=None)


class EduUnitProgress(SQLModelSerializable, table=True):
    __tablename__ = 'edu_unit_progress'

    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int
    class_id: int = Field(foreign_key='edu_class.id')
    unit_id: int = Field(foreign_key='edu_unit.id')
    status: int = Field(default=0)  # 0=未完成 1=已完成
    complete_time: Optional[datetime] = Field(default=None)


class EduPortfolio(SQLModelSerializable, table=True):
    __tablename__ = 'edu_portfolio'

    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int
    unit_id: int = Field(foreign_key='edu_unit.id')  # NOT NULL — 必须来自单元任务
    class_id: Optional[int] = Field(default=None, foreign_key='edu_class.id')
    asset_type: str = Field(max_length=20)  # agent / knowledge / workflow / text
    asset_id: Optional[int] = None
    text_content: Optional[str] = None
    title: str = Field(max_length=255)
    description: Optional[str] = None
    submit_time: Optional[datetime] = Field(default=None)


# DAO 层
from sqlmodel import Session, select


class EduCourseDao:
    @staticmethod
    def list_courses(session: Session, course_type: Optional[str] = None) -> List[EduCourse]:
        stmt = select(EduCourse).where(EduCourse.status == 0)
        if course_type:
            stmt = stmt.where(EduCourse.type == course_type)
        return session.exec(stmt).all()

    @staticmethod
    def get_course(session: Session, course_id: int) -> Optional[EduCourse]:
        return session.get(EduCourse, course_id)


class EduUnitDao:
    @staticmethod
    def list_units_by_course(session: Session, course_id: int) -> List[EduUnit]:
        stmt = (
            select(EduUnit)
            .where(EduUnit.course_id == course_id, EduUnit.status == 0)
            .order_by(EduUnit.order)
        )
        return session.exec(stmt).all()

    @staticmethod
    def get_unit(session: Session, unit_id: int) -> Optional[EduUnit]:
        return session.get(EduUnit, unit_id)


class EduProgressDao:
    @staticmethod
    def get_progress(session: Session, student_id: int, unit_id: int, class_id: int) -> Optional[EduUnitProgress]:
        stmt = select(EduUnitProgress).where(
            EduUnitProgress.student_id == student_id,
            EduUnitProgress.unit_id == unit_id,
            EduUnitProgress.class_id == class_id,
        )
        return session.exec(stmt).first()

    @staticmethod
    def list_progress_by_student_class(session: Session, student_id: int, class_id: int) -> List[EduUnitProgress]:
        stmt = select(EduUnitProgress).where(
            EduUnitProgress.student_id == student_id,
            EduUnitProgress.class_id == class_id,
        )
        return session.exec(stmt).all()

    @staticmethod
    def upsert_progress(session: Session, student_id: int, unit_id: int, class_id: int, status: int) -> EduUnitProgress:
        existing = EduProgressDao.get_progress(session, student_id, unit_id, class_id)
        if existing:
            existing.status = status
            if status == 1:
                existing.complete_time = datetime.now()
            session.add(existing)
        else:
            progress = EduUnitProgress(
                student_id=student_id,
                unit_id=unit_id,
                class_id=class_id,
                status=status,
                complete_time=datetime.now() if status == 1 else None,
            )
            session.add(progress)
            session.commit()
            return progress
        session.commit()
        return existing
```

### Step 3：验证语法

```bash
cd src/backend && python -c "from bisheng.education.domain.models.education import EduCourse, EduUnit, EduUnitProgress; print('OK')"
```

Expected: `OK`

### Step 4：提交

```bash
git add src/backend/bisheng/education/
git commit -m "feat: education domain models — 6 tables + DAO layer"
```

---

## Task 4：后端 Schema

### Files
- Create: `src/backend/bisheng/education/domain/schemas/education_schema.py`

### Step 1：编写 Schema 文件

```python
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


# ===== Course =====

class CourseOut(BaseModel):
    id: int
    title: str
    type: str
    description: Optional[str]
    cover: Optional[str]
    total_units: int = 0
    completed_units: int = 0  # 当前学生完成数，由 service 填充


class CourseListResp(BaseModel):
    courses: List[CourseOut]


# ===== Unit =====

class UnitOut(BaseModel):
    id: int
    course_id: int
    title: str
    order: int
    estimated_minutes: int
    right_panel_type: str
    right_panel_config: Optional[dict]
    is_completed: bool = False  # 当前学生完成状态


class UnitDetailOut(UnitOut):
    content: Optional[str]  # Markdown 内容，列表页不需要，详情页需要


class CourseDetailOut(BaseModel):
    course: CourseOut
    units: List[UnitOut]


# ===== Progress =====

class MarkCompleteReq(BaseModel):
    class_id: int


class MarkCompleteResp(BaseModel):
    unit_id: int
    class_id: int
    status: int
    complete_time: Optional[datetime]


# ===== UnitLearning（单元学习页完整数据）=====

class UnitLearningOut(BaseModel):
    unit: UnitDetailOut
    prev_unit_id: Optional[int]  # 上一单元 ID，无则 None
    next_unit_id: Optional[int]  # 下一单元 ID，无则 None
```

### Step 2：验证语法

```bash
cd src/backend && python -c "from bisheng.education.domain.schemas.education_schema import CourseOut, UnitDetailOut; print('OK')"
```

Expected: `OK`

### Step 3：提交

```bash
git add src/backend/bisheng/education/domain/schemas/education_schema.py
git commit -m "feat: education schemas — course, unit, progress request/response types"
```

---

## Task 5：后端 Service 层

### Files
- Create: `src/backend/bisheng/education/domain/services/course_service.py`

### Step 1：编写 Service

```python
from typing import Optional, List
from sqlmodel import Session
from bisheng.education.domain.models.education import (
    EduCourseDao, EduUnitDao, EduProgressDao, EduUnitProgress
)
from bisheng.education.domain.schemas.education_schema import (
    CourseOut, CourseDetailOut, UnitOut, UnitDetailOut, UnitLearningOut,
    MarkCompleteResp
)


class CourseService:

    @staticmethod
    def list_courses(session: Session, student_id: int, course_type: Optional[str] = None) -> List[CourseOut]:
        courses = EduCourseDao.list_courses(session, course_type)
        result = []
        for c in courses:
            units = EduUnitDao.list_units_by_course(session, c.id)
            total = len(units)
            # 所有班级的完成数取最大值（学生可能在多个班级）
            completed = 0
            if total > 0:
                unit_ids = {u.id for u in units}
                from sqlmodel import select
                from bisheng.education.domain.models.education import EduUnitProgress
                progresses = session.exec(
                    select(EduUnitProgress).where(
                        EduUnitProgress.student_id == student_id,
                        EduUnitProgress.unit_id.in_(unit_ids),
                        EduUnitProgress.status == 1,
                    )
                ).all()
                # 去重：同一 unit 在多个班级都完成，只算一次
                completed = len({p.unit_id for p in progresses})
            result.append(CourseOut(
                id=c.id,
                title=c.title,
                type=c.type,
                description=c.description,
                cover=c.cover,
                total_units=total,
                completed_units=completed,
            ))
        return result

    @staticmethod
    def get_course_detail(session: Session, course_id: int, student_id: int, class_id: Optional[int] = None) -> CourseDetailOut:
        course = EduCourseDao.get_course(session, course_id)
        if not course:
            raise ValueError(f"Course {course_id} not found")

        units = EduUnitDao.list_units_by_course(session, course_id)
        units_out = []
        for u in units:
            is_completed = False
            if class_id:
                progress = EduProgressDao.get_progress(session, student_id, u.id, class_id)
                is_completed = bool(progress and progress.status == 1)
            units_out.append(UnitOut(
                id=u.id,
                course_id=u.course_id,
                title=u.title,
                order=u.order,
                estimated_minutes=u.estimated_minutes,
                right_panel_type=u.right_panel_type,
                right_panel_config=u.right_panel_config,
                is_completed=is_completed,
            ))

        total_units = len(units_out)
        completed_units = sum(1 for u in units_out if u.is_completed)
        course_out = CourseOut(
            id=course.id,
            title=course.title,
            type=course.type,
            description=course.description,
            cover=course.cover,
            total_units=total_units,
            completed_units=completed_units,
        )
        return CourseDetailOut(course=course_out, units=units_out)

    @staticmethod
    def get_unit_learning(session: Session, unit_id: int, student_id: int, class_id: Optional[int] = None) -> UnitLearningOut:
        unit = EduUnitDao.get_unit(session, unit_id)
        if not unit:
            raise ValueError(f"Unit {unit_id} not found")

        # 获取同课程所有单元，确定上/下单元
        siblings = EduUnitDao.list_units_by_course(session, unit.course_id)
        ordered_ids = [u.id for u in siblings]
        idx = ordered_ids.index(unit_id) if unit_id in ordered_ids else -1
        prev_id = ordered_ids[idx - 1] if idx > 0 else None
        next_id = ordered_ids[idx + 1] if idx < len(ordered_ids) - 1 else None

        is_completed = False
        if class_id:
            progress = EduProgressDao.get_progress(session, student_id, unit.id, class_id)
            is_completed = bool(progress and progress.status == 1)

        unit_detail = UnitDetailOut(
            id=unit.id,
            course_id=unit.course_id,
            title=unit.title,
            order=unit.order,
            estimated_minutes=unit.estimated_minutes,
            right_panel_type=unit.right_panel_type,
            right_panel_config=unit.right_panel_config,
            content=unit.content,
            is_completed=is_completed,
        )
        return UnitLearningOut(unit=unit_detail, prev_unit_id=prev_id, next_unit_id=next_id)

    @staticmethod
    def mark_unit_complete(session: Session, student_id: int, unit_id: int, class_id: int) -> MarkCompleteResp:
        progress = EduProgressDao.upsert_progress(session, student_id, unit_id, class_id, status=1)
        return MarkCompleteResp(
            unit_id=unit_id,
            class_id=class_id,
            status=progress.status,
            complete_time=progress.complete_time,
        )
```

### Step 2：验证导入无误

```bash
cd src/backend && python -c "from bisheng.education.domain.services.course_service import CourseService; print('OK')"
```

Expected: `OK`

### Step 3：提交

```bash
git add src/backend/bisheng/education/domain/services/
git commit -m "feat: education course_service — list, detail, unit learning, mark complete"
```

---

## Task 6：后端 API 路由

### Files
- Create: `src/backend/bisheng/education/api/router.py`
- Modify: `src/backend/bisheng/api/router.py`（注册 education 路由）

### Step 1：编写 education router

创建 `src/backend/bisheng/education/api/router.py`：

```python
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from bisheng.core.database import get_sync_db_session
from bisheng.common.dependencies.user_deps import UserPayload
from bisheng.education.domain.services.course_service import CourseService
from bisheng.education.domain.schemas.education_schema import (
    CourseListResp, CourseDetailOut, UnitLearningOut, MarkCompleteReq, MarkCompleteResp
)

router = APIRouter(prefix='/education', tags=['Education'])


@router.get('/courses', response_model=CourseListResp)
def list_courses(
    course_type: Optional[str] = None,
    db: Session = Depends(get_sync_db_session),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    courses = CourseService.list_courses(db, login_user.user_id, course_type)
    return CourseListResp(courses=courses)


@router.get('/courses/{course_id}', response_model=CourseDetailOut)
def get_course_detail(
    course_id: int,
    class_id: Optional[int] = None,
    db: Session = Depends(get_sync_db_session),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    try:
        return CourseService.get_course_detail(db, course_id, login_user.user_id, class_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get('/units/{unit_id}', response_model=UnitLearningOut)
def get_unit_learning(
    unit_id: int,
    class_id: Optional[int] = None,
    db: Session = Depends(get_sync_db_session),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    try:
        return CourseService.get_unit_learning(db, unit_id, login_user.user_id, class_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post('/units/{unit_id}/complete', response_model=MarkCompleteResp)
def mark_unit_complete(
    unit_id: int,
    req: MarkCompleteReq,
    db: Session = Depends(get_sync_db_session),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    return CourseService.mark_unit_complete(db, login_user.user_id, unit_id, req.class_id)
```

### Step 2：在主路由中注册

查看 `src/backend/bisheng/api/router.py` 的现有注册方式：

```bash
grep -n "include_router" src/backend/bisheng/api/router.py | head -10
```

在合适位置添加（参考现有格式）：

```python
from bisheng.education.api.router import router as education_router
# 在 app.include_router 集中处添加：
app.include_router(education_router, prefix='/api/v1')
```

### Step 3：验证 FastAPI 路由可加载

```bash
cd src/backend && python -c "from bisheng.education.api.router import router; print([r.path for r in router.routes])"
```

Expected: `['/education/courses', '/education/courses/{course_id}', '/education/units/{unit_id}', '/education/units/{unit_id}/complete']`

### Step 4：提交

```bash
git add src/backend/bisheng/education/api/router.py src/backend/bisheng/api/router.py
git commit -m "feat: education API router — courses, units, progress endpoints"
```

---

## Task 7：前端路由重建

### Files
- Modify: `src/frontend/platform/src/routes/index.tsx`

### Step 1：确认当前 education 路由段（确保是 Task 0 留下的占位）

```bash
grep -n "education" src/frontend/platform/src/routes/index.tsx
```

### Step 2：替换路由段

将占位符替换为正式路由（注意：CoursesPage、CourseDetailPage、UnitLearningPage 在 Task 9-11 创建，此处先用 lazy import）：

在文件顶部追加懒加载导入：

```ts
import { lazy } from 'react';
const CoursesPage = lazy(() => import('../pages/EducationPage/CoursesPage'));
const CourseDetailPage = lazy(() => import('../pages/EducationPage/CourseDetailPage'));
const UnitLearningPage = lazy(() => import('../pages/EducationPage/UnitLearningPage'));
// Milestone 2 占位（路由先注册，页面 TBD）
const PortfolioPage = lazy(() => import('../pages/EducationPage/PortfolioPage'));
const ClassesPage = lazy(() => import('../pages/EducationPage/ClassesPage'));
const AccountsPage = lazy(() => import('../pages/EducationPage/AccountsPage'));
```

路由段：

```ts
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

### Step 3：创建 Milestone 2 占位文件

这些文件只需导出一个最小组件，让 lazy import 不报错：

```bash
mkdir -p src/frontend/platform/src/pages/EducationPage
```

创建 `src/frontend/platform/src/pages/EducationPage/PortfolioPage.tsx`：
```tsx
export default function PortfolioPage() {
  return <div className="p-8 text-[#9498AC]">作品集 — 敬请期待</div>;
}
```

创建 `src/frontend/platform/src/pages/EducationPage/ClassesPage.tsx`：
```tsx
export default function ClassesPage() {
  return <div className="p-8 text-[#9498AC]">班级管理 — 敬请期待</div>;
}
```

创建 `src/frontend/platform/src/pages/EducationPage/AccountsPage.tsx`：
```tsx
export default function AccountsPage() {
  return <div className="p-8 text-[#9498AC]">账号管理 — 敬请期待</div>;
}
```

### Step 4：验证 TypeScript 编译

```bash
cd src/frontend/platform && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors（或仅 CoursesPage 等尚不存在的 import 报错，Task 9-11 创建后消除）

### Step 5：提交

```bash
git add src/frontend/platform/src/routes/index.tsx src/frontend/platform/src/pages/EducationPage/
git commit -m "feat: education frontend routes — student/teacher/admin route tree"
```

---

## Task 8：MainLayout 侧边栏菜单

### Files
- Modify: `src/frontend/platform/src/layout/MainLayout.tsx`

### Step 1：确认当前 teachingItems 片段

```bash
grep -n "teachingItems\|education\|EDUCATION" src/frontend/platform/src/layout/MainLayout.tsx | head -20
```

### Step 2：找到 teachingItems 数组，添加新菜单项

在现有 `teachingItems` 数组中，添加基于 `web_menu` 的条件菜单项。找到 `teachingItems` 的定义，将内容替换为：

```tsx
// 在 useMemo 内的 teachingItems 定义中，追加以下条目
// （web_menu 数组来自 useContext 或 store，参考现有菜单项的写法）

// 学生菜单
if (hasPermission('education_student')) {
  teachingItems.push(
    {
      id: 'education-courses',
      label: '课程学习',
      icon: <BookOpenIcon className="w-4 h-4" />,
      to: '/education/courses',
    },
    {
      id: 'education-portfolio',
      label: '我的作品集',
      icon: <FolderIcon className="w-4 h-4" />,
      to: '/education/portfolio',
    }
  );
}

// 教师菜单
if (hasPermission('education_teacher')) {
  teachingItems.push({
    id: 'education-classes',
    label: '我的班级',
    icon: <UsersIcon className="w-4 h-4" />,
    to: '/education/classes',
  });
}
```

**注意**：`hasPermission` 方法需参考现有菜单权限判断的写法（通常是 `webMenu.includes('education_student')`），图标从现有引入的 Heroicons 或 Lucide 图标中选取，不引入新图标库。

### Step 3：验证前端编译无错

```bash
cd src/frontend/platform && npx tsc --noEmit 2>&1 | head -20
```

### Step 4：提交

```bash
git add src/frontend/platform/src/layout/MainLayout.tsx
git commit -m "feat: MainLayout — add education student/teacher menu items"
```

---

## Task 9：课程列表页

### Files
- Create: `src/frontend/platform/src/pages/EducationPage/CoursesPage.tsx`
- Create: `src/frontend/platform/src/pages/EducationPage/api/educationApi.ts`（HTTP 客户端）

### Step 1：创建 API 客户端

创建 `src/frontend/platform/src/pages/EducationPage/api/educationApi.ts`：

```ts
import axios from 'axios';

const BASE = '/api/v1/education';

export interface CourseOut {
  id: number;
  title: string;
  type: string;
  description: string | null;
  cover: string | null;
  total_units: number;
  completed_units: number;
}

export interface UnitOut {
  id: number;
  course_id: number;
  title: string;
  order: number;
  estimated_minutes: number;
  right_panel_type: string;
  right_panel_config: Record<string, unknown> | null;
  is_completed: boolean;
}

export interface CourseDetailOut {
  course: CourseOut;
  units: UnitOut[];
}

export interface UnitDetailOut extends UnitOut {
  content: string | null;
}

export interface UnitLearningOut {
  unit: UnitDetailOut;
  prev_unit_id: number | null;
  next_unit_id: number | null;
}

export const educationApi = {
  listCourses: (courseType?: string) =>
    axios.get<{ courses: CourseOut[] }>(`${BASE}/courses`, {
      params: courseType ? { course_type: courseType } : {},
    }).then(r => r.data.courses),

  getCourseDetail: (courseId: number, classId?: number) =>
    axios.get<CourseDetailOut>(`${BASE}/courses/${courseId}`, {
      params: classId ? { class_id: classId } : {},
    }).then(r => r.data),

  getUnitLearning: (unitId: number, classId?: number) =>
    axios.get<UnitLearningOut>(`${BASE}/units/${unitId}`, {
      params: classId ? { class_id: classId } : {},
    }).then(r => r.data),

  markUnitComplete: (unitId: number, classId: number) =>
    axios.post(`${BASE}/units/${unitId}/complete`, { class_id: classId }).then(r => r.data),
};
```

### Step 2：创建课程列表页

创建 `src/frontend/platform/src/pages/EducationPage/CoursesPage.tsx`：

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { educationApi, CourseOut } from './api/educationApi';

const TABS = [
  { key: '', label: '全部' },
  { key: 'general', label: '通识课' },
  { key: 'professional', label: '专业课' },
  { key: 'project', label: '项目案例课' },
];

export default function CoursesPage() {
  const [activeTab, setActiveTab] = useState('');
  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    educationApi.listCourses(activeTab || undefined)
      .then(setCourses)
      .finally(() => setLoading(false));
  }, [activeTab]);

  return (
    <div className="min-h-full bg-[#F7F9FF] p-6">
      <h1 className="text-2xl font-semibold text-[#140E35] mb-6">课程学习</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-[#E5EAF4]">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#4658FF] text-[#4658FF]'
                : 'border-transparent text-[#9498AC] hover:text-[#140E35]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Course Grid */}
      {loading ? (
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
              {/* Cover */}
              <div className="h-32 bg-gradient-to-br from-[#4658FF]/10 to-[#6B7FFF]/10 flex items-center justify-center">
                {course.cover ? (
                  <img src={course.cover} alt={course.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#4658FF]/40 text-4xl">📚</span>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="text-xs text-[#4658FF] bg-[#F1F5FF] rounded px-2 py-0.5 inline-block mb-2">
                  {course.type === 'general' ? '通识课' : course.type === 'professional' ? '专业课' : '项目案例课'}
                </div>
                <h3 className="text-sm font-semibold text-[#140E35] mb-2 line-clamp-2">{course.title}</h3>
                <div className="flex items-center justify-between text-xs text-[#9498AC]">
                  <span>{course.total_units} 个单元</span>
                  <span>{course.completed_units}/{course.total_units} 已完成</span>
                </div>
                {/* Progress bar */}
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

### Step 3：TypeScript 类型检查

```bash
cd src/frontend/platform && npx tsc --noEmit 2>&1 | grep "CoursesPage\|educationApi" | head -10
```

Expected: 0 errors

### Step 4：提交

```bash
git add src/frontend/platform/src/pages/EducationPage/
git commit -m "feat: CoursesPage — course list with tabs and progress cards"
```

---

## Task 10：课程详情页

### Files
- Create: `src/frontend/platform/src/pages/EducationPage/CourseDetailPage.tsx`

### Step 1：编写课程详情页

```tsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { educationApi, CourseDetailOut } from './api/educationApi';

const TYPE_LABEL: Record<string, string> = {
  general: '通识课',
  professional: '专业课',
  project: '项目案例课',
};

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [data, setData] = useState<CourseDetailOut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    educationApi.getCourseDetail(Number(courseId))
      .then(setData)
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) return <div className="p-8 text-[#9498AC]">加载中...</div>;
  if (!data) return <div className="p-8 text-[#9498AC]">课程不存在</div>;

  const { course, units } = data;
  const totalMinutes = units.reduce((sum, u) => sum + u.estimated_minutes, 0);

  return (
    <div className="min-h-full bg-[#F7F9FF] p-6">
      {/* Breadcrumb */}
      <div className="text-xs text-[#9498AC] mb-4 flex items-center gap-1">
        <Link to="/education/courses" className="hover:text-[#4658FF]">课程学习</Link>
        <span>/</span>
        <span className="text-[#140E35]">{course.title}</span>
      </div>

      {/* Course Header */}
      <div className="bg-white rounded-xl border border-[#E5EAF4] p-6 mb-6">
        <div className="flex gap-6">
          <div className="w-40 h-28 bg-gradient-to-br from-[#4658FF]/10 to-[#6B7FFF]/10 rounded-lg flex-shrink-0 flex items-center justify-center">
            {course.cover ? (
              <img src={course.cover} alt={course.title} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <span className="text-[#4658FF]/40 text-3xl">📚</span>
            )}
          </div>
          <div className="flex-1">
            <div className="text-xs text-[#4658FF] bg-[#F1F5FF] rounded px-2 py-0.5 inline-block mb-2">
              {TYPE_LABEL[course.type] || course.type}
            </div>
            <h1 className="text-xl font-semibold text-[#140E35] mb-2">{course.title}</h1>
            <div className="flex gap-4 text-sm text-[#9498AC]">
              <span>{course.total_units} 个单元</span>
              <span>{Math.ceil(totalMinutes / 60)} 学时</span>
              <span>{course.completed_units}/{course.total_units} 已完成</span>
            </div>
            {course.description && (
              <p className="mt-2 text-sm text-[#565772]">{course.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Unit List */}
      <div className="bg-white rounded-xl border border-[#E5EAF4] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5EAF4]">
          <h2 className="text-base font-semibold text-[#140E35]">课程单元</h2>
        </div>
        <div className="divide-y divide-[#E5EAF4]">
          {units.map((unit, idx) => (
            <Link
              key={unit.id}
              to={`/education/courses/${courseId}/${unit.id}`}
              className="flex items-center gap-4 px-6 py-4 hover:bg-[#F7F9FF] transition-colors group"
            >
              {/* Index */}
              <div className="w-7 h-7 rounded-full border-2 border-[#E5EAF4] flex items-center justify-center text-xs text-[#9498AC] flex-shrink-0 group-hover:border-[#4658FF]">
                {idx + 1}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#140E35] truncate">{unit.title}</div>
                <div className="text-xs text-[#9498AC] mt-0.5">{unit.estimated_minutes} 分钟</div>
              </div>
              {/* Status */}
              <div className="flex-shrink-0">
                {unit.is_completed ? (
                  <span className="text-xs text-[#4658FF] bg-[#F1F5FF] rounded-full px-2 py-0.5">已完成</span>
                ) : (
                  <span className="text-xs text-[#9498AC]">未完成</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Step 2：TypeScript 类型检查

```bash
cd src/frontend/platform && npx tsc --noEmit 2>&1 | grep "CourseDetailPage" | head -10
```

### Step 3：提交

```bash
git add src/frontend/platform/src/pages/EducationPage/CourseDetailPage.tsx
git commit -m "feat: CourseDetailPage — course header + unit list with completion status"
```

---

## Task 11：单元学习页（双栏）

### Files
- Create: `src/frontend/platform/src/pages/EducationPage/UnitLearningPage.tsx`
- Create: `src/frontend/platform/src/pages/EducationPage/panels/DialogPanel.tsx`
- Create: `src/frontend/platform/src/pages/EducationPage/panels/TextSubmitPanel.tsx`

### Step 1：创建对话框面板（Milestone 1 右栏组件一）

创建 `src/frontend/platform/src/pages/EducationPage/panels/DialogPanel.tsx`：

```tsx
import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  config: Record<string, unknown> | null;
}

export default function DialogPanel({ config }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      // TODO: 接入实际 chat API（Milestone 1 先用 mock）
      await new Promise(r => setTimeout(r, 800));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `[AI 回复占位] 你说的是：${userMsg}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-[#9498AC] text-sm py-8">开始和 AI 对话吧</div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-[#4658FF] text-white'
                  : 'bg-white border border-[#E5EAF4] text-[#140E35]'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-[#E5EAF4] rounded-lg px-3 py-2 text-[#9498AC] text-sm">
              思考中...
            </div>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-[#E5EAF4] flex gap-2">
        <input
          className="flex-1 border border-[#E5EAF4] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4658FF]"
          placeholder="输入消息..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
        />
        <button
          onClick={send}
          disabled={loading}
          className="px-4 py-2 bg-[#4658FF] text-white text-sm rounded-lg disabled:opacity-50 hover:bg-[#3748EF]"
        >
          发送
        </button>
      </div>
    </div>
  );
}
```

### Step 2：创建文本提交面板（Milestone 1 右栏组件二）

创建 `src/frontend/platform/src/pages/EducationPage/panels/TextSubmitPanel.tsx`：

```tsx
import { useState } from 'react';

interface Props {
  unitId: number;
  classId?: number;
  onSubmitted?: (content: string) => void;
}

export default function TextSubmitPanel({ unitId, classId, onSubmitted }: Props) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!content.trim() || loading) return;
    setLoading(true);
    try {
      // TODO: 调用 portfolio 提交 API（Milestone 2 实现），Milestone 1 先 mock
      await new Promise(r => setTimeout(r, 500));
      setSubmitted(true);
      onSubmitted?.(content);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="text-4xl mb-3">✅</div>
        <div className="text-[#140E35] font-medium mb-1">提交成功</div>
        <div className="text-[#9498AC] text-sm">你的分析已记录到作品集</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="text-sm text-[#565772]">请完成以下分析并提交：</div>
      <textarea
        className="flex-1 border border-[#E5EAF4] rounded-lg p-3 text-sm outline-none focus:border-[#4658FF] resize-none"
        placeholder="在此输入你的分析讨论内容..."
        value={content}
        onChange={e => setContent(e.target.value)}
      />
      <button
        onClick={submit}
        disabled={!content.trim() || loading}
        className="py-2 bg-[#4658FF] text-white text-sm rounded-lg disabled:opacity-50 hover:bg-[#3748EF]"
      >
        {loading ? '提交中...' : '提交作品'}
      </button>
    </div>
  );
}
```

### Step 3：创建单元学习主页

创建 `src/frontend/platform/src/pages/EducationPage/UnitLearningPage.tsx`：

```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { educationApi, UnitLearningOut } from './api/educationApi';
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

export default function UnitLearningPage() {
  const { courseId, unitId } = useParams<{ courseId: string; unitId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<UnitLearningOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  // classId 暂时为 undefined（Milestone 1 不强制要求班级，后续从 URL query 或 store 取）
  const classId = undefined;

  useEffect(() => {
    if (!unitId) return;
    setLoading(true);
    educationApi.getUnitLearning(Number(unitId), classId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [unitId]);

  const handleMarkComplete = async () => {
    if (!data || !classId) return;
    setMarking(true);
    try {
      await educationApi.markUnitComplete(Number(unitId), classId);
      setData(prev => prev ? { ...prev, unit: { ...prev.unit, is_completed: true } } : prev);
    } finally {
      setMarking(false);
    }
  };

  if (loading) return <div className="p-8 text-[#9498AC]">加载中...</div>;
  if (!data) return <div className="p-8 text-[#9498AC]">单元不存在</div>;

  const { unit, prev_unit_id, next_unit_id } = data;

  return (
    <div className="flex flex-col h-screen bg-[#F7F9FF]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-[#E5EAF4] flex-shrink-0">
        <div className="text-xs text-[#9498AC] flex items-center gap-1">
          <Link to="/education/courses" className="hover:text-[#4658FF]">课程学习</Link>
          <span>/</span>
          <Link to={`/education/courses/${courseId}`} className="hover:text-[#4658FF]">课程详情</Link>
          <span>/</span>
          <span className="text-[#140E35]">{unit.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {prev_unit_id && (
            <button
              onClick={() => navigate(`/education/courses/${courseId}/${prev_unit_id}`)}
              className="text-xs text-[#9498AC] hover:text-[#4658FF] px-2 py-1"
            >
              ← 上一单元
            </button>
          )}
          {next_unit_id && (
            <button
              onClick={() => navigate(`/education/courses/${courseId}/${next_unit_id}`)}
              className="text-xs text-[#9498AC] hover:text-[#4658FF] px-2 py-1"
            >
              下一单元 →
            </button>
          )}
        </div>
      </div>

      {/* Dual Column */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Markdown Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-white border-r border-[#E5EAF4]">
          <h1 className="text-xl font-semibold text-[#140E35] mb-6">{unit.title}</h1>
          {unit.content ? (
            <div className="prose prose-sm max-w-none text-[#565772]">
              <ReactMarkdown>{unit.content}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-[#9498AC]">本单元内容待更新</div>
          )}

          {/* Mark Complete Button */}
          <div className="mt-10 pt-6 border-t border-[#E5EAF4]">
            {unit.is_completed ? (
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
                {marking ? '标记中...' : '标记本单元已完成'}
              </button>
            )}
            {!classId && (
              <p className="text-xs text-[#9498AC] mt-2">加入班级后可记录进度</p>
            )}
          </div>
        </div>

        {/* Right — Operation Panel */}
        <div className="w-96 flex-shrink-0 flex flex-col bg-white">
          <div className="px-4 py-3 border-b border-[#E5EAF4]">
            <span className="text-sm font-medium text-[#140E35]">
              {PANEL_LABEL[unit.right_panel_type] || '操作区'}
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <RightPanel
              type={unit.right_panel_type}
              config={unit.right_panel_config}
              unitId={unit.id}
              classId={classId}
              onMarkComplete={handleMarkComplete}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

**注意**：`ReactMarkdown` 需要安装依赖。确认 platform 是否已有：

```bash
grep "react-markdown" src/frontend/platform/package.json
```

若无，安装：

```bash
cd src/frontend/platform && npm install react-markdown
```

### Step 4：TypeScript 类型检查

```bash
cd src/frontend/platform && npx tsc --noEmit 2>&1 | grep "UnitLearningPage\|DialogPanel\|TextSubmit" | head -10
```

### Step 5：前端构建验证

```bash
cd src/frontend/platform && npm run build 2>&1 | tail -10
```

Expected: build 成功

### Step 6：提交

```bash
git add src/frontend/platform/src/pages/EducationPage/
git commit -m "feat: UnitLearningPage — dual column layout with DialogPanel and TextSubmitPanel"
```

---

## Task 12：端到端验证

### Step 1：后端启动验证

```bash
cd src/backend && python -m uvicorn bisheng.main:app --reload --port 7860 2>&1 | head -20
```

Expected: `Application startup complete`，无 ImportError

### Step 2：API 接口验证

```bash
# 获取课程列表（需先有数据）
curl -X GET http://localhost:7860/api/v1/education/courses \
  -H "Cookie: access_token_cookie=<实际登录 token>"
```

Expected: `{"courses": [...]}`（若数据库无数据则返回 `{"courses": []}` 也正常）

### Step 3：前端本地开发服务验证

```bash
cd src/frontend/platform && npm run start
```

打开浏览器：`http://localhost:3001/education/courses`

验证清单：
- [ ] 课程列表页加载（即使无数据也不报错，显示「暂无课程」）
- [ ] 导航中出现「课程学习」菜单项（需用 `education_student` 权限的账号）
- [ ] 点击课程跳转到详情页
- [ ] 点击单元跳转到学习页
- [ ] 学习页双栏布局正常（左栏内容 + 右栏操作区）
- [ ] 「下一单元」按钮可用

### Step 4：最终提交

```bash
git add -A
git commit -m "feat: education module Milestone 1 complete — student main flow"
```

---

## 附录：Milestone 2 待办

以下内容不在本计划范围内，留 Milestone 2：

| 功能 | 说明 |
|------|------|
| 4 种右栏面板 | PromptDebugger / KnowledgeUpload / AgentForm / KnowledgeBind |
| 作品集页 | `/education/portfolio` |
| 班级管理页 | 教师端 `/education/classes` |
| 账号管理页 | 管理员端 `/education/accounts` |
| Portfolio API | 提交作品的后端接口 |
| class_id 传递 | 从 store/URL 取当前班级，传给 progress API |
| DialogPanel 真实接入 | 替换 mock，接入 E-Agent chat API |
| 种子数据 | Alembic seed 插入通识课 8 个单元 |
