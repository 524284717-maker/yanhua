/* ==========================================================================
 * 06-s1-saturation.js —— 【S1】库存饱和度计算
 *
 * @层          数据模型层（core）
 * @技术特征
 *   【特征 S1-1】库存量 Q(t)：以 T+0 初始库存为基数，对扫码流水按时刻做单向累加/扣减，
 *                入库作加法、出库作减法并以下限 0 截断，得到任意监测时刻 t 的库存量。
 *   【特征 S1-2】库存饱和度 S(t) = Q(t) / C：用同一时刻的库存量与仓储设计容量 C 相比，
 *                得到与仓储规模无关的归一化指标，使不同库房可用同一组阈值判定。
 *   【特征 S1-3】扫码流水快照：任意时刻 t 可回溯「不大于 t 的全部扫码记录」（倒序取最近 N 条）
 *                与「入库/出库累计笔数」，使饱和度数值可逐笔追溯到原始扫码记录。
 * @说明
 *   三个函数的输入均只有监测时刻 t（外加可选条数上限），不含任何内部状态，
 *   满足「任意时刻 t 取同一值」的自洽性要求（6 个页面共用同一 t 时数值必然一致）。
 * ========================================================================== */
(function (NS) {
  'use strict';

  var P = NS.P;
  var OP = NS.OP;

  /**
   * 【特征 S1-1】任意时刻 t 的库存量 Q(t)（吨）。
   * @param {number} t 监测时刻（分钟）
   * @returns {number}
   */
  function stockAt(t) {
    var s = P.stock0;
    for (var i = 0; i < OP.length; i++) {
      var o = OP[i];
      if (o.at > t) break;
      s = o.act === 'in' ? s + o.qty : Math.max(0, s - o.qty);
    }
    return s;
  }

  /**
   * 【特征 S1-2】任意时刻 t 的库存饱和度 S(t) ∈ [0, +∞)。
   * @param {number} t
   * @returns {number}
   */
  function satAt(t) { return stockAt(t) / P.capacity; }

  /**
   * 【特征 S1-3】截止时刻 t 的扫码流水快照（最新在前）。
   * @param {number} t
   * @param {number} [cap] 最多返回条数，默认 26
   * @returns {object[]}
   */
  function scansAt(t, cap) {
    var out = [];
    for (var i = OP.length - 1; i >= 0; i--) {
      if (OP[i].at <= t) out.push(OP[i]);
      if (out.length >= (cap || 26)) break;
    }
    return out;
  }

  /**
   * 【特征 S1-3】截止时刻 t 的入库/出库累计笔数。
   * @param {number} t
   * @returns {{in: number, out: number}}
   */
  function scanCount(t) {
    var inn = 0, out = 0;
    for (var i = 0; i < OP.length; i++) {
      if (OP[i].at > t) break;
      if (OP[i].act === 'in') inn++; else out++;
    }
    return { in: inn, out: out };
  }

  NS.__declare('06-s1-saturation', ['stockAt', 'satAt', 'scansAt', 'scanCount']);
  NS.stockAt = stockAt;
  NS.satAt = satAt;
  NS.scansAt = scansAt;
  NS.scanCount = scanCount;
})(window.FWCore);
