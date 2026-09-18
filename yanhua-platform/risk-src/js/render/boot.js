/* ==========================================================================
 * boot.js —— 页面启动装配
 *
 * @层          渲染层（render）
 * @技术特征    工程装配，非创新点
 * @说明
 *   必须在本文件之前加载：13 个 core 模块、compat/export-patent.js、render/page-shell.js、
 *   以及本页的 js/pages/sN.js（其中注册了 window.FWXPage）。
 * ========================================================================== */
(function (global) {
  'use strict';
  if (!global.FWShell || !global.FWXPage) {
    throw new Error('[patent-src] 加载顺序错误：需先加载 core/* → compat/export-patent.js → render/page-shell.js → pages/sN.js');
  }
  global.FWShell.boot(global.FWXPage);
})(window);
