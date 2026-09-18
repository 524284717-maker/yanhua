#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build-legacy.py —— 生成等价性自检用的「旧版单文件」对照基准。

把工作区根目录下线上运行的 patent-s1..s5.html 复制到 tools/legacy/，并只做两类最小改动：

  1. 资源路径：geo-data.js / patent-model.js 改为 ../../../ 相对路径（指向工作区根目录，不改变加载内容）；
  2. 测试钩子：注入 window.__setT(t) / __setPaused(v)，并让主循环尊重 paused 标志，
     使页面可被冻结在任意监测时刻重绘 —— 这是界面等价性比对可复现的前提。
     钩子与 patent-src/js/render/page-shell.js 中的实现语义完全一致。

改动均带出现次数断言；除上述两类改动外，文件内容与线上版本逐字节相同，
因此可安全地作为「旧版基准」使用。线上文件不会被修改。
"""

import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent       # 工作区根目录
SRC = ROOT
OUT = pathlib.Path(__file__).resolve().parent / 'legacy'

PAGES = [1, 2, 3, 4, 5]


def rep(text, old, new, expect, tag):
    got = text.count(old)
    if got != expect:
        raise SystemExit('[build-legacy] %s：期望 %d 处，实际 %d 处\n%r' % (tag, expect, got, old[:80]))
    return text.replace(old, new)


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    for n in PAGES:
        p = SRC / ('patent-s%d.html' % n)
        s = p.read_text(encoding='utf-8')

        s = rep(s, 'src="geo-data.js"', 'src="../../../geo-data.js"', 1, 's%d 地图数据路径' % n)
        s = rep(s, 'src="patent-model.js"', 'src="../../../patent-model.js"', 1, 's%d 数据模型路径' % n)

        # 声明 paused 标志
        s = rep(s, '  var lastTs = 0;',
                '  var lastTs = 0;\n  var paused = false;   /* [自检钩子] */',
                1, 's%d paused 声明' % n)

        # 注入时刻冻结钩子（紧随 PAGE_NO 声明之后）
        s = rep(s, '  var PAGE_NO = %d;' % n,
                '  var PAGE_NO = %d;\n'
                '  /* [自检钩子] 由 tools/build-legacy.py 注入，仅用于等价性比对，不影响原有行为 */\n'
                '  window.__setT = function (v) { T = v; lastTs = 0; paused = true; paint(); };\n'
                '  window.__setPaused = function (v) { paused = !!v; lastTs = 0; };\n'
                '  window.__getT = function () { return T; };' % n,
                1, 's%d 钩子注入' % n)

        # 主循环尊重 paused
        s = rep(s,
                '''  function tick(ts) {
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.12, (ts - lastTs) / 1000);
    lastTs = ts;
    T += dt * 1.15 * 3;                   // 推进速率：约 3 倍速，60 分钟约 17 秒一轮
    if (T > M.TL.end) { T = 0; onLoop(); }
    paint();
    requestAnimationFrame(tick);
  }''',
                '''  function tick(ts) {
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.12, (ts - lastTs) / 1000);
    lastTs = ts;
    if (!paused) {
      T += dt * 1.15 * 3;                   // 推进速率：约 3 倍速，60 分钟约 17 秒一轮
      if (T > M.TL.end) { T = 0; onLoop(); }
      paint();
    }
    requestAnimationFrame(tick);
  }''',
                1, 's%d 主循环暂停支持' % n)

        out = OUT / ('patent-s%d.html' % n)
        out.write_text(s, encoding='utf-8')
        print('written tools/legacy/patent-s%d.html  %d bytes' % (n, len(s.encode())))

    print('\n提示：界面等价性比对请执行  bash tools/dom-diff.sh')


if __name__ == '__main__':
    main()
