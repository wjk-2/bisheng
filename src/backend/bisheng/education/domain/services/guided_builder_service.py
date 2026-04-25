"""
引导式构建服务 - 处理工作流引导逻辑
"""
from typing import List, Dict, Any, Optional
from loguru import logger
from fastapi import HTTPException

from bisheng.education.domain.models.education import GuidedProgressDao


class GuidedBuilderService:
    """引导式构建服务"""

    @staticmethod
    def get_guided_steps() -> List[Dict[str, str]]:
        """
        获取引导式构建的 11 个步骤

        Returns:
            引导步骤列表
        """
        steps = [
            {
                'id': 'step-1',
                'title': '欢迎进入工作流编辑器',
                'description': '了解工作流画布与基础操作',
                'focus_element': '.react-flow',
                'instructions': '工作流由多个节点组成，数据会沿着节点连接流动。接下来我们会一步步创建一个最小可用的工作流。'
            },
            {
                'id': 'step-2',
                'title': '认识组件库',
                'description': '浏览左侧可用节点类型',
                'focus_element': '.flow-sidebar',
                'instructions': '左侧是节点组件库，包含基础节点与工具节点。您可以拖拽节点到画布中搭建流程。'
            },
            {
                'id': 'step-3',
                'title': '添加输入节点',
                'description': '拖拽输入节点到画布中心',
                'focus_element': '.flow-sidebar [data-node-type]',
                'instructions': '从组件库中拖拽"输入"节点到画布中央，作为工作流的入口。'
            },
            {
                'id': 'step-4',
                'title': '添加大模型节点',
                'description': '拖拽大模型节点到输入节点右侧',
                'focus_element': '.flow-sidebar',
                'instructions': '将"大模型"节点放在输入节点的右侧，用于处理输入内容。'
            },
            {
                'id': 'step-5',
                'title': '连接节点',
                'description': '将输入节点连接到大模型节点',
                'focus_element': '.react-flow',
                'instructions': '拖拽输入节点的连接点到大模型节点，完成第一条数据流连接。'
            },
            {
                'id': 'step-6',
                'title': '添加输出节点',
                'description': '拖拽输出节点到大模型节点右侧',
                'focus_element': '.flow-sidebar',
                'instructions': '添加"输出"节点，作为工作流的最终输出结果。'
            },
            {
                'id': 'step-7',
                'title': '连接输出节点',
                'description': '将大模型节点连接到输出节点',
                'focus_element': '.react-flow',
                'instructions': '完成大模型与输出节点的连接，构建完整的端到端流程。'
            },
            {
                'id': 'step-8',
                'title': '配置节点参数',
                'description': '点击节点打开配置面板',
                'focus_element': '.react-flow',
                'instructions': '点击大模型节点，调整模型与提示词配置，让输出符合预期。'
            },
            {
                'id': 'step-9',
                'title': '保存工作流',
                'description': '保存当前工作流配置',
                'focus_element': '.react-flow',
                'instructions': '点击顶部保存按钮，持久化当前配置，方便后续编辑与发布。'
            },
            {
                'id': 'step-10',
                'title': '测试运行',
                'description': '运行并验证工作流效果',
                'focus_element': '.react-flow',
                'instructions': '点击运行按钮进行测试，确认节点连接与输出效果。'
            },
            {
                'id': 'step-11',
                'title': '完成引导',
                'description': '继续探索更多工作流能力',
                'focus_element': '.react-flow',
                'instructions': '恭喜完成基础引导，您可以继续添加更多节点和高级配置。'
            }
        ]
        return steps

    @staticmethod
    def save_progress(
        user_id: int,
        step_id: str,
        completed: bool,
        config_data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        保存引导进度

        Args:
            user_id: 用户ID
            step_id: 步骤ID
            completed: 是否完成
            config_data: 配置数据（可选）

        Returns:
            是否保存成功
        """
        try:
            # 验证用户ID
            if not user_id or user_id <= 0:
                logger.error(f"无效的 user_id: {user_id}")
                raise HTTPException(status_code=400, detail="无效的用户ID")

            # 验证步骤ID
            if not step_id or not isinstance(step_id, str):
                logger.error(f"无效的 step_id: {step_id}")
                raise HTTPException(status_code=400, detail="无效的步骤ID")

            # 验证步骤ID是否存在
            valid_step_ids = {step['id'] for step in GuidedBuilderService.get_guided_steps()}
            if step_id not in valid_step_ids:
                raise HTTPException(status_code=400, detail=f"未知的步骤ID: {step_id}")

            # 保存进度
            GuidedProgressDao.save_progress(
                user_id=user_id,
                step_id=step_id,
                completed=completed,
                config_data=config_data
            )

            logger.info(f"引导进度保存成功 - user_id={user_id}, step_id={step_id}, completed={completed}")
            return True

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"保存引导进度失败 (user_id={user_id}, step_id={step_id}): {str(e)}")
            raise HTTPException(status_code=500, detail="保存引导进度失败")

    @staticmethod
    def get_user_progress_summary(user_id: int) -> Dict[str, Any]:
        """
        获取用户引导进度摘要

        Args:
            user_id: 用户ID

        Returns:
            引导进度摘要
        """
        try:
            # 验证用户ID
            if not user_id or user_id <= 0:
                logger.error(f"无效的 user_id: {user_id}")
                raise HTTPException(status_code=400, detail="无效的用户ID")

            # 获取用户所有进度
            all_progress = GuidedProgressDao.get_user_guided_progress(user_id)
            total_steps = len(GuidedBuilderService.get_guided_steps())

            # 统计完成的步骤
            completed_steps = [p for p in all_progress if p.completed]
            completion_rate = len(completed_steps) / total_steps if total_steps > 0 else 0

            # 找到当前步骤（第一个未完成的步骤）
            completed_step_ids = {p.step_id for p in completed_steps}
            all_step_ids = [step['id'] for step in GuidedBuilderService.get_guided_steps()]

            current_step_id = None
            for step_id in all_step_ids:
                if step_id not in completed_step_ids:
                    current_step_id = step_id
                    break

            # 判断是否可以生成智能体（必需步骤：step-1, step-3, step-4, step-5）
            required_steps = {'step-1', 'step-3', 'step-4', 'step-5'}
            can_generate = required_steps.issubset(completed_step_ids)

            # 获取最后更新时间
            last_updated = None
            if all_progress:
                last_updated = max(p.update_time for p in all_progress).isoformat()

            return {
                'total_steps': total_steps,
                'completed_steps': len(completed_steps),
                'completion_rate': round(completion_rate, 2),
                'current_step': current_step_id,
                'can_generate_agent': can_generate,
                'last_updated': last_updated
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取引导进度摘要失败 (user_id={user_id}): {str(e)}")
            raise HTTPException(status_code=500, detail="获取引导进度摘要失败")
