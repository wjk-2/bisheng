from fastapi import APIRouter, Depends, Body, Request, HTTPException
from loguru import logger

from bisheng.api.services.invite_code.invite_code import InviteCodeService
from bisheng.api.v1.schemas import resp_200
from bisheng.common.dependencies.user_deps import UserPayload
from bisheng.core.cache.redis_manager import get_redis_client
from bisheng.utils import get_request_ip

router = APIRouter(prefix='/invite', tags=['InviteCode'])


@router.post('/code')
async def create_invite_code(request: Request, login_user: UserPayload = Depends(UserPayload.get_admin_user),
                             name: str = Body(..., description='Batch'),
                             num: int = Body(..., description='Number of invitation codes in the current batch'),
                             limit: int = Body(..., description='Current batch invite code usage limit')):
    """
    Create an invite code
    """
    logger.debug(
        f"create invite code user_id: {login_user.user_id}, ip: {get_request_ip(request)}, name: {name}, num: {num}, limit: {limit}")
    codes = await InviteCodeService.create_batch_invite_codes(login_user, name, num, limit)
    return resp_200(data={
        "name": name,
        "limit": limit,
        "codes": codes
    })


@router.post('/bind')
async def bind_invite_code(request: Request, login_user: UserPayload = Depends(UserPayload.get_login_user),
                           code: str = Body(..., embed=True, description='Invitation Code')):
    """
    Binding Invitation Code
    """
    # 速率限制：每用户每小时最多尝试 10 次，防止暴力枚举邀请码。
    # 使用 Lua 原子 INCR，TTL 在首次调用时固定为 3600 秒（固定窗口）。
    rate_key = f"rate:invite_bind:{login_user.user_id}"
    redis_client = await get_redis_client()
    attempts = await redis_client.aincr(rate_key, expiration=3600)
    if attempts > 10:
        raise HTTPException(status_code=429, detail="操作过于频繁，请稍后再试")

    result = await InviteCodeService.bind_invite_code(login_user, code)
    logger.debug(f"bind_invite_code user_id:{login_user.user_id}, code:{code}, flag:{result}")
    return resp_200()


@router.get('/code')
async def get_bind_code_num(request: Request, login_user: UserPayload = Depends(UserPayload.get_login_user)):
    """
    Get the number of times a valid invitation code bound by a user can be used
    """
    num = await InviteCodeService.get_invite_code_num(login_user)
    return resp_200(data=num)
