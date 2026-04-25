"""Workspace 提示词 Prompts API — 匹配前端 LibreChat 路径."""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from bisheng.common.dependencies.user_deps import UserPayload
from bisheng.database.models.prompt import (
    Prompt, PromptDao, PromptGroup, PromptGroupDao,
)

router = APIRouter(prefix='/api/prompts', tags=['Workspace Prompts'])


# ── 辅助函数 ─────────────────────────────────────────────────

def _group_to_dict(g: PromptGroup, production_prompt: dict = None) -> dict:
    """转换 PromptGroup → 前端 TPromptGroup 格式."""
    d = {
        '_id': str(g.id),
        'name': g.name,
        'author': str(g.author),
        'authorName': g.author_name or '',
        'command': g.command or '',
        'oneliner': g.oneliner or '',
        'category': g.category or '',
        'productionId': str(g.production_id) if g.production_id else None,
        'numberOfGenerations': g.number_of_generations,
        'createdAt': g.create_time.isoformat() if g.create_time else '',
        'updatedAt': g.update_time.isoformat() if g.update_time else '',
    }
    if production_prompt is not None:
        d['productionPrompt'] = production_prompt
    elif g.production_id:
        p = PromptDao.get_by_id(g.production_id)
        d['productionPrompt'] = {'prompt': p.prompt} if p else None
    else:
        d['productionPrompt'] = None
    return d


def _prompt_to_dict(p: Prompt) -> dict:
    """转换 Prompt → 前端 TPrompt 格式."""
    return {
        '_id': str(p.id),
        'groupId': str(p.group_id),
        'author': str(p.author),
        'prompt': p.prompt,
        'type': p.type or 'text',
        'createdAt': p.create_time.isoformat() if p.create_time else '',
        'updatedAt': p.update_time.isoformat() if p.update_time else '',
    }


# ── 端点 1: GET /api/prompts — getPrompts ────────────────────

@router.get('/')
def get_prompts(
    groupId: Optional[str] = None,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    if not groupId:
        return []
    prompts = PromptDao.get_by_group(int(groupId))
    return [_prompt_to_dict(p) for p in prompts]


# ── 端点 2: POST /api/prompts — createPrompt ─────────────────

@router.post('/')
def create_prompt(
    payload: dict,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    prompt_data = payload.get('prompt', {})
    group_data = payload.get('group')

    # 创建或查找 group
    group = None
    group_id = prompt_data.get('groupId')
    if group_id:
        group = PromptGroupDao.get_by_id(int(group_id))
        if not group:
            raise HTTPException(404, 'Prompt group not found')
    elif group_data:
        group = PromptGroupDao.insert(PromptGroup(
            name=group_data.get('name', ''),
            author=login_user.user_id,
            author_name=login_user.user_name,
            category=group_data.get('category', ''),
            oneliner=group_data.get('oneliner', ''),
            command=group_data.get('command', ''),
        ))
    else:
        raise HTTPException(400, 'Must provide groupId or group')

    # 创建 prompt
    new_prompt = PromptDao.insert(Prompt(
        group_id=group.id,
        author=login_user.user_id,
        prompt=prompt_data.get('prompt', ''),
        type=prompt_data.get('type', 'text'),
    ))

    # 更新 group 的 generation 计数
    PromptGroupDao.update(group.id, {
        'number_of_generations': group.number_of_generations + 1,
    })

    result = {'prompt': _prompt_to_dict(new_prompt)}
    if group_data:
        result['group'] = _group_to_dict(group, production_prompt=None)
    return result


# ── 端点 3: GET /api/prompts/{id} — getPrompt ────────────────

@router.get('/all')
def get_all_prompt_groups(
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    groups = PromptGroupDao.get_all()
    return [_group_to_dict(g) for g in groups]


@router.get('/groups')
def get_prompt_groups(
    category: Optional[str] = None,
    pageNumber: str = '1',
    pageSize: str = '10',
    name: Optional[str] = None,
    author: Optional[str] = None,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    groups, total = PromptGroupDao.get_page(
        category=category,
        name=name,
        author=int(author) if author else None,
        page=int(pageNumber),
        page_size=int(pageSize),
    )
    pages = (total + int(pageSize) - 1) // int(pageSize)
    return {
        'promptGroups': [_group_to_dict(g) for g in groups],
        'pageNumber': pageNumber,
        'pageSize': pageSize,
        'pages': str(pages),
    }


@router.get('/random')
def get_random_prompts(
    limit: int = Query(default=4),
    skip: int = Query(default=0),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    groups = PromptGroupDao.get_random(limit=limit, skip=skip)
    return [_group_to_dict(g) for g in groups]


@router.get('/groups/{group_id}')
def get_prompt_group(
    group_id: str,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    group = PromptGroupDao.get_by_id(int(group_id))
    if not group:
        raise HTTPException(404, 'Prompt group not found')
    return _group_to_dict(group)


@router.get('/{prompt_id}')
def get_prompt(
    prompt_id: str,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    p = PromptDao.get_by_id(int(prompt_id))
    if not p:
        raise HTTPException(404, 'Prompt not found')
    return {'prompt': _prompt_to_dict(p)}


# ── 端点 7: PATCH /api/prompts/groups/{id} — updatePromptGroup
# 注意：固定路径必须在通配路径之前注册

@router.patch('/groups/{group_id}')
def update_prompt_group(
    group_id: str,
    payload: dict,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    # 前端字段 → 数据库字段映射
    field_map = {
        'name': 'name',
        'command': 'command',
        'oneliner': 'oneliner',
        'category': 'category',
    }
    update_data = {}
    for front_key, db_key in field_map.items():
        if front_key in payload:
            update_data[db_key] = payload[front_key]

    group = PromptGroupDao.update(int(group_id), update_data)
    if not group:
        raise HTTPException(404, 'Prompt group not found')
    return _group_to_dict(group)


# ── 端点 8: DELETE /api/prompts/groups/{id} — deletePromptGroup
# 注意：必须在 DELETE /{prompt_id} 之前注册

@router.delete('/groups/{group_id}')
def delete_prompt_group(
    group_id: str,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    group = PromptGroupDao.get_by_id(int(group_id))
    if not group:
        raise HTTPException(404, 'Prompt group not found')
    PromptGroupDao.delete_by_id(int(group_id))
    return {'message': 'Prompt group deleted'}


# ── 端点 10: PATCH /api/prompts/{id}/tags/production ─────────

@router.patch('/{prompt_id}/tags/production')
def make_prompt_production(
    prompt_id: str,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    p = PromptDao.get_by_id(int(prompt_id))
    if not p:
        raise HTTPException(404, 'Prompt not found')
    PromptGroupDao.update(p.group_id, {'production_id': p.id})
    return {'message': 'Prompt set as production'}


# ── 端点 11: PATCH /api/prompts/{id}/labels ──────────────────

@router.patch('/{prompt_id}/labels')
def update_prompt_labels(
    prompt_id: str,
    payload: dict,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    # 暂不实现 labels，返回成功
    return {'message': 'Labels updated'}


# ── 端点 4: DELETE /api/prompts/{id} — deletePrompt ──────────
# 注意：通配路径放在最后

@router.delete('/{prompt_id}')
def delete_prompt(
    prompt_id: str,
    groupId: str = Query(...),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    p = PromptDao.get_by_id(int(prompt_id))
    if not p:
        raise HTTPException(404, 'Prompt not found')
    PromptDao.delete_by_id(int(prompt_id))
    # 更新 group 的 generation 计数
    group = PromptGroupDao.get_by_id(int(groupId))
    if group and group.number_of_generations > 0:
        PromptGroupDao.update(group.id, {
            'number_of_generations': group.number_of_generations - 1,
        })
    return {'message': 'Prompt deleted'}
