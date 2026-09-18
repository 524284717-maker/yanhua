/* ==========================================================================
 * 00-namespace.js —— 模块命名空间与注册约定
 *
 * @层          数据模型层（core）
 * @技术特征    工程实现约定，非创新点
 * @说明
 *   全部算法模块统一挂载到全局命名空间 window.FWCore（Firework Monitoring Core）。
 *   每个模块以「一个文件 + 一个立即执行函数」的形式注册：
 *     (function (NS) { 'use strict'; ... NS.xxx = xxx; })(window.FWCore);
 *   模块内不产生任何全局变量，模块之间只通过 NS 上的显式成员通信，
 *   从而保证算法单元可独立阅读、独立评审、独立替换。
 *
 *   加载顺序由 pages/*.html 的 <script> 标签顺序决定，见 README「三、加载顺序」。
 * ========================================================================== */
(function (global) {
  'use strict';

  var NS = global.FWCore = global.FWCore || {};

  /**
   * 源码包元信息。
   * 以双下划线开头，与数据模型导出项区分，不参与兼容层的接口契约。
   */
  NS.__meta = {
    name: '烟花爆竹全链条数字化预警监管平台 · 风险智能识别源码包',
    version: '1.0.0',
    build: '2026-09-18',
    modules: [
      '01-params', '02-geometry', '03-geo-anchor', '04-op-dataset', '05-vehicles',
      '06-s1-saturation', '07-s2-geofence', '08-s3-stagnation', '09-s4-dual-risk',
      '10-s5-confidence', '11-timeline', '12-aggregate', '13-map-layers'
    ]
  };

  /**
   * 模块自检：注册时若命名冲突则直接报错，避免静默覆盖导致算法被替换而无人察觉。
   * @param {string} module 模块名（文件名去掉序号与扩展名）
   * @param {string[]} keys 该模块将要注册的成员名
   */
  NS.__declare = function (module, keys) {
    for (var i = 0; i < keys.length; i++) {
      if (Object.prototype.hasOwnProperty.call(NS, keys[i])) {
        throw new Error('[FWCore] 成员名冲突：' + keys[i] + '（模块 ' + module + '）');
      }
    }
  };
})(window);
