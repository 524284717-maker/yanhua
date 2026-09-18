/* ==========================================================================
 * 13-map-layers.js —— 政务云 GIS 图层构造
 *
 * @层          数据模型层（core）
 * @技术特征
 *   【特征 S5-4】管控预警的地理呈现：风险确认后，在政务云平台的 GIS 地图上
 *                同步显示目标仓储坐标与对应运输车辆坐标，并按 5 个图层叠加渲染——
 *                  ① 地理电子围栏层：以仓储为圆心的虚线圆（半径 = fenceR，约 800 m）；
 *                  ② 车辆轨迹层：每台车辆的进场路径折线 + 方向流动箭头，
 *                     滞留车辆用警示色、正常车辆用通行色区分；
 *                  ③ 仓储标记层：effectScatter 脉冲标记，库存饱和度超满载阈值时转为告警色；
 *                  ④ 车辆当前位置层：三角形航向标记，滞留车辆转为红色并加脉冲阴影；
 *                  ⑤ 预警高亮层：风险成立时对滞留车辆叠加独立高亮（独立 zlevel，
 *                     避免覆盖④的车辆标记）。
 *   【特征 S5-4】分级图层 zlevel：2/3/5/6/7，保证围栏 → 轨迹 → 仓储 → 车辆 → 预警
 *                的叠加顺序固定，不因数据更新顺序而变化。
 * @说明
 *   各图层构造函数均为纯函数，只接收「当前状态 st」与「标记尺寸」，
 *   不含 ECharts 实例，因此可脱离页面单独测试，也可被多个页面复用。
 * ========================================================================== */
(function (NS) {
  'use strict';

  var P = NS.P;
  var VEHICLES = NS.VEHICLES;
  var WARE = NS.WARE;
  var vehPos = NS.vehPos;

  /** 统一 tooltip 基础样式。 */
  var tipBase = {
    backgroundColor: 'rgba(6,26,55,0.95)', borderColor: '#00d4ff',
    textStyle: { color: '#fff', fontSize: 12 }
  };

  /** 地图标签统一的外框样式。 */
  var LABEL_BOX = {
    backgroundColor: 'rgba(6, 26, 55, 0.82)', borderColor: 'rgba(0, 180, 255, 0.45)',
    borderWidth: 1, borderRadius: 4, padding: [3, 6]
  };

  /**
   * 【特征 S2-1】注册县域/市域底图，使电子围栏、轨迹、仓储、车辆共用同一坐标系。
   */
  function registerMaps() {
    if (!window.echarts || !NS.COUNTY) return;
    if (!window.echarts.getMap('patent_county')) {
      window.echarts.registerMap('patent_county', { type: 'FeatureCollection', features: [NS.COUNTY] });
    }
    if (!window.echarts.getMap('patent_city') && NS.CITY && NS.COUNTY_LIST.length) {
      window.echarts.registerMap('patent_city', { type: 'FeatureCollection', features: NS.COUNTY_LIST });
    }
  }

  /**
   * 【特征 S5-4】① 地理电子围栏层：以目标仓储为圆心、fenceR 为半径的虚线圆。
   * @returns {object} ECharts custom series
   */
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

  /**
   * 【特征 S5-4】② 车辆轨迹层：进场路径 + 方向流动箭头，滞留车辆使用警示色。
   * @returns {object} ECharts lines series
   */
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

  /**
   * 【特征 S5-4】④ 车辆当前位置层：三角形航向标记，滞留车辆转为红色。
   * @param {number} t 监测时刻
   * @param {number} [size] 标记尺寸
   * @returns {object} ECharts scatter series
   */
  function vehSeries(t, size) {
    return {
      type: 'scatter', coordinateSystem: 'geo', zlevel: 6,
      symbol: 'path://M0,-9 L6,6 L-6,6 Z', symbolSize: size || 19,
      data: VEHICLES.map(function (v) {
        var r = vehPos(v, t);
        if (r.phase === 'before') return null;                       // 未进入围栏不显示
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

  /**
   * 【特征 S5-4】③ 仓储标记层：脉冲标记 + 库存量/容量标签，超满载阈值转为告警色。
   * @param {object} st 当前状态（需含 stock、sat）
   * @param {number} [size]
   * @returns {object} ECharts effectScatter series
   */
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

  /**
   * 【特征 S5-4】⑤ 预警高亮层：风险成立时对滞留车辆叠加独立高亮（独立图层避免覆盖车辆标记）。
   * @param {object} st 当前状态（需含 alert）
   * @param {number} [size]
   * @returns {object} ECharts effectScatter series
   */
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

  NS.__declare('13-map-layers', ['tipBase', 'LABEL_BOX', 'registerMaps',
    'fenceSeries', 'trackSeries', 'vehSeries', 'wareSeries', 'alertSeries']);
  NS.tipBase = tipBase;
  NS.LABEL_BOX = LABEL_BOX;
  NS.registerMaps = registerMaps;
  NS.fenceSeries = fenceSeries;
  NS.trackSeries = trackSeries;
  NS.vehSeries = vehSeries;
  NS.wareSeries = wareSeries;
  NS.alertSeries = alertSeries;
})(window.FWCore);
