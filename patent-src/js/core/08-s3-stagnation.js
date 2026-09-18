/* ==========================================================================
 * 08-s3-stagnation.js —— 【S3】滞留车辆筛选与异常滞留指数
 *
 * @层          数据模型层（core）
 * @技术特征
 *   【特征 S3-2】滞留车辆集合 V_stay(t)：对围栏内每台车辆同时施加两个条件——
 *                ① 停靠时长 stayMin ≥ 装卸容忍时间阈值 tolerance；
 *                ② 瞬时移动速度 spd < 静止阈值 staticSpeed。
 *                同时满足才判定为「滞留」，从而把「正在正常装卸的车辆」与
 *                「长时间停靠且已停止移动的车辆」区分开。
 *   【特征 S3-3】异常滞留指数 I(t)：对滞留车辆分别计算两个归一化权重——
 *                滞留时长权重 wStay = min(1, stayMin / tolerance)；
 *                静止程度权重 wSlow = max(0, 1 − spd / staticSpeed)；
 *                取等权平均得到单车权重 w = 0.5·wStay + 0.5·wSlow；
 *                再对滞留车辆权重求和并归一化：
 *                  I(t) = min(1, (Σw) / 3 × 0.78 + (Σw > 0 ? 0.1 : 0))。
 *                除以 3 是把指数标定到「3 台车滞留即接近报警线」，
 *                常数 0.1 保证「只要出现滞留即不为零」，便于人工识别早期异常。
 *   【特征 S3-4】滞留明细行：每台车辆输出 (车牌, 进入时刻, 围栏内时长, 速度,
 *                滞留权重, 是否滞留, 电子运单, 货物, 驾驶员, 联系方式, 轨迹阶段, 当前坐标)，
 *                使单一指数可下钻到具体车辆与运单。
 * @说明
 *   本模块不再区分「车是否滞留」的真值判断与「滞留程度」的连续量，
 *   而是同时输出二值集合与连续指数：前者用于触发判定（配合 S4），后者用于趋势展示。
 * ========================================================================== */
(function (NS) {
  'use strict';

  var P = NS.P;
  var VEHICLES = NS.VEHICLES;
  var vehPos = NS.vehPos;

  /**
   * 【特征 S3-2 / S3-3 / S3-4】时刻 t 的滞留车辆筛选结果与异常滞留指数。
   * @param {number} t 监测时刻（分钟）
   * @returns {{rows: object[], count: number, index: number}}
   *          rows 全部车辆明细（含未进入围栏车辆）；count 滞留车辆数；index 异常滞留指数 I(t)
   */
  function stagnationAt(t) {
    var rows = [], sumW = 0, stayCount = 0;

    VEHICLES.forEach(function (v) {
      var r = vehPos(v, t);
      if (r.phase === 'before') return;                       // 尚未进入围栏的车辆不参与统计

      var stayMin = r.phase === 'park' ? (r.stayMin || 0) : 0; // 仅停靠阶段累计停留时间
      var inFenceMin = Math.max(0, t - v.inAt);                // 进入围栏至当前的时长

      // 【特征 S3-3】两个归一化权重
      var wStay = Math.min(1, stayMin / P.tolerance);
      var wSlow = Math.max(0, 1 - r.spd / P.staticSpeed);
      var weight = 0.5 * wStay + 0.5 * wSlow;

      // 【特征 S3-2】双条件判定：停留超容忍 且 速度低于静止阈值
      var isStay = stayMin >= P.tolerance && r.spd < P.staticSpeed;
      if (isStay) { stayCount++; sumW += weight; }

      rows.push({
        plate: v.plate, inAt: v.inAt, inFenceMin: inFenceMin, spd: r.spd, stayMin: stayMin,
        weight: weight, stay: isStay, bill: v.bill, goods: v.goods, driver: v.driver,
        tel: v.tel, phase: r.phase, pos: r.pos
      });
    });

    // 【特征 S3-3】异常滞留指数
    var index = Math.min(1, sumW / 3 * 0.78 + (sumW > 0 ? 0.1 : 0));

    return { rows: rows, count: stayCount, index: index };
  }

  NS.__declare('08-s3-stagnation', ['stagnationAt']);
  NS.stagnationAt = stagnationAt;
})(window.FWCore);
