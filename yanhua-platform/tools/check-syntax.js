#!/usr/bin/env node
/**
 * tools/check-syntax.js —— 语法闸门（只编译，不执行）
 *
 * 检查对象：
 *   1. 所有 .html 中的「内联 <script>」块（本项目页面逻辑几乎全部内联）；
 *   2. risk-src/js/ 下的全部模块化脚本。
 *
 * 实现方式：用 Node 内置 vm.Script 编译源码。编译不会执行任何语句，
 * 因此页面的初始化逻辑、定时器、网络请求都不会被触发 —— 只做纯语法校验。
 *
 * 输出格式：相对路径(行,列): error: 说明
 * VS Code 任务面板会将其解析为可点击的诊断（见 .vscode/tasks.json）。
 *
 * 用法：node tools/check-syntax.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__']);

const problems = [];
let checked = 0;

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

/** 递归收集文件 */
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
    if (it.isDirectory()) walk(full, filter, out);
    else if (it.isFile() && filter(it.name)) out.push(full);
  }
  return out;
}

/**
 * 编译一段源码。失败时把 vm 的 SyntaxError 归一化成
 * { line, column, message }。lineOffset 用于把「片段内的行号」
 * 还原成「文件内的行号」。
 */
function compile(code, displayName, lineOffset) {
  try {
    // eslint-disable-next-line no-new
    new vm.Script(code, { filename: displayName, lineOffset: lineOffset || 0 });
    return null;
  } catch (err) {
    const stack = String(err.stack || '');
    const lines = stack.split('\n');

    let line = lineOffset ? lineOffset + 1 : 1;
    let column = 1;

    // vm 的报错栈形如：  <filename>:<line> 换行 源码 换行 空格+^
    for (let i = 0; i < lines.length; i++) {
      const m = /:(\d+)\s*$/.exec(lines[i].trim());
      if (m && lines[i].indexOf(displayName) !== -1) {
        line = Number(m[1]);
        const caret = lines[i + 2] || '';
        const idx = caret.indexOf('^');
        if (idx >= 0) column = idx + 1;
        break;
      }
    }
    return { line: line, column: column, message: err.message };
  }
}

/* ---------------- ① HTML 内联脚本 ---------------- */

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

function checkHtml(file) {
  const src = fs.readFileSync(file, 'utf8');
  const name = rel(file);
  let m;
  let found = 0;

  SCRIPT_RE.lastIndex = 0;
  while ((m = SCRIPT_RE.exec(src)) !== null) {
    const attrs = m[1] || '';
    const body = m[2];

    // 外链脚本、非 JS 类型（如 application/json、text/template）一律跳过
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const typeMatch = /\btype\s*=\s*["']([^"']*)["']/i.exec(attrs);
    if (typeMatch) {
      const t = typeMatch[1].toLowerCase();
      if (t.indexOf('javascript') === -1 && t.indexOf('module') === -1) continue;
    }
    if (!body.trim()) continue;

    // 片段起始行号（1 基）：body 的第一个字符紧跟在 <script ...> 的 '>' 之后，
    // 若 '>' 后是换行，则 body 的首行是「该标签行的剩余空白」，因此
    // vm 的 lineOffset 应取 bodyStartLine - 1，才能让片段第 1 行对应到文件同一行。
    const startLine = src.slice(0, m.index).split('\n').length;
    const bodyStartLine = startLine + (m[0].slice(0, m[0].indexOf('>') + 1).split('\n').length - 1);

    found++;
    checked++;
    const bad = compile(body, name, bodyStartLine - 1);
    if (bad) {
      problems.push({
        file: name,
        line: bad.line,
        column: bad.column,
        message: '内联脚本语法错误（第 ' + found + ' 个 script 块）：' + bad.message
      });
    }
  }
  return found;
}

/* ---------------- ② 独立 .js 文件 ---------------- */

function checkJs(file) {
  const name = rel(file);
  const code = fs.readFileSync(file, 'utf8');
  checked++;
  const bad = compile(code, name, 0);
  if (bad) {
    problems.push({
      file: name,
      line: bad.line,
      column: bad.column,
      message: '模块语法错误：' + bad.message
    });
    return false;
  }
  return true;
}

/* ---------------- 主流程 ---------------- */

console.log('');
console.log('  语法闸门 · 只编译不执行');
console.log('  工程根目录：' + ROOT);
console.log('');

const htmlFiles = walk(ROOT, function (n) { return /\.html?$/i.test(n); }).sort();
const jsFiles = walk(path.join(ROOT, 'risk-src', 'js'), function (n) { return /\.js$/i.test(n); }).sort();
const toolJs = walk(path.join(ROOT, 'tools'), function (n) { return /\.js$/i.test(n); }).sort();

console.log('  ── HTML 内联脚本 ──');
let scriptBlocks = 0;
htmlFiles.forEach(function (f) {
  const n = checkHtml(f);
  scriptBlocks += n;
  console.log('    ' + (n > 0 ? '✔' : '·') + ' ' + rel(f) + '  (' + n + ' 个 script 块)');
});

console.log('');
console.log('  ── 独立 JS 模块 ──');
jsFiles.concat(toolJs).forEach(function (f) {
  const ok = checkJs(f);
  console.log('    ' + (ok ? '✔' : '✘') + ' ' + rel(f));
});

/* ---------------- 汇总 ---------------- */

console.log('');
console.log('  ────────────────────────────────────────────');
console.log('  检查文件 ' + htmlFiles.length + ' 个 HTML（' + scriptBlocks + ' 个内联脚本块）');
console.log('           ' + (jsFiles.length + toolJs.length) + ' 个独立 .js 模块');
console.log('  合计校验 ' + checked + ' 段源码');

if (problems.length === 0) {
  console.log('  结果：PASS · 全部源码语法正确');
  console.log('');
  process.exit(0);
}

console.log('  结果：FAIL · 发现 ' + problems.length + ' 处语法错误');
console.log('');
problems.forEach(function (p) {
  console.log('  ' + p.file + '(' + p.line + ',' + p.column + '): error: ' + p.message);
});
console.log('');
process.exit(1);
