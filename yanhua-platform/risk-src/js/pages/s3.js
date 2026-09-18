/* ==========================================================================
 * s3.js —— 【S3】滞留车辆筛选与滞留指数 · 页面渲染实现
 *
 * @层          页面层（pages）
 * @技术特征
 *   【特征 S6-4】本页面不直接计算任何指标，全部数值来自 renderPage(t, st) 传入的
 *                状态快照 st（由 page-shell 每帧调用一次 stateAt(t) 得到），
 *                因此页面之间、页面与数据模型之间不会出现数值不一致。
 * @说明
 *   由 tools/build-pages.py 从 tools/pages-src/s3.frag.js 自动包装生成，请勿直接修改本文件。
 * ========================================================================== */
(function (global) {
  'use strict';
  var M = global.PATENT;

  var mapS3, idxChart;
  function initPage() {
    mapS3 = echarts.init(document.getElementById('mapStag'));
    idxChart = echarts.init(document.getElementById('idxChart'));
  }
  function relayout() { if (mapS3) mapS3.resize(); if (idxChart) idxChart.resize(); }

  function renderPage(t, st) {
    mapS3.setOption({
      animation: false,
      tooltip: Object.assign({ trigger: 'item',
        formatter: function (p) {
          if (p.data && p.data.plate) return '<b>' + p.data.plate + '</b><br/>移动速度：' + p.data.spd.toFixed(1) + ' km/h<br/>围栏内停留：' + Math.round(p.data.stayMin) + ' min<br/>判定：' + (p.data.staying ? '<span style="color:#ff7875">滞留车辆</span>' : '正常');
          if (p.name === '目标仓储') return '<b>万载县烟花爆竹仓储中心 A 库</b><br/>库存 ' + Math.round(st.stock) + ' 吨';
          return p.name || '';
        } }, M.tipBase),
      geo: {
        map: 'patent_county', roam: false, zoom: 11.0, aspectScale: 1.0,
        center: [M.WARE[0] - 0.0008, M.WARE[1] - 0.0006],
        left: 10, right: 10, top: 12, bottom: 10,
        itemStyle: { areaColor: 'rgba(13, 84, 152, 0.78)', borderColor: 'rgba(0, 226, 255, 0.85)', borderWidth: 2 },
        emphasis: { disabled: true }, label: { show: false }
      },
      series: [M.fenceSeries(), M.trackSeries(), M.wareSeries(st, 17), M.vehSeries(t, 18)]
    }, false);

    document.getElementById('inFenceTag').textContent = '围栏内车辆 ' + st.inFence.length + ' 辆';
    document.getElementById('stayTag').textContent = '滞留车辆集合 ' + st.stayCount + ' 辆 · 异常滞留指数 ' + st.index.toFixed(2);
    document.getElementById('kvIdx').className = 'kv' + (st.index >= M.P.stayThreshold ? ' hot' : '');
    document.getElementById('kvIdx').querySelector('.v').innerHTML = st.index.toFixed(2);

    document.getElementById('stayTbody').innerHTML = st.rows.map(function (r) {
      var chip = r.phase === 'before' ? '<span class="chip gray">未进入</span>'
        : r.stay ? '<span class="chip bad">滞留车辆</span>'
        : (r.phase === 'park' ? '<span class="chip mid">停靠中</span>' : '<span class="chip gray">正常行驶</span>');
      return '<tr class="' + (r.stay ? 'hit' : '') + '"><td>' + r.plate + '</td>' +
        '<td>T+' + r.inAt.toFixed(1) + '′</td>' +
        '<td class="num">' + r.inFenceMin.toFixed(1) + ' min</td>' +
        '<td class="num">' + r.spd.toFixed(1) + ' km/h</td>' +
        '<td>' + chip + '</td>' +
        '<td class="num">' + r.weight.toFixed(3) + '</td>' +
        '<td>' + r.bill + '</td></tr>';
    }).join('') || '<tr><td colspan="7" class="empty">围栏内暂无车辆</td></tr>';

    var xs = [], ys = [];
    for (var tt = 0; tt <= M.TL.end + 1e-9; tt += 0.5) {
      xs.push(tt.toFixed(1)); ys.push(+M.stagnationAt(tt).index.toFixed(3));
    }
    idxChart.setOption({
      grid: { left: 40, right: 16, top: 18, bottom: 24 },
      tooltip: Object.assign({ trigger: 'axis', formatter: function (p) { return 'T+' + p[0].axisValue + '′<br/>异常滞留指数 <b>' + p[0].data + '</b>'; } }, M.tipBase),
      xAxis: { type: 'category', data: xs, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
        axisLabel: { color: '#7f9ab3', fontSize: 10, interval: 19 }, axisTick: { show: false } },
      yAxis: { type: 'value', min: 0, max: 1, axisLabel: { color: '#7f9ab3', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.07)' } } },
      series: [{
        type: 'line', data: ys, smooth: true, symbol: 'none',
        lineStyle: { width: 2.4, color: '#ff9f2e' },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(255,159,46,0.4)' }, { offset: 1, color: 'rgba(255,159,46,0.02)' }]) },
        markLine: {
          silent: true, symbol: 'none',
          data: [
            { yAxis: 0.60, lineStyle: { color: '#ff4d4f', type: 'dashed', width: 1.6 }, label: { formatter: '滞留报警阈值 0.60', color: '#ff9d9f', fontSize: 10.5, position: 'insideEndTop' } },
            { xAxis: Math.round(t / 0.5), lineStyle: { color: '#ffd23f', width: 1.6 }, label: { formatter: 'T+' + t.toFixed(1) + '′', color: '#ffe08a', fontSize: 10.5 } }
          ]
        }
      }]
    }, true);
    document.getElementById('idxPeak').textContent = '窗口内峰值 ' + (M.DERIVED.peakIdx).toFixed(2);
  }
  global.FWXPage = {
    no: 3,
    initPage: initPage,
    relayout: relayout,
    renderPage: renderPage
  };
})(window);
