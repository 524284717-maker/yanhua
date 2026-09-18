/* ==========================================================================
 * 12-aggregate.js —— 状态聚合与阶段机
 *
 * @层          数据模型层（core）
 * @技术特征
 *   【特征 S6-4】单时刻完整状态快照 stateAt(t)：把 S1~S5 各模块的结果聚合成一个对象
 *                （库存量/饱和度/峰值/滞留指数/滞留车辆明细/账面下降幅度/两类风险标志/
 *                 无驶离轨迹标志/四路置信度/预警状态/围栏内车辆/扫码流水/累计笔数/阶段号），
 *                使「一个时刻 = 一份完整证据链」，页面只需一次调用即可获得全部展示数据，
 *                同时保证 6 个功能页在同一时刻读到完全相同的数值。
 *   【特征 S0-2】阶段机 stageAt(t)：由时间线 TL 反推当前所处功能阶段（1~5）与是否全流程完成，
 *                供页面顶栏展示「当前查看 S n / S5」。
 *   【特征 S6-5】阶段标注表 stageMeta：把 5 个功能阶段的名称、简称、说明与代表时刻集中登记，
 *                供总览页与阶段间跳转使用。
 * @说明
 *   stateAt(t) 对库存、饱和度、峰值等**只读预计算序列**（O(1)），
 *   对滞留明细、围栏车辆、扫码快照做实时计算（此时确实依赖瞬时 t），
 *   两者结果一致：预计算序列本身就是逐点调用同一批函数得到的。
 * ========================================================================== */
(function (NS) {
  'use strict';

  var TL = NS.TL;
  var rowAt = NS.rowAt;
  var stagnationAt = NS.stagnationAt;
  var inFenceAt = NS.inFenceAt;
  var scansAt = NS.scansAt;
  var scanCount = NS.scanCount;

  /**
   * 【特征 S6-4】任意时刻 t 的完整状态快照。
   * @param {number} t 监测时刻（分钟）
   * @returns {object}
   */
  function stateAt(t) {
    var r = rowAt(t);
    var st = stagnationAt(t);
    return {
      t: t,
      stock: r.stock, sat: r.sat, satPct: r.sat * 100,
      peakS4: r.peakS4, peakS4Pct: r.peakS4 * 100,
      index: r.idx, stayCount: r.stayCount, rows: st.rows,
      bookDrop: r.bookDrop, bookActive: r.bookActive,
      riskHide: r.riskHide, riskBook: r.riskBook, noDeparture: r.noDeparture,
      conf: r.conf, alert: r.alert,
      inFence: inFenceAt(t),
      scans: scansAt(t),
      scanCount: scanCount(t),
      stage: stageAt(t)
    };
  }

  /**
   * 【特征 S0-2】当前所处流程号（1~5）与是否完成。
   * @param {number} t
   * @returns {{no: number, done: boolean}}
   */
  function stageAt(t) {
    if (t >= TL.s5[1]) return { no: 5, done: true };
    if (t >= TL.s5[0]) return { no: 5, done: false };
    if (t >= TL.s4[0]) return { no: 4, done: false };
    if (t >= TL.s3[0]) return { no: 3, done: false };
    if (t >= TL.s2[0]) return { no: 2, done: false };
    return { no: 1, done: false };
  }

  /** 【特征 S6-5】5 个功能阶段的登记表。 */
  var stageMeta = [
    { no: 1, file: 's1.html', name: '库存饱和度计算', short: '库存饱和度',
      desc: '扫码出入库数据 + 设计容量 → 当前时刻库存饱和度',
      t: 31.5 },
    { no: 2, file: 's2.html', name: '电子围栏与车辆轨迹', short: '电子围栏',
      desc: '以仓储为中心构建地理电子围栏，实时获取围栏内车辆定位轨迹',
      t: 34.0 },
    { no: 3, file: 's3.html', name: '滞留车辆筛选与滞留指数', short: '滞留指数',
      desc: '筛选「速度低于静止阈值 且 停留超过装卸容忍时间」车辆，计算异常滞留指数',
      t: 35.0 },
    { no: 4, file: 's4.html', name: '双风险判定', short: '双风险判定',
      desc: '饱和度与滞留指数双超阈 → 隐蔽囤货风险；饱和度下降但无驶离轨迹 → 账面造假风险',
      t: 41.5 },
    { no: 5, file: 's5.html', name: '置信度校验与管控预警', short: '管控预警',
      desc: '多源数据一致性校验通过后确认风险，生成管控预警并在政务云 GIS 显示仓储及车辆坐标',
      t: 45.0 }
  ];

  /**
   * 【特征 S6-5】取某阶段的代表时刻。
   * @param {number} no 阶段号 1~5
   * @returns {number}
   */
  function stageTime(no) { return (stageMeta[no - 1] || stageMeta[0]).t; }

  NS.__declare('12-aggregate', ['stateAt', 'stageAt', 'stageMeta', 'stageTime']);
  NS.stateAt = stateAt;
  NS.stageAt = stageAt;
  NS.stageMeta = stageMeta;
  NS.stageTime = stageTime;
})(window.FWCore);
