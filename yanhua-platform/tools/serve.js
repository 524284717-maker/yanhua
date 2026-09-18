#!/usr/bin/env node
/**
 * tools/serve.js —— 零依赖本地静态预览服务
 *
 * 为什么需要它：本项目页面为完全离线的单文件 HTML，双击即可打开；
 * 但浏览器对 file:// 协议有若干限制（部分 API 不可用、缓存行为异常），
 * 且大屏页面在 http:// 下调试更接近真实部署环境，因此提供一个不依赖任何
 * npm 包的静态服务器。
 *
 * 用法：
 *   node tools/serve.js              # 默认 127.0.0.1:5180
 *   PORT=8080 node tools/serve.js    # 指定端口
 *
 * 特性：
 *   - 完整 MIME 表（含 .js 的 charset=utf-8，避免中文脚本乱码）
 *   - 中文路径 / 百分号编码正确解码
 *   - 目录请求自动回落到 index.html
 *   - 阻断 ../ 路径穿越，仅允许访问工程目录内文件
 *   - 启动时打印系统入口地址清单
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 5180);
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.zip': 'application/zip'
};

/** 需要展示的入口清单（启动时打印，方便直接点开） */
const ENTRIES = [
  ['工程门户（总入口）', '/index.html'],
  ['监管服务平台 · 态势总览', '/platform/index.html'],
  ['风险识别系统 · 功能总览', '/risk/patent.html'],
  ['风险识别系统 · 源码版总览', '/risk-src/pages/index.html']
];

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }, headers || {}));
  res.end(body);
}

/** 把 URL 路径解析为工程内的真实文件路径；越界返回 null */
function resolveTarget(urlPath) {
  let rel;
  try {
    rel = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch (e) {
    return { bad: 'URI 解码失败' };
  }
  if (rel === '/' || rel === '') rel = '/index.html';

  const abs = path.resolve(ROOT, '.' + path.posix.normalize(rel));
  // 路径穿越防护：解析结果必须仍在工程目录内
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) {
    return { bad: '路径越界' };
  }
  return { abs: abs, rel: rel };
}

const server = http.createServer(function (req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, '仅支持 GET / HEAD', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  const t = resolveTarget(req.url || '/');
  if (t.bad) {
    console.log('  403  ' + req.url + '  (' + t.bad + ')');
    return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  let abs = t.abs;

  let stat;
  try {
    stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      abs = path.join(abs, 'index.html');
      stat = fs.statSync(abs);
    }
  } catch (e) {
    console.log('  404  ' + req.url);
    return send(res, 404,
      '<!DOCTYPE html><meta charset="utf-8"><title>404</title>' +
      '<style>body{font:14px/1.8 -apple-system,"PingFang SC",sans-serif;padding:48px;color:#333}' +
      'code{background:#f4f4f6;padding:2px 6px;border-radius:4px}</style>' +
      '<h2>404 · 未找到</h2><p><code>' + String(req.url).replace(/[<>&]/g, '') + '</code></p>' +
      '<p>可访问的入口：</p><ul>' +
      ENTRIES.map(function (e) { return '<li><a href="' + e[1] + '">' + e[0] + '</a></li>'; }).join('') +
      '</ul>',
      { 'Content-Type': 'text/html; charset=utf-8' });
  }

  const ext = path.extname(abs).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  console.log('  200  ' + req.url + '  ' + (stat.size / 1024).toFixed(1) + ' KB');

  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  if (req.method === 'HEAD') return res.end();

  const stream = fs.createReadStream(abs);
  stream.on('error', function () { res.destroy(); });
  stream.pipe(res);
});

server.on('error', function (err) {
  if (err && err.code === 'EADDRINUSE') {
    console.error('\n  端口 ' + PORT + ' 已被占用。换一个端口重试：\n');
    console.error('    PORT=5181 node tools/serve.js\n');
  } else {
    console.error('\n  服务启动失败：' + (err && err.message) + '\n');
  }
  process.exit(1);
});

console.log('');
console.log('  正在启动本地预览服务 …');
console.log('  工程根目录：' + ROOT);
console.log('');

server.listen(PORT, HOST, function () {
  console.log('  已就绪 → http://' + HOST + ':' + PORT + '/');
  console.log('');
  ENTRIES.forEach(function (e) {
    console.log('    · ' + e[0]);
    console.log('      http://' + HOST + ':' + PORT + e[1]);
  });
  console.log('');
  console.log('  按 Ctrl+C 停止服务');
  console.log('');
});

process.on('SIGINT', function () {
  console.log('\n  已停止本地预览服务。\n');
  server.close(function () { process.exit(0); });
});
