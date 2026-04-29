"""education v5 - seed 29 courses + units

Revision ID: education_v5_courses_seed_20260428
Revises: education_v4_seed_20260428
Create Date: 2026-04-28

"""
from alembic import op
from sqlalchemy import text


# revision identifiers
revision = 'education_v5_courses_seed_20260428'
down_revision = 'education_v4_seed_20260428'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ---- 1. 缓存 4 条 vocational path 的 id（通过 title + school_type 定位，避免硬编码）----
    path_rows = conn.execute(text("""
        SELECT id, title FROM edu_path
        WHERE school_type = 'vocational'
    """)).fetchall()
    path_id_by_title = {row[1]: row[0] for row in path_rows}

    PATH_ID_1 = path_id_by_title['AI通识路径']
    PATH_ID_2 = path_id_by_title['AI专业核心路径']
    PATH_ID_3 = path_id_by_title['项目实操路径·物流方向']
    PATH_ID_4 = path_id_by_title['项目实操路径·电商方向']

    # ---- 2. 回填旧 3 门课的 path_id / stage / stage_order（用 title 子查询，避免 id 硬编码）----
    # 旧课 1：AI 大模型应用基础 → 路径 1（通识），归入认知层
    conn.execute(text("""
        UPDATE edu_course
        SET path_id = :pid, stage = '认知层', stage_order = 99
        WHERE title = 'AI 大模型应用基础' AND path_id IS NULL
    """), {'pid': PATH_ID_1})

    # 旧课 2：智能体开发实战 → 路径 2（专业核心），归入智能体编排
    conn.execute(text("""
        UPDATE edu_course
        SET path_id = :pid, stage = '智能体编排', stage_order = 99
        WHERE title = '智能体开发实战' AND path_id IS NULL
    """), {'pid': PATH_ID_2})

    # 旧课 3：校园智慧服务智能体项目
    #   该课 type=project 但无明确行业方向（非物流、非电商）
    #   保持 path_id = NULL，不强行归入任何路径
    #   TODO: 待新增"项目实操路径·校园服务方向"或由运营手动分配后再处理

    # ---- 3. 插入 29 门新课程（课程名、学时、stage 全部按设计文档 course-structure-redesign.md 第四节）----

    # ---- 路径 1：AI通识路径（6 门 / 12 学时） ----
    # 阶段：认知层 / 实操层 / 创作层；每门 2 学时 = 120 分钟
    courses_p1 = [
        # (title, stage, stage_order, minutes, right_panel_type, right_panel_note)
        ('AI工具认知：大模型能做哪些岗位任务', '认知层', 1, 120, 'dialog',           None),
        ('提示词实操：让AI帮你完成日常工作',   '认知层', 2, 120, 'prompt_debugger',  None),
        ('AI办公提效：文档/报告/数据处理',    '实操层', 1, 120, 'prompt_debugger',  None),
        ('知识库搭建：让AI记住你的业务资料',   '实操层', 2, 120, 'knowledge_upload', None),
        ('智能体配置：搭建一个岗位AI助手',     '实操层', 3, 120, 'agent_form',       None),
        # 设计文档原文为 "dialog + text_submit"；一期以主操作 dialog 为准，text_submit 作为辅助面板后续补齐
        ('综合实战：用AI解决一个真实工作问题', '创作层', 1, 120, 'dialog',           'dialog+text_submit 降级为 dialog'),
    ]
    for title, stage, so, minutes, panel, _note in courses_p1:
        conn.execute(text("""
            INSERT INTO edu_course (path_id, title, type, stage, stage_order,
                                    description, status, create_time, update_time)
            VALUES (:pid, :title, 'general', :stage, :so, NULL, 0, NOW(), NOW())
        """), {'pid': PATH_ID_1, 'title': title, 'stage': stage, 'so': so})

    # ---- 路径 2：AI专业核心路径（7 门 / 36 学时） ----
    # 阶段：大模型基础 / 数据与知识 / 智能体编排 / 部署与交付
    # 学时：6 + 4 + 6 + 6 + 6 + 4 + 4 = 36 学时 = 2160 分钟
    courses_p2 = [
        ('大模型API调用与Prompt工程',          '大模型基础', 1, 360, 'prompt_debugger',  None),
        ('AI数据服务：采集、标注、清洗',        '数据与知识', 1, 240, 'text_submit',      None),
        # 设计文档原为 "knowledge_upload + knowledge_bind"，一期降级为 knowledge_upload
        ('RAG知识库构建与检索调优',             '数据与知识', 2, 360, 'knowledge_upload', 'knowledge_upload+knowledge_bind 降级为 knowledge_upload'),
        # 设计文档原为 "iframe(工作流编辑器)"，iframe 面板一期未实现，降级为 dialog
        ('工作流设计与工具调用',                '智能体编排', 1, 360, 'dialog',           'iframe(工作流编辑器) 降级为 dialog'),
        # 设计文档原为 "iframe(智能体编辑器)"，降级为 dialog
        ('Agent设计与多智能体协作',             '智能体编排', 2, 360, 'dialog',           'iframe(智能体编辑器) 降级为 dialog'),
        ('AI系统部署与运维基础',                '部署与交付', 1, 240, 'text_submit',      None),
        ('综合项目：交付完整智能体作品集',       '部署与交付', 2, 240, 'text_submit',      None),
    ]
    for title, stage, so, minutes, panel, _note in courses_p2:
        conn.execute(text("""
            INSERT INTO edu_course (path_id, title, type, stage, stage_order,
                                    description, status, create_time, update_time)
            VALUES (:pid, :title, 'professional', :stage, :so, NULL, 0, NOW(), NOW())
        """), {'pid': PATH_ID_2, 'title': title, 'stage': stage, 'so': so})

    # ---- 路径 3：项目实操路径·物流方向（8 门 / 32 学时） ----
    # 阶段：业务认知 / 智能体设计 / 集成交付；每门 4 学时 = 240 分钟
    courses_p3 = [
        ('物流全链路与AI切入点分析',             '业务认知', 1, 240, 'dialog',       None),
        ('单据识别与信息提取助手',               '智能体设计', 1, 240, 'dialog',     'iframe(智能体编辑器) 降级为 dialog'),
        ('运单异常预警与处置助手',               '智能体设计', 2, 240, 'dialog',     'iframe(智能体编辑器) 降级为 dialog'),
        ('仓储盘点与库存管理智能体',             '智能体设计', 3, 240, 'dialog',     'iframe(智能体编辑器) 降级为 dialog'),
        ('路径规划与调度优化助手',               '智能体设计', 4, 240, 'dialog',     'iframe(工作流编辑器) 降级为 dialog'),
        ('物流客服问答机器人',                   '智能体设计', 5, 240, 'dialog',     'iframe(知识库+智能体) 降级为 dialog'),
        ('物流数据分析报告自动生成',             '集成交付', 1, 240, 'dialog',       'iframe(工作流编辑器) 降级为 dialog'),
        ('多智能体协作：物流全链路系统联调',     '集成交付', 2, 240, 'text_submit',  None),
    ]
    for title, stage, so, minutes, panel, _note in courses_p3:
        conn.execute(text("""
            INSERT INTO edu_course (path_id, title, type, stage, stage_order,
                                    description, status, create_time, update_time)
            VALUES (:pid, :title, 'project', :stage, :so, NULL, 0, NOW(), NOW())
        """), {'pid': PATH_ID_3, 'title': title, 'stage': stage, 'so': so})

    # ---- 路径 4：项目实操路径·电商方向（8 门 / 32 学时） ----
    courses_p4 = [
        ('电商全链路与AI切入点分析',             '业务认知', 1, 240, 'dialog',       None),
        ('商品标题与详情页智能生成助手',         '智能体设计', 1, 240, 'dialog',     'iframe(智能体编辑器) 降级为 dialog'),
        ('智能客服机器人：知识库+对话',          '智能体设计', 2, 240, 'dialog',     'iframe(知识库+智能体) 降级为 dialog'),
        ('用户评论分析与舆情监控助手',           '智能体设计', 3, 240, 'dialog',     'iframe(工作流编辑器) 降级为 dialog'),
        ('数据报表自动生成与解读助手',           '智能体设计', 4, 240, 'dialog',     'iframe(工作流编辑器) 降级为 dialog'),
        ('店铺运营AI助手：全场景集成',           '智能体设计', 5, 240, 'dialog',     'iframe(智能体编辑器) 降级为 dialog'),
        ('直播带货脚本与话术生成助手',           '集成交付', 1, 240, 'dialog',       'iframe(智能体编辑器) 降级为 dialog'),
        ('多智能体协作：电商运营系统联调',       '集成交付', 2, 240, 'text_submit',  None),
    ]
    for title, stage, so, minutes, panel, _note in courses_p4:
        conn.execute(text("""
            INSERT INTO edu_course (path_id, title, type, stage, stage_order,
                                    description, status, create_time, update_time)
            VALUES (:pid, :title, 'project', :stage, :so, NULL, 0, NOW(), NOW())
        """), {'pid': PATH_ID_4, 'title': title, 'stage': stage, 'so': so})

    # ---- 4. 为每门新课创建 1 个单元（edu_unit）----
    # 第一期约束：每门课 1 个单元；unit.title = course.title
    # right_panel_type 按设计文档分配（iframe 类降级为 dialog）

    # 构造 (path_id, title) -> (minutes, right_panel_type) 映射
    course_minutes_panel: dict = {}
    for pid, group in [(PATH_ID_1, courses_p1), (PATH_ID_2, courses_p2),
                        (PATH_ID_3, courses_p3), (PATH_ID_4, courses_p4)]:
        for title, _stage, _so, minutes, panel, _note in group:
            course_minutes_panel[(pid, title)] = (minutes, panel)

    # 逐课查询 id 并插入对应单元
    for (pid, title), (minutes, panel) in course_minutes_panel.items():
        course_row = conn.execute(text("""
            SELECT id FROM edu_course WHERE path_id = :pid AND title = :title
        """), {'pid': pid, 'title': title}).fetchone()
        if not course_row:
            continue
        course_id = course_row[0]
        conn.execute(text("""
            INSERT INTO edu_unit (course_id, title, `order`, content,
                                  right_panel_type, right_panel_config,
                                  estimated_minutes, status,
                                  create_time, update_time)
            VALUES (:cid, :title, 1, NULL,
                    :panel, NULL,
                    :minutes, 0,
                    NOW(), NOW())
        """), {'cid': course_id, 'title': title, 'panel': panel, 'minutes': minutes})


def downgrade() -> None:
    conn = op.get_bind()

    NEW_COURSE_TITLES = [
        # 路径 1
        'AI工具认知：大模型能做哪些岗位任务', '提示词实操：让AI帮你完成日常工作',
        'AI办公提效：文档/报告/数据处理', '知识库搭建：让AI记住你的业务资料',
        '智能体配置：搭建一个岗位AI助手', '综合实战：用AI解决一个真实工作问题',
        # 路径 2
        '大模型API调用与Prompt工程', 'AI数据服务：采集、标注、清洗',
        'RAG知识库构建与检索调优', '工作流设计与工具调用',
        'Agent设计与多智能体协作', 'AI系统部署与运维基础',
        '综合项目：交付完整智能体作品集',
        # 路径 3
        '物流全链路与AI切入点分析', '单据识别与信息提取助手',
        '运单异常预警与处置助手', '仓储盘点与库存管理智能体',
        '路径规划与调度优化助手', '物流客服问答机器人',
        '物流数据分析报告自动生成', '多智能体协作：物流全链路系统联调',
        # 路径 4
        '电商全链路与AI切入点分析', '商品标题与详情页智能生成助手',
        '智能客服机器人：知识库+对话', '用户评论分析与舆情监控助手',
        '数据报表自动生成与解读助手', '店铺运营AI助手：全场景集成',
        '直播带货脚本与话术生成助手', '多智能体协作：电商运营系统联调',
    ]

    # 删除对应的 units（先删子表）
    for title in NEW_COURSE_TITLES:
        conn.execute(text("""
            DELETE FROM edu_unit
            WHERE course_id IN (SELECT id FROM edu_course WHERE title = :title)
        """), {'title': title})

    # 删除新增课程
    for title in NEW_COURSE_TITLES:
        conn.execute(text("""
            DELETE FROM edu_course WHERE title = :title
        """), {'title': title})

    # 回滚旧 3 门课的 path_id / stage / stage_order
    conn.execute(text("""
        UPDATE edu_course
        SET path_id = NULL, stage = NULL, stage_order = 0
        WHERE title IN ('AI 大模型应用基础', '智能体开发实战')
    """))
    # 旧课 3 未被 upgrade 修改，downgrade 也不处理
