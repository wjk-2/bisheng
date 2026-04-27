# Education Milestone 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现班级管理（教师创建班级/添加学生）、学生端 class_id 传播（解锁进度记录）、作品集提交与查看。

**Architecture:** 后端延续已有的 DDD 四层结构（models→schemas→services→api/router），新增 ClassService 和 PortfolioService，并扩展现有 education 路由。前端在已有 EducationPage 目录下补充 ClassesPage 和 PortfolioPage 实现，educationApi.ts 中追加新接口。

**Tech Stack:** FastAPI + SQLModel（后端）；React 18 + TypeScript + Tailwind CSS 3.4（前端）；axios via `@/controllers/request`（前端 HTTP，拦截器已解包 data.data）

**Scope 说明（重要）：**
- AccountsPage → **不做**。现有 `/sys` 用户管理已满足需求，无需重建。
- 教师角色 → **不加新角色**。教师 = 普通用户 + 管理员在 `/sys` 开启 `/education/classes` 页面访问权限（web_menu 控制）。
- DialogPanel 真实对话接入 → 延后到 Milestone 3，本 Milestone 保持 Mock。

---

## 现有代码索引（改动前必读）

| 文件 | 说明 |
|------|------|
| `src/backend/bisheng/education/domain/models/education.py` | 全部 ORM + DAO，EduClass/EduClassMember/EduPortfolio 已定义 |
| `src/backend/bisheng/education/domain/schemas/education_schema.py` | 全部 Schema，需追加班级/作品集相关 |
| `src/backend/bisheng/education/domain/services/course_service.py` | 课程/进度服务，参考写法 |
| `src/backend/bisheng/education/api/router.py` | 教育路由，需追加班级/作品集端点 |
| `src/backend/bisheng/core/database/alembic/versions/education_v3_20260425.py` | 最新迁移，down_revision 为此 |
| `src/frontend/platform/src/pages/EducationPage/api/educationApi.ts` | 前端 API 客户端，需追加接口 |
| `src/frontend/platform/src/pages/EducationPage/ClassesPage.tsx` | 占位符，本 Milestone 实现 |
| `src/frontend/platform/src/pages/EducationPage/PortfolioPage.tsx` | 占位符，本 Milestone 实现 |
| `src/frontend/platform/src/pages/EducationPage/UnitLearningPage.tsx` | 需修改：从 URL/store 读取 class_id 并传递 |
| `src/frontend/platform/src/routes/index.tsx` | 路由已注册，无需改动 |

---

## Task 1：后端 — 班级 DAO 补全

**背景：** `EduClass` 和 `EduClassMember` ORM 已在 models/education.py 中定义，但缺少对应 DAO 方法。

**Files:**
- Modify: `src/backend/bisheng/education/domain/models/education.py`

**Step 1：在 models/education.py 末尾追加 EduClassDao 和 EduClassMemberDao**

```python
class EduClassDao:
    @staticmethod
    def create_class(session: Session, name: str, semester: str, teacher_id: int) -> EduClass:
        obj = EduClass(name=name, semester=semester, teacher_id=teacher_id,
                       create_time=datetime.now(), update_time=datetime.now())
        session.add(obj)
        session.commit()
        session.refresh(obj)
        return obj

    @staticmethod
    def list_by_teacher(session: Session, teacher_id: int) -> List[EduClass]:
        stmt = select(EduClass).where(EduClass.teacher_id == teacher_id, EduClass.status == 0)
        return session.exec(stmt).all()

    @staticmethod
    def get_class(session: Session, class_id: int) -> Optional[EduClass]:
        return session.get(EduClass, class_id)

    @staticmethod
    def list_all(session: Session) -> List[EduClass]:
        stmt = select(EduClass).where(EduClass.status == 0)
        return session.exec(stmt).all()


class EduClassMemberDao:
    @staticmethod
    def add_member(session: Session, class_id: int, student_id: int) -> EduClassMember:
        existing = session.exec(
            select(EduClassMember).where(
                EduClassMember.class_id == class_id,
                EduClassMember.student_id == student_id,
            )
        ).first()
        if existing:
            existing.status = 0
            session.add(existing)
            session.commit()
            return existing
        obj = EduClassMember(class_id=class_id, student_id=student_id,
                             join_time=datetime.now())
        session.add(obj)
        session.commit()
        session.refresh(obj)
        return obj

    @staticmethod
    def remove_member(session: Session, class_id: int, student_id: int) -> None:
        member = session.exec(
            select(EduClassMember).where(
                EduClassMember.class_id == class_id,
                EduClassMember.student_id == student_id,
                EduClassMember.status == 0,
            )
        ).first()
        if member:
            member.status = 1
            session.add(member)
            session.commit()

    @staticmethod
    def list_members(session: Session, class_id: int) -> List[EduClassMember]:
        stmt = select(EduClassMember).where(
            EduClassMember.class_id == class_id,
            EduClassMember.status == 0,
        )
        return session.exec(stmt).all()

    @staticmethod
    def list_classes_for_student(session: Session, student_id: int) -> List[EduClassMember]:
        stmt = select(EduClassMember).where(
            EduClassMember.student_id == student_id,
            EduClassMember.status == 0,
        )
        return session.exec(stmt).all()
```

**Step 2：提交**

```bash
cd "C:/Users/Administrator/projects/eagent-v3/education-m2"
git add src/backend/bisheng/education/domain/models/education.py
git commit -m "feat(edu): add EduClassDao and EduClassMemberDao"
```

---

## Task 2：后端 — 班级 Schema

**Files:**
- Modify: `src/backend/bisheng/education/domain/schemas/education_schema.py`

**Step 1：追加班级相关 Schema**

```python
# ===== Class =====

class ClassOut(BaseModel):
    id: int
    name: str
    semester: str
    teacher_id: int
    status: int
    member_count: int = 0
    create_time: Optional[datetime] = None


class ClassMemberOut(BaseModel):
    student_id: int
    username: str
    join_time: Optional[datetime] = None


class ClassDetailOut(BaseModel):
    cls: ClassOut
    members: List[ClassMemberOut]


class CreateClassReq(BaseModel):
    name: str
    semester: str


class AddMemberReq(BaseModel):
    student_id: int


class RemoveMemberReq(BaseModel):
    student_id: int
```

**Step 2：提交**

```bash
git add src/backend/bisheng/education/domain/schemas/education_schema.py
git commit -m "feat(edu): add class schemas"
```

---

## Task 3：后端 — ClassService

**Files:**
- Create: `src/backend/bisheng/education/domain/services/class_service.py`

**Step 1：创建 class_service.py**

```python
from sqlmodel import Session, select
from bisheng.education.domain.models.education import (
    EduClassDao, EduClassMemberDao, EduClass,
)
from bisheng.education.domain.schemas.education_schema import (
    ClassOut, ClassDetailOut, ClassMemberOut,
)
from bisheng.database.models.user import User


class ClassService:

    @staticmethod
    def create_class(session: Session, teacher_id: int, name: str, semester: str) -> ClassOut:
        cls = EduClassDao.create_class(session, name=name, semester=semester, teacher_id=teacher_id)
        return ClassOut(id=cls.id, name=cls.name, semester=cls.semester,
                        teacher_id=cls.teacher_id, status=cls.status,
                        member_count=0, create_time=cls.create_time)

    @staticmethod
    def list_classes(session: Session, teacher_id: int) -> list[ClassOut]:
        classes = EduClassDao.list_by_teacher(session, teacher_id)
        result = []
        for c in classes:
            members = EduClassMemberDao.list_members(session, c.id)
            result.append(ClassOut(id=c.id, name=c.name, semester=c.semester,
                                   teacher_id=c.teacher_id, status=c.status,
                                   member_count=len(members), create_time=c.create_time))
        return result

    @staticmethod
    def get_class_detail(session: Session, class_id: int) -> ClassDetailOut:
        cls = EduClassDao.get_class(session, class_id)
        if not cls:
            raise ValueError(f"Class {class_id} not found")
        members = EduClassMemberDao.list_members(session, class_id)
        member_ids = [m.student_id for m in members]
        users = session.exec(select(User).where(User.user_id.in_(member_ids))).all() if member_ids else []
        user_map = {u.user_id: u.user_name for u in users}
        member_outs = [
            ClassMemberOut(student_id=m.student_id,
                           username=user_map.get(m.student_id, str(m.student_id)),
                           join_time=m.join_time)
            for m in members
        ]
        member_count = len(members)
        cls_out = ClassOut(id=cls.id, name=cls.name, semester=cls.semester,
                           teacher_id=cls.teacher_id, status=cls.status,
                           member_count=member_count, create_time=cls.create_time)
        return ClassDetailOut(cls=cls_out, members=member_outs)

    @staticmethod
    def add_member(session: Session, class_id: int, student_id: int) -> None:
        cls = EduClassDao.get_class(session, class_id)
        if not cls:
            raise ValueError(f"Class {class_id} not found")
        EduClassMemberDao.add_member(session, class_id, student_id)

    @staticmethod
    def remove_member(session: Session, class_id: int, student_id: int) -> None:
        EduClassMemberDao.remove_member(session, class_id, student_id)

    @staticmethod
    def list_student_classes(session: Session, student_id: int) -> list[ClassOut]:
        memberships = EduClassMemberDao.list_classes_for_student(session, student_id)
        result = []
        for m in memberships:
            cls = EduClassDao.get_class(session, m.class_id)
            if cls and cls.status == 0:
                members = EduClassMemberDao.list_members(session, cls.id)
                result.append(ClassOut(id=cls.id, name=cls.name, semester=cls.semester,
                                       teacher_id=cls.teacher_id, status=cls.status,
                                       member_count=len(members), create_time=cls.create_time))
        return result
```

**Step 2：确认 User 模型导入路径**

`bisheng.database.models.user` 中的 `User` 有字段 `user_id` 和 `user_name`，通过 grep 确认：

```bash
grep -r "class User" src/backend/bisheng/database/models/
```

如果路径不对，调整 import。

**Step 3：提交**

```bash
git add src/backend/bisheng/education/domain/services/class_service.py
git commit -m "feat(edu): add ClassService"
```

---

## Task 4：后端 — 班级 API 端点

**Files:**
- Modify: `src/backend/bisheng/education/api/router.py`

**Step 1：追加 import 和班级端点**

在现有 import 块末尾追加：
```python
from bisheng.education.domain.services.class_service import ClassService
from bisheng.education.domain.schemas.education_schema import (
    CreateClassReq, AddMemberReq, RemoveMemberReq,
)
```

在现有路由末尾追加：

```python
# ===== 班级管理（教师端） =====

@router.post('/classes')
def create_class(
    req: CreateClassReq,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        result = ClassService.create_class(session, login_user.user_id, req.name, req.semester)
        return resp_200(data=result.model_dump())


@router.get('/classes')
def list_classes(
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        result = ClassService.list_classes(session, login_user.user_id)
        return resp_200(data={'classes': [c.model_dump() for c in result]})


@router.get('/classes/{class_id}')
def get_class_detail(
    class_id: int,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        try:
            result = ClassService.get_class_detail(session, class_id)
            return resp_200(data=result.model_dump())
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))


@router.post('/classes/{class_id}/members')
def add_class_member(
    class_id: int,
    req: AddMemberReq,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        try:
            ClassService.add_member(session, class_id, req.student_id)
            return resp_200(data={})
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))


@router.delete('/classes/{class_id}/members/{student_id}')
def remove_class_member(
    class_id: int,
    student_id: int,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        ClassService.remove_member(session, class_id, student_id)
        return resp_200(data={})


# ===== 学生端 — 查看自己的班级 =====

@router.get('/my-classes')
def list_my_classes(
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        result = ClassService.list_student_classes(session, login_user.user_id)
        return resp_200(data={'classes': [c.model_dump() for c in result]})
```

**Step 2：提交**

```bash
git add src/backend/bisheng/education/api/router.py
git commit -m "feat(edu): add class CRUD API endpoints"
```

---

## Task 5：后端 — Portfolio DAO、Schema、Service、API

**背景：** EduPortfolio ORM 已定义，只需补全 DAO + Service + Schema + 端点。本 Milestone 只做文字类作品（asset_type='text'），助手/工作流类型延后。

**Files:**
- Modify: `src/backend/bisheng/education/domain/models/education.py`
- Modify: `src/backend/bisheng/education/domain/schemas/education_schema.py`
- Create: `src/backend/bisheng/education/domain/services/portfolio_service.py`
- Modify: `src/backend/bisheng/education/api/router.py`

**Step 1：在 models/education.py 末尾追加 EduPortfolioDao**

```python
class EduPortfolioDao:
    @staticmethod
    def create(session: Session, student_id: int, unit_id: int, class_id: Optional[int],
               title: str, text_content: str) -> EduPortfolio:
        obj = EduPortfolio(
            student_id=student_id,
            unit_id=unit_id,
            class_id=class_id,
            asset_type='text',
            text_content=text_content,
            title=title,
            submit_time=datetime.now(),
        )
        session.add(obj)
        session.commit()
        session.refresh(obj)
        return obj

    @staticmethod
    def list_by_student_unit(session: Session, student_id: int, unit_id: int) -> List[EduPortfolio]:
        stmt = select(EduPortfolio).where(
            EduPortfolio.student_id == student_id,
            EduPortfolio.unit_id == unit_id,
        ).order_by(EduPortfolio.submit_time.desc())
        return session.exec(stmt).all()
```

**Step 2：在 education_schema.py 末尾追加 Portfolio Schema**

```python
# ===== Portfolio =====

class PortfolioOut(BaseModel):
    id: int
    unit_id: int
    class_id: Optional[int] = None
    asset_type: str
    title: str
    text_content: Optional[str] = None
    submit_time: Optional[datetime] = None


class SubmitPortfolioReq(BaseModel):
    unit_id: int
    class_id: Optional[int] = None
    title: str
    text_content: str
```

**Step 3：创建 portfolio_service.py**

```python
from sqlmodel import Session
from bisheng.education.domain.models.education import EduPortfolioDao
from bisheng.education.domain.schemas.education_schema import PortfolioOut, SubmitPortfolioReq


class PortfolioService:

    @staticmethod
    def submit(session: Session, student_id: int, req: SubmitPortfolioReq) -> PortfolioOut:
        obj = EduPortfolioDao.create(
            session, student_id=student_id, unit_id=req.unit_id,
            class_id=req.class_id, title=req.title, text_content=req.text_content,
        )
        return PortfolioOut(id=obj.id, unit_id=obj.unit_id, class_id=obj.class_id,
                            asset_type=obj.asset_type, title=obj.title,
                            text_content=obj.text_content, submit_time=obj.submit_time)

    @staticmethod
    def list_by_unit(session: Session, student_id: int, unit_id: int) -> list[PortfolioOut]:
        objs = EduPortfolioDao.list_by_student_unit(session, student_id, unit_id)
        return [PortfolioOut(id=o.id, unit_id=o.unit_id, class_id=o.class_id,
                             asset_type=o.asset_type, title=o.title,
                             text_content=o.text_content, submit_time=o.submit_time)
                for o in objs]
```

**Step 4：在 router.py 追加 Portfolio 端点**

追加 import：
```python
from bisheng.education.domain.services.portfolio_service import PortfolioService
from bisheng.education.domain.schemas.education_schema import SubmitPortfolioReq
```

追加端点：
```python
# ===== 作品集 =====

@router.post('/portfolio')
def submit_portfolio(
    req: SubmitPortfolioReq,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        result = PortfolioService.submit(session, login_user.user_id, req)
        return resp_200(data=result.model_dump())


@router.get('/portfolio/units/{unit_id}')
def list_portfolio_by_unit(
    unit_id: int,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        result = PortfolioService.list_by_unit(session, login_user.user_id, unit_id)
        return resp_200(data={'items': [r.model_dump() for r in result]})
```

**Step 5：提交**

```bash
git add src/backend/bisheng/education/domain/models/education.py \
        src/backend/bisheng/education/domain/schemas/education_schema.py \
        src/backend/bisheng/education/domain/services/portfolio_service.py \
        src/backend/bisheng/education/api/router.py
git commit -m "feat(edu): add Portfolio DAO/Schema/Service/API"
```

---

## Task 6：前端 — educationApi.ts 追加班级和作品集接口

**Files:**
- Modify: `src/frontend/platform/src/pages/EducationPage/api/educationApi.ts`

**Step 1：追加类型定义和接口**

在现有 `educationApi` 对象之前追加类型：

```typescript
export interface ClassOut {
  id: number;
  name: string;
  semester: string;
  teacher_id: number;
  status: number;
  member_count: number;
  create_time: string | null;
}

export interface ClassMemberOut {
  student_id: number;
  username: string;
  join_time: string | null;
}

export interface ClassDetailOut {
  cls: ClassOut;
  members: ClassMemberOut[];
}

export interface PortfolioOut {
  id: number;
  unit_id: number;
  class_id: number | null;
  asset_type: string;
  title: string;
  text_content: string | null;
  submit_time: string | null;
}
```

在现有 `educationApi` 对象末尾追加（注意保留末尾逗号）：

```typescript
  // 班级（教师端）
  createClass: (name: string, semester: string): Promise<ClassOut> =>
    axios.post(`${BASE}/classes`, { name, semester }).then((d: any) => d),

  listClasses: (): Promise<ClassOut[]> =>
    axios.get(`${BASE}/classes`).then((d: { classes: ClassOut[] }) => d.classes),

  getClassDetail: (classId: number): Promise<ClassDetailOut> =>
    axios.get(`${BASE}/classes/${classId}`).then((d: any) => d),

  addMember: (classId: number, studentId: number): Promise<void> =>
    axios.post(`${BASE}/classes/${classId}/members`, { student_id: studentId }),

  removeMember: (classId: number, studentId: number): Promise<void> =>
    axios.delete(`${BASE}/classes/${classId}/members/${studentId}`),

  // 班级（学生端）
  listMyClasses: (): Promise<ClassOut[]> =>
    axios.get(`${BASE}/my-classes`).then((d: { classes: ClassOut[] }) => d.classes),

  // 作品集
  submitPortfolio: (req: {
    unit_id: number;
    class_id?: number;
    title: string;
    text_content: string;
  }): Promise<PortfolioOut> =>
    axios.post(`${BASE}/portfolio`, req).then((d: any) => d),

  listPortfolioByUnit: (unitId: number): Promise<PortfolioOut[]> =>
    axios.get(`${BASE}/portfolio/units/${unitId}`).then((d: { items: PortfolioOut[] }) => d.items),
```

**Step 2：提交**

```bash
git add src/frontend/platform/src/pages/EducationPage/api/educationApi.ts
git commit -m "feat(edu): extend educationApi with class and portfolio endpoints"
```

---

## Task 7：前端 — UnitLearningPage 传递 class_id

**背景：** 现有 UnitLearningPage 已调用 `educationApi.getUnitLearning`，但 class_id 未传入，导致进度始终不记录。需要从 URL query param 或学生选课状态中读取 class_id。

**设计决策：** class_id 通过 URL query param 传递（`?class_id=1`）。学生从班级入口进入课程时，链接自动带 class_id；直接浏览课程列表时无 class_id，进度记录按钮不显示。

**Files:**
- Modify: `src/frontend/platform/src/pages/EducationPage/UnitLearningPage.tsx`
- Modify: `src/frontend/platform/src/pages/EducationPage/CourseDetailPage.tsx`（链接需携带 class_id）

**Step 1：读取 UnitLearningPage.tsx 当前实现**

先 cat 文件，确认当前 class_id 处理逻辑。

**Step 2：修改 UnitLearningPage.tsx**

在组件顶部用 `useSearchParams` 读取 class_id：

```typescript
import { useSearchParams } from 'react-router-dom';

// 在组件内：
const [searchParams] = useSearchParams();
const classId = searchParams.get('class_id') ? Number(searchParams.get('class_id')) : undefined;
```

将 classId 传入：
- `educationApi.getUnitLearning(unitId, classId)` 调用
- `educationApi.markUnitComplete(unitId, classId)` 调用（仅在 classId 存在时启用标记按钮）

**Step 3：修改 CourseDetailPage.tsx 单元链接**

确保从班级入口进来时，链接携带 class_id：

```typescript
// 在 CourseDetailPage 中，读取当前 class_id（同样来自 searchParams）
const [searchParams] = useSearchParams();
const classId = searchParams.get('class_id');

// 生成单元链接时携带 class_id
const unitUrl = classId
  ? `/education/courses/${courseId}/${unit.id}?class_id=${classId}`
  : `/education/courses/${courseId}/${unit.id}`;
```

**Step 4：修改 CoursesPage.tsx 课程链接（班级入口场景）**

CoursesPage 需要支持在有 class_id 时，课程链接也携带 class_id：

```typescript
// CoursesPage 中读取可选的 class_id
const classId = searchParams.get('class_id');

const courseUrl = classId
  ? `/education/courses/${course.id}?class_id=${classId}`
  : `/education/courses/${course.id}`;
```

**Step 5：提交**

```bash
git add src/frontend/platform/src/pages/EducationPage/UnitLearningPage.tsx \
        src/frontend/platform/src/pages/EducationPage/CourseDetailPage.tsx \
        src/frontend/platform/src/pages/EducationPage/CoursesPage.tsx
git commit -m "feat(edu): propagate class_id via URL query param for progress tracking"
```

---

## Task 8：前端 — ClassesPage 实现（教师端）

**Files:**
- Modify: `src/frontend/platform/src/pages/EducationPage/ClassesPage.tsx`

**Step 1：实现 ClassesPage**

参考 CoursesPage.tsx 的写法（同文件夹，结构一致）：

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { educationApi, ClassOut } from './api/educationApi';

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSemester, setNewSemester] = useState('');
  const navigate = useNavigate();

  const loadClasses = () => {
    setLoading(true);
    educationApi.listClasses()
      .then(setClasses)
      .catch(() => setClasses([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadClasses(); }, []);

  const handleCreate = () => {
    if (!newName.trim() || !newSemester.trim()) return;
    educationApi.createClass(newName.trim(), newSemester.trim())
      .then(() => { setShowCreate(false); setNewName(''); setNewSemester(''); loadClasses(); })
      .catch(() => {});
  };

  return (
    <div className="min-h-full bg-[#F7F9FF] p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[#140E35]">班级管理</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-[#4658FF] text-white text-sm rounded-lg hover:bg-[#3547EE]"
        >
          创建班级
        </button>
      </div>

      {/* 创建班级表单 */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-[#E5EAF4] p-4 mb-6">
          <h2 className="text-sm font-semibold text-[#140E35] mb-3">新建班级</h2>
          <div className="flex gap-3">
            <input
              className="flex-1 border border-[#E5EAF4] rounded-lg px-3 py-2 text-sm"
              placeholder="班级名称"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <input
              className="w-32 border border-[#E5EAF4] rounded-lg px-3 py-2 text-sm"
              placeholder="学期 (如 2025-1)"
              value={newSemester}
              onChange={e => setNewSemester(e.target.value)}
            />
            <button onClick={handleCreate}
              className="px-4 py-2 bg-[#4658FF] text-white text-sm rounded-lg hover:bg-[#3547EE]">
              确认
            </button>
            <button onClick={() => setShowCreate(false)}
              className="px-4 py-2 bg-[#F7F9FF] text-[#9498AC] text-sm rounded-lg border border-[#E5EAF4]">
              取消
            </button>
          </div>
        </div>
      )}

      {/* 班级列表 */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-xl border border-[#E5EAF4] animate-pulse" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center text-[#9498AC] py-16">暂无班级，点击右上角创建</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {classes.map(cls => (
            <div
              key={cls.id}
              onClick={() => navigate(`/education/classes/${cls.id}`)}
              className="bg-white rounded-xl border border-[#E5EAF4] p-5 cursor-pointer hover:shadow-md transition-shadow"
            >
              <h3 className="text-base font-semibold text-[#140E35] mb-1">{cls.name}</h3>
              <p className="text-xs text-[#9498AC] mb-3">{cls.semester}</p>
              <div className="text-sm text-[#4658FF]">{cls.member_count} 名学生</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

> **注意：** `classes/:classId` 路由也映射到 ClassesPage（已在 routes/index.tsx 中定义）。当 classId 存在时，页面显示班级详情（成员列表 + 添加/移除学生）。可在同一组件中用 `useParams` 区分列表/详情两种视图，或拆成两个组件。推荐在同一组件实现，减少文件数。

**Step 2：ClassesPage 详情视图（在同一文件追加）**

当路由参数 `classId` 存在时，展示班级详情（成员列表 + 添加学生）：

```typescript
// 在 ClassesPage 顶部添加
import { useParams } from 'react-router-dom';
import { ClassDetailOut } from './api/educationApi';

// 组件内：
const { classId } = useParams<{ classId?: string }>();
const numClassId = classId ? Number(classId) : undefined;

// 列表/详情切换逻辑：
// - numClassId 存在 → 渲染 ClassDetail 视图
// - 否则 → 渲染 ClassList 视图（上面已实现）
```

详情视图显示：
- 班级名称 + 学期
- 成员列表（用户名 + 加入时间 + 移除按钮）
- "添加学生"输入框（输入 user_id，调用 addMember）
- "进入课程"按钮（跳转到 `/education/courses?class_id={classId}`，CoursesList 页带 class_id）

**Step 3：提交**

```bash
git add src/frontend/platform/src/pages/EducationPage/ClassesPage.tsx
git commit -m "feat(edu): implement ClassesPage (teacher view, list + detail)"
```

---

## Task 9：前端 — PortfolioPage 实现

**Files:**
- Modify: `src/frontend/platform/src/pages/EducationPage/PortfolioPage.tsx`

**背景：** PortfolioPage 通过 URL query param `?unit_id=N` 知道当前在哪个单元提交作品。从 UnitLearningPage 点击"提交作品"时跳转并携带 unit_id 和 class_id。

**Step 1：实现 PortfolioPage**

```typescript
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { educationApi, PortfolioOut } from './api/educationApi';

export default function PortfolioPage() {
  const [searchParams] = useSearchParams();
  const unitId = searchParams.get('unit_id') ? Number(searchParams.get('unit_id')) : undefined;
  const classId = searchParams.get('class_id') ? Number(searchParams.get('class_id')) : undefined;

  const [items, setItems] = useState<PortfolioOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!unitId) return;
    setLoading(true);
    educationApi.listPortfolioByUnit(unitId)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [unitId]);

  const handleSubmit = () => {
    if (!unitId || !title.trim() || !content.trim()) return;
    setSubmitting(true);
    educationApi.submitPortfolio({ unit_id: unitId, class_id: classId, title: title.trim(), text_content: content.trim() })
      .then(item => { setItems(prev => [item, ...prev]); setTitle(''); setContent(''); })
      .catch(() => {})
      .finally(() => setSubmitting(false));
  };

  return (
    <div className="min-h-full bg-[#F7F9FF] p-6">
      <h1 className="text-2xl font-semibold text-[#140E35] mb-6">作品集</h1>

      {/* 提交表单 */}
      {unitId && (
        <div className="bg-white rounded-xl border border-[#E5EAF4] p-5 mb-6">
          <h2 className="text-sm font-semibold text-[#140E35] mb-3">提交新作品</h2>
          <input
            className="w-full border border-[#E5EAF4] rounded-lg px-3 py-2 text-sm mb-3"
            placeholder="作品标题"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            className="w-full border border-[#E5EAF4] rounded-lg px-3 py-2 text-sm h-32 resize-none"
            placeholder="作品内容（文字描述、总结、心得等）"
            value={content}
            onChange={e => setContent(e.target.value)}
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={handleSubmit}
              disabled={submitting || !title.trim() || !content.trim()}
              className="px-5 py-2 bg-[#4658FF] text-white text-sm rounded-lg hover:bg-[#3547EE] disabled:opacity-50"
            >
              {submitting ? '提交中...' : '提交作品'}
            </button>
          </div>
        </div>
      )}

      {/* 历史作品列表 */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center text-[#9498AC] py-8">加载中...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-[#9498AC] py-8">暂无作品记录</div>
        ) : (
          items.map(item => (
            <div key={item.id} className="bg-white rounded-xl border border-[#E5EAF4] p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-[#140E35]">{item.title}</h3>
                <span className="text-xs text-[#9498AC]">
                  {item.submit_time ? new Date(item.submit_time).toLocaleDateString('zh-CN') : ''}
                </span>
              </div>
              <p className="text-sm text-[#4B5880] whitespace-pre-wrap">{item.text_content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

**Step 2：在 UnitLearningPage 添加"提交作品"入口**

在 UnitLearningPage 底部操作区追加：

```typescript
// 在"标记完成"按钮旁边：
<button
  onClick={() => navigate(`/education/portfolio?unit_id=${unit.id}${classId ? `&class_id=${classId}` : ''}`)}
  className="px-4 py-2 border border-[#4658FF] text-[#4658FF] text-sm rounded-lg hover:bg-[#F1F5FF]"
>
  提交作品
</button>
```

**Step 3：提交**

```bash
git add src/frontend/platform/src/pages/EducationPage/PortfolioPage.tsx \
        src/frontend/platform/src/pages/EducationPage/UnitLearningPage.tsx
git commit -m "feat(edu): implement PortfolioPage and add submit entry in UnitLearningPage"
```

---

## Task 10：前端构建验证

**Step 1：构建**

```bash
cd "C:/Users/Administrator/projects/eagent-v3/education-m2/src/frontend/platform"
npm run build 2>&1 | tail -30
```

Expected: `✓ built in` 无 TypeScript error。

**Step 2：修复所有 TypeScript 错误后提交**

```bash
git add -A
git commit -m "fix(edu): fix TypeScript errors from build"
```

---

## Task 11：同步 .claude/ 文档至主工作树

**按规范 dev-conventions.md §6.4，feature worktree 中对 `.claude/` 的修改在合并前需同步回主工作树。**

本 Milestone 若对 `context.md` 或 `lessons.md` 有更新，执行：

```bash
cp "C:/Users/Administrator/projects/eagent-v3/education-m2/.claude/context.md" \
   "C:/Users/Administrator/projects/eagent-v3/v2.3.0 官方版本/.claude/context.md"
cp "C:/Users/Administrator/projects/eagent-v3/education-m2/.claude/lessons.md" \
   "C:/Users/Administrator/projects/eagent-v3/v2.3.0 官方版本/.claude/lessons.md"
```

---

## 完成标准

- [ ] 后端：`GET /api/v1/education/classes` 返回教师的班级列表
- [ ] 后端：`POST /api/v1/education/classes` 创建班级
- [ ] 后端：`POST /api/v1/education/classes/{id}/members` 添加学生
- [ ] 后端：`GET /api/v1/education/my-classes` 学生获取自己的班级
- [ ] 后端：`POST /api/v1/education/portfolio` 提交作品
- [ ] 后端：`GET /api/v1/education/portfolio/units/{id}` 查看历史作品
- [ ] 前端：ClassesPage 列表 + 详情（创建班级、添加/移除成员）
- [ ] 前端：PortfolioPage 提交表单 + 历史列表
- [ ] 前端：UnitLearningPage class_id 传播，进度记录按钮启用
- [ ] `npm run build` 无 TypeScript 错误
