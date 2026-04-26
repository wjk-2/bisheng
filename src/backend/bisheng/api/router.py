# Router for base api
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from loguru import logger

from bisheng.api.v1 import (assistant_router, audit_router, chat_router, component_router,
                            deployment_router, endpoints_router, evaluation_router, flows_router,
                            group_router, mark_router,
                            report_router, skillcenter_router, tag_router,
                            user_router, validate_router, variable_router, workflow_router,
                            workstation_router, tool_router, invite_code_router)
from bisheng.chat_session.api.router import router as session_router
from bisheng.finetune.api.finetune import router as finetune_router
from bisheng.finetune.api.server import router as server_router
from bisheng.knowledge.api.router import qa_router, knowledge_router
from bisheng.llm.api.router import router as llm_router
from bisheng.open_endpoints.api.endpoints.llm import router as llm_router_rpc
from bisheng.open_endpoints.api.router import (assistant_router_rpc, chat_router_rpc, flow_router,
                                               knowledge_router_rpc, workflow_router_rpc,
                                               filelib_router_rpc)
from bisheng.share_link.api.router import router as share_link_router
from bisheng.linsight.api.router import router as linsight_router
from bisheng.education.api.router import router as education_router
# from bisheng.telemetry_search.api.router import router as telemetry_search_router  # disabled: .pyc compiled for Python 3.10, incompatible with 3.11
from bisheng.api.v1.prompt import router as ws_prompt_router
from bisheng.api.v1.conversation_tag import router as ws_conversation_tag_router

router = APIRouter(prefix='/api/v1', )
router.include_router(chat_router)
router.include_router(endpoints_router)
router.include_router(validate_router)
router.include_router(flows_router)
router.include_router(skillcenter_router)
router.include_router(knowledge_router)
router.include_router(server_router)
router.include_router(user_router)
router.include_router(qa_router)
router.include_router(variable_router)
router.include_router(report_router)
router.include_router(finetune_router)
router.include_router(component_router)
router.include_router(assistant_router)
router.include_router(group_router)
router.include_router(audit_router)
router.include_router(evaluation_router)
router.include_router(tag_router)
router.include_router(llm_router)
router.include_router(workflow_router)
router.include_router(mark_router)
router.include_router(workstation_router)
router.include_router(linsight_router)
router.include_router(education_router)
router.include_router(tool_router)
router.include_router(invite_code_router)
router.include_router(session_router)
router.include_router(share_link_router)
# router.include_router(telemetry_search_router)  # disabled: telemetry_search module unavailable
router.include_router(deployment_router)

_EAGENT_API_KEY = os.getenv('EAGENT_API_KEY', '')
if not _EAGENT_API_KEY:
    logger.warning('EAGENT_API_KEY not set! API v2 endpoints will reject all requests. '
                   'Set EAGENT_API_KEY env variable to enable API v2.')


async def _verify_api_key(request: Request):
    """API v2 authentication: requires X-API-Key header matching EAGENT_API_KEY env var."""
    import hmac as _hmac
    if not _EAGENT_API_KEY:
        raise HTTPException(status_code=403, detail='API v2 not configured. Set EAGENT_API_KEY env variable.')
    api_key = request.headers.get('X-API-Key', '')
    if not api_key or not _hmac.compare_digest(api_key, _EAGENT_API_KEY):
        raise HTTPException(status_code=401, detail='Invalid API key')


router_rpc = APIRouter(prefix='/api/v2', dependencies=[Depends(_verify_api_key)])
router_rpc.include_router(knowledge_router_rpc)
router_rpc.include_router(filelib_router_rpc)
router_rpc.include_router(chat_router_rpc)
router_rpc.include_router(flow_router)
router_rpc.include_router(assistant_router_rpc)
router_rpc.include_router(workflow_router_rpc)
router_rpc.include_router(llm_router_rpc)

# Workspace 功能路由（/api/prompts, /api/tags, /api/categories）
# 前端 LibreChat 路径写死，后端适配前端
router_ws = APIRouter()
router_ws.include_router(ws_prompt_router)
router_ws.include_router(ws_conversation_tag_router)


@router_ws.get('/api/categories', tags=['Workspace Prompts'])
def get_categories():
    """返回预定义提示词分类列表."""
    return ['教学', '科研', '写作', '编程', '通用']
