"""Workspace 对话书签 ConversationTag API — 匹配前端 LibreChat 路径."""

from fastapi import APIRouter, Depends, HTTPException

from bisheng.common.dependencies.user_deps import UserPayload
from bisheng.database.models.conversation_tag import (
    ConversationTag, ConversationTagDao, ConversationTagLinkDao,
)

router = APIRouter(prefix='/api/tags', tags=['Workspace Bookmarks'])


# ── 辅助函数 ─────────────────────────────────────────────────

def _tag_to_dict(t: ConversationTag) -> dict:
    """转换 ConversationTag → 前端 TConversationTag 格式."""
    return {
        '_id': str(t.id),
        'user': str(t.user_id),
        'tag': t.tag,
        'description': t.description or '',
        'position': t.position,
        'count': t.count,
        'createdAt': t.create_time.isoformat() if t.create_time else '',
        'updatedAt': t.update_time.isoformat() if t.update_time else '',
    }


# ── 端点 1: GET /api/tags — getConversationTags ──────────────

@router.get('/')
def get_conversation_tags(
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    tags = ConversationTagDao.get_by_user(login_user.user_id)
    return [_tag_to_dict(t) for t in tags]


# ── 端点 2: POST /api/tags — createConversationTag ───────────

@router.post('/')
def create_conversation_tag(
    payload: dict,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    tag_name = payload.get('tag', '').strip()
    if not tag_name:
        raise HTTPException(400, 'Tag name is required')

    existing = ConversationTagDao.get_by_user_and_tag(login_user.user_id, tag_name)
    if existing:
        raise HTTPException(409, 'Tag already exists')

    record = ConversationTagDao.insert(ConversationTag(
        user_id=login_user.user_id,
        tag=tag_name,
        description=payload.get('description', ''),
        position=payload.get('position', 0),
    ))

    # 如果同时带了 conversationId，自动关联
    conversation_id = payload.get('conversationId')
    if conversation_id and payload.get('addToConversation'):
        ConversationTagLinkDao.set_tags_for_conversation(
            conversation_id, login_user.user_id,
            [tag_name] + ConversationTagLinkDao.get_tags_for_conversation(
                conversation_id, login_user.user_id),
        )
        # 重新获取更新后的 count
        record = ConversationTagDao.get_by_user_and_tag(login_user.user_id, tag_name)

    return _tag_to_dict(record)


# ── 端点 5: PUT /api/tags/convo/{conversationId} — addTagToConversation
# 注意：必须在 /{tag} 之前注册，否则 "convo" 会被当作 tag 参数

@router.put('/convo/{conversation_id}')
def add_tag_to_conversation(
    conversation_id: str,
    payload: dict,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    tags = payload.get('tags', [])
    result = ConversationTagLinkDao.set_tags_for_conversation(
        conversation_id, login_user.user_id, tags,
    )
    return result


# ── 端点 6: POST /api/tags/rebuild — rebuildConversationTags ─

@router.post('/rebuild')
def rebuild_conversation_tags(
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    ConversationTagLinkDao.rebuild_counts(login_user.user_id)
    tags = ConversationTagDao.get_by_user(login_user.user_id)
    return [_tag_to_dict(t) for t in tags]


# ── 端点 3: PUT /api/tags/{tag} — updateConversationTag ──────
# 注意：通配路径必须放在固定路径之后

@router.put('/{tag}')
def update_conversation_tag(
    tag: str,
    payload: dict,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    update_data = {}
    if 'tag' in payload:
        update_data['tag'] = payload['tag']
    if 'description' in payload:
        update_data['description'] = payload['description']
    if 'position' in payload:
        update_data['position'] = payload['position']

    record = ConversationTagDao.update_tag(login_user.user_id, tag, update_data)
    if not record:
        raise HTTPException(404, 'Tag not found')
    return _tag_to_dict(record)


# ── 端点 4: DELETE /api/tags/{tag} — deleteConversationTag ───

@router.delete('/{tag}')
def delete_conversation_tag(
    tag: str,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    existing = ConversationTagDao.get_by_user_and_tag(login_user.user_id, tag)
    if not existing:
        raise HTTPException(404, 'Tag not found')
    ConversationTagDao.delete_tag(login_user.user_id, tag)
    return _tag_to_dict(existing)
