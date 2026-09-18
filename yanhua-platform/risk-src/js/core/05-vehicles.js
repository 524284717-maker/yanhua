/* ==========================================================================
 * 05-vehicles.js —— 运输车辆定义与进出场路径
 *
 * @层          数据模型层（core）
 * @技术特征
 *   【特征 S2-2】车辆实体建模：每台进入目标仓储的烟花爆竹运输车辆由
 *                (车牌 plate, 车型 type, 是否滞留标记 stay, 进入时刻 inAt,
 *                 进场路径 entry, 停靠点 park, 出场路径 exit, 电子运单号 bill)
 *                构成，其中进场路径由起点 + 弯曲系数生成两段折线，
 *                停靠点按方位角在围栏内均匀散布，避免多车标记互相遮挡。
 *   【特征 S3-1】装卸容忍时间与行驶时序：进入围栏 → 行驶 TRAVEL 分钟至停靠点 →
 *                停靠 UNLOAD 分钟（正常车辆）或长期停靠（滞留车辆）→ 驶离。
 *                该时序是 S3「停留时间」与 S4「驶离轨迹」判定的物理基础。
 * @说明
 *   停靠点与出场路径由车辆序号 i 通过固定公式推导（方位角 2πi/n + 0.55，
 *   半径 0.0034 + (i mod 3) × 0.0017），因此车辆分布可复现、不依赖随机数。
 * ========================================================================== */
(function (NS) {
  'use strict';

  var WARE = NS.WARE;
  var CENTER = NS.CENTER;
  var pathFor = NS.pathFor;

  /** 【特征 S3-1】进入围栏 → 到达停靠点所需时间（min）。 */
  var TRAVEL = 3.0;

  /** 【特征 S3-1】正常车辆的装卸作业时长（min），与系统「装卸容忍时间阈值」配套使用。 */
  var UNLOAD = 6.0;

  /** 【特征 S2-2】5 台进入目标仓储的运输车辆。 */
  var VEHICLES = [
    { plate: '赣C·A8823', type: 'heavy', stay: true,  inAt: 3,
      entry: pathFor([CENTER[0] - 0.0135, CENTER[1] - 0.0100], WARE, 0.35),
      bill: 'YD2026082681', goods: '组合烟花 12.6 吨', driver: '李国平', tel: '138****6721' },
    { plate: '赣C·B1290', type: 'heavy', stay: true,  inAt: 6,
      entry: pathFor([CENTER[0] + 0.0128, CENTER[1] - 0.0075], WARE, -0.30),
      bill: 'YD2026082682', goods: '爆竹类 9.4 吨', driver: '王建民', tel: '139****2088' },
    { plate: '赣C·C7734', type: 'mid',   stay: true,  inAt: 9,
      entry: pathFor([CENTER[0] - 0.0035, CENTER[1] + 0.0138], WARE, 0.28),
      bill: 'YD2026082683', goods: '喷花类 7.2 吨', driver: '刘志强', tel: '137****5512' },
    { plate: '赣C·D2168', type: 'mid',   stay: false, inAt: 12,
      entry: pathFor([CENTER[0] + 0.0095, CENTER[1] + 0.0076], WARE, -0.32),
      bill: 'YD2026082684', goods: '升空类 5.6 吨', driver: '陈晓东', tel: '136****3390' },
    { plate: '赣C·E5902', type: 'small', stay: false, inAt: 15,
      entry: pathFor([CENTER[0] - 0.0122, CENTER[1] + 0.0048], WARE, 0.33),
      bill: 'YD2026082685', goods: '玩具烟花 3.1 吨', driver: '黄海涛', tel: '135****7746' }
  ];

  // 【特征 S2-2】停靠点：按方位均匀散布在围栏内，避免互相遮挡，且全部落在围栏半径之内。
  VEHICLES.forEach(function (v, i) {
    var ang = (i / VEHICLES.length) * Math.PI * 2 + 0.55;
    var rad = 0.0034 + (i % 3) * 0.0017;
    v.park = [WARE[0] + Math.cos(ang) * rad, WARE[1] + Math.sin(ang) * rad * 0.78];
    v.exit = pathFor(v.park, [CENTER[0] + Math.cos(ang) * 0.028, CENTER[1] + Math.sin(ang) * 0.028], 0.30);
  });

  NS.__declare('05-vehicles', ['VEHICLES', 'TRAVEL', 'UNLOAD']);
  NS.VEHICLES = VEHICLES;
  NS.TRAVEL = TRAVEL;
  NS.UNLOAD = UNLOAD;
})(window.FWCore);
