"""Death-cause audit ICD dictionary API."""

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from bisheng.api.v1.schemas import resp_200, resp_500
from bisheng.common.dependencies.user_deps import UserPayload
from bisheng.death_audit.icd.service import get_icd_status, lookup_codes, reload_icd_dictionary

router = APIRouter(prefix="/death-audit", tags=["DeathAudit"])


class IcdLookupRequest(BaseModel):
    codes: List[str] = Field(default_factory=list, description="ICD-10 codes to look up")


@router.get("/icd/status")
def icd_status(login_user: UserPayload = Depends(UserPayload.get_login_user)):
    try:
        return resp_200(data=get_icd_status())
    except Exception as exc:
        return resp_500(message=str(exc))


@router.post("/icd/lookup")
def icd_lookup(
    body: IcdLookupRequest,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    try:
        return resp_200(data=lookup_codes(body.codes or []))
    except Exception as exc:
        return resp_500(message=str(exc))


@router.post("/icd/reload")
def icd_reload(login_user: UserPayload = Depends(UserPayload.get_login_user)):
    """Reload dictionary from disk after ops replace the JSON file."""
    if not login_user.is_admin():
        return resp_500(message="admin only")
    try:
        assets = reload_icd_dictionary()
        return resp_200(
            data={
                "version": assets["version"],
                "entry_count": assets["entry_count"],
                "dictionary_path": assets["dictionary_path"],
                "quarantine_count": assets["quarantine_count"],
            }
        )
    except Exception as exc:
        return resp_500(message=str(exc))
