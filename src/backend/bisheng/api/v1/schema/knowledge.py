import json
from typing import Optional

from bisheng.knowledge.domain.models.knowledge_file import KnowledgeFileBase
from pydantic import Field, field_validator


class KnowledgeFileResp(KnowledgeFileBase):
    id: Optional[int] = Field(default=None)
    title: Optional[str] = Field(default=None, description="Document Summary")
    # E1后split_rule JSON列(Dict),前端多处假设字符串(.replace)报错。response统一stringify
    split_rule: Optional[str] = None

    @field_validator("split_rule", mode="before")
    @classmethod
    def _split_rule_dumps(cls, v):
        if isinstance(v, dict):
            return json.dumps(v, ensure_ascii=False)
        return v
