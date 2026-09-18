/* ==========================================================================
 * 03-geo-anchor.js —— 目标仓储地理锚定
 *
 * @层          数据模型层（core）
 * @技术特征
 *   【特征 S2-1】以行政区划边界数据（GeoJSON）逐级解析定位目标仓储：
 *                省级 FeatureCollection → 按名称定位地市 Feature →
 *                按地市 adcode 取县级 FeatureCollection → 按名称定位目标县 Feature；
 *                再由目标县多边形的**质心**与**外接矩形**确定地图视野与围栏圆心，
 *                使电子围栏、车辆轨迹、仓储标注全部落在同一地理坐标系内。
 * @说明
 *   本模块把「电子围栏圆心」这一个坐标，从硬编码改为由行政区划数据推导，
 *   因此同一套算法可直接迁移到其他县域（只改目标县名称，不改算法）。
 *   推导结果：CENTER（县质心）、BBOX（县外接框）、WARE（目标仓储坐标）。
 * ========================================================================== */
(function (NS) {
  'use strict';

  var GEO = window.GEO_DATA || {};

  /* ---------------- 一、逐级解析行政区划 ---------------- */

  /** 省级 FeatureCollection 中按名称定位「宜春市」。 */
  var cityFeat = ((GEO['360000'] || {}).features || []).filter(function (f) {
    return f.properties.name === '宜春市';
  })[0];

  /** 地市 adcode，缺失时回落到宜春市编码 360900。 */
  var cityAd = cityFeat ? String(cityFeat.properties.adcode) : '360900';

  /** 该地市下辖县级 FeatureCollection（作为县域地图底图）。 */
  var countyList = ((GEO[cityAd] || {}).features || []);

  /** 目标县 Feature：万载县（烟花爆竹主产区），缺失时回落为该市第一个县。 */
  var countyFeat = countyList.filter(function (f) { return f.properties.name === '万载县'; })[0] || countyList[0];

  /* ---------------- 二、多边形几何量 ---------------- */

  /**
   * 求多边形质心。优先使用数据自带的 centroid 字段，否则对首个环求顶点算术平均。
   * @param {object} f GeoJSON Feature
   * @returns {number[]} [lon, lat]
   */
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

  /**
   * 求多边形外接矩形（用于地图视野与县域全景视图）。
   * @param {object} f GeoJSON Feature
   * @returns {number[]} [minLon, minLat, maxLon, maxLat]
   */
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

  /* ---------------- 三、锚点结果 ---------------- */

  /** 目标县质心 —— 电子围栏圆心的经度基准。 */
  var CENTER = centroidOf(countyFeat);

  /** 目标县外接矩形 —— 县域全景视图视野。 */
  var BBOX = bboxOf(countyFeat);

  /**
   * 【特征 S2-1】目标仓储坐标：在县质心基础上向北偏移（+0.004 lon / +0.006 lat），
   * 使仓储点落在县域建成区一侧而非几何中心（几何中心往往落在山区/水域，不符合仓储选址实际）。
   */
  var WARE = [CENTER[0] + 0.004, CENTER[1] + 0.006];

  NS.__declare('03-geo-anchor', ['WARE', 'CENTER', 'BBOX', 'COUNTY', 'CITY', 'COUNTY_LIST']);
  NS.WARE = WARE;
  NS.CENTER = CENTER;
  NS.BBOX = BBOX;
  NS.COUNTY = countyFeat;
  NS.CITY = cityFeat;
  NS.COUNTY_LIST = countyList;
})(window.FWCore);
