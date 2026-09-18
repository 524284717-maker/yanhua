/* ==========================================================================
 * s1.js —— 【S1】库存饱和度计算 · 页面渲染实现
 *
 * @层          页面层（pages）
 * @技术特征
 *   【特征 S6-4】本页面不直接计算任何指标，全部数值来自 renderPage(t, st) 传入的
 *                状态快照 st（由 page-shell 每帧调用一次 stateAt(t) 得到），
 *                因此页面之间、页面与数据模型之间不会出现数值不一致。
 * @说明
 *   由 tools/build-pages.py 从 tools/pages-src/s1.frag.js 自动包装生成，请勿直接修改本文件。
 * ========================================================================== */
(function (global) {
  'use strict';
  var M = global.PATENT;

  var gauge, satChart;
  var opRows = M.OP;
  function initPage() {
    gauge = echarts.init(document.getElementById('gaugeSat'));
    satChart = echarts.init(document.getElementById('satChart'));

    document.getElementById('opTbody').innerHTML = opRows.map(function (o, i) {
      var q = M.P.stock0;
      for (var k = 0; k < opRows.length && k <= i; k++) {
        q = opRows[k].act === 'in' ? q + opRows[k].qty : Math.max(0, q - opRows[k].qty);
      }
      return '<tr class="' + (o.phantom ? 'warn' : '') + '"><td>T+' + o.at.toFixed(1) + '′</td>' +
        '<td>' + (o.act === 'in' ? '<span class="chip ok">扫码入库</span>' : '<span class="chip mid">扫码出库</span>') + '</td>' +
        '<td>' + o.name + '</td>' +
        '<td class="num">' + (o.act === 'in' ? '+' : '−') + o.qty.toFixed(1) + '</td>' +
        '<td class="num">' + q.toFixed(1) + '</td>' +
        '<td>' + (o.phantom ? '<span class="chip bad">无对应驶离轨迹</span>' : '—') + '</td></tr>';
    }).join('');
  }
  function relayout() { if (gauge) gauge.resize(); if (satChart) satChart.resize(); }

  function renderPage(t, st) {
    var satPct = st.sat * 100;
    var over = st.sat >= M.P.fullRatio;
    document.getElementById('satTag').textContent = over ? '已超满载阈值 85%' : '未达满载阈值 85%';

    gauge.setOption({
      series: [{
        type: 'gauge', min: 0, max: 120, startAngle: 210, endAngle: -30,
        center: ['50%', '60%'], radius: '98%',
        progress: { show: true, width: 14,
          itemStyle: { color: over ? '#ff4d4f' : new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#0e6fb8' }, { offset: 1, color: '#00d4ff' }]) } },
        axisLine: { lineStyle: { width: 14, color: [[M.P.fullRatio * 100 / 120, 'rgba(255,255,255,0.10)'], [1, 'rgba(255,77,79,0.28)']] } },
        axisTick: { distance: -14, length: 5, lineStyle: { color: 'rgba(255,255,255,0.25)', width: 1 } },
        splitLine: { distance: -14, length: 12, lineStyle: { color: 'rgba(255,255,255,0.4)', width: 1.4 } },
        axisLabel: { distance: -4, color: '#7f9ab3', fontSize: 10, formatter: function (v) { return v % 30 === 0 ? v : ''; } },
        pointer: { width: 4, length: '62%', itemStyle: { color: over ? '#ff6b6d' : '#00d4ff' } },
        anchor: { show: true, size: 10, itemStyle: { color: over ? '#ff6b6d' : '#00d4ff' } },
        title: { show: true, offsetCenter: [0, '40%'], color: '#8aa4bf', fontSize: 11 },
        detail: { valueAnimation: false, offsetCenter: [0, '6%'], formatter: function (v) { return v.toFixed(1) + '%'; },
          color: over ? '#ff6b6d' : '#e0f7ff', fontSize: 27, fontWeight: 700, fontFamily: '"DIN Alternate","Arial Black",sans-serif' },
        data: [{ value: satPct, name: '库存饱和度 S(t)' }]
      }]
    }, true);

    document.getElementById('kvStock').className = 'kv' + (over ? ' hot' : '');
    document.getElementById('kvStock').querySelector('.v').innerHTML = Math.round(st.stock) + '<small>吨</small>';
    document.getElementById('kvSat').className = 'kv' + (over ? ' hot' : '');
    document.getElementById('kvSat').querySelector('.v').innerHTML = satPct.toFixed(1) + '<small>%</small>';
    document.getElementById('peakTag').textContent = '历史峰值 ' + st.peakS4Pct.toFixed(1) + '%';

    // 饱和度演进曲线
    var xs = [], ys = [];
    for (var tt = 0; tt <= M.TL.end + 1e-9; tt += 0.5) {
      xs.push(tt.toFixed(1)); ys.push(+(M.satAt(tt) * 100).toFixed(2));
    }
    satChart.setOption({
      grid: { left: 42, right: 16, top: 24, bottom: 26 },
      tooltip: Object.assign({ trigger: 'axis', formatter: function (p) { return 'T+' + p[0].axisValue + '′<br/>饱和度 <b>' + p[0].data + '%</b>'; } }, M.tipBase),
      xAxis: { type: 'category', data: xs, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
        axisLabel: { color: '#7f9ab3', fontSize: 10, interval: 19 }, axisTick: { show: false } },
      yAxis: { type: 'value', min: 50, max: 95, axisLabel: { color: '#7f9ab3', fontSize: 10, formatter: '{value}%' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.07)' } } },
      series: [{
        type: 'line', data: ys, smooth: true, symbol: 'none',
        lineStyle: { width: 2.4, color: '#00d4ff' },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(0,212,255,0.42)' }, { offset: 1, color: 'rgba(0,212,255,0.02)' }]) },
        markLine: {
          silent: true, symbol: 'none',
          data: [
            { yAxis: 85, lineStyle: { color: '#ff4d4f', type: 'dashed', width: 1.6 }, label: { formatter: '满载阈值 85%', color: '#ff9d9f', fontSize: 10.5, position: 'insideEndTop' } },
            { xAxis: Math.round(t / 0.5), lineStyle: { color: '#ffd23f', width: 1.6 }, label: { formatter: 'T+' + t.toFixed(1) + '′', color: '#ffe08a', fontSize: 10.5 } }
          ]
        }
      }]
    }, true);

    document.getElementById('scanSum').textContent = '入库 ' + st.scanCount.in + ' · 出库 ' + st.scanCount.out;
    document.getElementById('scanIn').textContent = st.scanCount.in;
    document.getElementById('scanOut').textContent = st.scanCount.out;
    document.getElementById('scanTotal').textContent = st.scanCount.in + st.scanCount.out;
    document.getElementById('scanList').innerHTML = st.scans.map(function (s) {
      return '<div class="scan-item ' + s.act + '"><span class="t">T+' + s.at.toFixed(1) + '′</span>' +
        '<span class="c">' + (s.act === 'in' ? '扫码入库' : '扫码出库') + ' · ' + s.name +
        (s.phantom ? ' <span class="chip bad">无驶离</span>' : '') + '</span>' +
        '<span class="q">' + (s.act === 'in' ? '+' : '−') + s.qty.toFixed(1) + '</span></div>';
    }).join('') || '<div class="empty">暂无扫码记录</div>';
  }
  global.FWXPage = {
    no: 1,
    initPage: initPage,
    relayout: relayout,
    renderPage: renderPage
  };
})(window);
