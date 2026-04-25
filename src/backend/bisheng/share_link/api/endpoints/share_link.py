from fastapi import APIRouter, Depends, HTTPException
from fastapi.params import Body

from bisheng.common.dependencies.user_deps import UserPayload
from bisheng.common.schemas.api import resp_200, UnifiedResponseModel
from bisheng.share_link.api.dependencies import get_share_link_service
from bisheng.share_link.api.schemas.share_link_schema import GenerateShareLinkRequest, VerifyPasswordRequest

router = APIRouter()


@router.post('/generate_share_link', summary='generate share link',
             response_model=UnifiedResponseModel)
async def generate_share_link(
        req_param: GenerateShareLinkRequest = Body(..., description="generate share link request"),
        login_user: UserPayload = Depends(UserPayload.get_login_user),
        share_link_service=Depends(get_share_link_service)
):
    share_link = await share_link_service.generate_share_link(req_param, login_user)
    return resp_200(data=share_link)


@router.post('/verify_password', summary='verify share link password',
             response_model=UnifiedResponseModel)
async def verify_share_link_password(
        req_param: VerifyPasswordRequest = Body(...),
        share_link_service=Depends(get_share_link_service)
):
    """Verify the access password for a password-protected share link."""
    is_valid = await share_link_service.verify_password(req_param.share_token, req_param.password)
    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid password")
    return resp_200(data={"valid": True})


@router.get('/{share_token}', summary='get share link info',
            response_model=UnifiedResponseModel)
async def get_share_link_info(
        share_token: str,
        share_link_service=Depends(get_share_link_service)
):
    """Get share link info. Password field is masked (returns has_password bool instead)."""
    share_link = await share_link_service.get_share_link_by_token(share_token)

    data = share_link.dict()
    # 不向客户端暴露密码明文，改为 has_password 布尔值
    data['has_password'] = share_link.password is not None
    data.pop('password', None)

    return resp_200(data=data)
