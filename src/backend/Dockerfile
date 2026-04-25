# ============================================================================
# 后端镜像构建文件
#
# 重要说明：
# - 基础镜像 eagent/backend-base:v8 已包含 /app/bisheng/ 目录
# - 必须显式 COPY 到 /app/bisheng/ 才能覆盖基础镜像中的代码
# - 不要使用 COPY ./ ./ 这种模糊写法，会导致代码无法覆盖！
#
# 修复记录:
#   2026-03-02: 修复 COPY 路径问题，确保代码修复生效
# ============================================================================

FROM eagent/backend-base:v8

WORKDIR /app

# ✅ 显式指定目标路径，确保覆盖基础镜像中的目录
# 注意：COPY ./ ./ 会创建 /app/backend/bisheng/ 而不是覆盖 /app/bisheng/
COPY bisheng/ /app/bisheng/
COPY bisheng_langchain/ /app/bisheng_langchain/

# 复制配置文件到 /app 根目录
COPY pyproject.toml uv.lock alembic.ini entrypoint.sh ./

# 生成并安装依赖
RUN uv pip compile pyproject.toml --upgrade --output-file requirements.txt && \
    uv pip install -r requirements.txt --system --no-cache-dir && \
    uv cache clean && \
    rm -f requirements.txt

# patch langchain-openai lib. remove this when langchain-openai support reasoning_content
RUN patch -p1 < /app/bisheng/patches/langchain_openai.patch /usr/local/lib/python3.10/site-packages/langchain_openai/chat_models/base.py

CMD ["sh entrypoint.sh"]
