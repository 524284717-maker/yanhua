/* ==========================================================================
 * 09-s4-dual-risk.js —— 【S4】双风险判定
 *
 * @层          数据模型层（core）
 * @技术特征
 *   【特征 S4-1】判定式 A（隐蔽囤货风险 Risk_Hidden）：
 *                  S(t) ≥ 满载阈值  ∧  I(t) ≥ 滞留报警阈值
 *                同时成立即判定存在隐蔽囤货风险。
 *                其物理含义：库存已接近或超过设计容量，而围栏内又有车辆长时间停滞不动，
 *                说明该批货物并未真正发运，而是以运输车辆为临时储位进行「以车代库」式囤积。
 *                与单独看饱和度或单独看滞留相比，双条件「与」逻辑显著降低了误报率。
 *   【特征 S4-2】账面下降幅度 ΔS：ΔS = max(0, S_peak − S(t))，
 *                其中 S_peak 为进入判定阶段后的饱和度峰值。以峰值而非初始值为基准，
 *                可避免「库存本就低于初始值」造成的天然负差被误判为下降。
 *   【特征 S4-3】判定式 B（账面造假风险 Risk_Phantom）：
 *                  ΔS ≥ 账面下降阈值（15%） ∧  ¬Departure(考察窗口)
 *                同时成立即判定存在账面造假风险。
 *                其物理含义：系统账面显示批量出库（饱和度大幅下降），
 *                但电子围栏内自考察窗口起点起就没有任何车辆驶离轨迹，
 *                说明出库登记与实物流不一致，存在虚假出库登记/账外转移。
 *   【特征 S4-5】判定结果采用「命中即置位并保持」（latch）语义：
 *                一旦判定成立即记录首次命中时刻，后续时刻不再取消，
 *                保证风险结论可回溯、不闪烁。置位动作在 11-timeline.js 的时间线预计算中执行。
 * @说明
 *   本模块只提供**无状态的纯判定式**，全部阈值取自 01-params.js，
 *   不引入任何时刻序列或缓存，从而可被独立单元测试。
 * ========================================================================== */
(function (NS) {
  'use strict';

  var P = NS.P;

  /**
   * 【特征 S4-1】判定式 A：饱和度与异常滞留指数双超阈 → 隐蔽囤货风险。
   * @param {number} sat 当前时刻库存饱和度 S(t)
   * @param {number} idx 当前时刻异常滞留指数 I(t)
   * @returns {boolean}
   */
  function judgeHide(sat, idx) {
    return sat >= P.fullRatio && idx >= P.stayThreshold;
  }

  /**
   * 【特征 S4-2】账面下降幅度 ΔS（以判定阶段峰值为基准，非负）。
   * @param {number} peakSat 判定阶段内的饱和度峰值 S_peak
   * @param {number} sat 当前时刻库存饱和度 S(t)
   * @returns {number}
   */
  function bookDropOf(peakSat, sat) {
    return Math.max(0, peakSat - sat);
  }

  /**
   * 【特征 S4-3】判定式 B：饱和度下降超阈且无驶离轨迹 → 账面造假风险。
   * @param {number} bookDrop 账面下降幅度 ΔS
   * @param {boolean} hasDeparture 是否监测到驶离轨迹（由 07-s2-geofence 提供）
   * @returns {boolean}
   */
  function judgeBook(bookDrop, hasDeparture) {
    return bookDrop >= P.bookDrop && !hasDeparture;
  }

  NS.__declare('09-s4-dual-risk', ['judgeHide', 'bookDropOf', 'judgeBook']);
  NS.judgeHide = judgeHide;
  NS.bookDropOf = bookDropOf;
  NS.judgeBook = judgeBook;
})(window.FWCore);
