#!/usr/bin/env node
/**
 * tools/check-links.js —— 引用完整性校验
 *
 * 校验三类本地引用是否都能解析到真实文件：
 *   1. <script src="..."> ； 2. <link href="..."> / <a href="..."> ；
 *   3. 内联样式或脚本里的 url(...) 资源（如监控页的抓拍图片）。
 * 外链（http/https//）、data:、mailto:、锚点、javascript: 一律跳过。
 *
 * 同时检查「路径越界」：任何引用都不应解析到工程目录之外 —— 这是把原本平铺的
 * 目录重组为分层工程时最容易出的错。
 *
 * 输出格式：相对路径(行,列): error: 说明
 *
 * 用法：node tools/check-links.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__']);

/**
 * 声明式跳过清单：这些目录不是「成品页面」，其内部引用不参与解析校验。
 * 每一条都写明原因，避免变成掩盖问题的黑名单。
 */
const SKIP_TREES = [
  {
    dir: 'risk-src/tools/legacy',
    why: '等价性自检的自动生成基准页，仅供冻结时刻比对，导航链接不参与运行'
  },
  {
    dir: 'risk-src/tools/pages-src',
    why: '页面组装模板，含待替换占位符（__TITLE__、geo-data.js 标记块等），非成品页面'
  }
];

/** 允许的外链前缀 */
const EXTERNAL = /^(https?:|\/\/|data:|mailto:|tel:|javascript:|blob:|about:|#|%23)/i;

const problems = [];
let totalRefs = 0;

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function walk(dir, filter, out) {
  out = out || [];
  let items;
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  for (const it of items) {
    if (SKIP_DIRS.has(it.name)) continue;
    const full = path.join(dir, it.name);
    const relFull = rel(full);
    if (it.isDirectory() && SKIP_TREES.some(function (s) { return s.dir === relFull; })) continue;
    if (it.isDirectory()) walk(full, filter, out);
    else if (it.isFile() && filter(it.name)) out.push(full);
  }
  return out;
}

/** 由字符偏移量求出行、列（1 基） */
function locate(src, index) {
  const before = src.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

const PATTERNS = [
  {
    // src="..." / href="..." （同时兼容单引号）
    re: /\b(?:src|href)\s*=\s*["']([^"']*)["']/gi,
    kind: '资源引用',
    group: 1
  },
  {
    // url(...) —— 涵盖内联样式与脚本里的图片路径
    re: /\burl\(\s*["']?([^"')\s]+)["']?\s*\)/gi,
    kind: '样式资源',
    group: 1
  }
];

function checkFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const name = rel(file);
  const dir = path.dirname(file);
  const seen = Object.create(null);
  let count = 0;

  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(src)) !== null) {
      let target = (m[p.group] || '').trim();
      if (!target) continue;
      if (EXTERNAL.test(target)) continue;

      const pos = locate(src, m.index);
      const key = target + '@' + pos.line;
      if (seen[key]) continue;
      seen[key] = true;
      totalRefs++;
      count++;

      // 去掉查询串与锚点，再做路径判断
      const clean = target.split('#')[0].split('?')[0];
      if (!clean) continue;

      const abs = path.resolve(dir, clean);

      if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) {
        problems.push({
          file: name, line: pos.line, column: pos.column,
          message: p.kind + '越界（指向工程目录之外）：' + target
        });
        continue;
      }

      // 目录型引用（以 / 结尾）允许存在；其余必须命中真实文件
      if (!clean.endsWith('/') && !fs.existsSync(abs)) {
        problems.push({
          file: name, line: pos.line, column: pos.column,
          message: p.kind + '不存在：' + target
        });
      }    }
  }
  return { count: count, name: name };
}

/* ---------------- 主流程 ---------------- */

console.log('');
console.log('  引用完整性校验');
console.log('  工程根目录：' + ROOT);
console.log('');

const files = walk(ROOT, function (n) { return /\.html?$/i.test(n); }).sort();

files.forEach(function (f) {
  const r = checkFile(f);
  console.log('    ' + (r.count > 0 ? '✔' : '·') + ' ' + r.name + '  (' + r.count + ' 处本地引用)');
});

console.log('');
console.log('  ── 声明式跳过（非成品页面，其内部引用不参与校验）──');
SKIP_TREES.forEach(function (s) {
  console.log('    · ' + s.dir);
  console.log('      原因：' + s.why);
});

console.log('');
console.log('  ────────────────────────────────────────────');
console.log('  检查页面 ' + files.length + ' 个，解析本地引用 ' + totalRefs + ' 处');

if (problems.length === 0) {
  console.log('  结果：PASS · 全部引用均可解析，且无路径越界');
  console.log('');
  process.exit(0);
}

console.log('  结果：FAIL · 发现 ' + problems.length + ' 处问题');
console.log('');
problems.forEach(function (p) {
  console.log('  ' + p.file + '(' + p.line + ',' + p.column + '): error: ' + p.message);
});
console.log('');
process.exit(1);
