#!/usr/bin/env bash
# ==========================================================================
# tools/make-zip.sh —— 把整个工程打包为可直接分发的 ZIP
#
# 用法：bash tools/make-zip.sh  （或 npm run zip）
# 产物：与工程同级的 <工程名>.zip
#
# 排除内容：.git / node_modules / 系统文件 / 既有压缩包 / Python 缓存。
# 打包后自动用 unzip -t 校验归档完整性，并打印文件数与体积。
# ==========================================================================
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
NAME="$(basename "$DIR")"
OUT="$(dirname "$DIR")/$NAME.zip"

echo ""
echo "  打包工程：$NAME"
echo "  源目录　：$DIR"
echo "  目标　　：$OUT"
echo ""

rm -f "$OUT"

cd "$(dirname "$DIR")"
zip -r -q "$OUT" "$NAME" \
  -x "$NAME/.git/*" \
  -x "$NAME/.git" \
  -x "$NAME/node_modules/*" \
  -x "$NAME/**/__pycache__/*" \
  -x "*.DS_Store" \
  -x "$NAME/*.zip"

# 完整性校验
if unzip -t "$OUT" >/dev/null 2>&1; then
  N=$(unzip -l "$OUT" | awk 'END {print $2}')
  SIZE=$(du -h "$OUT" | cut -f1)
  echo "  ────────────────────────────────────────────"
  echo "  ✔ 归档校验通过：$N 个条目，体积 $SIZE"
  echo "  ✔ 解压后可直接用 VS Code 打开（或双击 .code-workspace）"
  echo ""
else
  echo "  ✘ 归档校验失败，请检查磁盘空间与权限" >&2
  exit 1
fi
