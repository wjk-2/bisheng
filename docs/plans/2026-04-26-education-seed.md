# Education 模块种子数据计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 新建 Alembic seed migration，插入 3 门样本课程 + 10 个单元，让 Milestone 1 页面可以真实验证。

**Scope:** 单一任务，只写 migration 脚本，不改任何业务代码。

---

## 前置说明

- **工作目录**：`C:/Users/Administrator/projects/eagent-v3/v2.3.0 官方版本/`
- **分支**：`feature/education-redesign`
- **当前最新 revision**：`education_v3_20260425`
- **迁移文件位置**：`src/backend/bisheng/core/database/alembic/versions/`

---

## Task 1：新建种子数据 Alembic Migration

### Files
- Create: `src/backend/bisheng/core/database/alembic/versions/education_v3_seed_20260426.py`

### Step 1：确认当前最新 revision

```bash
grep -r "revision = " "src/backend/bisheng/core/database/alembic/versions/education_v3_20260425.py"
```

Expected: `revision = 'education_v3_20260425'`

### Step 2：编写种子 migration

创建 `src/backend/bisheng/core/database/alembic/versions/education_v3_seed_20260426.py`：

```python
"""education v3 seed data: 3 sample courses + 10 units

Revision ID: education_v3_seed_20260426
Revises: education_v3_20260425
Create Date: 2026-04-26
"""
from alembic import op
from datetime import datetime

revision = 'education_v3_seed_20260426'
down_revision = 'education_v3_20260425'
branch_labels = None
depends_on = None

NOW = datetime(2026, 4, 26, 10, 0, 0)


def upgrade():
    # ===== 插入课程 =====
    op.execute("""
        INSERT INTO edu_course (title, type, description, cover, status, create_time, update_time) VALUES
        (
            'AI 大模型应用基础',
            'general',
            '面向全校学生的 AI 通识课程，从大模型原理到实际应用，零基础入门。',
            NULL,
            0,
            '2026-04-26 10:00:00',
            '2026-04-26 10:00:00'
        ),
        (
            '智能体开发实战',
            'professional',
            '面向计算机专业学生，学习基于 E-Agent 平台构建智能体应用的完整流程。',
            NULL,
            0,
            '2026-04-26 10:00:00',
            '2026-04-26 10:00:00'
        ),
        (
            '校园智慧服务智能体项目',
            'project',
            '综合项目课程，团队协作完成一个真实的校园智慧服务智能体，覆盖需求分析到上线部署全流程。',
            NULL,
            0,
            '2026-04-26 10:00:00',
            '2026-04-26 10:00:00'
        )
    """)

    # ===== 插入单元（依赖 course id，用子查询）=====

    # 课程1：AI 大模型应用基础（通识课）— 4 个单元
    op.execute("""
        INSERT INTO edu_unit (course_id, title, `order`, content, right_panel_type, right_panel_config, estimated_minutes, status, create_time, update_time)
        SELECT id, '什么是大模型', 1,
            '## 什么是大模型\n\n大语言模型（Large Language Model，LLM）是一种基于 Transformer 架构、在海量文本数据上训练的 AI 模型。\n\n### 核心概念\n\n- **参数规模**：现代大模型参数量从数十亿到数万亿不等\n- **涌现能力**：随着参数规模增大，模型会出现小模型没有的能力\n- **上下文理解**：能理解长达数万 token 的对话上下文\n\n### 代表性模型\n\n| 模型 | 机构 | 参数量 |\n|------|------|--------|\n| GPT-4 | OpenAI | 未公开 |\n| Claude 3 | Anthropic | 未公开 |\n| Qwen2.5 | 阿里云 | 72B |\n\n### 思考题\n\n大模型和传统搜索引擎有什么本质区别？试着和 AI 讨论一下你的理解。',
            'dialog', NULL, 30, 0, '2026-04-26 10:00:00', '2026-04-26 10:00:00'
        FROM edu_course WHERE title = 'AI 大模型应用基础'
    """)

    op.execute("""
        INSERT INTO edu_unit (course_id, title, `order`, content, right_panel_type, right_panel_config, estimated_minutes, status, create_time, update_time)
        SELECT id, 'Prompt 工程基础', 2,
            '## Prompt 工程基础\n\nPrompt（提示词）是与大模型沟通的语言，写好 Prompt 能让模型输出质量显著提升。\n\n### 基本原则\n\n1. **明确任务**：告诉模型你要它做什么\n2. **提供背景**：给出必要的上下文信息\n3. **指定格式**：说明你期望的输出格式\n4. **给出示例**：Few-shot 示例能大幅提升准确率\n\n### 常见模式\n\n```\n你是一个[角色]。\n背景：[上下文信息]\n任务：[具体要求]\n格式：[输出格式要求]\n```\n\n### 练习\n\n请写一个 Prompt，让 AI 帮你把一段 200 字的新闻摘要成 50 字以内，并写下你的 Prompt 分析。',
            'text_submit', NULL, 45, 0, '2026-04-26 10:00:00', '2026-04-26 10:00:00'
        FROM edu_course WHERE title = 'AI 大模型应用基础'
    """)

    op.execute("""
        INSERT INTO edu_unit (course_id, title, `order`, content, right_panel_type, right_panel_config, estimated_minutes, status, create_time, update_time)
        SELECT id, 'RAG 检索增强生成', 3,
            '## RAG 检索增强生成\n\nRAG（Retrieval-Augmented Generation）是解决大模型"幻觉"问题的核心技术。\n\n### 工作原理\n\n```\n用户提问\n  ↓\n向量检索（在知识库中找相关文档）\n  ↓\n将检索结果注入 Prompt\n  ↓\n模型基于真实资料生成回答\n```\n\n### 核心组件\n\n- **向量数据库**：存储文档的语义向量（Milvus、Chroma 等）\n- **Embedding 模型**：将文本转为向量\n- **重排模型（Rerank）**：对检索结果二次排序，提升精度\n\n### 与大模型直接问答的对比\n\n| 方式 | 优点 | 缺点 |\n|------|------|------|\n| 直接问答 | 简单快速 | 可能产生幻觉 |\n| RAG | 基于真实文档 | 依赖知识库质量 |\n\n有任何疑问，和 AI 一起探讨吧。',
            'dialog', NULL, 60, 0, '2026-04-26 10:00:00', '2026-04-26 10:00:00'
        FROM edu_course WHERE title = 'AI 大模型应用基础'
    """)

    op.execute("""
        INSERT INTO edu_unit (course_id, title, `order`, content, right_panel_type, right_panel_config, estimated_minutes, status, create_time, update_time)
        SELECT id, 'AI 应用伦理与安全', 4,
            '## AI 应用伦理与安全\n\n随着 AI 大规模应用，伦理和安全问题日益重要，作为 AI 使用者和开发者都需要了解。\n\n### 主要伦理议题\n\n1. **数据隐私**：AI 训练数据中可能含有个人隐私\n2. **算法偏见**：训练数据的偏见会被模型学习和放大\n3. **深度伪造**：AI 生成内容难以辨别真伪\n4. **就业影响**：自动化对劳动力市场的冲击\n\n### 安全风险\n\n- **Prompt 注入**：恶意用户通过 Prompt 绕过系统指令\n- **数据投毒**：在训练数据中植入后门\n- **模型窃取**：通过大量查询还原模型能力\n\n### 思考题\n\n请结合你的专业背景，分析 AI 在你所在领域可能带来的伦理风险，并提出 1-2 条应对建议，提交你的分析。',
            'text_submit', NULL, 45, 0, '2026-04-26 10:00:00', '2026-04-26 10:00:00'
        FROM edu_course WHERE title = 'AI 大模型应用基础'
    """)

    # 课程2：智能体开发实战（专业课）— 3 个单元
    op.execute("""
        INSERT INTO edu_unit (course_id, title, `order`, content, right_panel_type, right_panel_config, estimated_minutes, status, create_time, update_time)
        SELECT id, 'E-Agent 平台架构概览', 1,
            '## E-Agent 平台架构概览\n\nE-Agent 是基于 Bisheng v2.3.0 深度定制的高校智能体教学与应用平台。\n\n### 双前端架构\n\n| 应用 | URL | 定位 |\n|------|-----|------|\n| Workspace（门户） | /workspace/* | 普通用户使用智能体 |\n| Platform（平台） | /education /build 等 | 开发者管理智能体 |\n\n### 技术栈\n\n**后端**：FastAPI + SQLModel + LangChain + LangGraph\n**数据库**：MySQL + Redis + Milvus（向量） + Elasticsearch\n**前端**：React 18 + TypeScript + Tailwind CSS\n\n### 核心模块\n\n- **助手**：基于大模型的对话 AI\n- **工作流**：多步骤 Agent 执行链\n- **知识库**：RAG 检索增强的文档库\n\n有问题随时和 AI 探讨平台架构细节。',
            'dialog', NULL, 45, 0, '2026-04-26 10:00:00', '2026-04-26 10:00:00'
        FROM edu_course WHERE title = '智能体开发实战'
    """)

    op.execute("""
        INSERT INTO edu_unit (course_id, title, `order`, content, right_panel_type, right_panel_config, estimated_minutes, status, create_time, update_time)
        SELECT id, '构建你的第一个智能体', 2,
            '## 构建你的第一个智能体\n\n本单元通过实操演练，在 E-Agent 平台上创建一个简单的问答助手。\n\n### 操作步骤\n\n1. 登录 Platform，进入「构建」模块\n2. 点击「新建助手」，填写名称和系统提示词\n3. 选择模型（推荐：本地对话模型）\n4. 在调试界面测试效果\n5. 发布到 Workspace 供用户使用\n\n### 系统提示词示例\n\n```\n你是一个专业的学习助手，帮助大学生解答课程疑问。\n回答时：\n- 使用简洁清晰的语言\n- 必要时给出示例\n- 鼓励学生独立思考\n```\n\n### 作业\n\n创建一个「课程答疑助手」，设计系统提示词，并记录你的设计思路和测试结果。',
            'text_submit', NULL, 90, 0, '2026-04-26 10:00:00', '2026-04-26 10:00:00'
        FROM edu_course WHERE title = '智能体开发实战'
    """)

    op.execute("""
        INSERT INTO edu_unit (course_id, title, `order`, content, right_panel_type, right_panel_config, estimated_minutes, status, create_time, update_time)
        SELECT id, '知识库构建与 RAG 调优', 3,
            '## 知识库构建与 RAG 调优\n\n知识库是让智能体「有据可依」的核心组件，本单元学习如何构建高质量知识库。\n\n### 知识库构建流程\n\n```\n准备文档（PDF/Word/TXT）\n  ↓\n上传到 E-Agent 知识库\n  ↓\n选择 Embedding 模型 + 分块策略\n  ↓\n向量化索引\n  ↓\n绑定到助手 → 测试检索效果\n```\n\n### 分块策略对比\n\n| 策略 | 适合场景 | 注意点 |\n|------|---------|--------|\n| 固定长度（500 token） | 通用文档 | 可能截断语义 |\n| 按段落 | 结构化文档 | 段落长度不均 |\n| 按语义 | 高质量要求 | 耗时较长 |\n\n### 调优指标\n\n- **召回率**：相关文档是否被检索到\n- **精确率**：检索到的文档是否真正相关\n- **答案质量**：最终回答是否准确\n\n和 AI 讨论你在构建知识库时遇到的问题。',
            'dialog', NULL, 75, 0, '2026-04-26 10:00:00', '2026-04-26 10:00:00'
        FROM edu_course WHERE title = '智能体开发实战'
    """)

    # 课程3：校园智慧服务智能体项目（项目课）— 3 个单元
    op.execute("""
        INSERT INTO edu_unit (course_id, title, `order`, content, right_panel_type, right_panel_config, estimated_minutes, status, create_time, update_time)
        SELECT id, '项目需求分析与方案设计', 1,
            '## 项目需求分析与方案设计\n\n本项目课程的目标是完成一个真实的校园智慧服务智能体，本单元完成需求分析和方案设计。\n\n### 项目背景\n\n校园中存在大量重复性信息查询需求（教务、宿舍、图书馆、餐厅等），传统人工服务效率低下，智能体可以 7×24 小时提供准确的信息服务。\n\n### 需求分析框架\n\n1. **用户画像**：谁会使用这个智能体？\n2. **使用场景**：在什么情况下使用？\n3. **核心功能**：必须具备哪些能力？\n4. **数据来源**：知识库从哪里获取？\n5. **成功标准**：如何衡量项目成功？\n\n### 交付物\n\n完成《校园智慧服务智能体需求分析报告》，包含：\n- 用户画像（至少 2 个典型用户）\n- 核心功能列表（按优先级排序）\n- 数据来源规划\n- 项目里程碑计划\n\n请提交你的需求分析报告。',
            'text_submit', NULL, 120, 0, '2026-04-26 10:00:00', '2026-04-26 10:00:00'
        FROM edu_course WHERE title = '校园智慧服务智能体项目'
    """)

    op.execute("""
        INSERT INTO edu_unit (course_id, title, `order`, content, right_panel_type, right_panel_config, estimated_minutes, status, create_time, update_time)
        SELECT id, '知识库建设与智能体开发', 2,
            '## 知识库建设与智能体开发\n\n本单元进入实操阶段，完成知识库建设和智能体核心功能开发。\n\n### 阶段目标\n\n基于上一单元的需求分析，完成：\n1. 收集并整理校园信息文档\n2. 构建 E-Agent 知识库\n3. 创建智能体并绑定知识库\n4. 完成基础功能测试\n\n### 知识库内容建议\n\n- 教务常见问题 FAQ\n- 校历和重要日期\n- 各部门联系方式\n- 宿舍管理规定\n- 图书馆使用指南\n\n### 开发检查清单\n\n- [ ] 知识库文档已上传并完成索引\n- [ ] 智能体系统提示词已优化\n- [ ] 至少测试 20 个典型问题\n- [ ] 错误回答已分析原因\n\n遇到技术问题，和 AI 讨论解决方案。',
            'dialog', NULL, 180, 0, '2026-04-26 10:00:00', '2026-04-26 10:00:00'
        FROM edu_course WHERE title = '校园智慧服务智能体项目'
    """)

    op.execute("""
        INSERT INTO edu_unit (course_id, title, `order`, content, right_panel_type, right_panel_config, estimated_minutes, status, create_time, update_time)
        SELECT id, '项目汇报与复盘', 3,
            '## 项目汇报与复盘\n\n本单元完成项目最终汇报和复盘，总结经验教训。\n\n### 汇报内容结构\n\n1. **项目概述**（2 分钟）：目标、范围、团队\n2. **技术方案**（5 分钟）：架构、知识库、关键技术决策\n3. **演示**（5 分钟）：核心功能 Live Demo\n4. **数据指标**（3 分钟）：测试覆盖率、回答准确率\n5. **复盘**（5 分钟）：遇到的挑战、解决方案、改进建议\n\n### 复盘框架（STAR）\n\n- **S**ituation：项目背景和初始状态\n- **T**ask：面临的挑战和任务\n- **A**ction：采取的具体行动\n- **R**esult：最终结果和收获\n\n### 交付物\n\n请提交你的项目复盘报告，包含：\n- 项目成果总结\n- 技术难点和解决方案\n- 个人收获与反思\n- 对下一个项目的改进建议',
            'text_submit', NULL, 90, 0, '2026-04-26 10:00:00', '2026-04-26 10:00:00'
        FROM edu_course WHERE title = '校园智慧服务智能体项目'
    """)


def downgrade():
    op.execute("DELETE FROM edu_unit WHERE course_id IN (SELECT id FROM edu_course WHERE title IN ('AI 大模型应用基础', '智能体开发实战', '校园智慧服务智能体项目'))")
    op.execute("DELETE FROM edu_course WHERE title IN ('AI 大模型应用基础', '智能体开发实战', '校园智慧服务智能体项目')")
```

### Step 3：验证脚本语法

```bash
cd "C:/Users/Administrator/projects/eagent-v3/v2.3.0 官方版本/src/backend"
python -c "
import importlib.util, sys
spec = importlib.util.spec_from_file_location('seed', 'bisheng/core/database/alembic/versions/education_v3_seed_20260426.py')
mod = importlib.util.load_from_spec(spec)
spec.loader.exec_module(mod)
print('revision:', mod.revision)
print('down_revision:', mod.down_revision)
print('OK')
"
```

Expected: 打印 revision 和 down_revision，无报错

### Step 4：提交

```bash
cd "C:/Users/Administrator/projects/eagent-v3/v2.3.0 官方版本"
git add src/backend/bisheng/core/database/alembic/versions/education_v3_seed_20260426.py
git commit -m "feat: alembic seed education_v3 — 3 sample courses + 10 units"
```

---

## 验收标准

- [ ] 文件存在于 alembic/versions/ 目录
- [ ] `revision = 'education_v3_seed_20260426'`
- [ ] `down_revision = 'education_v3_20260425'`
- [ ] 3 门课程：通识课 / 专业课 / 项目课各一门
- [ ] 10 个单元：课程1 共 4 个，课程2 共 3 个，课程3 共 3 个
- [ ] right_panel_type 混用：dialog 和 text_submit 均有覆盖
- [ ] downgrade() 能正确清理数据
- [ ] Python 语法检查通过
- [ ] 已提交到 feature/education-redesign 分支
