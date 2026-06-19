import copy
import json
import time
from typing import Annotated, List, Optional, Union
from uuid import UUID

import yaml
from fastapi import APIRouter, Body, Depends, HTTPException, Path, Request, UploadFile
from loguru import logger

from bisheng.api.v1.schemas import (ProcessResponse, UploadFileResponse,
                                    resp_200)
from bisheng.chat.utils import judge_source, process_source_document
from bisheng.common.constants.enums.telemetry import BaseTelemetryTypeEnum, ApplicationTypeEnum
from bisheng.common.dependencies.user_deps import UserPayload
from bisheng.common.errcode.http_error import NotFoundError
from bisheng.common.errcode.server import SystemConfigEmptyError, SystemConfigInvalidError, UploadFileEmptyError, \
    UploadFileExtError, WebConfigConflictError
from bisheng.common.models.config import Config, ConfigDao, ConfigKeyEnum
from bisheng.common.schemas.telemetry.event_data_schema import NewMessageSessionEventData, ApplicationAliveEventData, \
    ApplicationProcessEventData
from bisheng.common.services import telemetry_service
from bisheng.common.services.config_service import settings as bisheng_settings
from bisheng.core.cache.redis_manager import get_redis_client_sync
from bisheng.core.cache.utils import save_uploaded_file, upload_file_to_minio
from bisheng.core.logger import trace_id_var
from bisheng.database.models.flow import FlowDao, FlowType
from bisheng.database.models.message import ChatMessage, ChatMessageDao
from bisheng.database.models.session import MessageSession, MessageSessionDao
from bisheng.interface.types import get_all_types_dict
from bisheng.open_endpoints.domain.utils import get_default_operator_async
from bisheng.share_link.api.dependencies import get_user_or_default_operator, header_share_token_parser
from bisheng.share_link.domain.models.share_link import ShareLink
from bisheng.processing.process import process_graph_cached, process_tweaks
from bisheng.services.deps import get_session_service, get_task_service
from bisheng.services.task.service import TaskService
from bisheng.utils import generate_uuid
from bisheng.utils import get_request_ip

try:
    from bisheng.worker import process_graph_cached_task
except ImportError:

    def process_graph_cached_task(*args, **kwargs):
        raise NotImplementedError('Celery is not installed')

# build router
router = APIRouter(tags=['Base'])

if bisheng_settings.debug:
    import tracemalloc
    import os
    import threading


    @router.get("/tracemalloc")
    def tracemalloc_point(login_user: UserPayload = Depends(UserPayload.get_login_user)):
        if not login_user.is_admin():
            raise HTTPException(status_code=403, detail='Admin only')
        snapshot = tracemalloc.take_snapshot()
        process_id = os.getpid()
        thread_id = threading.get_ident()
        snapshot.dump(f"/app/data/snapshot_{process_id}_{thread_id}_{time.time()}.prof")

        return resp_200()


@router.get('/all')
def get_all():
    """Get all parameters"""
    all_types = get_all_types_dict()
    return resp_200(all_types)


@router.get('/env')
def get_env():
    from bisheng import __version__
    """Get environment variable parameters"""
    uns_support = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'md', 'html', 'pdf', 'csv']

    etl_for_lm_url = bisheng_settings.get_knowledge().etl4lm.url
    if etl_for_lm_url:
        uns_support.extend(['png', 'jpg', 'jpeg', 'bmp'])

    env = {}
    if isinstance(bisheng_settings.environment, str):
        env['env'] = bisheng_settings.environment
    else:
        env = copy.deepcopy(bisheng_settings.environment)

    env['uns_support'] = uns_support
    if bisheng_settings.get_from_db('office_url'):
        env['office_url'] = bisheng_settings.get_from_db('office_url')
    # add tips from settings
    env['dialog_tips'] = bisheng_settings.get_from_db('dialog_tips')
    # add env dict from settings
    env.update(bisheng_settings.get_from_db('env') or {})
    env['pro'] = bisheng_settings.get_system_login_method().eagent_pro
    env['version'] = __version__
    env['enable_etl4lm'] = bool(etl_for_lm_url)

    return resp_200(env)


@router.get('/config')
def get_config(admin_user: UserPayload = Depends(UserPayload.get_admin_user)):
    db_config = ConfigDao.get_config(ConfigKeyEnum.INIT_DB)
    config_str = db_config.value if db_config else ''
    return resp_200(config_str)


@router.post('/config/save')
def save_config(request: Request, data: dict,
                admin_user: UserPayload = Depends(UserPayload.get_admin_user)):
    if not data.get('data', '').strip():
        raise SystemConfigEmptyError()

    logger.info(f'act=system_config_save user_name={admin_user.user_name} '
                f'ip={get_request_ip(request)}')

    # YAML 解析与 linsight_invitation_code 校验失败属于用户配置格式错，映射为 10031
    try:
        config = yaml.safe_load(data.get('data'))

        if isinstance(config, dict) and 'linsight_invitation_code' in config:
            if config['linsight_invitation_code'] is not None \
                    and not isinstance(config['linsight_invitation_code'], bool):
                raise ValueError('linsight_invitation_code must be a boolean value')
    except (yaml.YAMLError, ValueError) as e:
        logger.exception('System config YAML parse / linsight validation failed: %s', e)
        raise SystemConfigInvalidError()

    # DB 写入与 Redis 失效属于基础设施异常，原样上抛以便运维区分定位
    try:
        db_config = ConfigDao.get_config(ConfigKeyEnum.INIT_DB)
        db_config.value = data.get('data')
        ConfigDao.upsert_config(db_config)
        get_redis_client_sync().delete('config:initdb_config')
    except Exception as e:
        logger.exception('System config DB write / Redis invalidate failed: %s', e)
        raise

    return resp_200()


# web_config 的 Redis 缓存 key，与 initdb_config 缓存模式保持一致
WEB_CONFIG_REDIS_KEY = 'config:web_config'


@router.get('/web/config')
async def get_web_config(login_user: UserPayload = Depends(UserPayload.get_login_user)):
    """ Get some configuration items required by the front-end, the content is determined by the front-end """
    cached = await get_redis_client_sync().aget(WEB_CONFIG_REDIS_KEY)
    if cached is not None:
        return resp_200(data={'value': cached})
    web_conf = ConfigDao.get_config(ConfigKeyEnum.WEB_CONFIG)
    if not web_conf:
        return resp_200(data='')
    await get_redis_client_sync().aset(WEB_CONFIG_REDIS_KEY, web_conf.value, 600)
    return resp_200(data={'value': web_conf.value})


@router.post('/web/config')
async def update_web_config(request: Request,
                            admin_user: UserPayload = Depends(UserPayload.get_admin_user),
                            value: str = Body(embed=True),
                            version: int = Body(default=0, embed=True)):
    """ Update some configuration items required by the front-end, the content is determined by the front-end.

    C7 乐观锁：version 存在 value JSON 内（不改 config 表结构，避免 alembic 迁移）。
    方案1（version 独立 Body 参数 + 后端管理写入）：
      - 前端传入「调用方以为的当前 version」（save 前由 getCurrentVersion 拉取）
      - 后端读 DB 现有 value JSON 内的 version 比对：
          一致 → 允许更新，新 value JSON 内 version +1 后落库
          不一致 → WebConfigConflictError(10032)，提示刷新
      - 首次写入（DB 无记录）或 value JSON 损坏/无 version 字段 → 视 current_version = 0，
        与传入 version=0 一致则放行（兼容旧数据，version 从 1 起计）。

    value 契约（保持乐观锁不变量完整）：
      - value 必须是合法 JSON 字符串，且顶层为 dict 对象（web_config 语义即 {light, dark, bg, ...}）。
      - 非法 JSON（json.loads 失败）或合法 JSON 但非 dict（数组/字符串/null/数字等）
        → raise SystemConfigInvalidError(10031)，拒绝落库，不破坏乐观锁不变量。
      - 前端调用方（themePersistence.saveThemeDebounced）序列化 window.ThemeStyle，
        必为合法 dict JSON，正常路径不受影响。

    Redis 缓存读路径（get_web_config）返回的 value 已含 version，前端 getCurrentVersion 直接 JSON.parse 取。
    """
    logger.info(f'act=web_config_update user_name={admin_user.user_name} '
                f'ip={get_request_ip(request)} version={version}')

    web_conf = ConfigDao.get_config(ConfigKeyEnum.WEB_CONFIG)

    # 读 DB 现有 version（损坏/无字段/无记录统一兜底为 0）
    current_version = 0
    if web_conf and web_conf.value:
        try:
            existing = json.loads(web_conf.value)
            if isinstance(existing, dict) and isinstance(existing.get('version'), int):
                current_version = existing['version']
        except (json.JSONDecodeError, TypeError):
            # DB 侧损坏 JSON 不阻断乐观锁判定，按 version=0 处理（与无记录同等对待）
            current_version = 0

    # 乐观锁比对：不一致直接拒绝，不 partial 更新，避免并发覆盖
    if version != current_version:
        logger.warning(f'act=web_config_conflict user_name={admin_user.user_name} '
                       f'client_version={version} db_version={current_version}')
        raise WebConfigConflictError().return_resp_instance()

    # value 校验：必须是合法 JSON 且顶层为 dict 对象（web_config 契约）。
    # 非法值直接 reject 10031，不落库，保持乐观锁不变量完整（不写脏数据、不推进 version）。
    try:
        new_value_obj = json.loads(value)
    except (json.JSONDecodeError, TypeError) as e:
        logger.warning('act=web_config_invalid user_name=%s reason=invalid_json value_prefix=%r',
                       admin_user.user_name, value[:80])
        raise SystemConfigInvalidError()
    if not isinstance(new_value_obj, dict):
        logger.warning('act=web_config_invalid user_name=%s reason=non_dict type=%s',
                       admin_user.user_name, type(new_value_obj).__name__)
        raise SystemConfigInvalidError()

    # 把 version +1 写进新 value JSON（合法 dict，必能放下 version 字段）
    new_version = current_version + 1
    new_value_obj['version'] = new_version
    stored_value = json.dumps(new_value_obj, ensure_ascii=False)

    if not web_conf:
        web_conf = Config(key=ConfigKeyEnum.WEB_CONFIG.value, value=stored_value)
    else:
        web_conf.value = stored_value
    ConfigDao.upsert_config(web_conf)
    # Redis 失效失败不阻断响应：DB 已成功写入，缓存靠 TTL 600s 兜底（参照 save_config 的 DB/Redis 异常分类）
    try:
        await get_redis_client_sync().adelete(WEB_CONFIG_REDIS_KEY)
    except Exception as e:
        logger.exception('web_config Redis invalidate failed: %s', e)
    return resp_200(data={'value': web_conf.value, 'version': new_version})


@router.post('/process/{flow_id}')
async def process_flow_old(
        flow_id: UUID,
        inputs: Optional[dict] = None,
        tweaks: Optional[dict] = None,
        history_count: Annotated[int, Body(embed=True)] = 10,
        clear_cache: Annotated[bool, Body(embed=True)] = False,  # noqa: F821
        session_id: Annotated[Union[None, str], Body(embed=True)] = None,  # noqa: F821
        task_service: TaskService = Depends(get_task_service),
        sync: Annotated[bool, Body(embed=True)] = True,
        login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    return await process_flow(flow_id, inputs, tweaks, history_count, clear_cache, session_id,
                              task_service, sync, login_user=login_user)


# For backwards compatibility we will keep the old endpoint
# @router.post('/predict/{flow_id}')
@router.post('/process')
async def process_flow(
        flow_id: Annotated[UUID, Body(embed=True)],
        inputs: Optional[dict] = None,
        tweaks: Optional[dict] = None,
        history_count: Annotated[int, Body(embed=True)] = 10,
        clear_cache: Annotated[bool, Body(embed=True)] = False,  # noqa: F821
        session_id: Annotated[Union[None, str], Body(embed=True)] = None,  # noqa: F821
        task_service: TaskService = Depends(get_task_service),
        sync: Annotated[bool, Body(embed=True)] = True,  # noqa: F821
        sse: Annotated[bool, Body(embed=True)] = False,
        login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """
    Endpoint to process an input with a given flow_id.
    """
    if inputs and isinstance(inputs, dict) and 'id' in inputs:
        inputs.pop('id')
    flow_id = flow_id.hex
    logger.info(
        f'act=api_call sessionid={session_id} flow_id={flow_id} inputs={inputs} tweaks={tweaks}')
    flow = await FlowDao.aget_flow_by_id(flow_id)
    if flow is None or flow.data is None:
        raise NotFoundError()
    start_time = time.time()
    if session_id is None:
        # Generate a session ID
        session_id = get_session_service().generate_key(session_id=session_id,
                                                        data_graph=flow.data)
    try:
        graph_data = flow.data
        if tweaks:
            try:
                graph_data = process_tweaks(graph_data, tweaks)
            except Exception as exc:
                logger.error(f'Error processing tweaks: {exc}')

        # process
        if sync:
            result = await process_graph_cached(graph_data,
                                                inputs,
                                                clear_cache,
                                                session_id,
                                                history_count=history_count,
                                                flow_id=flow_id)
            if isinstance(result, dict) and 'result' in result:
                task_result = result['result']
                session_id = result['session_id']
            elif hasattr(result, 'result') and hasattr(result, 'session_id'):
                task_result = result.result
                session_id = result.session_id
        else:
            logger.warning('This is an experimental feature and may not work as expected.'
                           'Please report any issues to our GitHub repository.')

            task_id, task = await task_service.launch_task(
                process_graph_cached_task if task_service.use_celery else process_graph_cached,
                graph_data,
                inputs,
                clear_cache,
                session_id,
                history_count=history_count,
                flow_id=flow_id)
            if task.status == 'SUCCESS':
                task_result = task.result
                if hasattr(task_result, 'result'):
                    task_result = task_result.result
            else:
                logger.error(f'task_id={task_id} exception task result={task}')

        if isinstance(task_result, str):
            task_result = {'answer': task_result}
        # Judgment traceability
        source_documents = task_result.pop('source_documents', '')
        answer = list(task_result.values())[0]
        extra = {}
        source, result = await judge_source(answer, source_documents, session_id, extra)

        try:
            question = ChatMessage(user_id=login_user.user_id,
                                   is_bot=False,
                                   type='end',
                                   chat_id=session_id,
                                   category='question',
                                   flow_id=flow_id,
                                   message=json.dumps(inputs, ensure_ascii=False))
            message = ChatMessage(user_id=login_user.user_id,
                                  is_bot=True,
                                  chat_id=session_id,
                                  flow_id=flow_id,
                                  type='end',
                                  category='answer',
                                  message=answer,
                                  source=source)
            ChatMessageDao.insert_one(question)
            message = ChatMessageDao.insert_one(message)
            try:
                MessageSessionDao.insert_one(
                    MessageSession(
                        chat_id=session_id,
                        flow_id=flow_id,
                        flow_name=flow.name,
                        flow_type=FlowType.FLOW.value,
                        user_id=login_user.user_id,
                    ))

                # RecordTelemetryJournal
                await telemetry_service.log_event(user_id=login_user.user_id,
                                                  event_type=BaseTelemetryTypeEnum.NEW_MESSAGE_SESSION,
                                                  trace_id=trace_id_var.get(),
                                                  event_data=NewMessageSessionEventData(
                                                      session_id=session_id,
                                                      app_id=flow_id,
                                                      source='api',
                                                      app_name=flow.name,
                                                      app_type=ApplicationTypeEnum.SKILL
                                                  )
                                                  )
            except Exception as e:
                logger.warning(f'insert repeat session error: {e}')

            extra.update({'source': source, 'message_id': message.id})

            if source == 1:
                await process_source_document(source_documents, session_id, message.id, answer)
                extra.update({
                    'source_url':
                        'resouce/{chat_id}/{msg_id}'.format(chat_id=session_id, msg_id=message.id)
                })
            elif source == 4:
                # QA
                extra_qa = json.loads(answer.metadata.get('extra'))
                extra_qa.pop('answer', None)
                extra.update({'doc': [extra_qa]})
            task_result.update(extra)
            task_result.update({'answer': result})
        except Exception as e:
            logger.error(e)

        return resp_200(
            ProcessResponse(
                result=task_result,
                # task=task_response,
                session_id=session_id,
                backend=task_service.backend_name,
            ))

    except Exception as e:
        # Log stack trace
        logger.exception(e)
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        end_time = time.time()
        await telemetry_service.log_event(user_id=login_user.user_id,
                                          event_type=BaseTelemetryTypeEnum.APPLICATION_ALIVE,
                                          trace_id=trace_id_var.get(),
                                          event_data=ApplicationAliveEventData(
                                              app_id=flow_id,
                                              app_name=flow.name,
                                              app_type=ApplicationTypeEnum.SKILL,
                                              chat_id=session_id,
                                              start_time=int(start_time),
                                              end_time=int(end_time)))
        await telemetry_service.log_event(user_id=login_user.user_id,
                                          event_type=BaseTelemetryTypeEnum.APPLICATION_PROCESS,
                                          trace_id=trace_id_var.get(),
                                          event_data=ApplicationProcessEventData(
                                              app_id=flow_id,
                                              app_name=flow.name,
                                              app_type=ApplicationTypeEnum.SKILL,
                                              chat_id=session_id,
                                              start_time=int(start_time),
                                              end_time=int(end_time),
                                              process_time=int((end_time - start_time) * 1000)
                                          ))


async def _upload_file(file: UploadFile, object_name_prefix: str, file_supports: List[str] = None,
                       bucket_name: str = None) \
        -> UploadFileResponse:
    if file.size == 0:
        raise UploadFileEmptyError()
    file_ext = file.filename.split('.')[-1].lower()
    if file_supports and file_ext not in file_supports:
        raise UploadFileExtError()
    object_name = f'{object_name_prefix}/{generate_uuid()}.png'
    file_path = await upload_file_to_minio(file, object_name=object_name, bucket_name=bucket_name)
    if not isinstance(file_path, str):
        file_path = str(file_path)

    return UploadFileResponse(
        file_path=file_path,  # minioAccessible links
        relative_path=object_name,  # miniohitting the nail on the headobject_name
    )


@router.post('/upload/icon')
async def upload_icon(request: Request,
                      login_user: UserPayload = Depends(UserPayload.get_login_user),
                      file: UploadFile = None):
    bucket = bisheng_settings.object_storage.minio.public_bucket
    resp = await _upload_file(file,
                              object_name_prefix='icon',
                              file_supports=['jpeg', 'jpg', 'png'],
                              bucket_name=bucket)
    return resp_200(data=resp)


@router.post('/upload/workflow/{workflow_id}')
async def upload_icon_workflow(request: Request,
                               login_user: UserPayload = Depends(get_user_or_default_operator),
                               share_link: Union['ShareLink', None] = Depends(header_share_token_parser),
                               file: UploadFile = None,
                               workflow_id: str = Path(..., description='workflow id')):
    bucket = bisheng_settings.object_storage.minio.public_bucket
    resp = await _upload_file(file, object_name_prefix=f'workflow/{workflow_id}', bucket_name=bucket)
    return resp_200(data=resp)


@router.post('/upload/{flow_id}')
async def create_upload_file(
        file: UploadFile,
        flow_id: str,
        login_user: UserPayload = Depends(get_user_or_default_operator),
        share_link: Union['ShareLink', None] = Depends(header_share_token_parser)
):
    # Cache file
    try:
        if len(file.filename) > 80:
            file.filename = file.filename[-80:]
        file_path = await save_uploaded_file(file, folder_name=flow_id, file_name=file.filename)
        if not isinstance(file_path, str):
            file_path = str(file_path)
        return resp_200(UploadFileResponse(
            flowId=flow_id,
            file_path=file_path,
        ))
    except Exception as exc:
        logger.error(f'Error saving file: {exc}')
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# get endpoint to return version of bisheng
@router.get('/version')
def get_version():
    from bisheng import __version__
    return resp_200({'version': __version__})
