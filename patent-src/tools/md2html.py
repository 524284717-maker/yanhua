#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""md2html.py —— 把《技术特征对照表.md》转换为可读 HTML（浅色文档版式，便于打印与随交底书提交）。

支持的 Markdown 子集（本表用到的全部语法）：
  # ~ ###      标题
  | … | … |    表格（第二行 --- 为分隔行）
  > …          引用块
  - / 1.       列表
  ---          分隔线
  **粗体**  `行内代码`
"""

import pathlib
import re
import html

OUT = pathlib.Path(__file__).resolve().parent
SRC = OUT.parent / '技术特征对照表.md'
DST = OUT.parent / '技术特征对照表.html'

CSS = """
  * { box-sizing: border-box; }
  body { margin: 0; padding: 34px 46px 70px; background: #fff; color: #1f2d3d;
         font: 14px/1.85 -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
  .doc { max-width: 1180px; margin: 0 auto; }
  h1 { font-size: 25px; margin: 0 0 6px; padding-bottom: 12px;
       border-bottom: 2px solid #1a73e8; letter-spacing: .3px; }
  h2 { font-size: 18px; margin: 38px 0 12px; padding: 7px 0 7px 11px;
       border-left: 4px solid #1a73e8; background: #f2f7ff; }
  h3 { font-size: 15.5px; margin: 26px 0 10px; color: #10365f; }
  h3::before { content: "▍"; color: #1a73e8; margin-right: 5px; }
  p  { margin: 9px 0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0 18px; font-size: 12.5px; }
  th, td { border: 1px solid #d7e0ea; padding: 7px 9px; text-align: left; vertical-align: top; }
  th { background: #eef4fc; font-weight: 600; color: #10365f; }
  tbody tr:nth-child(even) { background: #fafcff; }
  blockquote { margin: 12px 0; padding: 10px 15px; background: #fff8e6;
               border-left: 4px solid #f0b400; color: #6b5300; font-size: 13px; }
  blockquote p { margin: 4px 0; }
  ul, ol { margin: 8px 0 8px 4px; padding-left: 22px; }
  li { margin: 4px 0; }
  hr { border: 0; border-top: 1px dashed #d7e0ea; margin: 28px 0; }
  code { background: #eef2f7; padding: 1px 5px; border-radius: 3px;
         font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace; color: #a3306b; }
  strong { color: #10365f; }
  .foot { margin-top: 40px; padding-top: 14px; border-top: 1px solid #e2e8f0;
          color: #7b8a9c; font-size: 12px; }
"""


def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'`(.+?)`', r'<code>\1</code>', s)
    return s


def convert(md):
    lines = md.split('\n')
    out, i = [], 0
    n = len(lines)

    while i < n:
        ln = lines[i]

        # 空行
        if not ln.strip():
            i += 1
            continue

        # 分隔线
        if re.match(r'^-{3,}$', ln.strip()):
            out.append('<hr/>')
            i += 1
            continue

        # 标题
        m = re.match(r'^(#{1,4})\s+(.*)$', ln)
        if m:
            lv = len(m.group(1))
            out.append('<h%d>%s</h%d>' % (lv, inline(m.group(2)), lv))
            i += 1
            continue

        # 表格
        if ln.lstrip().startswith('|') and i + 1 < n and re.match(r'^\s*\|[\s:|-]+\|\s*$', lines[i + 1]):
            head = [c.strip() for c in ln.strip().strip('|').split('|')]
            out.append('<table><thead><tr>' + ''.join('<th>%s</th>' % inline(c) for c in head) + '</tr></thead><tbody>')
            i += 2
            while i < n and lines[i].lstrip().startswith('|'):
                cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
                out.append('<tr>' + ''.join('<td>%s</td>' % inline(c) for c in cells) + '</tr>')
                i += 1
            out.append('</tbody></table>')
            continue

        # 引用
        if ln.startswith('>'):
            buf = []
            while i < n and lines[i].startswith('>'):
                buf.append(lines[i].lstrip('>').strip())
                i += 1
            out.append('<blockquote>' + ''.join('<p>%s</p>' % inline(b) for b in buf if b) + '</blockquote>')
            continue

        # 列表
        m = re.match(r'^\s*([-*]|\d+\.)\s+(.*)$', ln)
        if m:
            ordered = m.group(1).endswith('.')
            tag = 'ol' if ordered else 'ul'
            items = []
            while i < n:
                mm = re.match(r'^\s*([-*]|\d+\.)\s+(.*)$', lines[i])
                if not mm:
                    break
                items.append(inline(mm.group(2)))
                i += 1
            out.append('<%s>%s</%s>' % (tag, ''.join('<li>%s</li>' % x for x in items), tag))
            continue

        # 段落（行尾两个空格 → 硬换行）
        buf = []
        while i < n and lines[i].strip() and not re.match(r'^(#{1,4}\s|\s*[|>]|\s*([-*]|\d+\.)\s|-{3,}$)', lines[i]):
            buf.append(lines[i].strip())
            i += 1
        if buf:
            out.append('<p>' + '<br/>'.join(inline(b) for b in buf) + '</p>')
        else:
            out.append('<p>' + inline(ln.strip()) + '</p>')
            i += 1

    return '\n'.join(out)


def main():
    md = SRC.read_text(encoding='utf-8')
    body = convert(md)
    doc = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>技术特征对照表 · 烟花爆竹全链条数字化预警监管平台</title>
<style>{CSS}</style>
</head>
<body>
<div class="doc">
{body}
<div class="foot">本页由 <code>tools/md2html.py</code> 从 <code>技术特征对照表.md</code> 自动生成；
数值与行号均由源码包实测，等价性结论见 <code>tools/equivalence-test.html</code> 与 <code>tools/dom-diff.sh</code>。</div>
</div>
</body>
</html>
"""
    DST.write_text(doc, encoding='utf-8')
    print('written %s  %d bytes' % (DST.name, len(doc.encode())))


if __name__ == '__main__':
    main()
