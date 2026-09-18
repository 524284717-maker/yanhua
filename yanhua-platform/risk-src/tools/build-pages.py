#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build-pages.py —— 由 tools/pages-src/ 与 css/ 组装 pages/ 与 js/pages/。

本脚本是页面的**唯一组装入口**：
  - 输入：tools/pages-src/*.body.html（页面正文）、*.frag.js（页面渲染脚本）、
          tools/pages-src/index.overview.html（总览页模板）、css/platform.css
  - 输出：pages/index.html、pages/s1..s5.html、js/pages/s1..s5.js

设计约定（勿改）：
  1. 所有文本替换都先断言出现次数，次数不符即报错退出，杜绝静默替换失败；
  2. 页面加载顺序集中在本文件 CORE_MODULES 中定义，与 README「三、加载顺序」一致；
  3. 页面之间不共享可变状态，全部数据来自 js/core/ 的数据模型层。
"""

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent          # patent-src/
SRC = ROOT / 'tools' / 'pages-src'
PAGES = ROOT / 'pages'
JSPAGES = ROOT / 'js' / 'pages'

TITLE = '烟花爆竹全链条数字化预警监管平台'

STEPS = [
    (1, '库存饱和度计算', '扫码出入库数据 + 设计容量 → 当前时刻库存饱和度',
     '实时获取目标仓储的扫码出入库数据，并结合目标仓储的设计容量，计算当前时刻的库存饱和度'),
    (2, '电子围栏与车辆轨迹', '以仓储为中心构建地理电子围栏，实时获取围栏内车辆定位轨迹',
     '以目标仓储为中心构建地理电子围栏，并实时获取进入地理电子围栏内的烟花爆竹运输车辆的定位轨迹'),
    (3, '滞留车辆筛选与滞留指数', '筛选「速度低于静止阈值 且 停留超过装卸容忍时间」车辆，计算异常滞留指数',
     '实时获取车辆在地理电子围栏内的停留时间与移动速度，筛选出移动速度低于静止阈值且停留时间超过装卸容忍时间阈值的滞留车辆集合，并计算当前时刻围栏内车辆异常滞留指数'),
    (4, '双风险判定', '饱和度与滞留指数双超阈 → 隐蔽囤货风险；饱和度下降但无驶离轨迹 → 账面造假风险',
     '若当前时刻的库存饱和度大于满载阈值，且围栏车辆异常滞留指数大于滞留报警阈值，则判定存在隐蔽囤货风险；若当前时刻的库存饱和度在预设时间段内发生下降，但围栏内未监测到运输车辆驶离轨迹，则判定存在账面造假风险'),
    (5, '置信度校验与管控预警', '多源数据一致性校验通过后确认风险，生成管控预警并在政务云 GIS 显示仓储及车辆坐标',
     '若存在隐蔽囤货风险或账面造假风险任意一项时，进行风险置信度校验，校验通过后确认风险成立，生成管控预警信息，并在政务云平台的 GIS 地图上显示目标仓储及对应的烟花爆竹运输车辆坐标'),
]

NAV_SHORT = {1: '库存饱和度', 2: '电子围栏', 3: '滞留指数', 4: '双风险判定', 5: '管控预警'}

# ============================ 流程图标（内联 SVG，线性科技风格）============================
ICONS = {
    1: '<path d="M6 42V21L24 8l18 13v21"/>'
       '<path d="M3 42h42"/>'
       '<path d="M16 34a8 8 0 0 1 16 0"/>'
       '<path d="M24 34l5.2-5.2"/>'
       '<circle class="fill" cx="24" cy="34" r="1.4"/>',
    2: '<circle cx="24" cy="24" r="17" stroke-dasharray="5 3.6"/>'
       '<path d="M11.5 31.5l6.5-8.5 5.5 4.5 8-11"/>'
       '<circle class="fill" cx="11.5" cy="31.5" r="1.9"/>'
       '<circle class="fill" cx="31.5" cy="16.5" r="1.9"/>',
    3: '<path d="M5 33V20h16v13"/>'
       '<path d="M21 24.5h6.5L33 30.5V33"/>'
       '<path d="M2.5 33h37"/>'
       '<circle cx="9.5" cy="36" r="3"/>'
       '<circle cx="29.5" cy="36" r="3"/>'
       '<circle cx="36.5" cy="12" r="7.5"/>'
       '<path d="M36.5 7.8V12l4.6 2.9"/>',
    4: '<path d="M24 6.5v6.5"/>'
       '<path d="M9 13h30"/>'
       '<path d="M24 13v27"/>'
       '<path d="M16.5 40h15"/>'
       '<path d="M10.5 13L6.5 23"/><path d="M10.5 13l4 10"/>'
       '<path d="M6.5 23a4 4 0 0 0 8 0"/>'
       '<path d="M37.5 13l-4 10"/><path d="M37.5 13l4 10"/>'
       '<path d="M33.5 23a4 4 0 0 0 8 0"/>',
    5: '<circle cx="24" cy="6" r="2"/>'
       '<path d="M24 8v2.5"/>'
       '<path d="M24 10.5a11.5 11.5 0 0 1 11.5 11.5v8L39 35.5H9l3.5-5.5v-8A11.5 11.5 0 0 1 24 10.5z"/>'
       '<path d="M19.5 38a5 5 0 0 0 9 0"/>',
}

# ============================ 数据模型层加载顺序（唯一真源）============================
CORE_MODULES = [
    '00-namespace', '01-params', '02-geometry', '03-geo-anchor', '04-op-dataset', '05-vehicles',
    '06-s1-saturation', '07-s2-geofence', '08-s3-stagnation', '09-s4-dual-risk', '10-s5-confidence',
    '11-timeline', '12-aggregate', '13-map-layers',
]


def script_block(page_no=None):
    """生成页面的 <script> 加载序列。

    page_no 为 None 时生成「功能总览页」的序列：只加载数据模型层与兼容层，
    不加载渲染框架层（总览页无监测时钟，只需读取 DERIVED 的三个判定时刻）。
    """
    out = ['<script src="../../shared/geo-data.js"></script>']
    for m in CORE_MODULES:
        out.append('<script src="../js/core/%s.js"></script>' % m)
    out.append('<script src="../js/compat/export-patent.js"></script>')
    if page_no is not None:
        out.append('<script src="../js/render/page-shell.js"></script>')
        out.append('<script src="../js/pages/s%d.js"></script>' % page_no)
        out.append('<script src="../js/render/boot.js"></script>')
    return '\n'.join(out)


def rep(text, old, new, expect, tag):
    """断言式替换：出现次数不符即报错。"""
    got = text.count(old)
    if got != expect:
        raise SystemExit('[build-pages] %s：期望 %d 处，实际 %d 处 → %r' % (tag, expect, got, old[:60]))
    return text.replace(old, new)


def head(no, name, desc):
    nav = '\n'.join(
        '      <a href="s%d.html" data-step="%d"><b>S%d</b>%s</a>' % (n, n, n, NAV_SHORT[n])
        for n in range(1, 6)
    )
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>S{no} {name} · {TITLE}</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
<link rel="stylesheet" href="../css/platform.css" />
</head>
<body>
<div class="screen">
  <header>
    <div style="flex-shrink:0;">
      <h1>{TITLE}</h1>
      <div class="sub"><b>S{no} {name}</b> · {desc}</div>
    </div>
    <nav class="step-nav">
      <a class="home" href="index.html">方案总览</a>
{nav}
    </nav>
    <div class="ctrl">
      <span class="tag-step" id="stepTag">S{no} / S5</span>
      <span class="tag-time" id="flowTick">T+00.0′</span>
      <button class="btn" id="btnReset">重置</button>
    </div>
  </header>
"""


def tail(no):
    prev_a = ('<a href="s%d.html" data-step="%d">← 上一流程 S%d</a>' % (no - 1, no - 1, no - 1)) if no > 1 else '<a class="off">← 上一流程</a>'
    next_a = ('<a href="s%d.html" data-step="%d">下一流程 S%d →</a>' % (no + 1, no + 1, no + 1)) if no < 5 else '<a href="index.html">返回方案总览 →</a>'
    return f"""
  <footer class="pager">
    {prev_a}
    <span class="mid">S{no} / S5 · {STEPS[no-1][1]} —— 进页自 T+0 起按功能时序自动推进，各指标随监测时刻实时刷新</span>
    {next_a}
  </footer>
</div>

{script_block(no)}
</body>
</html>
"""


CARD = """    <a class="flow-card" href="s__N__.html">
      <span class="no">S__N__</span>
      <h4>__NAME__</h4>
      <div class="ic-wrap"><span class="ic-ring"><svg class="ic" viewBox="0 0 48 48" aria-hidden="true">__ICON__</svg></span></div>
      <div class="d">__DESC__</div>
      <div class="claim"><b>功能说明：</b>__CLAIM__</div>
      <div class="go">进入流程 →</div>
    </a>"""


# ============================ 页面渲染脚本包装 ============================
PAGE_JS_HEADER = """/* ==========================================================================
 * s{no}.js —— 【S{no}】{name} · 页面渲染实现
 *
 * @层          页面层（pages）
 * @技术特征
 *   【特征 S6-4】本页面不直接计算任何指标，全部数值来自 renderPage(t, st) 传入的
 *                状态快照 st（由 page-shell 每帧调用一次 stateAt(t) 得到），
 *                因此页面之间、页面与数据模型之间不会出现数值不一致。
 * @说明
 *   由 tools/build-pages.py 从 tools/pages-src/s{no}.frag.js 自动包装生成，请勿直接修改本文件。
 * ========================================================================== */
(function (global) {{
  'use strict';
  var M = global.PATENT;

{frag}
  global.FWXPage = {{
    no: {no},
    initPage: initPage,
    relayout: relayout,
    renderPage: renderPage
  }};
}})(window);
"""


def build_page_js(no, name):
    frag = (SRC / ('s%d.frag.js' % no)).read_text(encoding='utf-8')
    js = PAGE_JS_HEADER.format(no=no, name=name, frag=frag)
    (JSPAGES / ('s%d.js' % no)).write_text(js, encoding='utf-8')
    return js


def main():
    PAGES.mkdir(exist_ok=True)
    JSPAGES.mkdir(parents=True, exist_ok=True)

    # ---------- 总览页 ----------
    ov = (SRC / 'index.overview.html').read_text(encoding='utf-8')
    ov = rep(ov, '<style>__CSS__</style>', '<link rel="stylesheet" href="../css/platform.css" />', 1, '总览页样式外链')
    ov = rep(ov, '__TITLE__', TITLE, 2, '总览页标题')
    cards = '\n'.join(
        CARD.replace('__N__', str(n)).replace('__NAME__', name)
            .replace('__ICON__', ICONS[n]).replace('__DESC__', desc).replace('__CLAIM__', claim)
        for n, name, desc, claim in STEPS
    )
    ov = rep(ov, '__CARDS__', cards, 1, '总览页卡片')
    ov = rep(ov, 'href="patent-s1.html"', 'href="s1.html"', 2, '总览页入口链接')
    ov = rep(ov,
             '<script src="geo-data.js"></script>\n<script src="patent-model.js"></script>',
             script_block(None), 1, '总览页脚本')
    (PAGES / 'index.html').write_text(ov, encoding='utf-8')
    print('written pages/index.html  %d bytes' % len(ov.encode()))

    # ---------- 5 个功能页 ----------
    for no, name, desc, claim in STEPS:
        body = (SRC / ('s%d.body.html' % no)).read_text(encoding='utf-8')
        html = head(no, name, desc) + body + tail(no)
        (PAGES / ('s%d.html' % no)).write_text(html, encoding='utf-8')
        js = build_page_js(no, name)
        print('written pages/s%d.html  %d bytes   js/pages/s%d.js  %d bytes'
              % (no, len(html.encode()), no, len(js.encode())))

    # ---------- 语法闸门提示 ----------
    print('\n提示：请对 js/ 下所有脚本执行 node --check，并对 pages/ 执行浏览器回归。')


if __name__ == '__main__':
    main()
