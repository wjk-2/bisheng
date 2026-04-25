from fastapi import Request, HTTPException
from loguru import logger

INTERNAL_NETWORKS = ['127.0.0.1', '::1', '10.', '172.16.', '172.17.', '172.18.', '172.19.',
                     '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.',
                     '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.']


def verify_internal_request(request: Request):
    """验证请求来自内部网络（Docker网络或本地）"""
    client_ip = (request.headers.get('X-Real-IP')
                 or request.headers.get('X-Forwarded-For', '').split(',')[0].strip()
                 or request.client.host)

    is_internal = any(client_ip.startswith(prefix) for prefix in INTERNAL_NETWORKS)
    if not is_internal:
        logger.warning(f"Blocked external access from {client_ip} to internal endpoint {request.url.path}")
        raise HTTPException(status_code=403, detail="Access denied")
