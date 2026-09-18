/* ==========================================================================
 * 07-s2-geofence.js —— 【S2】电子围栏与车辆轨迹
 *
 * @层          数据模型层（core）
 * @技术特征
 *   【特征 S2-3】车辆定位轨迹函数：把车辆状态表示为监测时刻 t 的分段函数——
 *                「未进入（before）→ 驶入（in，速度由 34 km/h 线性降到 16 km/h）→
 *                 停靠（park，速度趋于 0）→ 驶离（out，速度由 8 km/h 升到 34 km/h）」，
 *                四个阶段的切换时刻由 inAt、TRAVEL、UNLOAD 决定，使轨迹连续可积。
 *   【特征 S2-4】围栏内车辆集合：以「车辆当前坐标与围栏圆心的平面距离 ≤ 围栏半径 × 1.6」
 *                为判据，得到当前时刻位于电子围栏内的车辆集合（1.6 为标注可视性系数，
 *                不影响判定逻辑，仅使围栏边缘车辆的标记不被围栏线遮挡）。
 *   【特征 S2-5】驶离轨迹监测：只统计「考察窗口起点 BOOK_WIN 之后才开始驶离」的车辆，
 *                把正常装卸后离场与风险窗口内的离场区分开，避免正常作业误触发账面判定。
 * @说明
 *   本模块输出的 vehPos(v, t) 是 S3（停留时间、速度）与 S4（驶离轨迹）唯一的轨迹数据来源。
 * ========================================================================== */
(function (NS) {
  'use strict';

  var P = NS.P;
  var VEHICLES = NS.VEHICLES;
  var TRAVEL = NS.TRAVEL;
  var UNLOAD = NS.UNLOAD;
  var BOOK_WIN = NS.BOOK_WIN;
  var WARE = NS.WARE;
  var pointOnCurve = NS.pointOnCurve;
  var distDeg = NS.distDeg;

  /**
   * 【特征 S2-3】任意时刻 t 的车辆运动状态（纯函数，无内部状态）。
   * @param {object} v 车辆实体
   * @param {number} t 监测时刻（分钟）
   * @returns {{pos: number[], spd: number, phase: string, stayMin: number}}
   *          pos 当前坐标；spd 当前移动速度 km/h；phase ∈ before|in|park|out；
   *          stayMin 已停靠时长（分钟）
   */
  function vehPos(v, t) {
    if (t < v.inAt) return { pos: v.entry[0], spd: 0, phase: 'before', stayMin: 0 };
    var tIn = t - v.inAt;
    if (tIn < TRAVEL) {
      // 驶入段：按折线路径插值，速度由 34 km/h 线性降至 16 km/h
      var k = tIn / TRAVEL;
      return { pos: pointOnCurve(v.entry, k), spd: 34 - 18 * k, phase: 'in', stayMin: 0 };
    }
    var stayMin = tIn - TRAVEL;
    if (v.stay) {
      // 滞留车辆：抵达停靠点后不再驶离，速度在 3 分钟内衰减到 0
      return { pos: v.park, spd: 0.4 * (1 - Math.min(1, stayMin / 3)), phase: 'park', stayMin: stayMin };
    }
    if (stayMin < UNLOAD) return { pos: v.park, spd: 0.8, phase: 'park', stayMin: stayMin };
    // 驶离段：速度由 8 km/h 升到 34 km/h
    var k2 = Math.min(1, (stayMin - UNLOAD) / 5);
    return { pos: pointOnCurve(v.exit, k2), spd: 8 + 26 * k2, phase: 'out', stayMin: stayMin };
  }

  /**
   * 【特征 S2-3】车辆开始驶离的时刻：进入时刻 + 行驶时长 + 装卸时长。
   * @param {object} v
   * @returns {number}
   */
  function vehExitStart(v) { return v.inAt + TRAVEL + UNLOAD; }

  /**
   * 【特征 S2-5】时刻 t 是否监测到围栏内车辆的驶离轨迹。
   * 仅在考察窗口 BOOK_WIN 之后才开始驶离的车辆参与判定。
   * @param {number} t
   * @returns {boolean} true 表示存在驶离轨迹
   */
  function detectDeparture(t) {
    return VEHICLES.some(function (v) {
      if (vehExitStart(v) < BOOK_WIN) return false;
      return vehPos(v, t).phase === 'out';
    });
  }

  /**
   * 【特征 S2-4】时刻 t 位于地理电子围栏内的车辆集合。
   * @param {number} t
   * @returns {object[]}
   */
  function inFenceAt(t) {
    return VEHICLES.filter(function (v) {
      return distDeg(vehPos(v, t).pos, WARE) <= P.fenceR * 1.6;
    });
  }

  NS.__declare('07-s2-geofence', ['vehPos', 'vehExitStart', 'detectDeparture', 'inFenceAt']);
  NS.vehPos = vehPos;
  NS.vehExitStart = vehExitStart;
  NS.detectDeparture = detectDeparture;
  NS.inFenceAt = inFenceAt;
})(window.FWCore);
