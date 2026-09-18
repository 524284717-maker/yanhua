#!/usr/bin/env bash
# ==========================================================================
# dom-diff.sh —— 界面等价性自检
#
# 目的：验证「模块化源码包生成的页面」与「线上旧版单文件页面」在**同一冻结监测时刻**
#       渲染出的界面完全一致。比对两项内容：
#         ① DOM：document.body.innerText（去空白归一化后整体比对）
#         ② ECharts：全部图表实例 getOption() 序列化结果（覆盖图表结构、数值、颜色、阈值线）
#
# 依赖：agent-browser CLI（需在 PATH 中）
# 用法：bash tools/dom-diff.sh
#
# 说明：旧版基准页由 tools/build-legacy.py 生成（仅注入时刻冻结钩子，其余与线上逐字节一致），
#       新版页面由 tools/build-pages.py 生成，两者使用语义完全相同的 __setT(t) 钩子，
#       因此本比对只反映「数据模型 + 渲染层」是否等价，不掺入时钟差异。
# ==========================================================================
set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
OLD="$DIR/legacy"
NEW="$DIR/../pages"

# 覆盖全部 5 个功能阶段 + 三个判定时刻（32.0 / 40.6 / 41.0）前后
TS=(3 8.5 12 16 20 25 29 31.5 32 33.5 35 36.5 37.5 39 40.6 41 42 44 47 50 53 56 59)

PROBE='
(function () {
  window.__setT(__T__);
  var txt = document.body.innerText.replace(/\s+/g, " ").trim();
  var h1 = 5381, i;
  for (i = 0; i < txt.length; i++) { h1 = ((h1 << 5) + h1 + txt.charCodeAt(i)) >>> 0; }
  var parts = [];
  document.querySelectorAll("[_echarts_instance_]").forEach(function (el) {
    var inst = window.echarts && window.echarts.getInstanceByDom(el);
    if (!inst) return;
    try { parts.push(el.id + "=" + JSON.stringify(inst.getOption())); }
    catch (e) { parts.push(el.id + "=ERR"); }
  });
  var opt = parts.join(";");
  var h2 = 5381;
  for (i = 0; i < opt.length; i++) { h2 = ((h2 << 5) + h2 + opt.charCodeAt(i)) >>> 0; }
  window.__TXT = txt;
  window.__OPT = opt;
  return "dom:" + h1 + "/" + txt.length + " opt:" + h2 + "/" + opt.length;
})()
'

if ! command -v agent-browser >/dev/null 2>&1; then
  echo "！未找到 agent-browser，请先将其加入 PATH。"
  exit 2
fi

# 打开一个页面并依次冻结到全部比对时刻，逐行输出结果（失败时输出 ERROR 行，便于定位）
probe_page() {
  agent-browser open "$1" >/dev/null 2>&1
  agent-browser wait 1500 >/dev/null 2>&1
  local t raw line
  for t in "${TS[@]}"; do
    raw="$(agent-browser eval "${PROBE/__T__/$t}" 2>&1 | tr -d '\r')"
    line="$(printf '%s\n' "$raw" | grep -E '^"dom:' | tail -1)"
    if [ -n "$line" ]; then
      line="${line%\"}"; line="${line#\"}"
      echo "$line"
    else
      echo "ERROR: $(printf '%s\n' "$raw" | grep -v '^[[:space:]]*$' | tail -1 | cut -c1-120)"
    fi
  done
}

FAIL=0
TOTAL=0

for n in 1 2 3 4 5; do
  echo "── S${n} ─────────────────────────────────────────"
  # macOS 自带 bash 3.2 无 mapfile，改用数组 + while read 读入
  OLDV=(); NEWV=()
  while IFS= read -r line; do OLDV+=("$line"); done < <(probe_page "file://$OLD/patent-s${n}.html")
  while IFS= read -r line; do NEWV+=("$line"); done < <(probe_page "file://$NEW/s${n}.html")
  i=0
  for t in "${TS[@]}"; do
    TOTAL=$((TOTAL + 1))
    if [ "${OLDV[$i]}" = "${NEWV[$i]}" ]; then
      echo "  ✓ T+${t}′  ${OLDV[$i]}"
    else
      FAIL=$((FAIL + 1))
      echo "  ✗ T+${t}′  旧版 ${OLDV[$i]}"
      echo "             新版 ${NEWV[$i]}"
    fi
    i=$((i + 1))
  done
done

agent-browser close >/dev/null 2>&1

echo "──────────────────────────────────────────────────"
if [ "$FAIL" -eq 0 ]; then
  echo "PASS · ${TOTAL} 个冻结时刻的界面（DOM 文本 + 全部 ECharts 配置）新旧完全一致"
  exit 0
else
  echo "FAIL · ${TOTAL} 个冻结时刻中发现 ${FAIL} 处界面差异"
  echo "      诊断：在页面上执行 window.__TXT / window.__OPT 可取出完整文本与图表配置进行逐字比对"
  exit 1
fi
