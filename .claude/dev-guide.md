# E-Agent 开发参考手册

> **版本**: v1.0
> **建立**: 2026-04-27
> **定位**: 开发规范（dev-conventions.md）的配套参考，提供示例、模板和背景说明

---

## 1. 标准端点模板

### 1.1 查询单个资源

```python
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from bisheng.core.database import get_sync_db_session
from bisheng.common.dependencies.user_deps import UserPayload
from bisheng.api.v1.schemas import resp_200
from bisheng.{module}.domain.services.{service} import XxxService

router = APIRouter(prefix='/{module}', tags=['{Module}'])

@router.get('/resource/{resource_id}')
def get_resource(
    resource_id: int,
    query_param: Optional[str] = None,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        try:
            result = XxxService.get(session, resource_id, login_user.user_id, query_param)
            return resp_200(data=result.model_dump())
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
```

### 1.2 查询列表

```python
@router.get('/resources')
def list_resources(
    filter_param: Optional[str] = None,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        items = XxxService.list(session, login_user.user_id, filter_param)
        return resp_200(data=XxxListResp(items=items).model_dump())
```

### 1.3 创建 / 更新资源

```python
@router.post('/resources')
def create_resource(
    req: XxxCreateReq,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        result = XxxService.create(session, login_user.user_id, req)
        return resp_200(data=result.model_dump())
```

---

## 2. 标准页面模板（前端）

### 2.1 数据加载页面

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { featureApi, XxxOut } from './api/featureApi';

export default function XxxPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<XxxOut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    featureApi.getXxx(Number(id))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-[#9498AC]">加载中...</div>;
  if (!data) return <div className="p-8 text-[#9498AC]">资源不存在</div>;

  return (
    <div className="min-h-full p-6">
      {/* 页面内容 */}
    </div>
  );
}
```

### 2.2 API 模块

```typescript
import axios from '@/controllers/request';

const BASE = '/api/v1/{module}';

export interface XxxOut {
  id: number;
  title: string;
  // 字段名保持 snake_case，与后端 Schema 一致
  // 时间戳字段统一用 create_time / update_time（见 dev-conventions.md §1.7）
  create_time: string | null;
  update_time: string | null;
}

export interface XxxListResp {
  items: XxxOut[];
}

export const featureApi = {
  listItems: (filter?: string): Promise<XxxOut[]> =>
    axios.get(`${BASE}/items`, { params: filter ? { filter } : {} })
      .then((data: XxxListResp) => data.items),

  getItem: (id: number): Promise<XxxOut> =>
    axios.get(`${BASE}/items/${id}`).then((data: any) => data),

  createItem: (req: XxxCreateReq): Promise<unknown> =>
    axios.post(`${BASE}/items`, req).then((data: any) => data),
};
```

---

## 3. 验证过的导入路径清单

| 组件 | 正确导入路径 |
|------|------------|
| 数据库会话 | `from bisheng.core.database import get_sync_db_session` |
| 认证依赖 | `from bisheng.common.dependencies.user_deps import UserPayload` |
| ORM 基类 | `from bisheng.common.models.base import SQLModelSerializable` |
| 配置 | `from bisheng.common.services.config_service import settings` |
| 响应工具 | `from bisheng.api.v1.schemas import resp_200` |
| SQLAlchemy JSON | `from sqlalchemy import Column, JSON` |
| Pydantic Schema | `from pydantic import BaseModel` |
| SQLModel ORM | `from sqlmodel import Field, Session, select` |

---

## 4. 数据模型示例

### 4.1 ORM 模型 + DAO

```python
from typing import Optional
from sqlmodel import Field, Session, select
from sqlalchemy import Column, JSON
from bisheng.common.models.base import SQLModelSerializable


class EduCourse(SQLModelSerializable, table=True):
    __tablename__ = 'edu_course'

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(max_length=255)
    type: str = Field(max_length=50)
    description: Optional[str] = Field(default=None)
    cover: Optional[str] = Field(default=None)
    config: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    status: int = Field(default=0)  # 0=启用 1=禁用
    create_time: Optional[datetime] = Field(default_factory=datetime.now)
    update_time: Optional[datetime] = Field(default_factory=datetime.now)


class EduCourseDao:

    @staticmethod
    def get_course(session: Session, course_id: int) -> Optional[EduCourse]:
        return session.get(EduCourse, course_id)

    @staticmethod
    def list_courses(session: Session, course_type: Optional[str] = None) -> list[EduCourse]:
        stmt = select(EduCourse).where(EduCourse.status == 0)
        if course_type:
            stmt = stmt.where(EduCourse.type == course_type)
        return session.exec(stmt).all()
```

### 4.2 Schema

```python
from typing import Optional, List
from pydantic import BaseModel


class CourseOut(BaseModel):
    id: int
    title: str
    type: str
    description: Optional[str] = None
    cover: Optional[str] = None
    total_units: int = 0
    completed_units: int = 0


class CourseListResp(BaseModel):
    courses: List[CourseOut]


class CourseDetailOut(BaseModel):
    course: CourseOut
    units: List['UnitOut']
```

---

## 5. Alembic Migration 示例

```python
"""education module v3 schema

Revision ID: education_v3_20260425
Revises: education_v2_seed_20260208
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision = 'education_v3_20260425'
down_revision = 'education_v2_seed_20260208'
branch_labels = None
depends_on = None


def upgrade():
    # Step 1: drop 旧表（子表先于父表）
    op.drop_table('edu_unit_progress', if_exists=True)
    op.drop_table('edu_unit', if_exists=True)
    op.drop_table('edu_course', if_exists=True)

    # Step 2: create 新表（父表先于子表）
    op.create_table(
        'edu_course',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('config', mysql.JSON(), nullable=True),
        sa.Column('status', sa.Integer(), server_default='0'),
        sa.Column('create_time', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('update_time', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_table(
        'edu_unit',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('course_id', sa.Integer(), sa.ForeignKey('edu_course.id'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('order', sa.Integer(), server_default='0'),
        sa.Column('right_panel_config', mysql.JSON(), nullable=True),
        sa.Column('create_time', sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade():
    # 顺序与 upgrade drop 一致（子表先于父表）
    op.drop_table('edu_unit')
    op.drop_table('edu_course')
```

---

## 6. 前端路由注册示例

```typescript
// routes/index.tsx
import { lazy } from 'react';

const CoursesPage = lazy(() => import('../pages/EducationPage/CoursesPage'));
const CourseDetailPage = lazy(() => import('../pages/EducationPage/CourseDetailPage'));

// 在 privateRouter children 中添加：
{
  path: 'education',
  children: [
    { path: 'courses', element: <CoursesPage /> },
    { path: 'courses/:courseId', element: <CourseDetailPage /> },
  ],
}
```

---

## 7. 拦截器行为说明

Platform axios 拦截器（`@/controllers/request.ts`）的完整处理逻辑：

| 条件 | 行为 |
|------|------|
| `status_code === 200` | 返回 `response.data.data`，`.then()` 直接获得业务数据 |
| `status_code === 403 / 404`，GET 请求 | 重定向到错误页 |
| `status_code === 403 / 404`，POST/PUT 请求 | `Promise.reject` |
| HTTP 401 | 清除 localStorage 认证项（`ws_token`, `token`, `userInfo`, `isLogin`）并 reload |
| 其他错误 | `toast` 弹窗提示 |

**推论**：API 函数的 `.then()` 回调永远只需处理正常数据，无需判断 `status_code`。

---

## 8. 颜色与 UI 系统

| 用途 | 值 |
|------|-----|
| 主色 | `#4658FF` |
| 主色浅背景 | `#F1F5FF` |
| 页面背景 | `#F7F9FF` |
| 卡片/面板背景 | `#FFFFFF` |
| 边框 | `#E5EAF4` |
| 主文本 | `#140E35` |
| 次文本 | `#565772` |
| 辅助文本 | `#9498AC` |

背景色由 `MainLayout.tsx` 的 `var(--studio-page-bg)` 统一承载，业务页面顶层容器不设背景色。
