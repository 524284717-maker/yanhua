/* ==========================================================================
 * 11-timeline.js —— 时间线预计算（判定结果与帧序解耦）
 *
 * @层          数据模型层（core）
 * @技术特征
 *   【特征 S6-1】全时间线等步长预计算：在模块加载时，以固定步长 GRID_STEP = 0.05 分钟
 *                对 [0, TL.end] 区间逐点求值，一次性得到全部指标序列 rows[]。
 *                每个采样点保存 (时刻, 库存量, 饱和度, 滞留指数, 滞留车辆数, 阶段峰值,
 *                账面下降幅度, 隐蔽囤货风险, 账面造假风险, 无驶离轨迹, 四路置信度, 预警状态)。
 *   【特征 S6-2】判定与帧序解耦：风险判定不依赖页面渲染帧、播放进度或定时器，
 *                而是对预计算序列的确定性遍历结果，因此——
 *                  ① 6 个功能页单独打开时，判定时刻完全一致；
 *                  ② 任意速度播放、暂停、重置、刷新，判定结果不变；
 *                  ③ 判定结论可离线复算，满足监管场景下的可审计要求。
 *   【特征 S4-5】置位保持（latch）：riskHideFrom / bookFrom / alertFrom 使用
 *                「首次命中即记录、后续不再取消」的语义，保证风险结论不闪烁。
 *   【特征 S6-3】采样点读取：rowAt(t) 以四舍五入定位采样点，把任意连续时刻 t
 *                映射到预计算序列上的确定元素，使「任意时刻查询」变为 O(1)。
 * @说明
 *   本模块是全系统唯一在**加载期执行计算**的模块，
 *   因此必须保证 01~10 号模块已全部加载完毕（见 README「三、加载顺序」）。
 * ========================================================================== */
(function (NS) {
  'use strict';

  var P = NS.P;
  var TL = NS.TL;
  var BOOK_WIN = NS.BOOK_WIN;

  var stockAt = NS.stockAt;
  var satAt = NS.satAt;
  var stagnationAt = NS.stagnationAt;
  var detectDeparture = NS.detectDeparture;
  var confidenceAt = NS.confidenceAt;
  var judgeHide = NS.judgeHide;
  var judgeBook = NS.judgeBook;
  var bookDropOf = NS.bookDropOf;

  /** 【特征 S6-1】时间线采样步长（分钟）。 */
  var GRID_STEP = 0.05;

  /**
   * 【特征 S6-1 / S6-2 / S4-5】全时间线预计算结果。
   * 该立即执行函数在脚本加载时运行一次，之后所有查询都只读该结果。
   */
  var DERIVED = (function () {
    var rows = [];
    var riskHideFrom = null, bookFrom = null, alertFrom = null;
    var peakS4 = 0, peakIdx = 0;

    for (var t = 0; t <= TL.end + 1e-9; t += GRID_STEP) {
      var tt = Math.round(t * 100) / 100;          // 消除浮点累加误差，保证 t 精确到 0.01
      var sat = satAt(tt);
      var st = stagnationAt(tt);

      if (tt >= TL.s4[0]) {                        // 进入判定阶段后开始记录峰值
        if (sat > peakS4) peakS4 = sat;
        if (st.index > peakIdx) peakIdx = st.index;
        // 【特征 S4-1 / S4-5】判定式 A，命中即置位
        if (riskHideFrom === null && judgeHide(sat, st.index)) riskHideFrom = tt;
      }

      var bookDrop = bookDropOf(peakS4, sat);
      var bookReady = false;
      var hasDeparture = detectDeparture(tt);      // 【特征 S2-5】驶离轨迹监测
      var noDeparture = !hasDeparture;

      if (tt >= BOOK_WIN) {
        // 【特征 S4-3 / S4-5】判定式 B，命中即置位
        if (bookFrom === null && judgeBook(bookDrop, hasDeparture)) bookFrom = tt;
        bookReady = bookFrom !== null;
      }

      var riskHide = riskHideFrom !== null;
      var conf = confidenceAt(tt);

      // 【特征 S5-2 / S4-5】置信度校验通过后确认风险并下发预警
      if (alertFrom === null && tt >= TL.s5[0] && (riskHide || bookReady) && conf.pass) alertFrom = tt;

      rows.push({
        t: tt, stock: stockAt(tt), sat: sat, idx: st.index, stayCount: st.count,
        peakS4: peakS4, bookDrop: bookDrop,
        bookActive: tt >= BOOK_WIN, riskHide: riskHide, riskBook: bookReady,
        noDeparture: noDeparture,
        conf: conf, alert: alertFrom !== null && tt >= alertFrom
      });
    }

    return {
      step: GRID_STEP, rows: rows,
      riskHideFrom: riskHideFrom, bookFrom: bookFrom, alertFrom: alertFrom,
      peakS4: peakS4, peakIdx: peakIdx
    };
  })();

  /**
   * 【特征 S6-3】把任意连续时刻映射到预计算采样点。
   * @param {number} t 监测时刻（分钟）
   * @returns {object} 采样点行
   */
  function rowAt(t) {
    var i = Math.round(t / GRID_STEP);
    if (i < 0) i = 0;
    if (i > DERIVED.rows.length - 1) i = DERIVED.rows.length - 1;
    return DERIVED.rows[i];
  }

  NS.__declare('11-timeline', ['GRID_STEP', 'DERIVED', 'rowAt']);
  NS.GRID_STEP = GRID_STEP;
  NS.DERIVED = DERIVED;
  NS.rowAt = rowAt;
})(window.FWCore);
