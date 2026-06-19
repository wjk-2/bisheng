#!/usr/bin/env bash
# build-images.sh — 固化 eagent/backend、eagent/frontend 本地构建。仅在 aliyun-agent 执行。
# 不推 registry，不改镜像名，不动 compose。
set -euo pipefail

VERSION="${VERSION:-v2.3.0}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
WITH_BASE="${1:-}"

if [ "$WITH_BASE" = "--with-base" ]; then
  echo "==> 构建 eagent/backend-base:v8（基础层，依赖大改时才重建）"
  docker build -t eagent/backend-base:v8 -f "${ROOT}/src/backend/base.Dockerfile" "${ROOT}/src/backend/"
fi

echo "==> 构建 eagent/backend:${VERSION}（FROM eagent/backend-base:v8）"
docker build -t "eagent/backend:${VERSION}" -t "eagent/backend:latest" \
  -f "${ROOT}/src/backend/Dockerfile" "${ROOT}/src/backend/"

echo "==> 构建 eagent/frontend:${VERSION}"
docker build -t "eagent/frontend:${VERSION}" -t "eagent/frontend:latest" \
  -f "${ROOT}/src/frontend/Dockerfile" "${ROOT}/src/frontend/"

echo "==> 完成，当前 eagent 镜像："
docker images --filter=reference='eagent/*' --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'
