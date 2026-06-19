#!/usr/bin/env bash
# ============================================================
# deploy-platform.sh — 湖州师范 node3 Platform 前端部署脚本
#
# 适用环境：湖州师范 E-Agent（172.20.20.35），通过 node4-gpu 跳板
# 警告：此脚本硬编码了湖州师范的服务器地址和路径，
#       不适用于其他环境（如 eagent200 等），切勿复用
#
# 用法：bash deploy-platform.sh [--skip-build]
#   --skip-build  跳过构建步骤，直接用现有 build/ 产物部署
#
# 部署策略：原子回退部署
#   1. 本地构建并整目录打包
#   2. scp 上传到 node3:/tmp/
#   3. 远端解压到 stage 目录 -> 校验 index.html + assets 非空
#      校验失败则清理 stage 退出，live 目录全程未被触碰，天然安全
#   4. 校验通过：mv live -> backup；mv stage -> live（同分区原子替换）
#   5. backup 保留最近 3 份，更老的自动轮转删除
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$SCRIPT_DIR/src/frontend/platform"
BUILD_DIR="$PLATFORM_DIR/build"
REMOTE_HOST="root@172.20.20.35"
REMOTE_PATH="/usr/share/nginx/html/platform"
STAGE_PARENT="/usr/share/nginx/html/.stage"
BACKUP_PARENT="/usr/share/nginx/html/.backup/platform"
PROXY_JUMP="node4-gpu"
TMP_PKG="/tmp/platform_build_$$.tar.gz"
REMOTE_TMP="/tmp/platform_build_$$.tar.gz"

SKIP_BUILD=false
for arg in "$@"; do
  [[ "$arg" == "--skip-build" ]] && SKIP_BUILD=true
done

echo "=== [1/5] 构建 Platform 前端 ==="
if [ "$SKIP_BUILD" = true ]; then
  echo "跳过构建，使用现有 build/ 产物"
else
  cd "$PLATFORM_DIR"
  npm run build
  cd "$SCRIPT_DIR"
fi

echo ""
echo "=== [2/5] 打包构建产物（整目录打包）==="
if [ ! -f "$BUILD_DIR/index.html" ]; then
  echo "错误：构建产物缺失 $BUILD_DIR/index.html，请确认构建成功或去掉 --skip-build" >&2
  exit 1
fi
# 整目录打包：-C 切到 build 目录，打包其中的所有内容（. 表示当前目录）
tar czf "$TMP_PKG" -C "$BUILD_DIR" .
echo "打包完成：$(du -sh "$TMP_PKG" | cut -f1)"

echo ""
echo "=== [3/5] 上传到 node3 ==="
scp -o ProxyJump="$PROXY_JUMP" "$TMP_PKG" "$REMOTE_HOST:$REMOTE_TMP"
rm -f "$TMP_PKG"

echo ""
echo "=== [4/5] 远端原子部署（stage -> 校验 -> mv live/backup）==="
# 远端执行逻辑通过 heredoc 传递
# 转义策略：
#   - heredoc 使用未加引号的 EOF，本地变量会被先展开（REMOTE_TMP/REMOTE_PATH 等替换进去）
#   - 远端 shell 需要保留的变量和特殊符号用反斜杠转义：\$stage \$backup \$REMOTE_TMP \$(date ...)
#   - 进程号 \$\$ 让 trap 里清的是远端 stage 自己，不与本地混淆
ssh -o ProxyJump="$PROXY_JUMP" "$REMOTE_HOST" bash <<EOF
set -euo pipefail

stage="$STAGE_PARENT/platform_\$\$"
backup="$BACKUP_PARENT/\$(date +%Y%m%d_%H%M%S)"
live="$REMOTE_PATH"

# 退出时无论成功失败都清理 stage 目录和上传的临时包
trap 'rm -rf "\$stage" "$REMOTE_TMP"' EXIT

# 1. 解压到 stage（live 目录尚未触碰）
rm -rf "\$stage"
mkdir -p "\$stage"
tar xzf "$REMOTE_TMP" -C "\$stage"

# 2. 校验产物完整性（失败直接退出，live 全程安全）
if [ ! -f "\$stage/index.html" ]; then
  echo "错误：stage 缺失 index.html，部署中止，live 未被触碰" >&2
  exit 1
fi
if [ ! -d "\$stage/assets" ] || [ -z "\$(ls -A "\$stage/assets" 2>/dev/null)" ]; then
  echo "错误：stage/assets 为空或不存在，部署中止，live 未被触碰" >&2
  exit 1
fi

# 3. 备份旧 live（若存在且非空）
if [ -d "\$live" ] && [ -n "\$(ls -A "\$live" 2>/dev/null)" ]; then
  mkdir -p "\$(dirname "\$backup")"
  mv "\$live" "\$backup"
  echo "已备份旧 live -> \$backup"
fi

# 4. 原子替换：stage -> live（同分区 /usr/share/nginx/html 内 mv 为 rename，原子生效）
mv "\$stage" "\$live"
echo "已部署新 live -> \$live"

# 5. 轮转备份：只保留最近 3 份
backup_dir="\$(dirname "\$backup")"
# ls -1dt 按时间倒序列出各时间戳目录；tail -n +4 取第 4 条起即更老的；xargs -r rm -rf 删除
ls -1dt "\$backup_dir"/*/ 2>/dev/null | tail -n +4 | xargs -r rm -rf
echo "备份轮转完成（保留最近 3 份）"
EOF

echo ""
echo "=== [5/5] 验证部署结果 ==="
ssh -o ProxyJump="$PROXY_JUMP" "$REMOTE_HOST" bash <<EOF
echo "目录结构："
ls -la "$REMOTE_PATH/"
echo ""
echo "最新 JS 文件（应为今天）："
ls -lt "$REMOTE_PATH/assets/js/"*.js 2>/dev/null | head -3
EOF

echo ""
echo "=== 部署完成 ==="
