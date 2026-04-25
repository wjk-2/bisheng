import hashlib
import json
import os
from typing import List

# from bisheng.telemetry_search.domain.init_dataset import init_dashboard_datasets  # disabled: .pyc compiled for Python 3.10
from loguru import logger
from sqlmodel import select, update

from bisheng.common.services.config_service import settings
from bisheng.core.cache.redis_manager import get_redis_client
from bisheng.core.database import get_async_db_session, get_database_connection
from bisheng.core.storage.minio.minio_manager import get_minio_storage_sync
from bisheng.database.constants import AdminRole, DefaultRole
from bisheng.database.models.component import Component
from bisheng.database.models.group import Group, DefaultGroup
from bisheng.database.models.role import Role
from bisheng.database.models.role_access import RoleAccess, AccessType, WebMenuResource
from bisheng.database.models.template import Template
from bisheng.tool.domain.models.gpts_tools import GptsTools
from bisheng.tool.domain.models.gpts_tools import GptsToolsType
from bisheng.user.domain.models.user import User
from bisheng.user.domain.models.user_role import UserRoleDao


async def init_default_data():
    """Initialize Database"""
    redis_client = await get_redis_client()
    if await redis_client.asetNx('init_default_data', '1', 300):
        try:
            db_manager = await get_database_connection()
            await db_manager.create_db_and_tables()
            async with get_async_db_session() as session:
                db_role = await session.exec(select(Role).limit(1))
                db_role = db_role.all()
                if not db_role:
                    # Initialize system configuration, Admin has all permissions
                    db_role = Role(id=AdminRole, role_name='System Admin', remark='System highest privileges',
                                   group_id=DefaultGroup)
                    session.add(db_role)
                    db_role_normal = Role(id=DefaultRole, role_name='Regular users', remark='Regular users',
                                          group_id=DefaultGroup)
                    session.add(db_role_normal)
                    # Grant to Normal User View access to the Build, Knowledge, Model menu bar
                    session.add_all([
                        RoleAccess(role_id=DefaultRole, type=AccessType.WEB_MENU.value,
                                   third_id=WebMenuResource.BUILD.value),
                        RoleAccess(role_id=DefaultRole, type=AccessType.WEB_MENU.value,
                                   third_id=WebMenuResource.KNOWLEDGE.value),
                        RoleAccess(role_id=DefaultRole, type=AccessType.WEB_MENU.value,
                                   third_id=WebMenuResource.MODEL.value),
                        RoleAccess(role_id=DefaultRole, type=AccessType.WEB_MENU.value,
                                   third_id=WebMenuResource.BACKEND.value),
                        RoleAccess(role_id=DefaultRole, type=AccessType.WEB_MENU.value,
                                   third_id=WebMenuResource.FRONTEND.value),
                    ])
                    await session.commit()
                # Add Default User Group
                group = await session.exec(select(Group).limit(1))
                group = group.all()
                if not group:
                    group = Group(id=DefaultGroup, group_name='Default user group', create_user=1, update_user=1)
                    session.add(group)
                    await session.commit()
                    await session.refresh(group)

                # ===== 改进后的逻辑 =====
                # 检查 admin 用户是否存在，而不是检查是否有任何用户
                admin_username = settings.admin.get('user_name') if settings.admin else None
                if not admin_username:
                    logger.warning("Admin config exists but username is empty")
                    return

                admin_user = await session.exec(select(User).where(User.user_name == admin_username))
                admin_user = admin_user.first()
                if admin_user:
                    logger.info(f"Admin user '{admin_username}' already exists, skipping creation")
                    return

                # 验证密码配置
                password = settings.admin.get('password')
                if not password:
                    logger.warning("Admin config exists but password is empty")
                    return

                # 检查密码是否需要加密（以 encrypt: 开头）
                if password.startswith('encrypt(') and password.endswith(')'):
                    # 已经是加密格式，直接使用
                    encrypted_password = password[8:-1]
                    try:
                        password = decrypt_token(encrypted_password)
                    except Exception as e:
                        logger.error(f"Failed to decrypt admin password: {e}")
                        return
                    # 加密密码需要解密后做 MD5
                    md5 = hashlib.md5()
                    md5.update(password.encode('utf-8'))
                    password = md5.hexdigest()
                else:
                    # 明文密码，直接做 MD5
                    md5 = hashlib.md5()
                    md5.update(password.encode('utf-8'))
                    password = md5.hexdigest()

                # 获取用户名
                admin_username = settings.admin.get('user_name')

                # 创建 admin 用户（不硬编码 user_id，让数据库自增）
                user = User(
                    user_name=admin_username,
                    password=password,
                )
                session.add(user)
                await session.commit()
                await session.refresh(user)
                await UserRoleDao.set_admin_user(user.user_id)
                logger.info(f"Admin user '{admin_username}' created with user_id={user.user_id}")

                component_db = await session.exec(select(Component).limit(1))
                component_db = component_db.all()
                if not component_db:
                    db_components = []
                    json_items = json.loads(read_from_conf('../database/data/component.json'))
                    for item in json_items:
                        for k, v in item.items():
                            db_component = Component(name=k, user_id=1, user_name='admin', data=v)
                            db_components.append(db_component)
                    session.add_all(db_components)
                    await session.commit()

                # Initialize Preset Skill Template
                templates = await session.exec(select(Template).limit(1))
                templates = templates.all()
                if not templates:
                    json_items = json.loads(read_from_conf('../database/data/template.json'))
                    for item in json_items:
                        session.add(Template(**item))
                    await session.commit()

                # Initialize preset tools list
                preset_tools = await session.exec(select(GptsTools).limit(1))
                preset_tools = preset_tools.all()
                if not preset_tools:
                    preset_tools = []
                    json_items = json.loads(read_from_conf('../database/data/t_gpts_tools.json'))
                    for item in json_items:
                        preset_tool = GptsTools(**item)
                        preset_tools.append(preset_tool)
                    session.add_all(preset_tools)
                    await session.commit()
                # Initialize Preset Tool Categories
                preset_tools_type = await session.exec(select(GptsToolsType).limit(1))
                preset_tools_type = preset_tools_type.all()
                if not preset_tools_type:
                    preset_tools_type = []
                    json_items = json.loads(read_from_conf('../database/data/t_gpts_tools_type.json'))
                    for item in json_items:
                        preset_tool_type = GptsToolsType(**item)
                        preset_tools_type.append(preset_tool_type)
                    session.add_all(preset_tools_type)
                    await session.commit()
                    # Set the category the preset tool belongs to, needs to be consistent with the preset data, soidIs Fixed
                    for i in range(1, 7):
                        await session.exec(update(GptsTools).where(GptsTools.id == i).values(type=i))
                    # Tools under the category of Sky Eye Examination
                    tyc_types: List[int] = list(range(7, 18))
                    await session.exec(
                        update(GptsTools).where(GptsTools.id.in_(tyc_types)).values(type=7))
                    # Instruments belonging to the financial category
                    jr_types: List[int] = list(range(18, 28))
                    await session.exec(
                        update(GptsTools).where(GptsTools.id.in_(jr_types)).values(type=8))
                    await session.commit()

            # Initialize Databaseconfig
            await settings.init_config()

            # init dashboard data (disabled: telemetry_search module unavailable)
            # await init_dashboard_datasets()
        except Exception as exc:
            # if the exception involves tables already existing
            # we can ignore it
            if 'already exists' not in str(exc):
                logger.exception(f'Error creating DB and tables: {exc}')
                raise RuntimeError('Error creating DB and tables') from exc
        finally:
            try:
                await redis_client.adelete('init_default_data')
            except Exception as e:
                logger.warning(f"Failed to release init lock: {e}")


def read_from_conf(file_path: str) -> str:
    # Get current path
    current_path = os.path.dirname(os.path.abspath(__file__))

    file_path = os.path.join(current_path, file_path)

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    return content


def upload_preset_minio_file():
    """ Upload preset file tominio, To work with workflow templates """
    minio_client = get_minio_storage_sync()
    # Upload it 「Multi-Assistant Parallelism+Serial Report Generation」 Required for workflow templatesdocxDoc.
    template_data = read_from_conf('../database/data/0254d1808a5247d2a3ee0d0011819acb.docx')
    minio_client.put_object_sync(bucket_name=minio_client.bucket,
                                 object_name='workflow/report/0254d1808a5247d2a3ee0d0011819acb.docx',
                                 file=template_data,
                                 content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
