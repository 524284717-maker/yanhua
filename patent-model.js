/* ==========================================================================
 * patent-model.js
 * 烟花爆竹仓储隐蔽囤货与账面造假风险智能识别系统 —— 共享数据模型
 *
 * 供 patent.html（方案总览）与 patent-s1..s5.html（S1~S5 分流程页）共用。
 * 所有指标均为「时刻 t（分钟）」的纯函数，任何页面取同一 t 都得到同一结果，
 * 从而保证分页展示时各流程数据严格自洽。
 * ========================================================================== */
(function (global) {
  'use strict';

  var GEO = global.GEO_DATA || {};

  /* ---------------- 一、系统阈值参数（可调） ---------------- */
  var P = {
    capacity: 800,        // 目标仓储设计容量（吨）
    fullRatio: 0.85,      // 满载阈值 S(t) ≥ 85%
    staticSpeed: 2,       // 静止阈值（km/h）
    tolerance: 15,        // 装卸容忍时间阈值（min）
    stayThreshold: 0.60,  // 滞留报警阈值 I(t) ≥ 0.60
    confThreshold: 0.85,  // 风险置信度阈值
    fenceR: 0.0082,       // 地理电子围栏半径（度，≈800 m）
    bookDrop: 0.15,       // 账面造假：预设时间段内饱和度下降阈值（15%）
    stock0: 498           // T+0 初始库存（吨）
  };

  /* ---------------- 二、功能时间线（分钟） ---------------- */
  var TL = { s1: [0, 9], s2: [9, 17], s3: [17, 32], s4: [32, 41], s5: [41, 56], end: 60 };
  var BOOK_WIN = 36.8;    // 账面造假考察窗口起点

  /* ---------------- 三、目标仓储定位：宜春市万载县 ---------------- */
  var cityFeat = ((GEO['360000'] || {}).features || []).filter(function (f) {
    return f.properties.name === '宜春市';
  })[0];
  var cityAd = cityFeat ? String(cityFeat.properties.adcode) : '360900';
  var countyList = ((GEO[cityAd] || {}).features || []);
  var countyFeat = countyList.filter(function (f) { return f.properties.name === '万载县'; })[0] || countyList[0];

  function centroidOf(f) {
    if (!f) return [114.30, 28.22];
    var c = f.properties && f.properties.centroid;
    if (c && c.length === 2) return c;
    var g = f.geometry;
    var ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0];
    var sx = 0, sy = 0;
    ring.forEach(function (p) { sx += p[0]; sy += p[1]; });
    return [sx / ring.length, sy / ring.length];
  }
  function bboxOf(f) {
    if (!f) return [113.99, 27.99, 114.61, 28.46];
    var g = f.geometry;
    var rings = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    rings.forEach(function (poly) {
      poly.forEach(function (ring) {
        ring.forEach(function (p) {
          if (p[0] < minx) minx = p[0];
          if (p[0] > maxx) maxx = p[0];
          if (p[1] < miny) miny = p[1];
          if (p[1] > maxy) maxy = p[1];
        });
      });
    });
    return [minx, miny, maxx, maxy];
  }

  var CENTER = centroidOf(countyFeat);          // 万载县质心
  var BBOX = bboxOf(countyFeat);
  var WARE = [CENTER[0] + 0.004, CENTER[1] + 0.006];   // 目标仓储坐标（县域中心偏北）

  /* ---------------- 四、车辆定义 ---------------- */
  function pathFor(a, b, bulge) {
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    var dx = b[0] - a[0], dy = b[1] - a[1];
    return [[a[0], a[1]], [mx - dy * bulge, my + dx * bulge], [b[0], b[1]]];
  }
  function pointOnCurve(coords, k) {
    if (k <= 0.5) {
      var u = k / 0.5;
      return [coords[0][0] + (coords[1][0] - coords[0][0]) * u, coords[0][1] + (coords[1][1] - coords[0][1]) * u];
    }
    var v = (k - 0.5) / 0.5;
    return [coords[1][0] + (coords[2][0] - coords[1][0]) * v, coords[1][1] + (coords[2][1] - coords[1][1]) * v];
  }
  function distDeg(a, b) {
    return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
  }

  var TRAVEL = 3.0;      // 进入围栏 → 停靠点用时（min）
  var UNLOAD = 6.0;      // 正常车辆装卸时长（min）

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
  // 停靠点：按方位均匀散布在围栏内，避免互相遮挡
  VEHICLES.forEach(function (v, i) {
    var ang = (i / VEHICLES.length) * Math.PI * 2 + 0.55;
    var rad = 0.0034 + (i % 3) * 0.0017;
    v.park = [WARE[0] + Math.cos(ang) * rad, WARE[1] + Math.sin(ang) * rad * 0.78];
    v.exit = pathFor(v.park, [CENTER[0] + Math.cos(ang) * 0.028, CENTER[1] + Math.sin(ang) * 0.028], 0.30);
  });

  /* ---------------- 五、扫码出入库流水（带时间戳调度） ---------------- */
  var OP = [
    // S1（T+0~9）：常规出入库
    { at: 0.6,  act: 'in',  name: '组合烟花（产成品）', qty: 12.6 },
    { at: 2.0,  act: 'in',  name: '爆竹类（产成品）',   qty: 18.4 },
    { at: 3.4,  act: 'out', name: '组合烟花（发运）',   qty: 9.8 },
    { at: 4.8,  act: 'in',  name: '黑火药（原料）',     qty: 6.2 },
    { at: 6.2,  act: 'in',  name: '喷花类（产成品）',   qty: 14.2 },
    { at: 7.8,  act: 'in',  name: '引火线（原材料）',   qty: 3.6 },
    // S2（T+9~17）：电子围栏构建、轨迹接入
    { at: 9.4,  act: 'out', name: '爆竹类（发运）',     qty: 12.1 },
    { at: 10.8, act: 'in',  name: '组合烟花（产成品）', qty: 21.4 },
    { at: 12.2, act: 'in',  name: '升空类（产成品）',   qty: 11.8 },
    { at: 13.6, act: 'in',  name: '玩具烟花（产成品）', qty: 9.2 },
    { at: 15.0, act: 'out', name: '喷花类（发运）',     qty: 8.6 },
    { at: 16.4, act: 'in',  name: '黑火药（原料）',     qty: 4.8 },
    // S3（T+17~32）：入库集中放量，饱和度突破满载阈值
    { at: 17.6, act: 'in',  name: '爆竹类（产成品）',   qty: 18.6 },
    { at: 19.0, act: 'in',  name: '喷花类（产成品）',   qty: 14.2 },
    { at: 20.4, act: 'out', name: '升空类（发运）',     qty: 7.4 },
    { at: 21.8, act: 'in',  name: '组合烟花（产成品）', qty: 14.4 },
    { at: 23.2, act: 'in',  name: '玩具烟花（产成品）', qty: 11.6 },
    { at: 24.6, act: 'in',  name: '组合烟花（产成品）', qty: 19.2 },
    { at: 26.0, act: 'out', name: '喷花类（发运）',     qty: 6.2 },
    { at: 27.4, act: 'in',  name: '爆竹类（产成品）',   qty: 16.8 },
    { at: 28.8, act: 'in',  name: '组合烟花（产成品）', qty: 24.4 },
    { at: 30.0, act: 'in',  name: '黑火药（原料）',     qty: 12.6 },
    { at: 31.4, act: 'out', name: '玩具烟花（发运）',   qty: 5.2 },
    // S4 前半段（T+32~36）：饱和度维持 86% 以上
    { at: 32.8, act: 'in',  name: '组合烟花（产成品）', qty: 10.4 },
    { at: 34.2, act: 'out', name: '喷花类（发运）',     qty: 4.6 },
    { at: 35.6, act: 'in',  name: '爆竹类（产成品）',   qty: 8.2 },
    // S4 后半段（T+36~41）：批量「扫码出库」但围栏内无驶离轨迹
    { at: 36.8, act: 'out', name: '组合烟花（发运）',   qty: 26.4, phantom: true },
    { at: 37.8, act: 'out', name: '爆竹类（发运）',     qty: 28.6, phantom: true },
    { at: 38.8, act: 'out', name: '喷花类（发运）',     qty: 24.8, phantom: true },
    { at: 39.8, act: 'out', name: '升空类（发运）',     qty: 30.2, phantom: true },
    { at: 40.6, act: 'out', name: '组合烟花（发运）',   qty: 22.4, phantom: true },
    // S5（T+41~60）：账面仍在「发货」，滞留车辆始终未驶离
    { at: 42.4, act: 'out', name: '玩具烟花（发运）',   qty: 18.6, phantom: true },
    { at: 44.6, act: 'out', name: '黑火药（发运）',     qty: 15.4, phantom: true },
    { at: 47.0, act: 'out', name: '爆竹类（发运）',     qty: 12.8, phantom: true },
    { at: 50.0, act: 'out', name: '组合烟花（发运）',   qty: 10.2, phantom: true },
    { at: 53.0, act: 'out', name: '喷花类（发运）',     qty: 8.4,  phantom: true },
    { at: 56.0, act: 'out', name: '升空类（发运）',     qty: 6.2,  phantom: true }
  ].sort(function (a, b) { return a.at - b.at; });

  /* ---------------- 六、纯函数：任意时刻 t 的状态 ---------------- */

  // 库存（吨）
  function stockAt(t) {
    var s = P.stock0;
    for (var i = 0; i < OP.length; i++) {
      var o = OP[i];
      if (o.at > t) break;
      s = o.act === 'in' ? s + o.qty : Math.max(0, s - o.qty);
    }
    return s;
  }
  function satAt(t) { return stockAt(t) / P.capacity; }

  // 扫码流水（最新在前，最多 26 条）
  function scansAt(t, cap) {
    var out = [];
    for (var i = OP.length - 1; i >= 0; i--) {
      if (OP[i].at <= t) out.push(OP[i]);
      if (out.length >= (cap || 26)) break;
    }
    return out;
  }
  function scanCount(t) {
    var inn = 0, out = 0;
    for (var i = 0; i < OP.length; i++) {
      if (OP[i].at > t) break;
      if (OP[i].act === 'in') inn++; else out++;
    }
    return { in: inn, out: out };
  }

  // 车辆定位轨迹（S2）
  function vehPos(v, t) {
    if (t < v.inAt) return { pos: v.entry[0], spd: 0, phase: 'before', stayMin: 0 };
    var tIn = t - v.inAt;
    if (tIn < TRAVEL) {
      var k = tIn / TRAVEL;
      return { pos: pointOnCurve(v.entry, k), spd: 34 - 18 * k, phase: 'in', stayMin: 0 };
    }
    var stayMin = tIn - TRAVEL;
    if (v.stay) {
      return { pos: v.park, spd: 0.4 * (1 - Math.min(1, stayMin / 3)), phase: 'park', stayMin: stayMin };
    }
    if (stayMin < UNLOAD) return { pos: v.park, spd: 0.8, phase: 'park', stayMin: stayMin };
    var k2 = Math.min(1, (stayMin - UNLOAD) / 5);
    return { pos: pointOnCurve(v.exit, k2), spd: 8 + 26 * k2, phase: 'out', stayMin: stayMin };
  }
  function vehExitStart(v) { return v.inAt + TRAVEL + UNLOAD; }

  // 驶离轨迹监测：只统计考察窗口起点之后才开始驶离的车辆
  function detectDeparture(t) {
    return VEHICLES.some(function (v) {
      if (vehExitStart(v) < BOOK_WIN) return false;
      return vehPos(v, t).phase === 'out';
    });
  }

  // 围栏内车辆
  function inFenceAt(t) {
    return VEHICLES.filter(function (v) {
      return distDeg(vehPos(v, t).pos, WARE) <= P.fenceR * 1.6;
    });
  }

  // S3：滞留车辆筛选与异常滞留指数
  function stagnationAt(t) {
    var rows = [], sumW = 0, stayCount = 0;
    VEHICLES.forEach(function (v) {
      var r = vehPos(v, t);
      if (r.phase === 'before') return;
      var stayMin = r.phase === 'park' ? (r.stayMin || 0) : 0;
      var inFenceMin = Math.max(0, t - v.inAt);
      var wStay = Math.min(1, stayMin / P.tolerance);
      var wSlow = Math.max(0, 1 - r.spd / P.staticSpeed);
      var weight = 0.5 * wStay + 0.5 * wSlow;
      var isStay = stayMin >= P.tolerance && r.spd < P.staticSpeed;   // 停留超容忍 且 速度低于静止阈值
      if (isStay) { stayCount++; sumW += weight; }
      rows.push({
        plate: v.plate, inAt: v.inAt, inFenceMin: inFenceMin, spd: r.spd, stayMin: stayMin,
        weight: weight, stay: isStay, bill: v.bill, goods: v.goods, driver: v.driver,
        tel: v.tel, phase: r.phase, pos: r.pos
      });
    });
    var index = Math.min(1, sumW / 3 * 0.78 + (sumW > 0 ? 0.1 : 0));
    return { rows: rows, count: stayCount, index: index };
  }

  // S5：多源置信度校验
  function hash01(s) {
    var h = 7;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return (h % 1000) / 1000;
  }
  function confidenceAt(t) {
    var k = Math.round(t);
    var parts = {
      a: 88 + Math.round(hash01('a' + k) * 9),   // 扫码出入库数据完整性
      b: 86 + Math.round(hash01('b' + k) * 12),  // 视频监控核验
      c: 90 + Math.round(hash01('c' + k) * 9),   // 车辆定位轨迹连续性
      d: 82 + Math.round(hash01('d' + k) * 14)   // 电子运单比对
    };
    var total = parts.a * 0.32 + parts.b * 0.24 + parts.c * 0.26 + parts.d * 0.18;
    return { a: parts.a, b: parts.b, c: parts.c, d: parts.d, total: total, pass: total >= P.confThreshold * 100 };
  }

  /* ---------------- 七、时间线预计算（风险判定取窗口内峰值，与帧序无关） ---------------- */
  var GRID_STEP = 0.05;
  var DERIVED = (function () {
    var rows = [];
    var riskHideFrom = null, bookFrom = null, alertFrom = null;
    var peakS4 = 0, peakIdx = 0;
    for (var t = 0; t <= TL.end + 1e-9; t += GRID_STEP) {
      var tt = Math.round(t * 100) / 100;
      var sat = satAt(tt);
      var st = stagnationAt(tt);
      if (tt >= TL.s4[0]) {
        if (sat > peakS4) peakS4 = sat;
        if (st.index > peakIdx) peakIdx = st.index;
        // 判定式 A（隐蔽囤货）：S(t) ≥ 满载阈值 ∧ I(t) ≥ 滞留报警阈值 —— 命中即置位保持
        if (riskHideFrom === null && sat >= P.fullRatio && st.index >= P.stayThreshold) riskHideFrom = tt;
      }
      var bookDrop = Math.max(0, peakS4 - sat);
      var bookReady = false;
      if (tt >= BOOK_WIN) {
        // 判定式 B（账面造假）：预设时间段内饱和度下降 ≥ 15% ∧ 围栏内无驶离轨迹
        if (bookFrom === null && bookDrop >= P.bookDrop && !detectDeparture(tt)) bookFrom = tt;
        bookReady = bookFrom !== null;
      }
      var riskHide = riskHideFrom !== null;
      var conf = confidenceAt(tt);
      var anyRisk = riskHide || bookReady;
      if (alertFrom === null && tt >= TL.s5[0] && anyRisk && conf.pass) alertFrom = tt;
      rows.push({
        t: tt, stock: stockAt(tt), sat: sat, idx: st.index, stayCount: st.count,
        peakS4: peakS4, bookDrop: bookDrop,
        bookActive: tt >= BOOK_WIN, riskHide: riskHide, riskBook: bookReady,
        noDeparture: !detectDeparture(tt),
        conf: conf, alert: alertFrom !== null && tt >= alertFrom
      });
    }
    return {
      step: GRID_STEP, rows: rows,
      riskHideFrom: riskHideFrom, bookFrom: bookFrom, alertFrom: alertFrom,
      peakS4: peakS4, peakIdx: peakIdx
    };
  })();

  function rowAt(t) {
    var i = Math.round(t / GRID_STEP);
    if (i < 0) i = 0;
    if (i > DERIVED.rows.length - 1) i = DERIVED.rows.length - 1;
    return DERIVED.rows[i];
  }

  // 汇总：任意时刻的完整状态
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

  // 当前所处流程号（1~5）与是否完成
  function stageAt(t) {
    if (t >= TL.s5[1]) return { no: 5, done: true };
    if (t >= TL.s5[0]) return { no: 5, done: false };
    if (t >= TL.s4[0]) return { no: 4, done: false };
    if (t >= TL.s3[0]) return { no: 3, done: false };
    if (t >= TL.s2[0]) return { no: 2, done: false };
    return { no: 1, done: false };
  }

  /* ---------------- 八、地图辅助 ---------------- */
  var stageMeta = [
    { no: 1, file: 'patent-s1.html', name: '库存饱和度计算', short: '库存饱和度',
      desc: '扫码出入库数据 + 设计容量 → 当前时刻库存饱和度',
      t: 31.5 },
    { no: 2, file: 'patent-s2.html', name: '电子围栏与车辆轨迹', short: '电子围栏',
      desc: '以仓储为中心构建地理电子围栏，实时获取围栏内车辆定位轨迹',
      t: 34.0 },
    { no: 3, file: 'patent-s3.html', name: '滞留车辆筛选与滞留指数', short: '滞留指数',
      desc: '筛选「速度低于静止阈值 且 停留超过装卸容忍时间」车辆，计算异常滞留指数',
      t: 35.0 },
    { no: 4, file: 'patent-s4.html', name: '双风险判定', short: '双风险判定',
      desc: '饱和度与滞留指数双超阈 → 隐蔽囤货风险；饱和度下降但无驶离轨迹 → 账面造假风险',
      t: 41.5 },
    { no: 5, file: 'patent-s5.html', name: '置信度校验与管控预警', short: '管控预警',
      desc: '多源数据一致性校验通过后确认风险，生成管控预警并在政务云 GIS 显示仓储及车辆坐标',
      t: 45.0 }
  ];
  function stageTime(no) { return (stageMeta[no - 1] || stageMeta[0]).t; }

  function registerMaps() {
    if (!global.echarts || !countyFeat) return;
    if (!global.echarts.getMap('patent_county')) {
      global.echarts.registerMap('patent_county', { type: 'FeatureCollection', features: [countyFeat] });
    }
    if (!global.echarts.getMap('patent_city') && cityFeat && countyList.length) {
      global.echarts.registerMap('patent_city', { type: 'FeatureCollection', features: countyList });
    }
  }

  var tipBase = {
    backgroundColor: 'rgba(6,26,55,0.95)', borderColor: '#00d4ff',
    textStyle: { color: '#fff', fontSize: 12 }
  };
  var LABEL_BOX = {
    backgroundColor: 'rgba(6, 26, 55, 0.82)', borderColor: 'rgba(0, 180, 255, 0.45)',
    borderWidth: 1, borderRadius: 4, padding: [3, 6]
  };

  // 围栏圆圈图层
  function fenceSeries() {
    return {
      type: 'custom', coordinateSystem: 'geo', zlevel: 2, silent: true,
      renderItem: function (params, api) {
        var c0 = api.coord(WARE);
        var c1 = api.coord([WARE[0] + P.fenceR, WARE[1]]);
        var r = Math.max(14, Math.abs(c1[0] - c0[0]));
        return {
          type: 'group',
          children: [{
            type: 'circle',
            shape: { cx: c0[0], cy: c0[1], r: r },
            style: { fill: 'rgba(0, 212, 255, 0.13)', stroke: 'rgba(0, 212, 255, 0.9)', lineWidth: 2.4, lineDash: [8, 5] }
          }, {
            type: 'text',
            style: {
              text: '地理电子围栏 R = 800 m', x: c0[0], y: c0[1] + r + 15, textAlign: 'center',
              fill: '#8fe3ff', font: '600 12px sans-serif'
            }
          }]
        };
      },
      data: [[0, 0]]
    };
  }

  // 车辆轨迹图层
  function trackSeries() {
    return {
      type: 'lines', coordinateSystem: 'geo', zlevel: 3, polyline: true,
      lineStyle: { width: 1.4, opacity: 0.5 },
      data: VEHICLES.map(function (v) {
        return {
          coords: v.entry.concat([v.park]), name: v.plate,
          lineStyle: { color: v.stay ? 'rgba(255,159,46,0.85)' : 'rgba(127,227,160,0.7)', width: v.stay ? 1.8 : 1.3 },
          effect: { show: true, period: v.stay ? 4 : 7, trailLength: 0.24, symbol: 'arrow', symbolSize: 5,
                    color: v.stay ? '#ff9f2e' : '#7fe3a0' }
        };
      })
    };
  }

  // 车辆当前位置散点
  function vehSeries(t, size) {
    return {
      type: 'scatter', coordinateSystem: 'geo', zlevel: 6,
      symbol: 'path://M0,-9 L6,6 L-6,6 Z', symbolSize: size || 19,
      data: VEHICLES.map(function (v) {
        var r = vehPos(v, t);
        if (r.phase === 'before') return null;
        var marked = v.stay && r.phase === 'park' && (r.stayMin || 0) >= P.tolerance;
        return {
          name: v.plate, value: r.pos, plate: v.plate, spd: r.spd, stayMin: r.stayMin || 0,
          staying: marked, phase: r.phase,
          itemStyle: {
            color: marked ? '#ff4d4f' : (r.phase === 'park' ? '#ffd23f' : '#7fe3a0'),
            borderColor: 'rgba(255,255,255,0.85)', borderWidth: 1,
            shadowBlur: 10, shadowColor: marked ? 'rgba(255,77,79,0.9)' : 'rgba(0,212,255,0.6)'
          },
          label: {
            show: r.phase === 'park', position: 'bottom', distance: 6, formatter: v.plate,
            color: marked ? '#ff9d9f' : '#cfe9ff', fontSize: 10.5, fontWeight: 600,
            textShadowColor: 'rgba(0,0,0,0.8)', textShadowBlur: 4
          }
        };
      }).filter(Boolean)
    };
  }

  // 仓储标记
  function wareSeries(st, size) {
    return {
      type: 'effectScatter', coordinateSystem: 'geo', zlevel: 5,
      rippleEffect: { brushType: 'stroke', scale: 3.4, period: 3.6 },
      symbolSize: size || 19,
      itemStyle: {
        color: st.sat >= P.fullRatio ? '#ff4d4f' : '#ffd23f',
        shadowBlur: 16, shadowColor: 'rgba(255, 210, 63, 0.85)'
      },
      label: Object.assign({
        show: true, position: 'top', distance: 9,
        formatter: '目标仓储 A 库\n库存 ' + Math.round(st.stock) + ' 吨 / 800 吨',
        color: '#ffe08a', fontSize: 11.5, fontWeight: 700, lineHeight: 15,
        textShadowColor: 'rgba(0,0,0,0.8)', textShadowBlur: 4, align: 'center'
      }, LABEL_BOX),
      data: [{ name: '目标仓储', value: WARE }]
    };
  }

  // 预警高亮层（独立图层，避免覆盖车辆标记）
  function alertSeries(st, size) {
    return {
      type: 'effectScatter', coordinateSystem: 'geo', zlevel: 7, silent: true,
      rippleEffect: { brushType: 'stroke', scale: 2.8, period: 2.4 }, symbolSize: size || 17,
      data: st.alert ? VEHICLES.filter(function (v) { return v.stay; }).map(function (v) {
        return {
          name: v.plate, value: v.park,
          itemStyle: { color: '#ff4d4f', shadowBlur: 16, shadowColor: 'rgba(255,77,79,0.95)' }
        };
      }) : []
    };
  }

  /* ---------------- 九、导出 ---------------- */
  global.PATENT = {
    P: P, TL: TL, BOOK_WIN: BOOK_WIN, OP: OP, VEHICLES: VEHICLES,
    WARE: WARE, CENTER: CENTER, BBOX: BBOX, COUNTY: countyFeat,
    CITY: cityFeat, COUNTY_LIST: countyList, TRAVEL: TRAVEL, UNLOAD: UNLOAD,
    DERIVED: DERIVED, stageMeta: stageMeta, tipBase: tipBase, LABEL_BOX: LABEL_BOX,
    stockAt: stockAt, satAt: satAt, scansAt: scansAt, scanCount: scanCount,
    vehPos: vehPos, vehExitStart: vehExitStart, detectDeparture: detectDeparture,
    inFenceAt: inFenceAt, stagnationAt: stagnationAt,
    confidenceAt: confidenceAt, hash01: hash01,
    rowAt: rowAt, stateAt: stateAt, stageAt: stageAt, stageTime: stageTime,
    distDeg: distDeg, pointOnCurve: pointOnCurve, pathFor: pathFor,
    registerMaps: registerMaps,
    fenceSeries: fenceSeries, trackSeries: trackSeries,
    vehSeries: vehSeries, wareSeries: wareSeries, alertSeries: alertSeries
  };
})(window);
