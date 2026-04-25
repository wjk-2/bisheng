from typing import Optional, Dict

from pydantic import BaseModel, Field

from bisheng.share_link.domain.models.share_link import ResourceTypeEnum, ShareMode


class GenerateShareLinkRequest(BaseModel):
    """Generate shared link request model"""
    resource_type: ResourceTypeEnum = Field(..., description="Resource Type")
    resource_id: str = Field(..., description="reasourseID")
    share_mode: ShareMode = Field(default=ShareMode.READ_ONLY, description="sharing mode")
    expire_time: int = Field(default=0, description="Expiration time, in seconds,0Indicates never expires")
    expire_days: Optional[int] = Field(default=None, description="Expiration time in days (1-365), overrides expire_time if provided. 0 means never expires")
    meta_data: Optional[Dict] = Field(None, description="Metadata to store additional information")
    password: Optional[str] = Field(default=None, min_length=6, max_length=6, description="6-char access password, None means no password required")


class VerifyPasswordRequest(BaseModel):
    """Verify share link password request"""
    share_token: str = Field(..., description="Share token")
    password: str = Field(..., min_length=1, max_length=6, description="Password to verify")
