/* ==========================================================================
 * export-patent.js —— 接口兼容层
 *
 * @层          兼容层（compat）
 * @技术特征    工程兼容约定，非创新点
 * @说明
 *   把数据模型层（window.FWCore）整体导出为 window.PATENT，
 *   使原有页面脚本中的 `var M = window.PATENT;` 无需任何修改即可运行。
 *
 *   —— 该文件是「模块化源码」与「既有页面」之间唯一的耦合点：
 *      等价性自检（tools/equivalence-test.html）正是通过**不加载本文件**，
 *      直接比对 window.FWCore 与旧版 window.PATENT 来验证数值等价。
 * ========================================================================== */
(function (global) {
  'use strict';
  global.PATENT = global.FWCore;
})(window);
