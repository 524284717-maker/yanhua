/* ==========================================================================
 * 02-geometry.js —— 平面几何基础函数
 *
 * @层          数据模型层（core）
 * @技术特征    工程工具函数，非创新点
 * @说明
 *   经纬度在本系统中按平面坐标近似处理（县域尺度下误差可忽略），
 *   仅提供 3 个基础运算：
 *     pathFor       由起点、终点与弯曲系数生成两段折线（用于车辆进出场路径）
 *     pointOnCurve  在折线上按比例 k ∈ [0,1] 取点（用于车辆位置插值）
 *     distDeg       两点间平面距离（度）
 * ========================================================================== */
(function (NS) {
  'use strict';

  /**
   * 生成「起点 → 控制点 → 终点」两段折线路径。
   * @param {number[]} a 起点 [lon, lat]
   * @param {number[]} b 终点 [lon, lat]
   * @param {number} bulge 弯曲系数，正负决定弯向
   * @returns {number[][]} 3 个顶点的折线
   */
  function pathFor(a, b, bulge) {
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    var dx = b[0] - a[0], dy = b[1] - a[1];
    return [[a[0], a[1]], [mx - dy * bulge, my + dx * bulge], [b[0], b[1]]];
  }

  /**
   * 在折线上按行程比例取点。
   * @param {number[][]} coords 折线顶点
   * @param {number} k 行程比例 ∈ [0,1]
   * @returns {number[]} 坐标 [lon, lat]
   */
  function pointOnCurve(coords, k) {
    if (k <= 0.5) {
      var u = k / 0.5;
      return [coords[0][0] + (coords[1][0] - coords[0][0]) * u, coords[0][1] + (coords[1][1] - coords[0][1]) * u];
    }
    var v = (k - 0.5) / 0.5;
    return [coords[1][0] + (coords[2][0] - coords[1][0]) * v, coords[1][1] + (coords[2][1] - coords[1][1]) * v];
  }

  /**
   * 两点间平面距离（单位：度）。
   * @param {number[]} a
   * @param {number[]} b
   * @returns {number}
   */
  function distDeg(a, b) {
    return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
  }

  NS.__declare('02-geometry', ['pathFor', 'pointOnCurve', 'distDeg']);
  NS.pathFor = pathFor;
  NS.pointOnCurve = pointOnCurve;
  NS.distDeg = distDeg;
})(window.FWCore);
