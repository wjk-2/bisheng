from bisheng.common.dependencies.user_deps import UserPayload
from bisheng.common.errcode.http_error import NotFoundError
from bisheng.common.utils import util as common_util
from bisheng.share_link.api.schemas.share_link_schema import GenerateShareLinkRequest
from bisheng.share_link.domain.models.share_link import ShareLink
from bisheng.share_link.domain.repositories.interfaces.share_link_repository import ShareLinkRepository


class ShareLinkService:
    def __init__(self,
                 share_link_repository: 'ShareLinkRepository'):
        self.share_link_repository = share_link_repository

    async def generate_share_link(self, generate_share_link: GenerateShareLinkRequest,
                                  login_user: UserPayload) -> ShareLink:
        """Generate sharable link"""

        share_token = common_util.generate_short_high_entropy_string()

        # expire_days 优先级高于 expire_time；0 表示永不过期
        if generate_share_link.expire_days is not None:
            expire_time = generate_share_link.expire_days * 86400 if generate_share_link.expire_days > 0 else 0
        else:
            expire_time = generate_share_link.expire_time

        share_link = ShareLink(
            share_token=share_token,
            resource_id=generate_share_link.resource_id,
            resource_type=generate_share_link.resource_type,
            share_mode=generate_share_link.share_mode,
            expire_time=expire_time,
            meta_data=generate_share_link.meta_data,
            password=generate_share_link.password,
            create_user_id=login_user.user_id
        )

        return await self.share_link_repository.save(share_link)

    async def get_share_link_by_token(self, share_token: str) -> ShareLink:
        """Get shared link info by share_token"""
        share_link = await self.share_link_repository.find_one(share_token=share_token)

        if not share_link:
            raise NotFoundError()

        return share_link

    async def verify_password(self, share_token: str, password: str) -> bool:
        """Verify the password of a share link. Returns True if correct or no password set."""
        share_link = await self.share_link_repository.find_one(share_token=share_token)

        if not share_link:
            raise NotFoundError()

        if share_link.password is None:
            return True

        return share_link.password == password
