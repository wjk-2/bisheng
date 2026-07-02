import json
import logging

from fastapi import WebSocket
from fastapi.exceptions import HTTPException

from bisheng.common.schemas.api import UnifiedResponseModel

logger = logging.getLogger(__name__)


class BaseErrorCode(Exception):
    # The first three digits of the error code represent the specific function module, and the last two digits represent the specific error report inside the module. For example,10001
    Code: int
    Msg: str

    def __init__(self, exception: Exception = None, msg: str = None, code: int = None, **kwargs):
        self.exception = exception
        raw_msg = msg or self.Msg
        # Format the message template with kwargs so placeholder-bearing Msg
        # (e.g. 'Meta data fields {field_name} ...') is filled when callers pass
        # the matching kwargs. Fall back to the raw template when a placeholder
        # has no matching kwarg, so callers that pass no kwargs (or pass exception
        # as the first positional param) are not broken by KeyError.
        if kwargs:
            try:
                self.message = raw_msg.format(**kwargs)
            except (KeyError, IndexError):
                self.message = raw_msg
        else:
            self.message = raw_msg
        self.code = code or self.Code
        self.kwargs = kwargs
        # I3: errcode 进日志——异常抛出时记 warning 含 code/message，助排障
        # （此前 errcode 只进 HTTP/SSE 响应体，日志无 code，排障难关联）
        logger.warning(f"errcode={self.code} msg={self.message} exc={exception}")
        super().__init__(exception)

    def __str__(self):
        return str(self.exception) if self.exception else self.message

    @classmethod
    def return_resp(cls, msg: str = None, data: any = None) -> UnifiedResponseModel:
        return UnifiedResponseModel(status_code=cls.Code, status_message=msg or cls.Msg,
                                    data=data)

    def return_resp_instance(self, data: any = None) -> UnifiedResponseModel:
        data = data if data is not None else {"exception": str(self), **self.kwargs}

        return UnifiedResponseModel(status_code=self.code, status_message=self.message,
                                    data=data)

    @classmethod
    def http_exception(cls, msg: str = None) -> HTTPException:
        return HTTPException(status_code=cls.Code, detail=msg or cls.Msg)

    @classmethod
    def to_sse_event(cls, msg: str = None, data: any = None, event: str = "error", **kwargs) -> dict:
        data = data if data is not None else {"exception": cls.Msg, **kwargs}
        return {
            "event": event,
            "data": json.dumps({
                "status_code": cls.Code,
                "status_message": msg or cls.Msg,
                "data": data
            })
        }

    def to_sse_event_instance(self, event: str = "error", data: any = None) -> dict:
        data = data if data is not None else {"exception": str(self), **self.kwargs}
        return {
            "event": event,
            "data": json.dumps({
                "status_code": self.code,
                "status_message": self.message,
                "data": data
            })
        }

    def to_sse_event_instance_str(self, event: str = "error", data: any = None) -> str:
        data = data if data is not None else {"exception": str(self), **self.kwargs}
        msg = json.dumps({
            "status_code": self.code,
            "status_message": self.message,
            "data": data
        }, ensure_ascii=False)
        return f'event: {event}\ndata: {msg}\n\n'

    def to_dict(self, data: any = None) -> dict:
        data = data if data is not None else {"exception": str(self), **self.kwargs}
        return {
            "status_code": self.code,
            "status_message": self.message,
            "data": data
        }

    def to_json_str(self, data: any = None) -> str:
        data = data if data is not None else {"exception": str(self), **self.kwargs}
        return json.dumps({
            "status_code": self.code,
            "status_message": self.message,
            "data": data
        }, ensure_ascii=False)

    # websocket error message
    async def websocket_close_message(self, websocket: WebSocket, close_ws: bool = True):
        reason = {
            "status_code": self.code,
            "status_message": self.message,
            "data": {"exception": str(self), **self.kwargs}
        }
        await websocket.send_json({"category": "error", "type": "end", "message": reason})
        if close_ws:
            await websocket.close(reason=self.message[:10])
