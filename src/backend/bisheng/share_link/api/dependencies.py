from typing import Annotated, Optional, Union

from fastapi import Depends, Header
from sqlmodel.ext.asyncio.session import AsyncSession

from bisheng.common.dependencies.core_deps import get_db_session
from bisheng.common.dependencies.user_deps import UserPayload
from bisheng.user.domain.services.auth import AuthJwt
from bisheng.share_link.domain.models.share_link import ShareLink, ShareLinkStatusEnum
from bisheng.share_link.domain.repositories.implementations.share_link_repository_impl import ShareLinkRepositoryImpl
from bisheng.share_link.domain.repositories.interfaces.share_link_repository import ShareLinkRepository
from bisheng.share_link.domain.services.share_link_service import ShareLinkService


async def get_share_link_repository(
        session: AsyncSession = Depends(get_db_session),
) -> ShareLinkRepository:
    """DapatkanShareLinkRepositoryInstance Dependencies"""
    return ShareLinkRepositoryImpl(session)


async def get_share_link_service(
        share_link_repository: ShareLinkRepository = Depends(get_share_link_repository),
) -> 'ShareLinkService':
    """DapatkanShareLinkServiceInstance Dependencies"""
    return ShareLinkService(share_link_repository=share_link_repository)


# Resolve share links in request headerstokenand return the corresponding sharing link information
async def header_share_token_parser(
        share_token: Annotated[str | None, Header(alias="share-token")] = None,
        share_link_service: ShareLinkService = Depends(get_share_link_service),
) -> Union['ShareLink', None]:
    """According to the request headershare-tokenGet shared link info"""
    if not share_token:
        return None

    share_link = await share_link_service.get_share_link_by_token(share_token)
    if share_link.status != ShareLinkStatusEnum.ACTIVE:
        return None
    if share_link.expire_time > 0:
        from datetime import datetime
        elapsed = (datetime.now() - share_link.create_time).total_seconds()
        if elapsed > share_link.expire_time:
            return None
    return share_link


async def get_user_or_default_operator(
        auth_jwt: AuthJwt = Depends(AuthJwt),
        share_link: Union['ShareLink', None] = Depends(header_share_token_parser),
) -> UserPayload:
    """有效 share_link 时允许匿名访问，否则要求 JWT 登录。
    share 场景返回 user_id=-1 占位，业务层需自行基于 share_link 做权限判断。

    使用契约：
    - 此依赖用于"登录用户或合法 share 访客均可访问"的端点
    - 持有任意有效 share_link 即视为合法访客，不校验 share_link 与当前资源的归属关系
    - 业务层如需校验归属，须自行在函数体内对 share_link 做二次验证

    已豁免端点（新增豁免须同步登记此处，并在端点处加 # [share-accessible] 注释）：
    - GET  /api/v1/flows/{flow_id}              # share 链接需读取工作流定义
    - GET  /api/v1/assistant/info/{id}          # share 链接需读取智能体配置
    - GET  /api/v1/chat/history                 # share 对话需读取历史消息
    - POST /api/v1/knowledge/upload             # share 对话允许访客上传临时文件（存 MinIO，不归属任何知识库）
    - POST /api/v1/workstation/files            # share 对话允许访客上传附件（存 MinIO，路径由对话上下文控制归属）
    - POST /api/v1/workstation/chat/completions # share 对话允许访客发送消息
    - POST /api/v1/linsight/workbench/upload-file # linsight 分享页允许访客上传任务输入文件
    - GET  /api/v1/workstation/config             # share 对话允许访客获取工作台配置（模型列表、上传开关等）

    注：WebSocket share 路由（/workflow/chat/share/{id}）使用独立的 get_default_operator，见 workflow.py。
    """
    from bisheng.common.exceptions.auth import JWTDecodeError
    try:
        subject = auth_jwt.get_subject()
        return await UserPayload.init_login_user(
            user_id=subject['user_id'], user_name=subject['user_name']
        )
    except (JWTDecodeError, Exception):
        if share_link is not None:
            return UserPayload(user_id=-1, user_name='share_visitor', user_role=[])
        from bisheng.common.errcode.http_error import UnAuthorizedError
        raise UnAuthorizedError.http_exception()


async def get_optional_user(
        auth_jwt: AuthJwt = Depends(AuthJwt),
) -> Optional['UserPayload']:
    """无需认证即可访问的端点使用此依赖：有 JWT 返回 UserPayload，无 JWT 返回 None（不报错）。
    适用于配置类公开端点，如 GET /api/v1/workstation/config。"""
    from bisheng.common.exceptions.auth import JWTDecodeError
    try:
        subject = auth_jwt.get_subject()
        return await UserPayload.init_login_user(
            user_id=subject['user_id'], user_name=subject['user_name']
        )
    except (JWTDecodeError, Exception):
        return None
