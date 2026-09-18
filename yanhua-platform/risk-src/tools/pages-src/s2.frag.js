  var mapOv, mapDt, ovOpt = null;

  function smallFence() {
    // 总览图上的围栏：视觉半径放大 1.6 倍并加引线，避免在县域尺度下不可见
    return {
      type: 'custom', coordinateSystem: 'geo', zlevel: 2, silent: true,
      renderItem: function (params, api) {
        var c0 = api.coord(M.WARE);
        var c1 = api.coord([M.WARE[0] + M.P.fenceR * 1.7, M.WARE[1]]);
        var r = Math.max(16, Math.abs(c1[0] - c0[0]));
        return {
          type: 'group',
          children: [{
            type: 'circle', shape: { cx: c0[0], cy: c0[1], r: r },
            style: { fill: 'rgba(0, 212, 255, 0.16)', stroke: 'rgba(0, 212, 255, 0.95)', lineWidth: 1.6, lineDash: [5, 4] }
          }, {
            type: 'circle', shape: { cx: c0[0], cy: c0[1], r: 4 },
            style: { fill: '#ff4d4f', stroke: '#fff', lineWidth: 1.2 }
          }]
        };
      },
      data: [[0, 0]]
    };
  }
  function bigPin() {
    return {
      type: 'effectScatter', coordinateSystem: 'geo', zlevel: 6,
      rippleEffect: { brushType: 'stroke', scale: 3.6, period: 3.4 }, symbolSize: 15,
      itemStyle: { color: '#ff4d4f', shadowBlur: 16, shadowColor: 'rgba(255,77,79,0.9)' },
      label: {
        show: true, position: 'right', distance: 8, formatter: '目标仓储 A 库',
        color: '#ffb0b2', fontSize: 12, fontWeight: 700,
        backgroundColor: 'rgba(6,26,55,0.85)', borderColor: 'rgba(255,77,79,0.6)', borderWidth: 1,
        borderRadius: 4, padding: [3, 6], textShadowColor: 'rgba(0,0,0,0.8)', textShadowBlur: 4
      },
      data: [{ name: '目标仓储', value: M.WARE }]
    };
  }

  function initPage() {
    mapOv = echarts.init(document.getElementById('mapOverview'));
    mapDt = echarts.init(document.getElementById('mapDetail'));
  }
  function relayout() { if (mapOv) mapOv.resize(); if (mapDt) mapDt.resize(); }

  function renderPage(t, st) {
    // ---------- 县域总览：完整显示万载县边界 ----------
    mapOv.setOption({
      animation: false,
      tooltip: Object.assign({ trigger: 'item',
        formatter: function (p) {
          if (p.data && p.data.plate) return '<b>' + p.data.plate + '</b><br/>移动速度：' + p.data.spd.toFixed(1) + ' km/h<br/>围栏内停留：' + Math.round(p.data.stayMin) + ' min<br/>坐标：' + p.data.value[0].toFixed(4) + ', ' + p.data.value[1].toFixed(4);
          if (p.name === '目标仓储') return '<b>万载县烟花爆竹仓储中心 A 库</b><br/>坐标 ' + M.WARE[0].toFixed(4) + ', ' + M.WARE[1].toFixed(4) + '<br/>库存 ' + Math.round(st.stock) + ' 吨 / 800 吨<br/>饱和度 ' + st.satPct.toFixed(1) + '%';
          return p.name || '';
        } }, M.tipBase),
      geo: {
        map: 'patent_county', roam: false, zoom: 1.02, aspectScale: 1.0,
        center: [(M.BBOX[0] + M.BBOX[2]) / 2, (M.BBOX[1] + M.BBOX[3]) / 2],
        left: 16, right: 16, top: 14, bottom: 14,
        itemStyle: {
          areaColor: 'rgba(13, 84, 152, 0.78)',
          borderColor: 'rgba(0, 226, 255, 0.95)', borderWidth: 2,
          shadowColor: 'rgba(0, 150, 255, 0.75)', shadowBlur: 22
        },
        emphasis: { disabled: true },
        label: { show: true, color: 'rgba(200, 232, 255, 0.92)', fontSize: 13, fontWeight: 600 }
      },
      series: [smallFence(), M.trackSeries(), bigPin(), M.vehSeries(t, 11)]
    }, false);
    document.getElementById('ovInfo').textContent = '万载县 · 县域全景视图';

    // ---------- 围栏细节放大 ----------
    mapDt.setOption({
      animation: false,
      title: { text: '', left: 12, top: 6 },
      tooltip: Object.assign({ trigger: 'item',
        formatter: function (p) {
          if (p.data && p.data.plate) return '<b>' + p.data.plate + '</b><br/>移动速度：' + p.data.spd.toFixed(1) + ' km/h<br/>围栏内停留：' + Math.round(p.data.stayMin) + ' min<br/>状态：' + (p.data.staying ? '<span style="color:#ff7875">滞留车辆</span>' : '正常') + '<br/>坐标：' + p.data.value[0].toFixed(4) + ', ' + p.data.value[1].toFixed(4);
          if (p.name === '目标仓储') return '<b>万载县烟花爆竹仓储中心 A 库</b><br/>库存 ' + Math.round(st.stock) + ' 吨 / 800 吨<br/>饱和度 ' + st.satPct.toFixed(1) + '%';
          return p.name || '';
        } }, M.tipBase),
      geo: {
        map: 'patent_county', roam: false, zoom: 11.0, aspectScale: 1.0,
        center: [M.WARE[0] - 0.0008, M.WARE[1] - 0.0006],
        left: 10, right: 10, top: 12, bottom: 10,
        itemStyle: {
          areaColor: 'rgba(13, 84, 152, 0.78)',
          borderColor: 'rgba(0, 226, 255, 0.85)', borderWidth: 2
        },
        emphasis: { disabled: true },
        label: { show: false }
      },
      series: [M.fenceSeries(), M.trackSeries(), M.wareSeries(st, 17), M.vehSeries(t, 18)]
    }, false);
    document.getElementById('dtInfo').textContent = '围栏内车辆 ' + st.inFence.length + ' 辆';

    document.getElementById('fenceCenter').textContent = M.WARE[0].toFixed(4) + ', ' + M.WARE[1].toFixed(4);
    document.getElementById('fenceCnt').textContent = st.inFence.length + ' 辆';
    document.getElementById('trackCnt').textContent = M.VEHICLES.filter(function (v) { return M.vehPos(v, t).phase !== 'before'; }).length + ' 车次';

    document.getElementById('trackTbody').innerHTML = st.rows.map(function (r) {
      var chip = r.phase === 'before' ? '<span class="chip gray">未进入</span>'
        : r.stay ? '<span class="chip bad">滞留中</span>'
        : (r.phase === 'park' ? '<span class="chip mid">停靠中</span>'
        : (r.phase === 'in' ? '<span class="chip ok">驶入中</span>' : '<span class="chip gray">已驶离</span>'));
      return '<tr class="' + (r.stay ? 'hit' : '') + '"><td>' + r.plate + '</td>' +
        '<td>' + (r.phase === 'before' ? '—' : 'T+' + r.inAt.toFixed(1) + '′') + '</td>' +
        '<td class="num">' + (r.phase === 'before' ? '—' : r.inFenceMin.toFixed(1) + ' min') + '</td>' +
        '<td class="num">' + r.spd.toFixed(1) + ' km/h</td>' +
        '<td>' + chip + '</td>' +
        '<td>' + r.pos[0].toFixed(4) + ', ' + r.pos[1].toFixed(4) + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="empty">围栏内暂无车辆</td></tr>';
  }